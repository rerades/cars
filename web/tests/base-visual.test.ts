import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test } from "node:test";

// Story #1033: visual base ("Dirección visual" of docs/design/tokens.md).
const WEB = resolve(import.meta.dirname, "..");
const css = readFileSync(join(WEB, "src/styles/global.css"), "utf8");

/** Value of a custom property inside the first block that declares it, or inside the given block. */
function token(name: string, source = css): string {
  const m = source.match(new RegExp(`${name}:\\s*([^;]+);`));
  assert.ok(m, `${name} is missing`);
  return m[1].trim();
}

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  assert.ok(start >= 0, `${selector} is missing`);
  return css.slice(start, css.indexOf("}", start));
}

// CA 1: values of tokens.md.
test("@theme carries the tokens of Dirección visual with their values", () => {
  const theme = block("@theme static");
  const expected: Record<string, string> = {
    "--color-ink-950": "#0b1217",
    "--color-ink-900": "#0b1217",
    "--color-ink-600": "#4a5660",
    "--color-surface": "#ffffff",
    "--color-surface-muted": "#eef1ee",
    "--color-line-soft": "#cdd4d0",
    "--color-brand-600": "#0a5c6e",
    "--color-brand-800": "#07414e",
    "--color-on-dark": "#ffffff",
    "--color-on-dark-muted": "#b9c4ca",
    "--color-signal": "#c6f24e",
    "--color-soon-bg": "#c6f24e",
    "--color-soon-fg": "#0b1217",
    "--font-sans": '"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    "--font-stretch-wide": "125%",
    "--font-stretch-narrow": "62%",
    "--text-display": "clamp(2.75rem, 8vw, 6.5rem)",
    "--text-screen": "clamp(2.25rem, 5vw, 4.25rem)",
    "--text-block": "clamp(2rem, 4.4vw, 3.5rem)",
    "--text-version": "clamp(1.25rem, 2vw, 1.75rem)",
    "--text-figure-xl": "clamp(3.75rem, 8vw, 7rem)",
    "--text-figure-l": "clamp(3.25rem, 5.6vw, 5.25rem)",
    "--text-figure-m": "clamp(2.75rem, 4.4vw, 4rem)",
    "--radius-pill": "999px",
    "--menu-clearance": "6rem",
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(token(name, theme), value, name);
});

test("tokens that Dirección visual does not mention keep their value", () => {
  const theme = block("@theme static");
  const kept: Record<string, string> = {
    "--color-line": "#6b7280",
    "--color-on-brand": "#ffffff",
    "--color-deal-bg": "#fef3c7",
    "--color-deal-fg": "#78350f",
    "--color-discontinued-bg": "#e5e7eb",
    "--color-discontinued-fg": "#374151",
    "--spacing-touch": "2.75rem",
    "--radius-card": "0.5rem",
  };
  for (const [name, value] of Object.entries(kept)) assert.equal(token(name, theme), value, name);
});

// CA 2: font from the site itself.
test("Archivo is declared as a variable font and its file and license are in web/", () => {
  const face = block("@font-face");
  assert.match(face, /font-family:\s*"Archivo"/);
  assert.match(face, /url\("\.\.\/assets\/fonts\/archivo\.woff2"\)/);
  assert.match(face, /font-weight:\s*100 900/);
  assert.match(face, /font-stretch:\s*62% 125%/);
  assert.match(face, /font-display:\s*swap/);
  assert.ok(existsSync(join(WEB, "src/assets/fonts/archivo.woff2")));
  assert.match(readFileSync(join(WEB, "src/assets/fonts/archivo.LICENSE"), "utf8"), /SIL Open Font License/);
});

// CA 3: dark band reassigns tokens.
test(".band-dark reassigns the five tokens of tokens.md; light and white bands exist", () => {
  const dark = block(".band-dark");
  assert.equal(token("--color-ink-900", dark), "var(--color-on-dark)");
  assert.equal(token("--color-ink-600", dark), "var(--color-on-dark-muted)");
  assert.equal(token("--color-brand-600", dark), "var(--color-on-dark)");
  assert.equal(token("--color-brand-800", dark), "var(--color-signal)");
  assert.equal(token("--color-line-soft", dark), "#33404a");
  assert.match(dark, /background:\s*var\(--color-ink-950\)/);
  assert.match(block(".band-light"), /background:\s*var\(--color-surface-muted\)/);
  assert.match(block(".band-white"), /background:\s*var\(--color-surface\)/);
});

// CA 4: contrast table, WCAG 2.1 computed by code instead of by hand (pending 1 of tokens.md).
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("contrast pairs of the table meet their threshold, with the documented ratio", () => {
  const theme = block("@theme static");
  const c = (n: string) => token(`--color-${n}`, theme);
  // [foreground, background, documented ratio, threshold]
  const pairs: [string, string, number, number][] = [
    ["on-dark", "ink-950", 18.86, 4.5],
    ["on-dark-muted", "ink-950", 10.61, 4.5],
    ["ink-950", "signal", 14.56, 4.5],
    ["signal", "ink-950", 14.56, 4.5],
    ["ink-900", "surface", 18.86, 4.5],
    ["ink-900", "surface-muted", 16.57, 4.5],
    ["ink-600", "surface", 7.53, 4.5],
    ["ink-600", "surface-muted", 6.61, 4.5],
    ["brand-600", "surface", 7.59, 4.5],
    ["brand-600", "surface-muted", 6.67, 4.5],
    ["brand-800", "surface", 11.19, 4.5],
    ["deal-fg", "deal-bg", 8.15, 4.5],
    ["on-dark", "ink-950", 18.86, 3],
    ["on-dark", "ink-900", 18.86, 4.5],
    ["on-brand", "brand-600", 7.59, 4.5],
    ["line", "surface-muted", 4.24, 3],
  ];
  for (const [fg, bg, documented, threshold] of pairs) {
    const got = ratio(c(fg), c(bg));
    assert.ok(got >= threshold, `${fg} on ${bg}: ${got.toFixed(2)} < ${threshold}`);
    assert.ok(Math.abs(got - documented) < 0.02, `${fg} on ${bg}: ${got.toFixed(2)} differs from documented ${documented}`);
  }
  // The documented failure: a link colour alone does not distinguish itself from text, so links stay underlined.
  assert.ok(ratio(c("brand-600"), c("ink-900")) < 3);
  // The dark band's hairline is decorative only; no ratio is required.
  assert.ok(ratio("#33404a", c("ink-950")) < 3);
});

// CA 2: nothing is requested from third parties in the built site.
test("the built site serves the font itself and requests nothing from third parties", () => {
  const out = mkdtempSync(join(tmpdir(), "cars-base-"));
  execFileSync("pnpm", ["exec", "astro", "build", "--outDir", out], { cwd: WEB, stdio: "pipe" });
  const files = readdirSync(out, { recursive: true, encoding: "utf8" });
  assert.ok(files.some((f) => /\.woff2$/.test(f)), "no woff2 in the built site");
  const styles = files.filter((f) => f.endsWith(".css")).map((f) => readFileSync(join(out, f), "utf8")).join("\n");
  assert.match(styles, /@font-face/);
  assert.match(styles, /\.band-dark/);
  assert.doesNotMatch(styles, /url\(\s*["']?(https?:)?\/\//, "a stylesheet loads something from another origin");
  for (const f of files.filter((f) => f.endsWith(".html"))) {
    const html = readFileSync(join(out, f), "utf8");
    // A canonical link is not a request, so only things the browser fetches count.
    assert.doesNotMatch(html, /<(script|img|source|iframe)\b[^>]*\ssrc="(https?:)?\/\//, `${f} loads a third-party resource`);
    assert.doesNotMatch(html, /<link\b[^>]*rel="(stylesheet|preload|preconnect|dns-prefetch)"[^>]*href="(https?:)?\/\//, `${f} links a third-party resource`);
  }
});
