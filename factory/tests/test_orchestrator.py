"""Pruebas del orquestador y del hook guardián. Ejecutar: python3 -m unittest discover factory/tests"""
import json
import os
import subprocess
import sys
import unittest
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "factory"))

import orchestrator as orq  # noqa: E402

TZ = ZoneInfo("Europe/Madrid")


def cfg(**over):
    base = {
        "billing": {"mode": "subscription"},
        "global": {
            "max_concurrent_runs": 1, "max_runs_per_day": 6,
            "allowed_hours": "01:00-07:00", "timezone": "Europe/Madrid",
            "default_model": "sonnet", "period": "monthly",
            "max_usd_per_period": 20, "stop_file": "factory/STOP",
        },
        "agents": {
            "researcher": {
                "max_runs_per_day": 2, "max_usd_per_period": 10,
                "max_usd_per_run": 1.0, "max_turns_per_run": 25,
                "write_paths": ["data/"],
            }
        },
    }
    base["global"].update(over.pop("global", {}))
    base["agents"]["researcher"].update(over.pop("agents", {}))
    return base


def row(agent="researcher", day="2026-09-21", cost=0.5):
    return {"agent": agent, "started": f"{day}T02:00:00+02:00", "cost_usd": cost}


class TestVentanaHoraria(unittest.TestCase):
    def test_dentro_de_ventana_nocturna(self):
        self.assertTrue(orq.in_window(datetime(2026, 9, 21, 2, 30, tzinfo=TZ), "01:00-07:00"))

    def test_fuera_de_ventana(self):
        self.assertFalse(orq.in_window(datetime(2026, 9, 21, 10, 0, tzinfo=TZ), "01:00-07:00"))

    def test_limites_de_la_ventana(self):
        self.assertTrue(orq.in_window(datetime(2026, 9, 21, 1, 0, tzinfo=TZ), "01:00-07:00"))
        self.assertFalse(orq.in_window(datetime(2026, 9, 21, 7, 0, tzinfo=TZ), "01:00-07:00"))

    def test_ventana_que_cruza_medianoche(self):
        self.assertTrue(orq.in_window(datetime(2026, 9, 21, 23, 30, tzinfo=TZ), "22:00-06:00"))
        self.assertTrue(orq.in_window(datetime(2026, 9, 21, 5, 0, tzinfo=TZ), "22:00-06:00"))
        self.assertFalse(orq.in_window(datetime(2026, 9, 21, 12, 0, tzinfo=TZ), "22:00-06:00"))

    def test_sin_ventana_siempre_permitido(self):
        self.assertTrue(orq.in_window(datetime(2026, 9, 21, 12, 0, tzinfo=TZ), None))


class TestLedger(unittest.TestCase):
    def test_cuenta_ejecuciones_del_dia(self):
        rows = [row(day="2026-09-21"), row(day="2026-09-21"), row(day="2026-09-20")]
        self.assertEqual(orq.runs_today(rows, datetime(2026, 9, 21).date()), 2)

    def test_cuenta_por_agente(self):
        rows = [row(), row(agent="developer")]
        self.assertEqual(orq.runs_today(rows, datetime(2026, 9, 21).date(), "researcher"), 1)

    def test_suma_gasto(self):
        self.assertEqual(orq.spent_in_period([row(cost=0.5), row(cost=0.25)]), 0.75)

    def test_linea_corrupta_no_rompe(self):
        path = orq.LEDGER_DIR / "2026-01.jsonl"
        orq.LEDGER_DIR.mkdir(parents=True, exist_ok=True)
        path.write_text('{"agent":"x","cost_usd":1}\nno-es-json\n', encoding="utf-8")
        try:
            self.assertEqual(len(orq.read_ledger(datetime(2026, 1, 5))), 1)
        finally:
            path.unlink()


class TestGuardas(unittest.TestCase):
    NOCHE = datetime(2026, 9, 21, 2, 0, tzinfo=TZ)

    def test_permite_en_condiciones_normales(self):
        self.assertTrue(orq.check_can_run(cfg(), "researcher", self.NOCHE, []).allowed)

    def test_bloquea_fuera_de_horario(self):
        d = orq.check_can_run(cfg(), "researcher", datetime(2026, 9, 21, 12, 0, tzinfo=TZ), [])
        self.assertFalse(d.allowed)
        self.assertIn("horario", d.reason)

    def test_ignore_window(self):
        d = orq.check_can_run(cfg(), "researcher", datetime(2026, 9, 21, 12, 0, tzinfo=TZ), [],
                              ignore_window=True)
        self.assertTrue(d.allowed)

    def test_bloquea_por_limite_diario_del_agente(self):
        rows = [row(), row()]
        d = orq.check_can_run(cfg(), "researcher", self.NOCHE, rows)
        self.assertFalse(d.allowed)
        self.assertIn("límite diario de researcher", d.reason)

    def test_bloquea_por_limite_diario_global(self):
        rows = [row(agent=f"a{i}", cost=0) for i in range(6)]
        c = cfg(agents={"max_runs_per_day": 99})
        d = orq.check_can_run(c, "researcher", self.NOCHE, rows)
        self.assertFalse(d.allowed)
        self.assertIn("global", d.reason)

    def test_bloquea_por_presupuesto_del_agente(self):
        rows = [row(day="2026-09-01", cost=10.0)]
        d = orq.check_can_run(cfg(), "researcher", self.NOCHE, rows)
        self.assertFalse(d.allowed)
        self.assertIn("presupuesto de researcher", d.reason)

    def test_bloquea_sin_presupuesto_asignado(self):
        c = cfg(); c["agents"]["researcher"]["max_usd_per_period"] = None
        self.assertFalse(orq.check_can_run(c, "researcher", self.NOCHE, []).allowed)

    def test_bloquea_con_stop_file(self):
        stop = orq.REPO / "factory" / "STOP"
        stop.write_text("test", encoding="utf-8")
        try:
            d = orq.check_can_run(cfg(), "researcher", self.NOCHE, [])
            self.assertFalse(d.allowed)
            self.assertIn("parada", d.reason)
        finally:
            stop.unlink()

    def test_bloquea_con_ejecucion_en_curso(self):
        orq.LOCK.write_text("test", encoding="utf-8")
        try:
            d = orq.check_can_run(cfg(), "researcher", self.NOCHE, [])
            self.assertFalse(d.allowed)
            self.assertIn("en curso", d.reason)
        finally:
            orq.LOCK.unlink()

    def test_agente_desconocido(self):
        with self.assertRaises(KeyError):
            orq.check_can_run(cfg(), "fantasma", self.NOCHE, [])


class TestComando(unittest.TestCase):
    def test_incluye_limites(self):
        cmd = orq.build_command(cfg(), "researcher", "tarea")
        self.assertIn("--max-turns", cmd)
        self.assertEqual(cmd[cmd.index("--max-turns") + 1], "25")
        self.assertEqual(cmd[cmd.index("--max-budget-usd") + 1], "1.00")
        self.assertEqual(cmd[cmd.index("--agent") + 1], "researcher")
        self.assertEqual(cmd[cmd.index("--model") + 1], "sonnet")

    def test_clasifica_resultados(self):
        self.assertEqual(orq.classify(0, {"is_error": False}, ""), "success")
        self.assertEqual(orq.classify(1, {"is_error": True}, ""), "failed")
        self.assertEqual(orq.classify(1, {}, "Claude usage limit reached"), "rate_limited")
        self.assertEqual(orq.classify(1, {"result": "Budget limit reached"}, ""), "budget_exceeded")


class TestHookGuardian(unittest.TestCase):
    HOOK = REPO / ".claude" / "hooks" / "guard_paths.py"

    def run_hook(self, event, agent="researcher", paths=("data/",)):
        env = dict(os.environ, FACTORY_AGENT=agent, FACTORY_REPO=str(REPO),
                   FACTORY_WRITE_PATHS=json.dumps(list(paths)))
        return subprocess.run([sys.executable, str(self.HOOK)], input=json.dumps(event),
                              capture_output=True, text=True, env=env)

    def test_permite_escritura_en_ruta_propia(self):
        r = self.run_hook({"tool_name": "Write", "tool_input": {"file_path": "data/raw/tesla/model-3.yaml"}})
        self.assertEqual(r.returncode, 0)

    def test_bloquea_escritura_fuera_de_su_ruta(self):
        r = self.run_hook({"tool_name": "Write", "tool_input": {"file_path": "src/app.tsx"}})
        self.assertEqual(r.returncode, 2)
        self.assertIn("solo puede escribir", r.stderr)

    def test_bloquea_ruta_protegida(self):
        r = self.run_hook({"tool_name": "Edit", "tool_input": {"file_path": "factory/budgets.yaml"}},
                          paths=("data/", "factory/"))
        self.assertEqual(r.returncode, 2)
        self.assertIn("protegida", r.stderr)

    def test_bloquea_fuera_del_repositorio(self):
        r = self.run_hook({"tool_name": "Write", "tool_input": {"file_path": "/etc/passwd"}})
        self.assertEqual(r.returncode, 2)

    def test_bloquea_git_push(self):
        r = self.run_hook({"tool_name": "Bash", "tool_input": {"command": "git push origin main"}})
        self.assertEqual(r.returncode, 2)

    def test_bloquea_acceso_a_secretos(self):
        r = self.run_hook({"tool_name": "Bash", "tool_input": {"command": "cat .secrets/gh_token"}})
        self.assertEqual(r.returncode, 2)

    def test_permite_bash_normal(self):
        r = self.run_hook({"tool_name": "Bash", "tool_input": {"command": "ls data/"}})
        self.assertEqual(r.returncode, 0)

    def test_no_aplica_en_uso_interactivo(self):
        env = {k: v for k, v in os.environ.items() if not k.startswith("FACTORY_")}
        r = subprocess.run([sys.executable, str(self.HOOK)],
                           input=json.dumps({"tool_name": "Write", "tool_input": {"file_path": "/etc/passwd"}}),
                           capture_output=True, text=True, env=env)
        self.assertEqual(r.returncode, 0)


if __name__ == "__main__":
    unittest.main()
