// Checks that every language has the same strings and content entries, and that
// the string keys used in js/app.js exist. Run: node tools/check-locales.mjs
import fs from "node:fs";
import vm from "node:vm";
const ctx = {window:{}}; ctx.window.window = ctx.window; vm.createContext(ctx);
const run = f => vm.runInContext(fs.readFileSync(f, "utf8").replace(/^window\.BOL = window\.BOL \|\| \{\};/m, "var BOL = window.BOL = window.BOL || {};"), ctx);
run("data/places.js"); run("data/itineraries.js");
const langs = ["fr", "en", "es"];
for (const l of langs){ run(`locales/${l}.js`); run(`locales/${l}.content.js`); }
const B = ctx.window.BOL, L = B.locales;
let problems = 0;
const report = (msg) => { problems++; console.log(msg); };
const ref = L.en;
for (const l of langs){
  for (const section of ["ui", "places", "edges", "dishes", "climates", "tour"]){
    const a = Object.keys(ref[section] || {}), b = Object.keys(L[l][section] || {});
    a.filter(k => !b.includes(k)).forEach(k => report(`${l}: missing ${section}.${k}`));
    b.filter(k => !a.includes(k)).forEach(k => report(`${l}: extra ${section}.${k}`));
  }
  for (const p of B.places){ const c = L[l].places[p.id]; if (!c) continue;
    for (const f of ["name", "label", "short", "story", "todo", "tips"]) if (!c[f] || !c[f].length) report(`${l}: ${p.id}.${f} empty`);
    if (c.todo.length !== ref.places[p.id].todo.length) report(`${l}: ${p.id}.todo has ${c.todo.length} items, en has ${ref.places[p.id].todo.length}`);
  }
}
const src = fs.readFileSync("js/app.js", "utf8");
const used = new Set([...src.matchAll(/\bt\(\s*"([\w.]+)"/g)].map(m => m[1]));
for (const m of src.matchAll(/"((?:wx\.[dnr]|pack|trip|toast|map|cat|catDesc|region|regionDesc|mode|modeShort|geo|tips|idea|filter|show)[\w.]*)"/g)) if (m[1].split(".").length > 1 || m[1].startsWith("show")) used.add(m[1]);
for (const k of used) if (!k.endsWith(".") && !(k in ref.ui)) report(`app.js uses unknown string ${k}`);
console.log(problems ? `${problems} problem(s)` : "All locales complete.");
process.exit(problems ? 1 : 0);
