// Bolivia à la carte: router, views and map.
// Views (hash routes, language-independent so links can be shared):
//   #/            home: regions, themes, itinerary ideas, practical tips
//   #/map         all places with filters (?region=…, ?cat=…)
//   #/place/<id>  one place
//   #/routes      "how to get from A to B" and every travel link
//   #/route/<id>  one travel link
//   #/trip        the optional trip planner (?t=<code> loads a shared trip)
//   #/guide       practical tips: money, buses, blockades (?s=<section> scrolls to one)
(function(){
"use strict";
const B = window.BOL, I = B.i18n, M = B.model, t = I.t;
const {byId, edgeById, adj} = M;

const CATS = ["ville", "culture", "nature", "altiplano", "jungle", "aventure"];
const MODES = ["bus", "train", "avion", "bateau", "tour", "velo"];
// Travel regions, in the order a visitor meets them going from the Andes down to the lowlands.
const REGIONS = ["lapaz", "titicaca", "south", "colonial", "tarija", "cbba", "santacruz", "chiquitania", "serrania", "amazon"];
const REGION_COVER = {lapaz:"lapaz", titicaca:"isladelsol", south:"salar", colonial:"sucre", tarija:"tarija", cbba:"torotoro", santacruz:"samaipata", chiquitania:"sanjavier", serrania:"chochis", amazon:"pampas"};
// The nine departments (Pando has no place yet), west to east.
const DEPTS = ["La Paz", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Cochabamba", "Santa Cruz", "Beni", "Pando"];
const MAJOR = new Set(["cbba","lapaz","sucre","potosi","uyuni","salar","santacruz","tarija","oruro","copacabana","rurrenabaque","samaipata","torotoro","tupiza","trinidad","sanignacio","robore","aguascalientes"]);
const ENTRY_AIR = ["lapaz", "santacruz", "cbba"], ENTRY_LAND = ["copacabana", "uyuni", "tupiza"];
const HERO = ["salar", "isladelsol", "torotoro"];

/* ───── Small helpers ───── */
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} };
const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } };
const pc = id => I.c("places", id) || {};
const name = id => pc(id).name || id;
const label = id => pc(id).label || name(id);
const photos = id => B.photos[id] || [];
// Every photo also exists 640 px wide in photos/sm/, for lists, cards and tooltips.
const small = src => src ? src.replace("photos/", "photos/sm/") : "";
const cover = id => (photos(id)[0] || {}).src || "";
const catVar = c => `--c:var(--c-${c})`;
const isPhone = () => matchMedia("(max-width:860px)").matches;
// On touch screens a route line's tap area would swallow taps meant for nearby places.
const coarse = matchMedia("(pointer:coarse)").matches;

const fmtDays = d => t("days", {n:d, d:I.num(d)});
const fmtAlt = a => t("alt", {a:I.num(a, 0)});
// "Département de Potosí", with per-name exceptions such as "Département d'Oruro".
// In menus: "Sorata · La Paz", so a little-known place can be located (not "Cochabamba · Cochabamba").
const withDept = id => name(id) === byId[id].dept ? name(id) : `${name(id)} · ${byId[id].dept}`;
const deptName = (d, key) => { const k = `${key || "dept.named"}.${d}`, v = t(k); return v === k ? t(key || "dept.named", {d}) : v; };
function fmtH(h){
  if (h <= 0) return "—";
  const H = Math.floor(h), m = Math.round((h - H) * 60 / 5) * 5;
  if (m === 60) return t("h", {h:H + 1});
  return H ? (m ? t("hm", {h:H, m:String(m).padStart(2, "0")}) : t("h", {h:H})) : t("min", {m});
}
// Official dollar and euro rates of the day (data/rates.js, refreshed daily from the central bank).
const RATES = B.rates;
const money = v => new Intl.NumberFormat(I.lang, {minimumFractionDigits:2, maximumFractionDigits:2}).format(v);
const rateDate = style => new Intl.DateTimeFormat(I.lang, style === "short" ? {day:"numeric", month:"short"} : {day:"numeric", month:"long", year:"numeric"}).format(new Date(RATES.date + "T12:00:00"));
const ratesLine = () => RATES ? t("rates.line", {date:rateDate("short"), eur:money(RATES.eur), usd:money(RATES.usd)}) : "";
function ratesBox(){
  if (!RATES) return "";
  return `<div class="rates"><p class="rates-title">${esc(t("rates.title"))}</p>
    <div class="rates-row"><div><b>${esc(money(RATES.eur))} Bs</b><span>${esc(t("rates.eur"))}</span></div><div><b>${esc(money(RATES.usd))} Bs</b><span>${esc(t("rates.usd"))}</span></div></div>
    <p class="rates-src"><a href="${esc(RATES.source)}" target="_blank" rel="noopener">${esc(t("rates.source", {date:rateDate()}))}</a>. ${esc(t("rates.note"))}</p></div>`;
}
const edgeText = id => I.c("edges", id) || {};
const roadName = r => r.startsWith("F") ? t("road.national", {n:r.slice(1)}) : r.startsWith("D") ? t("road.dept", {n:r.slice(1)}) : r;

const ICON = {
  discover:'<path d="M12 3l9 9-9 9-9-9z"/><path d="M12 8l4 4-4 4-4-4z"/>',
  map:'<path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
  route:'<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 000-6H9a3 3 0 010-6h6.5" stroke-dasharray="2 3"/>',
  trip:'<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2M4 13h16"/>',
  plus:'<path d="M12 5v14M5 12h14"/>', check:'<path d="M5 12.5l4.5 4.5L19 7"/>', x:'<path d="M6 6l12 12M18 6L6 18"/>',
  up:'<path d="M12 19V5M6 11l6-6 6 6"/>', down:'<path d="M12 5v14M6 13l6 6 6-6"/>', back:'<path d="M15 5l-7 7 7 7"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', swap:'<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
  ext:'<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/>', link:'<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
  list:'<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>', sort:'<path d="M4 7h10M4 12h7M4 17h4M17 5v14M14 16l3 3 3-3"/>',
  chev:'<path d="M6 9l6 6 6-6"/>', info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  pin:'<path d="M12 21s-6.5-5.6-6.5-11A6.5 6.5 0 0118.5 10c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>',
  arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>'
};
const icon = (k, cls) => `<svg ${cls ? `class="${cls}" ` : ""}viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
// Logo: a chakana (Andean stepped cross) framing Illimani under the Altiplano sky, over woven stripes.
// Ids are prefixed so the inline copy can't clash with other SVGs on the page.
const LOGO = '<svg viewBox="-3 -3 46 46" aria-hidden="true"><defs><path id="lg-ck" d="M15 0h10v5h5v5h5v5h5v10h-5v5h-5v5h-5v5H15v-5h-5v-5H5v-5H0V15h5v-5h5V5h5z"/><clipPath id="lg-cc"><use href="#lg-ck"/></clipPath></defs><use href="#lg-ck" fill="none" stroke="#fbefe0" stroke-width="5.2"/><use href="#lg-ck" fill="#1f1747" stroke="#1f1747" stroke-width="2.6"/><g clip-path="url(#lg-cc)"><rect width="40" height="40" fill="#00a3b4"/><circle cx="24.5" cy="9" r="3.9" fill="#f5a300"/><path d="M-1 27.5L7 21l3 1.6 4.2-5.4 2.6 1.8 4.6-7.2 3.4 4.6 3-2.6 4.8 5.6L41 27.5z" fill="#1f1747"/><path d="M18.9 14.3l2.5-3.5 2.8 3.9-1.9-.9-1.3 1.4zM27.3 15.4l1.5-1.2 2 2.4-1.6-.5zM12.8 19.2l1.4-2 1.5 1-1.1.2z" fill="#fbefe0"/><rect y="27.5" width="40" height="3.6" fill="#e2187b"/><rect y="31.1" width="40" height="3.4" fill="#f5a300"/><rect y="34.5" width="40" height="6" fill="#0f9d58"/></g></svg>';
function modeIcon(m){
  const dash = {train:"6 3", avion:"1 4", bateau:"4 4", tour:"7 4", velo:"2 3"}[m] || "";
  return `<svg class="mode-ico" viewBox="0 0 30 14" aria-hidden="true"><line class="m-${m}" x1="2" y1="7" x2="28" y2="7" ${dash ? `stroke-dasharray="${dash}"` : ""} ${m === "avion" ? 'stroke-linecap="round"' : ""}/></svg>`;
}

let toastTimer;
function toast(msg, actionLabel, action){
  const el = $("#toast");
  el.innerHTML = `<span>${esc(msg)}</span>${actionLabel ? `<button type="button">${esc(actionLabel)}</button>` : ""}`;
  el.hidden = false;
  if (actionLabel) $("button", el).onclick = () => { el.hidden = true; action(); };
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.hidden = true, 6000);
}

/* ───── State ───── */
const S = {
  view:"home", place:null, edge:null, q:"", region:"all", cats:new Set(CATS), month:-1,
  modes:new Set(["bus","train","bateau","tour","velo"]), basemap:"relief",
  calc:{from:"", to:"", pref:"avion", show:false},
  preview:null,   // place shown in the bottom card on the phone map
  fromMap:false,  // the open place was reached from the phone map, so "back" returns there
  group:"region", // places list grouped by travel region or by department
  list:null,      // where the places list was scrolled when a place was opened: {panel, win, id}
  canBack:false,  // the open place was reached from the list, so "back" is a history step
  guideSec:null
};
const savedUi = load("bolivia-ui", null);
if (savedUi){
  if (typeof savedUi.month === "number") S.month = savedUi.month;
  if (Array.isArray(savedUi.modes)) S.modes = new Set(savedUi.modes.filter(m => MODES.includes(m)));
  if (savedUi.group === "dept") S.group = "dept";
}
const saveUi = () => store("bolivia-ui", {month:S.month, modes:[...S.modes], group:S.group});
let trip = M.cleanTrip(load("bolivia-trip", null));
const saveTrip = () => store("bolivia-trip", trip);
const inTrip = id => trip.stops.some(s => s.id === id);
const tripStart = () => trip.stops.length ? trip.stops[0].id : null;

function addStop(id){
  trip.stops.push({id, d:byId[id].days[1] || 1});
  saveTrip(); update();
  toast(trip.stops.length === 1 ? t("toast.firstStop", {name:label(id)}) : t("toast.added", {name:label(id)}), S.view === "trip" ? "" : t("toast.seeTrip"), () => go("#/trip"));
}
function removeAt(i){
  const before = M.cleanTrip(trip), id = trip.stops[i].id;
  trip.stops.splice(i, 1); saveTrip(); update();
  toast(t("toast.removed", {name:label(id)}), t("undo"), () => { trip = before; saveTrip(); update(); });
}
function toggleStop(id){
  const i = trip.stops.findIndex(s => s.id === id);
  if (i >= 0) removeAt(i); else addStop(id);
}
function replaceTrip(next, msg){
  const before = M.cleanTrip(trip), had = trip.stops.length > 0;
  trip = M.cleanTrip(next); saveTrip(); update();
  if (had) toast(msg, t("undo"), () => { trip = before; saveTrip(); update(); }); else toast(msg);
}
function setStart(id){
  if (!byId[id]) return;
  const i = trip.stops.findIndex(s => s.id === id);
  if (i === 0) return;
  if (i > 0){ const [s] = trip.stops.splice(i, 1); trip.stops.unshift(s); }
  else trip.stops.unshift({id, d:1});
  saveTrip(); update();
}
const ideaTrip = it => ({days:it.days, pref:it.pref, end:it.end, stops:it.stops.map(([id, d]) => ({id, d}))});

/* ───── Climate texts ───── */
const dayWord = x => t(x >= 30 ? "wx.d.vhot" : x >= 26 ? "wx.d.hot" : x >= 21 ? "wx.d.mild" : x >= 15 ? "wx.d.cool" : x >= 8 ? "wx.d.cold" : "wx.d.vcold");
const nightWord = n => t(n >= 20 ? "wx.n.warm" : n >= 12 ? "wx.n.mild" : n >= 5 ? "wx.n.cool" : n >= 0 ? "wx.n.cold" : n >= -8 ? "wx.n.frost" : "wx.n.freezing");
const rainWord = r => t(r >= 200 ? "wx.r.vwet" : r >= 100 ? "wx.r.wet" : r >= 40 ? "wx.r.showers" : "wx.r.dry");
function packList(p, w){
  const out = [];
  if (w.min < -5) out.push("pack.down", "pack.bag");
  else if (w.min < 3) out.push("pack.fleece", "pack.hat");
  else if (w.min < 10) out.push("pack.sweater");
  if (w.max >= 27) out.push("pack.light");
  if (p.alt >= 2500) out.push("pack.sun");
  else if (w.max >= 27) out.push("pack.sunhat");
  if (w.rain >= 100) out.push("pack.rain");
  if (["amazonie","chapare","chiquitania","yungas","santacruz"].includes(p.clim)) out.push("pack.mosquito");
  if (["madidi","pampas","noelkempff","amboro"].includes(p.id)) out.push("pack.sleeves");
  if (["aguascalientes","coroico","lomas","robore"].includes(p.id)) out.push("pack.swim");
  return out.map(k => t(k));
}
function tempsHtml(id){
  if (S.month < 0) return "";
  const w = M.climate(id, S.month);
  return w ? `<span class="temps" title="${esc(t("wx.tempsTitle", {month:I.month(S.month)}))}"><span class="h">${w.max}°</span> / <span class="l">${w.min}°</span></span>` : "";
}
function weatherBlock(p){
  const cl = I.c("climates", p.clim); if (!cl) return "";
  const m = S.month, months = [...Array(12).keys()].map(k => M.climate(p.id, k));
  const W = 340, H = 124, pl = 28, pr = 6, pt = 8, pb = 20, cw = (W - pl - pr) / 12;
  const tMin = Math.min(-5, ...months.map(x => x.min)), tMax = Math.max(30, ...months.map(x => x.max)), rMax = Math.max(150, ...months.map(x => x.rain));
  const ty = v => pt + (1 - (v - tMin) / (tMax - tMin)) * (H - pt - pb), cx = k => pl + cw * k + cw / 2;
  const line = key => months.map((x, k) => (k ? "L" : "M") + cx(k).toFixed(1) + " " + ty(x[key]).toFixed(1)).join(" ");
  const ticks = [tMin <= -10 ? -10 : 0, 10, 20, 30].filter(v => v >= tMin && v <= tMax);
  const chart = `<svg class="wx-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("wx.chartLabel"))}">
    ${m >= 0 ? `<rect class="cur" x="${pl + cw * m}" y="${pt - 4}" width="${cw}" height="${H - pt - pb + 8}" rx="3"/>` : ""}
    ${months.map((x, k) => { const h = x.rain / rMax * (H - pt - pb) * 0.6; return `<rect class="rb" x="${(pl + cw * k + 3).toFixed(1)}" y="${(H - pb - h).toFixed(1)}" width="${(cw - 6).toFixed(1)}" height="${h.toFixed(1)}" rx="1.5"/>`; }).join("")}
    ${ticks.map(v => `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${ty(v)}" y2="${ty(v)}"/><text x="${pl - 5}" y="${ty(v) + 3}" text-anchor="end">${v}°</text>`).join("")}
    <path class="mx" d="${line("max")}"/><path class="mn" d="${line("min")}"/>
    ${months.map((x, k) => `<text x="${cx(k)}" y="${H - 5}" text-anchor="middle">${esc(I.month(k, "narrow"))}</text>`).join("")}
  </svg>`;
  const now = w => `<div><b class="hot">${w.max}°</b><span>${esc(t("wx.day"))}, ${esc(dayWord(w.max))}</span></div><div><b class="cold">${w.min}°</b><span>${esc(nightWord(w.min))}</span></div><div><b class="rain">${w.rain} mm</b><span>${esc(rainWord(w.rain))}</span></div>`;
  let head;
  if (m >= 0){
    const w = months[m];
    head = `<h3>${esc(t("wx.in", {month:I.month(m)}))}</h3><div class="wx-now">${now(w)}</div><div><p class="small muted" style="margin-bottom:6px">${esc(t("wx.pack"))}</p><div class="pack">${packList(p, w).map(x => `<span class="chip">${esc(x)}</span>`).join("")}</div></div>`;
  } else {
    head = `<h3>${esc(t("wx.dry"))}</h3><div class="wx-now">${now(months[6])}</div><h3>${esc(t("wx.wet"))}</h3><div class="wx-now">${now(months[0])}</div>`;
  }
  return `<section class="wx" aria-label="${esc(t("wx.title"))}">${head}${chart}<div class="legend-mini"><span><i style="background:var(--hot)"></i>${esc(t("wx.max"))}</span><span><i style="background:var(--cold)"></i>${esc(t("wx.min"))}</span><span><i style="background:var(--water)"></i>${esc(t("wx.rain"))}</span><span>${esc(cl[0])}</span></div><p class="small">${esc(cl[1])}</p>${m < 0 ? `<p class="small muted">${esc(t("wx.pickMonth"))}</p>` : ""}</section>`;
}
const monthOptions = () => `<option value="-1">${esc(t("filter.anyMonth"))}</option>` + [...Array(12).keys()].map(k => `<option value="${k}" ${S.month === k ? "selected" : ""}>${esc(I.month(k))}</option>`).join("");

/* ───── Router ───── */
const go = h => { if (location.hash === h) route(); else location.hash = h; };
function route(){
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean), q = new URLSearchParams(qs || "");
  const v = parts[0] || "";
  const prev = S.view;
  // Leaving the places list for a place: remember the scroll, to come back to the same spot.
  if (prev === "map" && v === "place") S.list = {panel:$("#panel").scrollTop, win:window.scrollY, id:parts[1]};
  S.place = null; S.edge = null; S.guideSec = null;
  S.canBack = prev === "map" && v === "place";
  if (v === "place" && byId[parts[1]]){ S.view = "place"; S.place = parts[1]; }
  else if (v === "route" && edgeById[parts[1]]){ S.view = "route"; S.edge = parts[1]; }
  else if (v === "guide"){ S.view = "guide"; S.guideSec = q.get("s"); }
  else if (v === "map"){
    S.view = "map";
    if (prev !== "place" || q.has("region") || q.has("cat")) S.list = null;
    if (q.has("region")) S.region = REGIONS.includes(q.get("region")) ? q.get("region") : "all";
    if (q.has("cat") && CATS.includes(q.get("cat"))) S.cats = new Set([q.get("cat")]);
    if (q.has("region") || q.has("cat")) history.replaceState(null, "", "#/map");
  }
  else if (v === "routes") S.view = "routes";
  else if (v === "trip"){
    S.view = "trip";
    if (q.has("t")){
      const shared = M.decode(q.get("t"));
      history.replaceState(null, "", "#/trip");
      if (shared && M.encode(shared) !== M.encode(trip)) replaceTrip(shared, t("toast.sharedLoaded"));
    }
  }
  else S.view = "home";
  S.preview = null;
  document.body.classList.toggle("show-map", S.view === "map" && S.fromMap && isPhone());
  if (S.view !== "place") S.fromMap = false;
  render(true);
}

/* ───── Chrome: header, tab bar ───── */
function renderChrome(){
  const n = trip.stops.length;
  const nav = [["home", "#/", "discover", t("nav.home")], ["map", "#/map", "map", t("nav.map")], ["routes", "#/routes", "route", t("nav.routes")], ["guide", "#/guide", "info", t("nav.guide")], ["trip", "#/trip", "trip", t("nav.trip")]];
  const cur = {home:"home", map:"map", place:"map", routes:"routes", route:"routes", guide:"guide", trip:"trip"}[S.view];
  const link = ([k, href, ic, txt], withIcon) => `<a href="${href}" ${cur === k ? 'aria-current="page"' : ""}>${withIcon ? icon(ic) : ""}<span>${esc(txt)}</span>${k === "trip" ? `<span class="count" aria-label="${esc(t("nav.tripCount", {n}))}">${n || ""}</span>` : ""}</a>`;
  $("#head").innerHTML = `<div class="bar">
    <a class="brand" href="#/">${LOGO}<span>${esc(t("brand"))}</span></a>
    <nav class="mainnav" aria-label="${esc(t("nav.label"))}">${nav.map(x => link(x, false)).join("")}</nav>
    <label class="lang"><span class="sr-only">${esc(t("lang.label"))}</span><select id="langSel">${I.supported.map(l => `<option value="${l}" ${l === I.lang ? "selected" : ""} lang="${l}">${esc(I.names[l])}</option>`).join("")}</select>${icon("chev")}</label>
  </div><div class="weave thin"></div>`;
  $("#tabbar").innerHTML = nav.map(x => link(x, true)).join("");
  $("#tabbar").setAttribute("aria-label", t("nav.label"));
  $("#skip").textContent = t("skip");
  $("#langSel").onchange = ev => switchLang(ev.target.value);
}
async function switchLang(lang){
  await I.use(lang, true);
  if (new URLSearchParams(location.search).has("lang")) history.replaceState(null, "", location.pathname + location.hash);
  if (map) relabelMap();
  render(false);
}

/* ───── Home ───── */
function ideaCard(it, compact){
  const tr = M.cleanTrip(ideaTrip(it)), tot = M.totals(tr);
  return `<article class="idea ${compact ? "compact" : ""}">
    <h3>${esc(t(`idea.${it.id}.name`))}</h3>
    <p class="meta">${esc(t("ideas.meta", {days:fmtDays(Math.ceil(tot.total)), start:label(it.stops[0][0])}))}</p>
    ${tripBar(tr, tot, true)}
    ${compact ? "" : `<p>${esc(t(`idea.${it.id}.desc`))}</p>`}
    <p class="stopsline">${esc(I.list([...new Set(it.stops.map(s => label(s[0])))]))}</p>
    <div><button type="button" class="btn small" data-act="idea" data-id="${it.id}">${esc(t("ideas.use"))}</button></div>
  </article>`;
}
function renderHome(){
  const count = c => B.places.filter(p => p.cat === c).length;
  $("#v-home").innerHTML = `
  <section class="hero"><div class="in">
    <div>
      <p class="kicker">${esc(t("home.kicker"))}</p>
      <h1 tabindex="-1" id="pageTitle">${esc(t("home.title"))}</h1>
      <p class="lead">${esc(t("home.lead", {n:B.places.length}))}</p>
      <div class="row"><a class="btn cta" href="#/map">${icon("map")}${esc(t("home.explore"))}</a><a class="btn on-dark" href="#/trip">${icon("trip")}${esc(t("home.plan"))}</a></div>
    </div>
    <div class="mosaic">${HERO.map((id, i) => `<figure><a href="#/place/${id}"><img src="${esc(i ? small(cover(id)) : cover(id))}" alt="${esc(name(id))}" ${i ? "" : 'fetchpriority="high"'} decoding="async"></a><figcaption>${esc(label(id))}</figcaption></figure>`).join("")}</div>
  </div></section>
  <div class="weave thick"></div>
  <section class="section" aria-labelledby="h-reg"><header><div><h2 id="h-reg">${esc(t("home.regions"))}</h2><p>${esc(t("home.regionsLead"))}</p></div></header>
    <div class="regions">${REGIONS.map(r => `<a class="region" href="#/map?region=${r}"><img src="${esc(small(cover(REGION_COVER[r])))}" alt="" loading="lazy" decoding="async"><div class="txt"><h3>${esc(t("region." + r))}</h3><p>${esc(t("regionDesc." + r))}</p><span class="n">${esc(t("places", {n:B.places.filter(p => p.region === r).length}))}</span></div></a>`).join("")}</div>
  </section>
  <section class="section" aria-labelledby="h-th"><header><div><h2 id="h-th">${esc(t("home.themes"))}</h2><p>${esc(t("home.themesLead"))}</p></div></header>
    <div class="themes">${CATS.map(c => `<a class="theme" href="#/map?cat=${c}" style="${catVar(c)}"><span class="dmd"></span><b>${esc(t("cat." + c))}</b><span>${esc(t("catDesc." + c))}</span><span>${esc(t("places", {n:count(c)}))}</span></a>`).join("")}</div>
  </section>
  <section class="section" aria-labelledby="h-id"><header><div><h2 id="h-id">${esc(t("ideas.title"))}</h2><p>${esc(t("ideas.lead"))}</p></div></header>
    <div class="ideas">${B.itineraries.map(it => ideaCard(it, false)).join("")}</div>
  </section>
  <section class="section" aria-labelledby="h-tips"><header><div><h2 id="h-tips">${esc(t("tips.title"))}</h2></div><a class="btn" href="#/guide">${icon("info")}${esc(t("tips.more"))}</a></header>
    <div class="tips">${[["money","money"],["transport","city"],["altitude","health"],["seasons",""]].map(([k, s]) => { const inner = `<h3><span class="dmd"></span>${esc(t("tips." + k))}</h3><p>${esc(t("tips." + k + ".text"))}</p>${k === "money" && RATES ? `<p class="tip-rate">${esc(ratesLine())}</p>` : ""}`; return s ? `<a class="tip" href="#/guide?s=${s}">${inner}</a>` : `<div class="tip">${inner}</div>`; }).join("")}</div>
  </section>
  ${siteFoot()}`;
}
const siteFoot = () => `<footer class="site-foot"><div class="weave"></div><div class="in">
    <div><b>${esc(t("brand"))}</b><p>${esc(t("foot.about"))}</p></div>
    <div><p>${esc(t("foot.createdBy"))} <a href="https://github.com/jordanmontt" rel="author">jordanmontt</a></p><p class="small">${esc(t("foot.credits"))}</p></div>
  </div></footer>`;

/* ───── Practical tips ───── */
function renderGuide(){
  const g = {sections:I.c("guide", "sections"), intro:I.c("guide", "intro"), phrases:I.c("guide", "phrases"), chapare:I.c("guide", "chapare")};
  const num = i => String(i + 1).padStart(2, "0");
  $("#v-home").innerHTML = `
  <section class="pagehead"><div class="in">
    <p class="kicker">${esc(t("guide.kicker"))}</p>
    <h1 tabindex="-1" id="pageTitle">${esc(t("guide.title"))}</h1>
    <p class="lead">${esc(g.intro)}</p>
  </div></section>
  <div class="weave thick"></div>
  <div class="guide">
    <nav class="toc" aria-label="${esc(t("guide.toc"))}">
      <p>${esc(t("guide.toc"))}</p>
      <ol>${g.sections.map(s => `<li><a href="#/guide?s=${s.id}">${esc(s.title)}</a></li>`).join("")}<li><a href="#/guide?s=phrases">${esc(t("guide.phrases"))}</a></li><li><a href="#/guide?s=chapare">${esc(g.chapare.title)}</a></li></ol>
    </nav>
    <div class="gbody">
      ${g.sections.map((s, i) => `<section class="gsec" id="g-${s.id}" aria-labelledby="gh-${s.id}">
        <span class="gnum" aria-hidden="true">${num(i)}</span>
        <div><h2 id="gh-${s.id}">${esc(s.title)}</h2><p class="glead">${esc(s.lead)}</p>${s.id === "money" ? ratesBox() : ""}
          <ul class="todo">${s.points.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      </section>`).join("")}
      <section class="gsec" id="g-phrases" aria-labelledby="gh-phrases">
        <span class="gnum" aria-hidden="true">${num(g.sections.length)}</span>
        <div><h2 id="gh-phrases">${esc(t("guide.phrases"))}</h2><p class="glead">${esc(t("guide.phrasesLead"))}</p>
          <dl class="phrases">${g.phrases.map(([es, tr]) => `<div><dt lang="es">${esc(es)}</dt><dd>${esc(tr)}</dd></div>`).join("")}</dl></div>
      </section>
      <section class="callout warn chapare" id="g-chapare" aria-labelledby="gh-chapare">
        <h2 id="gh-chapare">${esc(g.chapare.title)}</h2><p>${esc(g.chapare.text)}</p><p>${esc(g.chapare.road)}</p>
      </section>
    </div>
  </div>
  ${siteFoot()}`;
}
const guideLink = () => `<a class="guidelink" href="#/guide">${icon("info")}<span>${esc(t("guide.link"))} <b>${esc(t("guide.linkCta"))}</b></span>${icon("arrow")}</a>`;
const credit = () => `<p class="credit">${esc(t("foot.createdBy"))} <a href="https://github.com/jordanmontt" rel="author">jordanmontt</a>. ${esc(t("foot.credits"))}</p>`;

/* ───── Panel: places list ───── */
function matches(p){
  const q = S.q.trim().toLowerCase();
  if (!S.cats.has(p.cat)) return false;
  if (S.region !== "all" && p.region !== S.region) return false;
  if (!q) return true;
  const c = pc(p.id);
  const hay = [c.name, c.label, c.short, p.dept, t("region." + p.region), t("cat." + p.cat), ...(c.todo || [])].join(" ");
  const norm = s => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return norm(hay).includes(norm(q));
}
function placeRow(p){
  const on = inTrip(p.id), ph = photos(p.id)[0], c = pc(p.id);
  const start = tripStart(), r = start && start !== p.id ? M.shortest(start, p.id, trip.pref) : null;
  // Grouped by region, each row says its department (grouped by department, the heading does).
  return `<li class="pitem" style="${catVar(p.cat)}">
    <a href="#/place/${p.id}">${ph ? `<img src="${esc(small(ph.src))}" alt="" loading="lazy" decoding="async">` : `<span class="noimg"></span>`}
      <span style="min-width:0"><span class="nm">${esc(c.name)}</span><span class="meta"><span class="dmd"></span><span>${esc(t("cat." + p.cat))}</span>${S.group === "dept" ? "" : `<span>${esc(deptName(p.dept, "dept.short"))}</span>`}<span>${esc(fmtAlt(p.alt))}</span>${r ? `<span>${esc(t("fromStart", {h:fmtH(r.hours), place:label(start)}))}</span>` : ""}${tempsHtml(p.id)}</span></span></a>
    <button type="button" class="addbtn ${on ? "on" : ""}" data-act="toggle" data-id="${p.id}" aria-pressed="${on}" aria-label="${esc(t(on ? "trip.removeNamed" : "trip.addNamed", {name:c.name}))}">${icon(on ? "check" : "plus")}</button>
  </li>`;
}
function renderResults(){
  const list = B.places.filter(matches);
  const byDept = S.group === "dept";
  const groups = byDept ? DEPTS.map(d => [d, deptName(d), list.filter(p => p.dept === d)])
    : (S.region === "all" ? REGIONS : [S.region]).map(r => [r, t("region." + r), list.filter(p => p.region === r)]);
  // The Chapare (Cochabamba tropics) is left out on purpose: say why, next to Cochabamba.
  const chapare = `<a class="zone-note" href="#/guide?s=chapare">${icon("info")}${esc(t("chapare.short"))}</a>`;
  const html = groups.filter(([, , ps]) => ps.length)
    .map(([k, title, ps]) => `<section class="zone"><h3>${esc(title)}<span>${ps.length}</span></h3><ul class="plist">${ps.map(placeRow).join("")}</ul>${k === (byDept ? "Cochabamba" : "cbba") ? chapare : ""}</section>`).join("");
  $("#resultCount").textContent = t("results", {n:list.length});
  $("#results").innerHTML = html || `<div class="empty"><p>${esc(t("noResults"))}</p><p style="margin-top:10px"><button type="button" class="btn small" data-act="resetFilters">${esc(t("filter.reset"))}</button></p></div>`;
}
function panelMap(){
  const allCats = S.cats.size === CATS.length;
  return `<div class="in stack">
    <div><h1 class="title" tabindex="-1" id="pageTitle">${esc(t("map.title"))}</h1><p class="muted" style="margin-top:6px">${esc(t("map.intro"))}</p></div>
    <div class="search">${icon("search")}<input class="inp" id="q" type="search" value="${esc(S.q)}" placeholder="${esc(t("map.search"))}" aria-label="${esc(t("map.searchLabel"))}" autocomplete="off"></div>
    <div class="filters">
      <div class="fgrid">
        <label class="field">${esc(t("filter.region"))}<select data-set="region"><option value="all">${esc(t("filter.allRegions"))}</option>${REGIONS.map(r => `<option value="${r}" ${S.region === r ? "selected" : ""}>${esc(t("region." + r))}</option>`).join("")}</select></label>
        <label class="field">${esc(t("filter.month"))}<select data-set="month">${monthOptions()}</select></label>
      </div>
      <div class="chips" role="group" aria-label="${esc(t("filter.cats"))}">
        ${CATS.map(c => `<button type="button" class="fchip" data-act="cat" data-k="${c}" aria-pressed="${S.cats.has(c)}" style="${catVar(c)}"><span class="dmd"></span>${esc(t("cat." + c))}</button>`).join("")}
        ${allCats ? "" : `<button type="button" class="fchip" data-act="allCats">${esc(t("filter.allCats"))}</button>`}
      </div>
    </div>
    <div class="row resultrow"><p class="resultline" id="resultCount" aria-live="polite"></p>
      <div class="seg small" role="group" aria-label="${esc(t("group.label"))}"><span class="seg-label">${esc(t("group.label"))}</span><button type="button" data-act="group" data-v="region" aria-pressed="${S.group === "region"}">${esc(t("group.region"))}</button><button type="button" data-act="group" data-v="dept" aria-pressed="${S.group === "dept"}">${esc(t("group.dept"))}</button></div></div>
    <div id="results"></div>
    ${credit()}
  </div>`;
}

/* ───── Panel: one place ───── */
function galleryHtml(id){
  const ph = photos(id); if (!ph.length) return "";
  return `<div class="gallery" id="gallery" tabindex="0" aria-label="${esc(t("photos.label", {name:name(id)}))}">${ph.map((x, i) => `<figure><img src="${esc(x.src)}" alt="${esc(t("photos.alt", {name:name(id), i:i + 1}))}" ${i ? 'loading="lazy"' : ""} decoding="async"><figcaption>${esc(t("photos.by"))} <a href="${esc(x.page)}" target="_blank" rel="noopener">${esc(x.artist || "Wikimedia Commons")}</a>${x.lic ? ", " + esc(x.lic) : ""}</figcaption></figure>`).join("")}</div>
  ${ph.length > 1 ? `<div class="galnav" aria-hidden="true">${ph.map((x, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}`;
}
function edgeRow(e, from){
  const other = from ? (e.a === from ? e.b : e.a) : null;
  const txt = from ? label(other) : `${label(e.a)} – ${label(e.b)}`;
  return `<li><a href="#/route/${e.id}">${modeIcon(e.mode)}<span>${esc(txt)}<span class="sr-only">, ${esc(t("mode." + e.mode))}</span></span><span class="h">${esc(edgeText(e.id).t)}</span></a></li>`;
}
function panelPlace(id){
  const p = byId[id], c = pc(id), on = inTrip(id);
  const start = tripStart(), r = start && start !== id ? M.shortest(start, id, trip.pref) : null;
  const conns = adj[id].map(n => n.e).sort((a, b) => a.h - b.h);
  const food = (B.food[id] || []).map(k => I.c("dishes", k)).filter(Boolean);
  const days = p.days[0] === p.days[1] ? fmtDays(p.days[1]) : t("daysRange", {a:I.num(p.days[0]), b:fmtDays(p.days[1])});
  return `<div class="in stack" style="${catVar(p.cat)}">
    <a class="linkback" href="#/map" data-act="back">${icon("back")}${esc(t(S.fromMap ? "back.map" : "back.places"))}</a>
    ${galleryHtml(id)}
    <div class="stack" style="gap:10px">
      <div class="row"><span class="chip c"><span class="d"></span>${esc(t("cat." + p.cat))}</span></div>
      <h1 class="title" tabindex="-1" id="pageTitle">${esc(c.name)}</h1>
      <p class="where">${icon("pin")}<span><b>${esc(deptName(p.dept))}</b> · <a href="#/map?region=${p.region}">${esc(t("region." + p.region))}</a></span></p>
    </div>
    <p class="story">${esc(c.story || c.short)}</p>
    <div class="row">
      <button type="button" class="btn ${on ? "added" : "primary"}" data-act="toggle" data-id="${id}" aria-pressed="${on}">${icon(on ? "check" : "plus")}${esc(t(on ? "trip.inTrip" : "trip.add"))}</button>
      <button type="button" class="btn ghost phone-only" data-act="showMap">${icon("map")}${esc(t("showOnMap"))}</button>
      <a class="btn ghost" href="https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lng}" target="_blank" rel="noopener">${icon("ext")}Google Maps</a>
    </div>
    <div class="facts">
      <div><b>${esc(fmtAlt(p.alt))}</b><span>${esc(t("fact.alt"))}</span></div>
      <div><b>${esc(days)}</b><span>${esc(t("fact.days"))}</span></div>
      ${r ? `<div><b>${esc(fmtH(r.hours))}</b><span>${esc(t("fact.from", {place:label(start)}))}</span></div>` : ""}
    </div>
    ${p.alt >= 3500 ? `<div class="callout warn"><strong>${esc(t("alt.warnTitle"))}</strong> ${esc(t("alt.warn"))}</div>` : ""}
    <section class="sec"><h2>${esc(t("place.todo"))}</h2><ul class="todo">${(c.todo || []).map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
    ${food.length ? `<section class="sec"><h2>${esc(t("place.food"))}</h2><ul class="food">${food.map(([n, d]) => `<li><b>${esc(n)}</b><span>${esc(d)}</span></li>`).join("")}</ul></section>` : ""}
    <section class="sec"><h2>${esc(t("place.weather"))}</h2>
      <label class="field" style="max-width:260px">${esc(t("filter.month"))}<select data-set="month">${monthOptions()}</select></label>
      ${weatherBlock(p)}</section>
    ${c.tips ? `<div class="callout"><strong>${esc(t("place.tip"))}</strong> ${esc(c.tips)}</div>` : ""}
    ${p.tour ? `<section class="sec"><h2>${esc(t("place.tourStops"))}</h2><p class="muted">${esc(I.list(B.tourStops.map(s => I.c("tour", s.id))))}</p></section>` : ""}
    <section class="sec"><h2>${esc(t("place.getThere"))}</h2><ul class="elist">${conns.map(e => edgeRow(e, id)).join("")}</ul></section>
    ${guideLink()}
    ${credit()}
  </div>`;
}

/* ───── Panel: routes ───── */
function placeOptions(sel, firstLabel){
  const coll = I.collator();
  const sorted = B.places.slice().sort((a, b) => coll.compare(name(a.id), name(b.id)));
  return (firstLabel ? `<option value="">${esc(firstLabel)}</option>` : "") + sorted.map(p => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(withDept(p.id))}</option>`).join("");
}
function pathHtml(r){
  if (!r) return `<div class="pathres"><p style="padding-top:8px"><strong>${esc(t("calc.none"))}</strong> ${esc(t("calc.tryFly"))}</p></div>`;
  if (!r.steps.length) return "";
  const fly = r.steps.some(s => s.e.mode === "avion");
  return `<div class="pathres"><ul class="elist">${r.steps.map(s => `<li><a href="#/route/${s.e.id}">${modeIcon(s.e.mode)}<span>${esc(label(s.from))} – ${esc(label(s.to))}<span class="sr-only">, ${esc(t("mode." + s.e.mode))}</span></span><span class="h">${esc(edgeText(s.e.id).t)}</span></a></li>`).join("")}</ul>
    <p class="tot">${esc(t("calc.total", {h:fmtH(r.hours)}))}${fly ? " " + esc(t("calc.airport")) : ""}. ${esc(t("calc.plan", {d:fmtDays(M.travelDays(r.hours))}))}</p></div>`;
}
function panelRoutes(){
  const C = S.calc;
  if (!C.from) C.from = tripStart() || "lapaz";
  if (!C.to) C.to = C.from === "uyuni" ? "lapaz" : "uyuni";
  const r = C.show ? M.shortest(C.from, C.to, C.pref) : null;
  const groups = MODES.map(m => [m, B.edges.filter(e => e.mode === m)]).filter(([, es]) => es.length);
  return `<div class="in stack">
    <div><h1 class="title" tabindex="-1" id="pageTitle">${esc(t("routes.title"))}</h1><p class="muted" style="margin-top:6px">${esc(t("routes.intro"))}</p></div>
    <section class="sec" aria-labelledby="h-calc"><h2 id="h-calc">${esc(t("calc.title"))}</h2>
      <div class="calc">
        <label class="field">${esc(t("calc.from"))}<select data-set="calcFrom">${placeOptions(C.from)}</select></label>
        <button type="button" class="swap" data-act="swap" aria-label="${esc(t("calc.swap"))}">${icon("swap")}</button>
        <label class="field">${esc(t("calc.to"))}<select data-set="calcTo">${placeOptions(C.to)}</select></label>
      </div>
      <div class="row" style="justify-content:space-between">
        <div class="seg" role="group" aria-label="${esc(t("pref.label"))}"><button type="button" data-act="cpref" data-v="route" aria-pressed="${C.pref === "route"}">${esc(t("pref.route"))}</button><button type="button" data-act="cpref" data-v="avion" aria-pressed="${C.pref === "avion"}">${esc(t("pref.fly"))}</button></div>
        <button type="button" class="btn primary small" data-act="calc">${esc(t("calc.go"))}</button>
      </div>
      <div aria-live="polite">${C.show ? pathHtml(r) : ""}</div>
    </section>
    <section class="sec"><h2>${esc(t("routes.all"))}</h2>
      ${groups.map(([m, es]) => `<details class="more" ${m === "bus" ? "" : ""}><summary>${modeIcon(m)} ${esc(t("mode." + m))} <span class="muted">(${es.length})</span></summary><ul class="elist" style="margin-top:6px">${es.map(e => edgeRow(e)).join("")}</ul></details>`).join("")}
      <p class="small muted">${esc(t("routes.disclaimer"))}</p>
    </section>
    ${guideLink()}
    ${credit()}
  </div>`;
}
function panelRoute(id){
  const e = edgeById[id], a = byId[e.a], b = byId[e.b], R = B.routes[e.id], et = edgeText(id);
  const dAlt = b.alt - a.alt;
  return `<div class="in stack">
    <a class="linkback" href="#/routes">${icon("back")}${esc(t("back.routes"))}</a>
    <div class="stack" style="gap:8px"><div class="row">${modeIcon(e.mode)}<span class="muted small" style="font-weight:600">${esc(t("mode." + e.mode))}</span></div>
      <h1 class="title" tabindex="-1" id="pageTitle">${esc(label(e.a))} – ${esc(label(e.b))}</h1>
      <p class="where">${icon("pin")}<span><b>${esc(a.dept === b.dept ? deptName(a.dept) : `${deptName(a.dept)} – ${deptName(b.dept)}`)}</b></span></p></div>
    <div class="facts">
      <div><b>${esc(et.t)}</b><span>${esc(t("fact.duration"))}</span></div>
      <div><b>${R && !e.straight ? esc(t("km", {k:I.num(R.km, 0)})) : "—"}</b><span>${esc(t("fact.distance"))}</span></div>
      <div><b>${Math.abs(dAlt) >= 100 ? (dAlt > 0 ? "+" : "−") + esc(fmtAlt(Math.abs(dAlt))) : "≈ 0"}</b><span>${esc(t("fact.climb"))}</span></div>
    </div>
    ${R && R.refs.length && !e.straight ? `<section class="sec"><h2>${esc(t("route.roads"))}</h2><div class="row">${R.refs.map(([r, k]) => `<span class="chip">${esc(roadName(r))}, ${esc(t("km", {k:I.num(k, 0)}))}</span>`).join("")}</div></section>` : ""}
    <dl class="kv">
      ${et.road ? `<dt>${esc(t("route.way"))}</dt><dd>${esc(et.road)}</dd>` : ""}
      <dt>${esc(t("route.how"))}</dt><dd>${esc(et.how)}</dd>
      ${et.note ? `<dt>${esc(t("route.note"))}</dt><dd>${esc(et.note)}</dd>` : ""}
    </dl>
    <div class="row">
      <a class="btn small" href="#/place/${a.id}">${esc(label(a.id))}</a>
      <a class="btn small" href="#/place/${b.id}">${esc(label(b.id))}</a>
      ${["bus", "velo"].includes(e.mode) ? `<a class="btn small ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=driving">${icon("ext")}${esc(t("route.gmaps"))}</a>` : ""}
    </div>
    ${credit()}
  </div>`;
}

/* ───── Panel: trip planner ───── */
// Woven timeline: one stripe per stop in its category colour, hatched gaps for travel.
function tripBar(tr, tot, small){
  if (!tr.stops.length) return "";
  const scale = Math.max(tot.total, tr.days || 0, 1), pct = d => (d / scale * 100).toFixed(2) + "%";
  let html = "";
  tr.stops.forEach((s, i) => {
    if (i > 0 && tot.legs[i-1] && tot.legs[i-1].days) html += `<i class="travel" style="width:${pct(tot.legs[i-1].days)}"></i>`;
    if (s.d) html += `<i style="width:${pct(s.d)};${catVar(byId[s.id].cat)}" title="${esc(label(s.id))}"></i>`;
  });
  const endLeg = tot.legs.length >= tr.stops.length ? tot.legs[tot.legs.length - 1] : null;
  if (endLeg && endLeg.days) html += `<i class="travel" style="width:${pct(endLeg.days)}"></i>`;
  if (tr.days && tot.total < tr.days) html += `<i class="free" style="width:${pct(tr.days - tot.total)}"></i>`;
  if (tr.days && tot.total > tr.days) html += `<span class="limit" style="left:${pct(tr.days)}"></span>`;
  return `<div class="tripbar" ${small ? 'style="height:14px;border-radius:3px"' : ""} aria-hidden="true">${html}</div>`;
}
function legLine(l){
  if (!l.r) return esc(t("trip.noLeg"));
  return l.r.steps.map(st => `<strong>${esc(t("modeShort." + st.e.mode))}</strong> ${esc(edgeText(st.e.id).t)}${st.to !== l.to ? " " + esc(t("trip.via", {place:label(st.to)})) : ""}`).join(", ");
}
function startOptions(sel, withEmpty){
  const used = new Set([...ENTRY_AIR, ...ENTRY_LAND]);
  const coll = I.collator();
  const opt = id => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(withDept(id))}</option>`;
  return (withEmpty ? `<option value="">${esc(t("trip.pickStart"))}</option>` : "")
    + `<optgroup label="${esc(t("trip.byAir"))}">${ENTRY_AIR.map(opt).join("")}</optgroup>`
    + `<optgroup label="${esc(t("trip.byLand"))}">${ENTRY_LAND.map(id => `<option value="${id}" ${id === sel ? "selected" : ""}>${esc(t("trip.border." + id, {place:name(id)}))}</option>`).join("")}</optgroup>`
    + `<optgroup label="${esc(t("trip.otherPlaces"))}">${B.places.filter(p => !used.has(p.id)).sort((a, b) => coll.compare(name(a.id), name(b.id))).map(p => opt(p.id)).join("")}</optgroup>`;
}
function altChart(){
  const pts = trip.stops.map(s => byId[s.id]); if (pts.length < 2) return "";
  const W = 360, H = 116, pl = 44, pr = 8, pt = 10, pb = 22, max = 5000;
  const x = i => pl + i * (W - pl - pr) / (pts.length - 1), y = a => pt + (1 - Math.min(a, max) / max) * (H - pt - pb);
  let d = ""; pts.forEach((p, i) => { d += (i ? " H" + x(i).toFixed(1) + " V" : "M" + x(i).toFixed(1) + " ") + y(p.alt).toFixed(1); });
  return `<svg class="altchart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(t("trip.altChart"))}">
    ${[0, 2000, 4000].map(a => `<line class="gl" x1="${pl}" x2="${W - pr}" y1="${y(a)}" y2="${y(a)}"/><text x="${pl - 5}" y="${y(a) + 3}" text-anchor="end">${esc(fmtAlt(a))}</text>`).join("")}
    <line class="hl" x1="${pl}" x2="${W - pr}" y1="${y(3500)}" y2="${y(3500)}"/><text x="${W - pr}" y="${y(3500) - 4}" text-anchor="end">${esc(fmtAlt(3500))}</text>
    <path class="ar" d="${d} V${H - pb} H${pl} Z"/><path class="ln" d="${d}"/>
    ${pts.map((p, i) => `<text x="${x(i)}" y="${H - 7}" text-anchor="middle">${i + 1}</text>`).join("")}
  </svg>`;
}
function dayLabel(a, b){ return b > a ? t("dayRange", {a, b}) : t("dayOne", {a}); }
function panelTrip(){
  const head = `<div><h1 class="title" tabindex="-1" id="pageTitle">${esc(t("trip.title"))}</h1><p class="muted" style="margin-top:6px">${esc(t("trip.intro"))}</p></div>`;
  if (!trip.stops.length){
    return `<div class="in stack">${head}
      <div class="empty stack" style="gap:12px">
        <p>${esc(t("trip.emptyLead"))}</p>
        <label class="field">${esc(t("trip.start"))}<select data-set="start">${startOptions("", true)}</select></label>
        <p class="small">${esc(t("trip.emptyOr"))}</p>
        <div><a class="btn" href="#/map">${icon("map")}${esc(t("trip.browse"))}</a></div>
      </div>
      <section class="sec"><h2>${esc(t("ideas.title"))}</h2><p class="muted small">${esc(t("ideas.lead"))}</p>${B.itineraries.map(it => ideaCard(it, true)).join("")}</section>
      ${credit()}</div>`;
  }
  const tot = M.totals(trip), {legs, stay, travel, total} = tot;
  const over = trip.days && total > trip.days, free = trip.days ? trip.days - total : 0;
  const jumps = [];
  trip.stops.forEach((s, i) => { if (i && byId[s.id].alt >= 3500 && byId[trip.stops[i-1].id].alt < 2000) jumps.push(label(s.id)); });
  let day = 1;
  const rows = trip.stops.map((s, i) => {
    let legHtml = "";
    if (i > 0){ const l = legs[i-1]; day += l.days;
      legHtml = `<li class="leg ${l.r ? "" : "bad"}"><button type="button" data-act="leg" data-i="${i-1}" aria-label="${esc(t("trip.legShow", {a:label(l.from), b:label(l.to)}))}"><span>${legLine(l)}</span><span>${l.r ? esc(t("trip.legTime", {h:fmtH(l.r.hours)})) + ", " + esc(l.days ? t("trip.legDays", {d:fmtDays(l.days)}) : t("trip.legSameDay")) : ""}</span></button></li>`; }
    const p = byId[s.id], d0 = Math.floor(day), d1 = Math.floor(day + Math.max(s.d, 1) - 1); day += s.d;
    return legHtml + `<li class="stop" style="${catVar(p.cat)}"><span class="num"><span>${i + 1}</span></span>
      <div style="min-width:0"><a class="nm" href="#/place/${p.id}">${esc(name(p.id))}</a>${i === 0 ? `<span class="tagstart">${esc(t("trip.startTag"))}</span>` : ""}
        <div class="when">${esc(s.d ? dayLabel(d0, d1) : t("trip.passing"))}, ${esc(deptName(p.dept, "dept.short"))}, ${esc(fmtAlt(p.alt))} ${tempsHtml(p.id)}</div></div>
      <div><span class="stepper"><button type="button" data-act="dec" data-i="${i}" aria-label="${esc(t("trip.lessDay", {name:label(p.id)}))}">−</button><output>${esc(fmtDays(s.d))}</output><button type="button" data-act="inc" data-i="${i}" aria-label="${esc(t("trip.moreDay", {name:label(p.id)}))}">+</button></span>
        <div class="stop-tools"><button type="button" class="icon-btn" data-act="up" data-i="${i}" ${i === 0 ? "disabled" : ""} aria-label="${esc(t("trip.up", {name:label(p.id)}))}">${icon("up")}</button><button type="button" class="icon-btn" data-act="down" data-i="${i}" ${i === trip.stops.length - 1 ? "disabled" : ""} aria-label="${esc(t("trip.down", {name:label(p.id)}))}">${icon("down")}</button><button type="button" class="icon-btn" data-act="rm" data-i="${i}" aria-label="${esc(t("trip.removeNamed", {name:label(p.id)}))}">${icon("x")}</button></div></div>
    </li>`;
  }).join("");
  const endLeg = legs.length >= trip.stops.length ? legs[legs.length - 1] : null;
  const endOpts = [["start", t("trip.endStart")], ["last", t("trip.endLast")], ...ENTRY_AIR.map(id => [id, t("trip.endAt", {place:name(id)})])];
  return `<div class="in stack">${head}
    <div class="gauge ${over ? "over" : ""}">
      <div class="row" style="justify-content:space-between;align-items:flex-end">
        <div class="big">${esc(I.num(total))}<small>${esc(trip.days ? t("trip.ofDays", {n:trip.days, d:I.num(trip.days)}) : t("trip.daysTotal", {n:total}))}</small></div>
        ${trip.days ? `<span class="status ${over ? "over" : ""}">${esc(over ? t("trip.tooMany", {d:fmtDays(-free)}) : free ? t("trip.free", {d:fmtDays(free)}) : t("trip.exact"))}</span>` : ""}
      </div>
      ${tripBar(trip, tot, false)}
      <div class="legend-mini"><span>${esc(t("trip.stay", {d:fmtDays(stay)}))}</span><span><i style="background:repeating-linear-gradient(135deg,var(--route) 0 2px,transparent 2px 5px);opacity:.6"></i>${esc(t("trip.travel", {d:fmtDays(travel)}))}</span></div>
    </div>
    <div class="settings">
      <label class="field">${esc(t("trip.start"))}<select data-set="start">${startOptions(trip.stops[0].id, false)}</select></label>
      <label class="field">${esc(t("trip.length"))}<input class="inp" type="number" inputmode="numeric" min="1" max="120" data-set="days" value="${trip.days || ""}" placeholder="${esc(t("trip.noLength"))}"></label>
      <label class="field">${esc(t("trip.end"))}<select data-set="end">${endOpts.map(([v, txt]) => `<option value="${v}" ${trip.end === v ? "selected" : ""}>${esc(txt)}</option>`).join("")}</select></label>
      <label class="field">${esc(t("trip.month"))}<select data-set="month">${monthOptions()}</select></label>
      <div class="field wide"><span>${esc(t("pref.label"))}</span><div class="seg" role="group" aria-label="${esc(t("pref.label"))}"><button type="button" data-act="pref" data-v="route" aria-pressed="${trip.pref === "route"}">${esc(t("pref.route"))}</button><button type="button" data-act="pref" data-v="avion" aria-pressed="${trip.pref === "avion"}">${esc(t("pref.fly"))}</button></div></div>
    </div>
    ${jumps.length ? `<div class="callout warn"><strong>${esc(t("trip.jumpTitle"))}</strong> ${esc(t("trip.jump", {places:I.list(jumps)}))}</div>` : ""}
    <ol class="stops">${rows}${endLeg ? `<li class="leg ${endLeg.r ? "" : "bad"}"><button type="button" data-act="leg" data-i="${legs.length - 1}"><span>${esc(trip.end === "start" ? t("trip.backTo", {place:label(endLeg.to)}) : t("trip.endAt", {place:label(endLeg.to)}))}: ${legLine(endLeg)}</span><span>${endLeg.r ? esc(t("trip.legTime", {h:fmtH(endLeg.r.hours)})) : ""}</span></button></li>` : ""}</ol>
    <p class="small muted">${esc(t("trip.addMore"))} <a href="#/map">${esc(t("trip.browse"))}</a></p>
    <div class="row">
      ${trip.stops.length > 2 ? `<button type="button" class="btn small" data-act="opt">${icon("sort")}${esc(t("trip.optimize"))}</button>` : ""}
      <button type="button" class="btn small" data-act="share">${icon("link")}${esc(t("trip.share"))}</button>
      <button type="button" class="btn small" data-act="copy">${icon("copy")}${esc(t("trip.copy"))}</button>
      <button type="button" class="btn small ghost" data-act="clear">${esc(t("trip.clear"))}</button>
    </div>
    ${trip.stops.length > 1 ? `<section class="sec"><h2>${esc(t("trip.altTitle"))}</h2>${altChart()}</section>` : ""}
    <details class="more"><summary>${esc(t("ideas.other"))}</summary><div class="stack" style="margin-top:12px">${B.itineraries.map(it => ideaCard(it, true)).join("")}</div></details>
    ${credit()}
  </div>`;
}
function summaryText(){
  const {legs, stay, travel, total} = M.totals(trip);
  const lines = [t("sum.title"), ""];
  let day = 1;
  trip.stops.forEach((s, i) => {
    if (i > 0){ const l = legs[i-1]; lines.push("   → " + legPlain(l)); day += l.days; }
    const d0 = Math.floor(day), d1 = Math.floor(day + Math.max(s.d, 1) - 1);
    lines.push(`${s.d ? dayLabel(d0, d1) : t("trip.passing")}: ${name(s.id)} (${fmtDays(s.d)})`);
    day += s.d;
  });
  if (legs.length >= trip.stops.length){ const l = legs[legs.length - 1]; lines.push("   → " + legPlain(l)); }
  lines.push("", t("sum.total", {stay:fmtDays(stay), travel:fmtDays(travel), total:fmtDays(total)}), "", shareUrl());
  return lines.join("\n");
}
const legPlain = l => !l.r ? t("trip.noLeg") : l.r.steps.map(s => `${label(s.to)} (${t("modeShort." + s.e.mode)}, ${edgeText(s.e.id).t})`).join(" → ");
const shareUrl = () => location.href.split("#")[0].split("?")[0] + "#/trip?t=" + M.encode(trip);
function copyText(txt, okMsg){
  const fallback = () => { window.prompt(t("copy.manual"), txt); };
  try { navigator.clipboard.writeText(txt).then(() => toast(okMsg), fallback); } catch(e){ fallback(); }
}

/* ───── Map ───── */
// Leaflet and the map geometry (~450 KB) only load when a map view is first opened.
const LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
let mapLoading = null;
function ensureMap(){
  if (!mapLoading) mapLoading = Promise.all([B.loadScript(LEAFLET_JS), B.loadScript("data/geo.js?v=" + B.release)]).then(initMap);
  return mapLoading;
}
let map, markers = {}, edgeEls = {}, layers = {}, relief, detailed, baseGroup, geoLabels = [], subMarkers = [];
const GEOLABELS = [["geo.peru",-12.6,-70.3,"country"],["geo.brazil",-11.6,-61.2,"country"],["geo.chile",-21.6,-69.6,"country"],["geo.argentina",-23.6,-64.2,"country"],["geo.paraguay",-21.4,-59.6,"country"],
  ["geo.titicaca",-15.95,-69.55,"water"],["geo.uyuni",-20.55,-67.55,"water"],["geo.coipasa",-19.35,-68.25,"water"],["geo.poopo",-18.75,-67.05,"water"],
  ["geo.altiplano",-18.4,-67.75,"region"],["geo.amazon",-12.3,-65.6,"region"],["geo.chaco",-20.6,-62.0,"region"],["geo.chiquitania",-17.2,-61.4,"region"],["geo.moxos",-14.2,-65.4,"region"],["geo.cordillera",-15.95,-68.25,"region"]];
function tourLine(){ const u = byId.uyuni; return [[u.lat, u.lng], ...B.tourStops.map(s => [s.lat, s.lng]), [u.lat, u.lng]]; }
function arc(a, b){
  const pa = [a.lat, a.lng], pb = [b.lat, b.lng], mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2, dx = pb[0] - pa[0], dy = pb[1] - pa[1];
  const c = [mx - dy * 0.18, my + dx * 0.18], out = [];
  for (let i = 0; i <= 28; i++){ const s = i / 28, u = 1 - s; out.push([u*u*pa[0] + 2*u*s*c[0] + s*s*pb[0], u*u*pa[1] + 2*u*s*c[1] + s*s*pb[1]]); }
  return out;
}
function edgeLine(e){
  const a = byId[e.a], b = byId[e.b];
  if (e.geom) return e.geom;
  if (e.tourgeom) return tourLine();
  if (e.mode === "avion") return arc(a, b);
  if (!e.straight && B.routes[e.id]) return B.routes[e.id].c;
  return [[a.lat, a.lng], ...(e.via || []), [b.lat, b.lng]];
}
function initMap(){
  const BASE = B.base;
  map = L.map("map", {zoomControl:true, minZoom:5, maxZoom:13, zoomSnap:0.5, maxBounds:L.latLngBounds([[BASE.bounds[0] - 2, BASE.bounds[1] - 3], [BASE.bounds[2] + 2, BASE.bounds[3] + 3]])});
  map.attributionControl.setPrefix(false);
  map.zoomControl.setPosition("topleft");
  relief = L.imageOverlay("assets/relief.jpg", [[BASE.bounds[0], BASE.bounds[1]], [BASE.bounds[2], BASE.bounds[3]]], {className:"relief-img", interactive:false, attribution:"Terrain Tiles (SRTM), Natural Earth, OSRM / © OpenStreetMap"}).addTo(map);
  detailed = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}", {maxZoom:18, crossOrigin:true, attribution:"Esri, HERE, Garmin, © OpenStreetMap contributors"});
  baseGroup = L.layerGroup().addTo(map);
  const geo = (g, cls, fill) => L.geoJSON(g, {interactive:false, style:{className:cls, fill:!!fill, stroke:true}}).addTo(baseGroup);
  geo(BASE.mask, "mask", true); geo(BASE.rivers, "river"); geo(BASE.lakes, "lake", true); geo(BASE.salars, "salar", true);
  geo(BASE.depts, "dept"); geo(BASE.borders, "nborder"); geo(BASE.bolivia, "bol");
  geoLabels = GEOLABELS.map(([k, la, ln, c]) => L.marker([la, ln], {interactive:false, keyboard:false, icon:L.divIcon({className:"", html:"", iconSize:null})}).addTo(baseGroup));
  ["edges", "trip", "calc", "markers"].forEach(k => layers[k] = L.layerGroup().addTo(map));
  B.edges.forEach(e => {
    const ll = edgeLine(e);
    const vis = L.polyline(ll, {className:`edge m-${e.mode}`, interactive:false});
    const hit = L.polyline(ll, {className:"edge-hit", interactive:!coarse, bubblingMouseEvents:false});
    hit.on("click", () => go("#/route/" + e.id));
    hit.on("mouseover", () => vis.getElement() && vis.getElement().classList.add("hl"));
    hit.on("mouseout", () => { if (S.edge !== e.id) vis.getElement() && vis.getElement().classList.remove("hl"); });
    edgeEls[e.id] = {e, vis, hit};
  });
  B.places.forEach(p => {
    const m = L.marker([p.lat, p.lng], {icon:L.divIcon({className:"pin-wrap", html:"", iconSize:[16,16], iconAnchor:[8,8]}), riseOnHover:true, zIndexOffset:MAJOR.has(p.id) ? 500 : 0});
    m.on("click", () => {
      if (isPhone() && document.body.classList.contains("show-map")) showPreview(p.id);
      else go("#/place/" + p.id);
    });
    markers[p.id] = m;
  });
  subMarkers = B.tourStops.map(s => L.marker([s.lat, s.lng], {icon:L.divIcon({className:"pin-wrap", html:"", iconSize:[9,9], iconAnchor:[4,4]}), zIndexOffset:-100}).on("click", () => go("#/place/salar")).addTo(map));
  detailed.on("tileerror", () => { if (S.basemap === "detailed"){ setBasemap("relief"); toast(t("map.detailedFail")); } });
  map.on("zoomend", zoomClass);
  map.on("click", () => {
    if (S.preview) closePreview();
    else if (!isPhone() && (S.view === "place" || S.view === "route")) go("#/map");
  });
  // The container can still be 0×0 on a cold load (styles not applied yet): frame the
  // country once it has a real size, and keep Leaflet in sync with later resizes.
  let framed = false;
  const frame = () => {
    const el = map.getContainer();
    if (!el.clientWidth || !el.clientHeight) return;
    map.invalidateSize();
    if (!framed){ framed = true; map.fitBounds([[-22.9, -69.6], [-9.7, -57.5]], {padding:[10, 10], animate:false}); focusMap(); }
  };
  map.setView([-16.5, -64.5], 5);
  if (window.ResizeObserver) new ResizeObserver(frame).observe(map.getContainer());
  frame();
  zoomClass();
  relabelMap();
}
function relabelMap(){
  GEOLABELS.forEach(([k, , , c], i) => geoLabels[i].setIcon(L.divIcon({className:"", html:`<div class="geo-label ${c}">${esc(t(k))}</div>`, iconSize:null})));
  B.places.forEach(p => {
    const m = markers[p.id];
    m.setIcon(L.divIcon({className:"pin-wrap", html:`<div class="pin ${MAJOR.has(p.id) ? "major" : ""}" style="${catVar(p.cat)}"><i></i><span>${esc(label(p.id))}</span></div>`, iconSize:[16,16], iconAnchor:[8,8]}));
    m.options.title = name(p.id);
    m.unbindTooltip();
    if (!matchMedia("(hover:none)").matches){
      const ph = photos(p.id)[0];
      m.bindTooltip(() => { const w = S.month >= 0 ? M.climate(p.id, S.month) : null; return `${ph ? `<img src="${esc(small(ph.src))}" alt="">` : ""}<div>${esc(name(p.id))}<small class="tip-where">${esc(deptName(p.dept))}</small><small>${esc(pc(p.id).short)}</small>${w ? `<small>${esc(t("map.tipWx", {month:I.month(S.month), max:w.max, min:w.min}))}</small>` : ""}</div>`; }, {direction:"top", offset:[0, -10], className:"ptip", opacity:1});
    }
  });
  subMarkers.forEach((m, i) => { const n = I.c("tour", B.tourStops[i].id); m.setIcon(L.divIcon({className:"pin-wrap", html:`<div class="pin sub"><i></i><span>${esc(n)}</span></div>`, iconSize:[9,9], iconAnchor:[4,4]})); });
  Object.values(edgeEls).forEach(({e, hit}) => { hit.unbindTooltip(); hit.bindTooltip(`${esc(label(e.a))} – ${esc(label(e.b))}: ${esc(t("modeShort." + e.mode))}, ${esc(edgeText(e.id).t)}`, {sticky:true, direction:"top", opacity:.95}); });
  renderMapCtl();
  drawMap();
}
function zoomClass(){ const z = map.getZoom(), c = map.getContainer(); c.classList.toggle("zlow", z < 7); c.classList.toggle("zmid", z >= 7 && z < 8); }
function setBasemap(k){
  S.basemap = k;
  if (k === "detailed"){ map.addLayer(detailed); map.removeLayer(relief); map.removeLayer(baseGroup); }
  else { map.removeLayer(detailed); if (!map.hasLayer(relief)) relief.addTo(map); if (!map.hasLayer(baseGroup)) baseGroup.addTo(map); }
  renderMapCtl();
}
function renderMapCtl(){
  $("#mapTop").innerHTML = `<div class="seg" role="group" aria-label="${esc(t("map.basemap"))}"><button type="button" data-act="basemap" data-v="relief" aria-pressed="${S.basemap === "relief"}">${esc(t("map.relief"))}</button><button type="button" data-act="basemap" data-v="detailed" aria-pressed="${S.basemap === "detailed"}">${esc(t("map.detailed"))}</button></div>`;
  const open = !isPhone() && (!$("#legend") || $("#legend").open);
  $("#mapBottom").innerHTML = `<details class="legend" id="legend" ${open ? "open" : ""}><summary>${esc(t("map.legend"))}</summary>
    <div class="chips" role="group" aria-label="${esc(t("map.lines"))}">${MODES.map(m => `<button type="button" class="fchip" data-act="mode" data-k="${m}" aria-pressed="${S.modes.has(m)}">${modeIcon(m)}${esc(t("modeShort." + m))}</button>`).join("")}</div></details>`;
}
const visible = p => S.cats.has(p.cat) || inTrip(p.id) || S.place === p.id;
function drawMap(){
  if (!map) return;
  const sel = S.place || S.preview, selEdge = S.edge;
  B.places.forEach(p => {
    const m = markers[p.id], vis = visible(p);
    if (vis && !layers.markers.hasLayer(m)) layers.markers.addLayer(m);
    if (!vis && layers.markers.hasLayer(m)) layers.markers.removeLayer(m);
    const el = m.getElement(); if (!el) return;
    const pin = el.querySelector(".pin"); if (!pin) return;
    pin.classList.toggle("sel", sel === p.id);
    pin.classList.toggle("intrip", inTrip(p.id));
    let dim = false;
    if (sel) dim = !(sel === p.id || adj[sel].some(n => n.to === p.id));
    else if (S.view === "map" && S.region !== "all") dim = p.region !== S.region;
    else if (S.view === "map" && S.q.trim()) dim = !matches(p);
    pin.classList.toggle("dimmed", dim);
  });
  Object.values(edgeEls).forEach(({e, vis, hit}) => {
    const show = (S.modes.has(e.mode) && visible(byId[e.a]) && visible(byId[e.b])) || selEdge === e.id;
    [vis, hit].forEach(l => { if (show && !layers.edges.hasLayer(l)) layers.edges.addLayer(l); if (!show && layers.edges.hasLayer(l)) layers.edges.removeLayer(l); });
    const el = vis.getElement(); if (!el) return;
    const touches = sel && (e.a === sel || e.b === sel);
    el.classList.toggle("hl", selEdge === e.id || !!touches);
    el.classList.toggle("dim", (!!sel && !touches) || (!!selEdge && selEdge !== e.id));
  });
  layers.trip.clearLayers();
  if (S.view === "trip" || S.view === "place" || S.view === "map"){
    const {legs} = M.totals(trip);
    legs.forEach(l => { if (!l.r) return; l.r.steps.forEach(s => {
      let ll = edgeLine(s.e); if (s.rev) ll = ll.slice().reverse();
      layers.trip.addLayer(L.polyline(ll, {className:"trip-case", interactive:false}));
      layers.trip.addLayer(L.polyline(ll, {className:`trip m-${s.e.mode}`, interactive:false}));
    }); });
    const seen = {};
    trip.stops.forEach((s, i) => (seen[s.id] = seen[s.id] || []).push(i + 1));
    Object.entries(seen).forEach(([id, nums]) => { const p = byId[id];
      layers.trip.addLayer(L.marker([p.lat, p.lng], {interactive:false, keyboard:false, zIndexOffset:1000, icon:L.divIcon({className:"tripnum", html:`<b>${nums.join(", ")}</b>`, iconSize:[0, 0]})}));
    });
  }
  layers.calc.clearLayers();
  if (S.view === "routes" && S.calc.show){
    const r = M.shortest(S.calc.from, S.calc.to, S.calc.pref);
    if (r) r.steps.forEach(s => layers.calc.addLayer(L.polyline(edgeLine(s.e), {className:"calc-path", interactive:false})));
  }
}
function focusMap(){
  if (!map) return;
  const pad = {padding:[50, 50], maxZoom:9};
  if (S.view === "place"){ const p = byId[S.place]; map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 7.5), {duration:.6}); }
  else if (S.view === "route") map.fitBounds(edgeLine(edgeById[S.edge]), pad);
  else if (S.view === "trip" && trip.stops.length > 1) map.fitBounds(trip.stops.map(s => [byId[s.id].lat, byId[s.id].lng]), {padding:[60, 60], maxZoom:8});
  else if (S.view === "map" && S.region !== "all") fitRegion();
  else if (S.view === "routes" && S.calc.show) fitCalc();
}
function fitRegion(){ const pts = B.places.filter(p => p.region === S.region).map(p => [p.lat, p.lng]); if (pts.length) map.fitBounds(pts, {padding:[60, 60], maxZoom:9}); }
function fitCalc(){ const r = M.shortest(S.calc.from, S.calc.to, S.calc.pref); if (r && r.steps.length){ const all = []; r.steps.forEach(s => all.push(...edgeLine(s.e))); map.fitBounds(all, {padding:[50, 50], maxZoom:9}); } }

/* ───── Phone map: bottom card for a tapped place ───── */
function showPreview(id){
  S.preview = id; renderSheet(); drawMap();
  const p = byId[id], pt = map.latLngToContainerPoint([p.lat, p.lng]), h = map.getSize().y;
  if (pt.y > h * 0.45) map.panBy([0, pt.y - h * 0.35]);
}
function closePreview(){ S.preview = null; renderSheet(); drawMap(); }
function renderSheet(){
  const el = $("#sheet"), id = S.preview;
  document.body.classList.toggle("has-sheet", !!id);
  if (!id){ el.hidden = true; el.innerHTML = ""; return; }
  const p = byId[id], c = pc(id), on = inTrip(id), ph = photos(id)[0];
  el.hidden = false;
  el.innerHTML = `<article class="sheet-card" style="${catVar(p.cat)}" aria-label="${esc(c.name)}">
    ${ph ? `<img src="${esc(small(ph.src))}" alt="">` : ""}
    <div class="sheet-txt">
      <span class="chip c"><span class="d"></span>${esc(t("cat." + p.cat))}</span>
      <h2>${esc(c.name)}</h2>
      <p class="sheet-where">${esc(deptName(p.dept))}</p>
      <p>${esc(c.short)}</p>
      <div class="row">
        <a class="btn primary small" href="#/place/${id}" data-act="openFromMap">${esc(t("preview.open"))}</a>
        <button type="button" class="addbtn ${on ? "on" : ""}" data-act="toggle" data-id="${id}" aria-pressed="${on}" aria-label="${esc(t(on ? "trip.removeNamed" : "trip.addNamed", {name:c.name}))}">${icon(on ? "check" : "plus")}</button>
      </div>
    </div>
    <button type="button" class="icon-btn sheet-close" data-act="closePreview" aria-label="${esc(t("close"))}">${icon("x")}</button>
  </article>`;
}

/* ───── Render ───── */
function render(navigated){
  renderChrome();
  // Home and the tips are plain pages; the other views are the list/detail panel next to the map.
  const page = S.view === "home" || S.view === "guide";
  $("#v-home").hidden = !page; $("#v-app").hidden = page;
  // Back from a place to the list: return to the spot the visitor left, not to the top.
  const restore = navigated && S.view === "map" ? S.list : null;
  let title = t("brand");
  if (S.view === "home"){ renderHome(); title = t("brand") + ", " + t("home.titleShort"); }
  else if (S.view === "guide"){ renderGuide(); title = t("guide.title") + " | " + t("brand"); }
  else {
    if (!map) ensureMap().then(() => { render(false); focusMap(); }, () => { mapLoading = null; toast(t("map.loadFail")); });
    const panel = $("#panel");
    const html = {map:panelMap, place:() => panelPlace(S.place), routes:panelRoutes, route:() => panelRoute(S.edge), trip:panelTrip}[S.view]();
    const scroll = navigated ? 0 : panel.scrollTop, winScroll = navigated ? 0 : window.scrollY;
    panel.innerHTML = html;
    if (S.view === "map") renderResults();
    panel.scrollTop = restore ? restore.panel : scroll;
    if (!navigated) window.scrollTo(0, winScroll);
    bindGallery();
    title = ({map:t("map.title"), place:name(S.place), routes:t("routes.title"), route:S.edge && `${label(edgeById[S.edge].a)} – ${label(edgeById[S.edge].b)}`, trip:t("trip.title")})[S.view] + " | " + t("brand");
    $("#viewToggle").innerHTML = document.body.classList.contains("show-map") ? icon("list") + esc(t(S.view === "place" ? "showPlace" : "showList")) : icon("map") + esc(t("showMap"));
    renderSheet();
    if (map){
      map.invalidateSize();
      drawMap();
      if (navigated) focusMap();
    }
  }
  document.title = title;
  if (!navigated) return;
  const sec = S.guideSec && $("#g-" + S.guideSec);
  if (restore){
    window.scrollTo(0, restore.win);
    const a = $(`#results a[href="#/place/${restore.id}"]`); if (a) a.focus({preventScroll:true});
  } else if (sec){
    sec.scrollIntoView();
    requestAnimationFrame(() => sec.scrollIntoView());   // again once a cold load has laid out
    const h = $("h2", sec); if (h){ h.tabIndex = -1; h.focus({preventScroll:true}); }
  } else {
    window.scrollTo(0, 0);
    const h = $("#pageTitle"); if (h) h.focus({preventScroll:true});
  }
}
// Re-render after a state change without moving focus or scroll.
function update(){ render(false); }
function bindGallery(){
  const g = $("#gallery"); if (!g) return;
  const dots = $$(".galnav i");
  g.onscroll = () => { const i = Math.round(g.scrollLeft / (g.scrollWidth / dots.length)); dots.forEach((d, k) => d.classList.toggle("on", k === i)); };
}

/* ───── Events ───── */
document.addEventListener("click", ev => {
  const b = ev.target.closest("[data-act]"); if (!b) return;
  const act = b.dataset.act, i = +b.dataset.i, s = trip.stops[i];
  switch (act){
    case "toggle": toggleStop(b.dataset.id); break;
    case "cat": { const k = b.dataset.k; S.cats.has(k) ? S.cats.delete(k) : S.cats.add(k); update(); break; }
    case "allCats": S.cats = new Set(CATS); update(); break;
    case "resetFilters": S.cats = new Set(CATS); S.region = "all"; S.q = ""; update(); break;
    case "mode": { const k = b.dataset.k; S.modes.has(k) ? S.modes.delete(k) : S.modes.add(k); saveUi(); renderMapCtl(); drawMap(); break; }
    case "basemap": setBasemap(b.dataset.v); break;
    case "openFromMap": S.fromMap = true; break;
    // Opened from the list: a real history step back, so the phone's back button agrees.
    case "back": if (S.canBack){ ev.preventDefault(); history.back(); } break;
    case "group": S.group = b.dataset.v; saveUi(); update(); break;
    case "closePreview": closePreview(); break;
    case "showMap":
      document.body.classList.add("show-map"); update();
      if (map && S.view === "place"){ map.invalidateSize(); const p = byId[S.place]; map.setView([p.lat, p.lng], Math.max(map.getZoom(), 8)); }
      break;
    case "toggleView":
      document.body.classList.toggle("show-map"); S.preview = null; update(); if (map) map.invalidateSize(); break;
    case "idea": {
      const it = B.itineraries.find(x => x.id === b.dataset.id);
      replaceTrip(ideaTrip(it), t("toast.ideaLoaded", {name:t(`idea.${it.id}.name`)}));
      if (S.view !== "trip") go("#/trip"); else { $("#panel").scrollTop = 0; window.scrollTo(0, 0); focusMap(); }
      break;
    }
    case "inc": s.d = Math.min(30, s.d + 1); saveTrip(); update(); break;
    case "dec": s.d = Math.max(0, s.d - 1); saveTrip(); update(); break;
    case "up": if (i > 0){ [trip.stops[i-1], trip.stops[i]] = [trip.stops[i], trip.stops[i-1]]; saveTrip(); update(); } break;
    case "down": if (i < trip.stops.length - 1){ [trip.stops[i+1], trip.stops[i]] = [trip.stops[i], trip.stops[i+1]]; saveTrip(); update(); } break;
    case "rm": removeAt(i); break;
    case "leg": {
      const l = M.legs(trip)[i];
      if (map && l && l.r){ const all = []; l.r.steps.forEach(st => all.push(...edgeLine(st.e))); if (isPhone()){ document.body.classList.add("show-map"); update(); } map.invalidateSize(); map.fitBounds(all, {padding:[40, 40], maxZoom:9}); }
      break;
    }
    case "pref": trip.pref = b.dataset.v; saveTrip(); update(); break;
    case "opt": { const before = M.cleanTrip(trip); trip = M.optimize(trip); saveTrip(); update(); toast(t("toast.optimized"), t("undo"), () => { trip = before; saveTrip(); update(); }); break; }
    case "share": {
      const url = shareUrl();
      if (navigator.share && isPhone()) navigator.share({title:t("sum.title"), url}).catch(() => {});
      else copyText(url, t("toast.linkCopied"));
      break;
    }
    case "copy": copyText(summaryText(), t("toast.summaryCopied")); break;
    case "clear": {
      const before = M.cleanTrip(trip);
      trip = M.emptyTrip(); saveTrip(); update();
      toast(t("toast.cleared"), t("undo"), () => { trip = before; saveTrip(); update(); });
      break;
    }
    case "cpref": S.calc.pref = b.dataset.v; update(); if (S.calc.show) fitCalc(); break;
    case "swap": [S.calc.from, S.calc.to] = [S.calc.to, S.calc.from]; update(); if (S.calc.show) fitCalc(); break;
    case "calc": S.calc.show = true; update(); fitCalc(); break;
  }
});
document.addEventListener("change", ev => {
  const el = ev.target.closest("[data-set]"); if (!el) return;
  const v = el.value;
  switch (el.dataset.set){
    case "region": S.region = v; update(); if (v !== "all") fitRegion(); break;
    case "month": S.month = +v; saveUi(); update(); break;
    case "start": if (v) setStart(v); break;
    case "days": { const n = Math.round(+v); trip.days = n > 0 ? Math.min(120, n) : null; saveTrip(); update(); break; }
    case "end": trip.end = v; saveTrip(); update(); break;
    case "calcFrom": S.calc.from = v; S.calc.show = false; update(); break;
    case "calcTo": S.calc.to = v; S.calc.show = false; update(); break;
  }
});
document.addEventListener("input", ev => {
  if (ev.target.id !== "q") return;
  S.q = ev.target.value; renderResults(); drawMap();
});
window.addEventListener("storage", ev => { if (ev.key === "bolivia-trip"){ trip = M.cleanTrip(load("bolivia-trip", null)); update(); } });

/* ───── Start ───── */
async function start(){
  try { await I.use(I.initial(), false); }
  catch(e){ $("#v-home").innerHTML = `<p style="padding:40px">Could not load the site texts. Please reload the page.</p>`; return; }
  $("#viewToggle").dataset.act = "toggleView";
  // The app puts the list back where it was itself (see render).
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  // Cache for photos, map and libraries (see sw.js). Not available when opened as a file.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  window.addEventListener("hashchange", route);
  route();
}
start();
})();
