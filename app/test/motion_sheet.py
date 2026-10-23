"""Planche contact des animations : chaque mouvement à ses positions clés (contrôle visuel)."""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright
HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE.parent / "src"
OUT = HERE.parent / "shots" / "motion"
OUT.mkdir(parents=True, exist_ok=True)
CSS = """
body{margin:0;background:#0d0d0c;color:#f2eee6;font:12px system-ui}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;padding:8px}
.cell{background:#161513;border:1px solid #2e2b26;border-radius:8px;padding:4px}
.cell b{display:block;font-size:11px;margin:2px 4px}
.row{display:grid;grid-template-columns:repeat(4,1fr);gap:2px}
.mv-svg{width:100%;height:auto;display:block;background:#11100e;border-radius:4px}
.mv-limb{stroke:#d4ad3f;stroke-linecap:round;fill:none}
.mv-far .mv-limb{stroke:#8a7230}
.mv-head{fill:#d4ad3f}.mv-hand{fill:#d4ad3f}.mv-far .mv-hand{fill:#8a7230}
.mv-torso{fill:#d4ad3f;stroke:#d4ad3f;stroke-width:.05;stroke-linejoin:round}
.mv-ground{stroke:#3a362f;stroke-width:.02}
.mv-prop{fill:#2a2722;stroke:#4a443a;stroke-width:.012}
.mv-mat{fill:#26231e}
.mv-plate{fill:#1f1d1a;stroke:#a49d8f;stroke-width:.03}
.mv-eqf{fill:#a49d8f}.mv-eq{stroke:#a49d8f;fill:none}
.mv-band{stroke:#5fc08a;stroke-width:.018;stroke-dasharray:.04 .03}
.mv-trail{stroke:#d4ad3f;stroke-width:.012;stroke-dasharray:.03 .03;fill:none;opacity:.6}
.mv-wheel{fill:none;stroke:#4a443a;stroke-width:.02}
"""
async def run(ids_filter=None, name="sheet"):
    files = [SRC / "14_motion.js", SRC / "15_moves.js"]
    js = "\n".join(f.read_text() for f in files)
    vend = HERE / "vendor"
    page = f"""<!doctype html><html><head><meta charset=utf-8><style>{CSS}</style>
<script src="file://{vend}/react.development.js"></script><script src="file://{vend}/react-dom.development.js"></script><script src="file://{vend}/htm.umd.js"></script></head><body><div id=r></div>
<script>
const {{ useState, useEffect, useMemo, useRef, useCallback, Fragment }} = React;
const _html = htm.bind(React.createElement);
const html = (s, ...v) => {{ const r = _html(s, ...v); return Array.isArray(r) ? React.createElement(Fragment, null, ...r) : r; }};
window.__errs = []; window.onerror = (m) => {{ window.__errs.push(String(m)); }};
</script><script>
{js}
</script><script>
if (typeof motionFor !== "function") window.motionFor = (id) => mvPrep(MOVES[id]);
const FILTER = {repr(ids_filter or [])};
function Sheet() {{
  const ids = Object.keys(MOVES).filter((k) => !FILTER.length || FILTER.includes(k));
  return html`<div className="grid">${{ids.map((id) => {{
    let M; try {{ M = mvPrep(MOVES[id]); }} catch (e) {{ window.__errs.push(id + ": " + e); return null; }}
    const ts = []; let acc = 0; M.keysFull.forEach((k) => {{ acc += k.d; ts.push(acc - 0.001); }});
    const pick = ts.length > 4 ? [ts[0], ts[Math.floor(ts.length / 3)], ts[Math.floor(2 * ts.length / 3)], ts[ts.length - 2]] : ts;
    return html`<div className="cell" key=${{id}}><b>${{id}} · ${{M.n || ""}}</b><div className="row">${{pick.map((t, i) => html`<${{MoveFigure}} key=${{i}} M=${{M}} time=${{t}} trail=${{M.trail ? mvTrail(M, M.trail) : null}} />`)}}</div></div>`;
  }})}}</div>`;
}}
try {{ ReactDOM.createRoot(document.getElementById("r")).render(html`<${{Sheet}} />`); }} catch (e) {{ window.__errs.push(String(e)); }}
</script></body></html>"""
    (HERE / "_motion.html").write_text(page)
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width": 1800, "height": 1000})
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await pg.goto("file://" + str(HERE / "_motion.html")); await pg.wait_for_timeout(1200)
        errs += await pg.evaluate("window.__errs")
        await pg.screenshot(path=str(OUT / (name + ".png")), full_page=True)
        n = await pg.evaluate("document.querySelectorAll('.cell').length")
        await b.close()
    print(n, "mouvements", "erreurs:", errs[:8])
if __name__ == "__main__":
    asyncio.run(run(sys.argv[2:] if len(sys.argv) > 2 else None, sys.argv[1] if len(sys.argv) > 1 else "sheet"))
