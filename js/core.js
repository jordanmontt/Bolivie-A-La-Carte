// Bolivia à la carte: shared core.
// Constants, small helpers, state (the trip, filters) and climate texts. Loaded first.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
const B = window.BOL, I = B.i18n, M = B.model, t = I.t;
const {byId, edgeById, adj} = M;

const CATS = ["ville", "culture", "nature", "altiplano", "jungle", "aventure"];
const MODES = ["bus", "train", "avion", "bateau", "tour", "velo"];
// Travel regions, their order and cover place come from content/regions.yml.
const REGIONS = B.regions.map(r => r.id);
const REGION_COVER = Object.fromEntries(B.regions.map(r => [r.id, r.cover]));
// The nine departments (Pando has no place yet), west to east.
const DEPTS = ["La Paz", "Oruro", "Potosí", "Chuquisaca", "Tarija", "Cochabamba", "Santa Cruz", "Beni", "Pando"];
// Places drawn bigger on the map ("major: true" in content/places/*.yml).
const MAJOR = new Set(B.places.filter(p => p.major).map(p => p.id));
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
  culture:'<path d="M9 3h6v3h3v3h3v6h-3v3h-3v3H9v-3H6v-3H3V9h3V6h3z"/><circle cx="12" cy="12" r="2.5"/>',
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
  canBack:false,  // the open place was reached from the list, so "back" is a history step
  sec:null,      // section to scroll to (#/guide?s=…, #/culture/<topic>?s=…)
  topic:""       // culture page shown ("" = overview)
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
