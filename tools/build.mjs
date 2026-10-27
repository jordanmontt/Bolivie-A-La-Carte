// Builds the files the site loads (data/*.js, locales/*.js) from the editable files in content/,
// and the plain pages for search engines (<lang>/…, sitemap.xml, robots.txt; see tools/pages.mjs).
//   node tools/build.mjs            check everything, then write the files
//   node tools/build.mjs --check    only check, write nothing
//   node tools/build.mjs --out DIR  write into DIR instead (used to compare builds)
// Every text and fact lives once in content/; this script also lists any problem it finds
// (missing translation, unknown place, missing photo...) and stops without writing.
import fs from "node:fs";
import path from "node:path";
import {parse} from "./yaml.mjs";
import {makePages} from "./pages.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const C = p => path.join(ROOT, "content", p);
const LANGS = ["fr", "en", "es"];
const CATS = ["ville", "culture", "nature", "altiplano", "jungle", "aventure"];
const MODES = ["bus", "train", "avion", "bateau", "tour", "velo"];
const PLACE_TEXTS = ["name", "label", "short", "story", "todo", "tips"];

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const outDir = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : ROOT;

const problems = [];
const problem = msg => problems.push(msg);
function read(rel){
  try { return parse(fs.readFileSync(C(rel), "utf8"), "content/" + rel); }
  catch(e){ problem(e.message); return null; }
}
const str = v => v === null || v === undefined ? "" : String(v);
function texts(obj, where, fields, optional = []){
  const out = {};
  for (const l of LANGS){
    const t = obj && obj[l];
    if (!t){ problem(`${where}: the "${l}" texts are missing`); continue; }
    out[l] = {};
    for (const f of fields){
      const v = t[f];
      if (Array.isArray(v)){
        if (!v.length) problem(`${where} (${l}): "${f}" is empty`);
        out[l][f] = v.map(str);
      } else if (v === undefined || v === null || str(v).trim() === ""){
        if (!optional.includes(f)) problem(`${where} (${l}): "${f}" is missing`);
      } else out[l][f] = str(v);
    }
  }
  return out;
}

/* ───── Regions and places ───── */
const regions = read("regions.yml") || [];
const placeFiles = fs.readdirSync(C("places")).filter(f => f.endsWith(".yml") && !f.startsWith("_")).sort();
const listed = new Map();
regions.forEach(r => (r.places || []).forEach(id => {
  if (listed.has(id)) problem(`content/regions.yml: "${id}" is listed in two regions`);
  listed.set(id, r.id);
}));
for (const f of placeFiles){
  const id = f.slice(0, -4);
  if (!listed.has(id)) problem(`content/places/${f}: add "${id}" to a region's places list in content/regions.yml`);
}
const climates = read("climates.yml") || {};
const dishes = read("dishes.yml") || {};
const places = [], placeText = Object.fromEntries(LANGS.map(l => [l, {}]));
const food = {}, photos = {};
for (const r of regions){
  for (const id of r.places || []){
    const file = `places/${id}.yml`, where = "content/" + file;
    if (!fs.existsSync(C(file))){ problem(`content/regions.yml: no file content/${file} for "${id}"`); continue; }
    const p = read(file); if (!p) continue;
    if (!CATS.includes(p.category)) problem(`${where}: category must be one of ${CATS.join(", ")}`);
    if (!climates[p.climate]) problem(`${where}: unknown climate "${p.climate}" (see content/climates.yml)`);
    for (const k of ["lat", "lng", "altitude"]) if (typeof p[k] !== "number") problem(`${where}: "${k}" must be a number`);
    if (!Array.isArray(p.days) || p.days.length !== 2) problem(`${where}: "days" must be [minimum, ideal]`);
    const place = {id, region:r.id, cat:p.category, dept:str(p.department), lat:p.lat, lng:p.lng, alt:p.altitude, days:p.days, clim:p.climate};
    if (p.tour) place.tour = true;
    if (p.major) place.major = true;
    places.push(place);
    const t = texts(p, where, PLACE_TEXTS);
    LANGS.forEach(l => { if (t[l]) placeText[l][id] = t[l]; });
    if (p.dishes && p.dishes.length){
      p.dishes.forEach(d => { if (!dishes[d]) problem(`${where}: unknown dish "${d}" (see content/dishes.yml)`); });
      food[id] = p.dishes;
    }
    if (p.photos && p.photos.length){
      photos[id] = p.photos.map((x, k) => {
        if (!x.file || !fs.existsSync(path.join(ROOT, "photos", str(x.file)))) problem(`${where}: photo ${k + 1}, file photos/${str(x.file)} not found`);
        return {src:"photos/" + str(x.file), artist:str(x.author), lic:str(x.licence), page:str(x.source)};
      });
    }
  }
}
const byId = Object.fromEntries(places.map(p => [p.id, p]));
regions.forEach(r => { if (!byId[r.cover]) problem(`content/regions.yml: cover "${r.cover}" of region "${r.id}" is not a place`); });

/* ───── Routes ───── */
const routeList = read("routes.yml") || [];
const edges = [], edgeText = Object.fromEntries(LANGS.map(l => [l, {}]));
const seenRoutes = new Set();
for (const e of routeList){
  const where = `content/routes.yml (${e.id})`;
  if (seenRoutes.has(e.id)) problem(`${where}: this id is used twice`);
  seenRoutes.add(e.id);
  if (!byId[e.from] || !byId[e.to]) problem(`${where}: unknown place "${byId[e.from] ? e.to : e.from}"`);
  if (!MODES.includes(e.mode)) problem(`${where}: mode must be one of ${MODES.join(", ")}`);
  const edge = {id:e.id, a:e.from, b:e.to, mode:e.mode, h:e.hours};
  for (const k of ["via", "geom", "straight", "tourgeom"]) if (e[k] !== undefined) edge[k] = e[k];
  edges.push(edge);
  const t = texts(e, where, ["t", "how", "road", "note"], ["road", "note"]);
  LANGS.forEach(l => { if (t[l]) edgeText[l][e.id] = t[l]; });
}

/* ───── Climates, dishes, Salar tour stops, itineraries ───── */
const climateData = {}, climateText = Object.fromEntries(LANGS.map(l => [l, {}]));
for (const [id, c] of Object.entries(climates)){
  climateData[id] = c.data;
  const t = texts(c, `content/climates.yml (${id})`, ["title", "text"]);
  LANGS.forEach(l => { if (t[l]) climateText[l][id] = [t[l].title, t[l].text]; });
}
const dishText = Object.fromEntries(LANGS.map(l => [l, {}]));
for (const [id, d] of Object.entries(dishes)){
  const t = texts(d, `content/dishes.yml (${id})`, ["name", "text"]);
  LANGS.forEach(l => { if (t[l]) dishText[l][id] = [t[l].name, t[l].text]; });
}
const tourStops = [], tourText = Object.fromEntries(LANGS.map(l => [l, {}]));
for (const s of read("tour.yml") || []){
  tourStops.push({id:s.id, lat:s.lat, lng:s.lng});
  LANGS.forEach(l => { if (!s[l]) problem(`content/tour.yml (${s.id}): "${l}" name missing`); tourText[l][s.id] = str(s[l]); });
}
const itineraries = [], ideaText = Object.fromEntries(LANGS.map(l => [l, {}]));
for (const it of read("itineraries.yml") || []){
  const where = `content/itineraries.yml (${it.id})`;
  it.stops.forEach(([id]) => { if (!byId[id]) problem(`${where}: unknown place "${id}"`); });
  itineraries.push({id:it.id, days:it.days, pref:it.pref, end:it.end, stops:it.stops});
  const t = texts(it, where, ["name", "desc"]);
  LANGS.forEach(l => { if (t[l]){ ideaText[l][`idea.${it.id}.name`] = t[l].name; ideaText[l][`idea.${it.id}.desc`] = t[l].desc; } });
}

/* ───── Culture: festivals, UNESCO, crafts, legends; border crossings ───── */
// Each item is written once and linked to places by id; the site shows it on every page it concerns.
const culture = {}, cultureText = Object.fromEntries(LANGS.map(l => [l, {}]));
const COUNTRIES = ["peru", "chile", "argentina", "brazil", "paraguay"];
function items(file, fields, keep, check){
  const out = [];
  LANGS.forEach(l => cultureText[l][file] = {});
  const seen = new Set();
  for (const x of read(file + ".yml") || []){
    const where = `content/${file}.yml (${x.id})`;
    if (seen.has(x.id)) problem(`${where}: this id is used twice`);
    seen.add(x.id);
    const refs = [].concat(x.places || [], x.place ? [x.place] : []);
    refs.forEach(id => { if (!byId[id]) problem(`${where}: unknown place "${id}"`); });
    if (check) check(x, where);
    const o = {id:x.id};
    keep.forEach(k => { if (x[k] !== undefined) o[k] = x[k]; });
    out.push(o);
    if (fields){
      const t = texts(x, where, fields);
      LANGS.forEach(l => { if (t[l]) cultureText[l][file][x.id] = t[l]; });
    } else LANGS.forEach(l => {
      if (!x[l]) problem(`${where}: "${l}" name missing`);
      cultureText[l][file][x.id] = str(x[l]);
    });
  }
  culture[file] = out;
}
items("festivals", ["name", "text"], ["place", "date", "days", "easter", "nth", "month", "even"], (x, where) => {
  const ways = ["date", "easter", "nth", "month"].filter(k => x[k] !== undefined);
  if (ways.length !== 1) problem(`${where}: give exactly one of date, easter, nth or month`);
  if (x.date !== undefined && !/^\d\d-\d\d$/.test(str(x.date))) problem(`${where}: date must look like 08-15 (month-day)`);
});
const festivalIds = new Set(culture.festivals.map(f => f.id));
items("unesco", null, ["kind", "year", "places", "festival"], (x, where) => {
  if (!["world", "intangible"].includes(x.kind)) problem(`${where}: kind must be world or intangible`);
  if (x.festival && !festivalIds.has(x.festival)) problem(`${where}: unknown festival "${x.festival}"`);
});
items("crafts", ["name", "text"], ["places"]);
items("legends", ["name", "text"], ["places"]);
items("borders", ["name", "text"], ["country", "place"], (x, where) => {
  if (!COUNTRIES.includes(x.country)) problem(`${where}: country must be one of ${COUNTRIES.join(", ")}`);
});

/* ───── Interface texts and the practical tips page ───── */
const ui = {}, guide = {};
for (const l of LANGS){
  ui[l] = read(`ui/${l}.yml`) || {};
  regions.forEach(r => {
    if (!r[l] || !r[l].name || !r[l].desc) problem(`content/regions.yml (${r.id}): "${l}" name or desc missing`);
    else { ui[l]["region." + r.id] = str(r[l].name); ui[l]["regionDesc." + r.id] = str(r[l].desc); }
  });
  Object.assign(ui[l], ideaText[l]);
  guide[l] = read(`guide/${l}.yml`);
}
const ref = ui.en;
for (const l of LANGS){
  Object.keys(ref).filter(k => !(k in ui[l])).forEach(k => problem(`content/ui/${l}.yml: "${k}" is missing (it exists in English)`));
  Object.keys(ui[l]).filter(k => !(k in ref)).forEach(k => problem(`content/ui/${l}.yml: "${k}" does not exist in English`));
  const g = guide[l] || {}, rg = guide.en || {};
  (rg.sections || []).forEach((s, i) => {
    const o = (g.sections || [])[i];
    if (!o || o.id !== s.id) problem(`content/guide/${l}.yml: section ${i + 1} should be "${s.id}"`);
  });
  if ((g.phrases || []).length !== (rg.phrases || []).length) problem(`content/guide/${l}.yml: not the same number of phrases as in English`);
}
// Interface texts used by the code must exist.
const codeFiles = [];
(function walk(d){ for (const f of fs.readdirSync(d)){ const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith(".js")) codeFiles.push(p); } })(path.join(ROOT, "js"));
for (const f of codeFiles){
  const src = fs.readFileSync(f, "utf8");
  for (const m of src.matchAll(/\bt\(\s*"([\w.]+)"/g)) if (!m[1].endsWith(".") && !(m[1] in ref)) problem(`${path.relative(ROOT, f)} uses the unknown text "${m[1]}"`);
}

/* ───── Pages for search engines ───── */
const seo = read("seo.yml") || {};
const site = str(seo.site);
if (!/^https:\/\/.+\/$/.test(site)) problem(`content/seo.yml: "site" must be the site's address, starting with https:// and ending with /`);
for (const l of LANGS){
  if (!seo[l]) { problem(`content/seo.yml: the "${l}" texts are missing`); seo[l] = {}; }
  Object.keys(seo.en || {}).filter(k => !(k in seo[l])).forEach(k => problem(`content/seo.yml (${l}): "${k}" is missing (it exists in English)`));
}
// The release number of index.html (?v=…), so the pages load the current stylesheet, and the logo.
const release = (fs.readFileSync(path.join(ROOT, "index.html"), "utf8").match(/\?v=(\d+)/) || [])[1] || "1";
const logo = (fs.readFileSync(path.join(ROOT, "js/core.js"), "utf8").match(/const LOGO = '(.*?)';/) || [])[1] || "";
let pages = {files:{}};
if (!problems.length){
  pages = makePages({LANGS, site, seo, ui, regions, places, placeText, photos, food, dishText, edges, edgeText, culture, cultureText, guide, release, logo});
  pages.problems.forEach(problem);
}

if (problems.length){
  console.log(`${problems.length} problem(s), nothing written:\n- ` + problems.join("\n- "));
  process.exit(1);
}
if (checkOnly){ console.log(`All good: ${places.length} places, ${edges.length} routes, ${Object.keys(dishes).length} dishes.`); process.exit(0); }

/* ───── Write ───── */
const HEAD = "// Generated by tools/build.mjs from content/. Do not edit: change content/ and run the build.\n";
const NS = "window.BOL = window.BOL || {};\n";
const list = a => "[\n" + a.map(x => " " + JSON.stringify(x)).join(",\n") + "\n]";
const dict = o => "{\n" + Object.entries(o).map(([k, v]) => " " + JSON.stringify(k) + ":" + JSON.stringify(v)).join(",\n") + "\n}";
function write(rel, text){
  const f = path.join(outDir, rel);
  fs.mkdirSync(path.dirname(f), {recursive:true});
  fs.writeFileSync(f, text);
}
write("data/places.js", HEAD + NS
  + "BOL.regions = " + list(regions.map(r => ({id:r.id, cover:r.cover}))) + ";\n"
  + "BOL.places = " + list(places) + ";\n"
  + "BOL.edges = " + list(edges) + ";\n"
  + "BOL.tourStops = " + list(tourStops) + ";\n"
  + "BOL.climates = " + dict(climateData) + ";\n"
  + "BOL.food = " + dict(food) + ";\n");
write("data/photos.js", HEAD + NS + "BOL.photos = " + dict(photos) + ";\n");
write("data/itineraries.js", HEAD + NS + "BOL.itineraries = " + list(itineraries) + ";\n");
write("data/culture.js", HEAD + NS + Object.entries(culture).map(([k, v]) => `BOL.${k} = ${list(v)};\n`).join(""));
for (const l of LANGS){
  write(`locales/${l}.js`, HEAD + NS + "BOL.locales = BOL.locales || {};\n"
    + `BOL.locales.${l} = Object.assign(BOL.locales.${l} || {}, {ui: ${dict(ui[l])}});\n`);
  write(`locales/${l}.content.js`, HEAD + NS + "BOL.locales = BOL.locales || {};\n"
    + `BOL.locales.${l} = Object.assign(BOL.locales.${l} || {}, {\n`
    + ` places: ${dict(placeText[l])},\n edges: ${dict(edgeText[l])},\n dishes: ${dict(dishText[l])},\n`
    + ` climates: ${dict(climateText[l])},\n tour: ${dict(tourText[l])},\n`
    + Object.entries(cultureText[l]).map(([k, v]) => ` ${k}: ${dict(v)},\n`).join("")
    + ` guide: ${JSON.stringify(guide[l])}\n});\n`);
}
// The language folders hold only generated pages: clear them so renamed places leave no old page.
LANGS.forEach(l => fs.rmSync(path.join(outDir, l), {recursive:true, force:true}));
for (const [rel, text] of Object.entries(pages.files)) write(rel, text);
// Reminders, not errors: what still needs work (see technical.md, "Known gaps").
const noPhoto = places.filter(p => !(photos[p.id] || []).length).map(p => p.id);
if (noPhoto.length) console.log(`Places without photos: ${noPhoto.join(", ")}`);
console.log(`Built ${places.length} places, ${edges.length} routes, ${Object.keys(dishes).length} dishes in ${LANGS.length} languages, and ${Object.keys(pages.files).length - 2} pages for search engines.`);
