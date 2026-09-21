"""Pruebas de la bitácora. Ejecutar: python3 -m unittest discover -s factory/tests"""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "factory"))

import bitacora as bit  # noqa: E402


class TestBitacora(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self._orig = bit.DIARY
        bit.DIARY = Path(self.tmp.name)

    def tearDown(self):
        bit.DIARY = self._orig
        self.tmp.cleanup()

    def when(self, day, hour=10):
        return datetime(2026, 9, day, hour, 0, tzinfo=timezone.utc)

    def contenido(self, mes="2026-09"):
        return (bit.DIARY / f"{mes}.md").read_text(encoding="utf-8")

    def test_crea_fichero_del_mes_con_cabecera(self):
        bit.add_entry("primera", "nota", when=self.when(21))
        self.assertIn("# Bitácora 2026-09", self.contenido())
        self.assertIn("primera", self.contenido())

    def test_no_duplica_la_misma_marca(self):
        self.assertTrue(bit.add_entry("x", "commit", mark="git:abc", when=self.when(21)))
        self.assertFalse(bit.add_entry("x", "commit", mark="git:abc", when=self.when(21)))
        self.assertEqual(self.contenido().count("git:abc"), 1)

    def test_entrada_sin_marca_siempre_se_añade(self):
        bit.add_entry("nota suelta", "nota", when=self.when(21))
        bit.add_entry("nota suelta", "nota", when=self.when(21))
        self.assertEqual(self.contenido().count("nota suelta"), 2)

    def test_ordena_por_fecha_aunque_se_añada_desordenado(self):
        bit.add_entry("tercera", "nota", when=self.when(23))
        bit.add_entry("primera", "nota", when=self.when(21))
        bit.add_entry("segunda", "nota", when=self.when(22))
        cuerpo = self.contenido()
        self.assertLess(cuerpo.index("primera"), cuerpo.index("segunda"))
        self.assertLess(cuerpo.index("segunda"), cuerpo.index("tercera"))

    def test_separa_por_mes(self):
        bit.add_entry("de septiembre", "nota", when=self.when(21))
        bit.add_entry("de octubre", "nota", when=datetime(2026, 10, 1, tzinfo=timezone.utc))
        self.assertIn("de septiembre", self.contenido("2026-09"))
        self.assertIn("de octubre", self.contenido("2026-10"))

    def test_marcas_se_buscan_en_todos_los_meses(self):
        bit.add_entry("x", "commit", mark="git:zzz", when=self.when(21))
        self.assertFalse(bit.add_entry("x", "commit", mark="git:zzz",
                                       when=datetime(2026, 10, 1, tzinfo=timezone.utc)))

    def test_incluye_tipo_y_referencias(self):
        bit.add_entry("algo", "decision", refs=["ADR-0002", "PR#2"], when=self.when(21))
        linea = self.contenido()
        self.assertIn("Decisión", linea)
        self.assertIn("(ADR-0002, PR#2)", linea)


if __name__ == "__main__":
    unittest.main()
