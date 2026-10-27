// Languages: locale resolution, on-demand catalogues and message lookup.
//
// Each language has two catalogues, loaded only when needed:
//   locales/<lang>.js          interface strings  -> BOL.locales[lang].ui
//   locales/<lang>.content.js  destination texts  -> BOL.locales[lang].places, .edges, ...
// Only the active language is downloaded; tools/build.mjs keeps every language
// complete. Lookups still fall back to English when it happens to be loaded.
//
// Language choice: ?lang= in the URL, then the language of the page (es.html, fr.html, en.html
// are index.html in one language, see tools/pages.mjs), then the visitor's saved choice, then
// the browser languages in order of preference, then English.
(function(){
"use strict";
const SUPPORTED = ["fr", "en", "es"], DEFAULT = "en", STORE = "bolivia-lang";
// Release number added to files loaded on demand, like the ?v= in index.html: bump both together.
const RELEASE = "16";
const NAMES = {fr:"Français", en:"English", es:"Español"};
window.BOL = window.BOL || {};
BOL.locales = BOL.locales || {};
const loading = {};

function match(tag){
  if (!tag) return null;
  const base = String(tag).toLowerCase().split(/[-_]/)[0];
  return SUPPORTED.includes(base) ? base : null;
}
function fromUrl(){ try { return match(new URLSearchParams(location.search).get("lang")); } catch(e){ return null; } }
function fromPage(){ return match(document.documentElement.dataset.lang); }
function fromStore(){ try { return match(localStorage.getItem(STORE)); } catch(e){ return null; } }
function fromBrowser(){
  const list = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
  for (const l of list){ const m = match(l); if (m) return m; }
  return null;
}
const scripts = {};
function inject(src){
  if (scripts[src]) return scripts[src];
  return scripts[src] = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => { delete scripts[src]; reject(new Error("Cannot load " + src)); };
    document.head.appendChild(s);
  });
}
function load(lang){
  if (!loading[lang]) loading[lang] = Promise.all([inject(`locales/${lang}.js?v=${RELEASE}`), inject(`locales/${lang}.content.js?v=${RELEASE}`)]);
  return loading[lang];
}

const I = {lang: DEFAULT, supported: SUPPORTED, names: NAMES};
const chain = () => [I.lang, DEFAULT].filter((l, i, a) => a.indexOf(l) === i).map(l => BOL.locales[l]).filter(Boolean);
const plural = {};

// Interface string. A value may be a plural object {one, other, ...} chosen with vars.n.
I.t = (key, vars) => {
  let v;
  for (const L of chain()){ v = L.ui && L.ui[key]; if (v !== undefined) break; }
  if (v === undefined) return key;
  if (typeof v === "object"){
    const n = vars && typeof vars.n === "number" ? vars.n : 0;
    plural[I.lang] = plural[I.lang] || new Intl.PluralRules(I.lang);
    v = v[plural[I.lang].select(n)] ?? v.other;
  }
  return String(v).replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] !== undefined ? vars[k] : m);
};
// Content entry, e.g. I.c("places", "sucre").story
I.c = (section, id) => {
  for (const L of chain()){ const v = L[section] && L[section][id]; if (v !== undefined) return v; }
  return undefined;
};
I.num = (n, digits) => new Intl.NumberFormat(I.lang, {maximumFractionDigits: digits ?? 1}).format(n);
I.month = (m, style) => new Intl.DateTimeFormat(I.lang, {month: style || "long"}).format(new Date(2025, m, 15));
I.list = items => {
  try { return new Intl.ListFormat(I.lang, {type: "conjunction"}).format(items); } catch(e){ return items.join(", "); }
};
I.collator = () => new Intl.Collator(I.lang);

I.initial = () => fromUrl() || fromPage() || fromStore() || fromBrowser() || DEFAULT;
// Activate a language. persist = the visitor picked it explicitly.
I.use = async (lang, persist) => {
  lang = match(lang) || DEFAULT;
  await load(lang);
  I.lang = lang;
  document.documentElement.lang = lang;
  if (persist){ try { localStorage.setItem(STORE, lang); } catch(e){} }
};

BOL.i18n = I;
BOL.loadScript = inject;
BOL.release = RELEASE;
})();
