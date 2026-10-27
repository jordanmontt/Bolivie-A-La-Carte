// Bolivia à la carte: router, page shell, events and start-up. Loaded last.
// Views (hash routes, language-independent so links can be shared):
//   #/            home: regions, themes, itinerary ideas, practical tips
//   #/map         all places with filters (?region=…, ?cat=…)
//   #/place/<id>  one place
//   #/routes      "how to get from A to B" and every travel link
//   #/route/<id>  one travel link
//   #/trip        the optional trip planner (?t=<code> loads a shared trip)
//   #/guide       practical tips: money, buses, blockades (?s=<section> scrolls to one)
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
/* ───── Router ───── */
const go = h => { if (location.hash === h) route(); else location.hash = h; };
function route(){
  const raw = location.hash.replace(/^#\/?/, "");
  const [path, qs] = raw.split("?");
  const parts = path.split("/").filter(Boolean), q = new URLSearchParams(qs || "");
  const v = parts[0] || "";
  const prev = S.view, left = S.place;
  // Back (or reload) on an entry that remembers its scroll: return to that spot (see saveScroll).
  clearTimeout(scrollTimer);
  const st = history.state, restore = st && typeof st.win === "number" ? {win:st.win, panel:st.panel || 0, left} : null;
  S.place = null; S.edge = null; S.sec = q.get("s");
  S.canBack = prev === "map" && v === "place";
  if (v === "place" && byId[parts[1]]){ S.view = "place"; S.place = parts[1]; }
  else if (v === "route" && edgeById[parts[1]]){ S.view = "route"; S.edge = parts[1]; }
  else if (v === "guide") S.view = "guide";
  else if (v === "culture"){ S.view = "culture"; S.topic = TOPICS.includes(parts[1]) ? parts[1] : ""; }
  else if (v === "map"){
    S.view = "map";
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
      if (shared && M.encode(shared) !== M.encode(trip)){ countEvent("trip-open-shared"); replaceTrip(shared, t("toast.sharedLoaded")); }
    }
  }
  else S.view = "home";
  S.preview = null;
  document.body.classList.toggle("show-map", S.view === "map" && S.fromMap && isPhone());
  if (S.view !== "place") S.fromMap = false;
  render(true, restore);
  countView();
}

/* ───── Chrome: header, tab bar ───── */
function renderChrome(){
  const n = trip.stops.length;
  const nav = [["home", "#/", "discover", t("nav.home")], ["culture", "#/culture", "culture", t("nav.culture")], ["map", "#/map", "map", t("nav.map")], ["routes", "#/routes", "route", t("nav.routes")], ["guide", "#/guide", "info", t("nav.guide")], ["trip", "#/trip", "trip", t("nav.trip")]];
  const cur = {home:"home", map:"map", place:"map", routes:"routes", route:"routes", guide:"guide", culture:"culture", trip:"trip"}[S.view];
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
  langAddress();
  if (map) relabelMap();
  render(false);
}

/* ───── Render ───── */
function render(navigated, restore){
  renderChrome();
  // Home, tips and culture are plain pages; the other views are the list/detail panel next to the map.
  const page = ["home", "guide", "culture"].includes(S.view);
  $("#v-home").hidden = !page; $("#v-app").hidden = page;
  let title = t("brand");
  if (S.view === "home"){ renderHome(); title = t("brand") + ", " + t("home.titleShort"); }
  else if (S.view === "guide"){ renderGuide(); title = t("guide.title") + " | " + t("brand"); }
  else if (S.view === "culture"){ renderCulture(); title = t(S.topic ? "culture." + S.topic : "culture.title") + " | " + t("brand"); }
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
  const sec = S.sec && $("#g-" + CSS.escape(S.sec));
  if (restore){
    window.scrollTo(0, restore.win);
    requestAnimationFrame(() => window.scrollTo(0, restore.win));   // again once a cold load has laid out
    const a = restore.left && $(`#results a[href="#/place/${restore.left}"]`); if (a) a.focus({preventScroll:true});
  } else if (sec){
    sec.scrollIntoView();
    requestAnimationFrame(() => sec.scrollIntoView());   // again once a cold load has laid out
    const h = $("h2, h3", sec); if (h){ h.tabIndex = -1; h.focus({preventScroll:true}); }
    sec.classList.add("flash");
  } else {
    window.scrollTo(0, 0);
    const h = $("#pageTitle"); if (h) h.focus({preventScroll:true});
  }
}
// Every history entry keeps where its page was scrolled (in history.state), so going back to any
// page, or reloading it, returns to the same spot; a link to a new page opens at the top.
let scrollTimer = 0;
function saveScroll(){
  clearTimeout(scrollTimer);
  history.replaceState({...history.state, win:window.scrollY, panel:$("#panel").scrollTop}, "");
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
    case "toggle": if (!trip.stops.some(x => x.id === b.dataset.id)) countEvent("trip-add/" + b.dataset.id); toggleStop(b.dataset.id); break;
    case "cat": { const k = b.dataset.k; S.cats.has(k) ? S.cats.delete(k) : S.cats.add(k); update(); break; }
    case "allCats": S.cats = new Set(CATS); update(); break;
    case "allMonths": S.month = -1; saveUi(); update(); break;
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
      countEvent("idea/" + it.id);
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
      countEvent("trip-share");
      if (navigator.share && isPhone()) navigator.share({title:t("sum.title"), url}).catch(() => {});
      else copyText(url, t("toast.linkCopied"));
      break;
    }
    case "copy": countEvent("trip-copy"); copyText(summaryText(), t("toast.summaryCopied")); break;
    case "clear": {
      const before = M.cleanTrip(trip);
      trip = M.emptyTrip(); saveTrip(); update();
      toast(t("toast.cleared"), t("undo"), () => { trip = before; saveTrip(); update(); });
      break;
    }
    case "cpref": S.calc.pref = b.dataset.v; update(); if (S.calc.show) fitCalc(); break;
    case "swap": [S.calc.from, S.calc.to] = [S.calc.to, S.calc.from]; update(); if (S.calc.show) fitCalc(); break;
    case "calc": countEvent(`calc/${S.calc.from}-${S.calc.to}`); S.calc.show = true; update(); fitCalc(); break;
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

/* ───── Address and visitor statistics ───── */
// Keep the address on the page of the current language (es.html, fr.html, en.html: index.html with
// its title and link preview image in that language), so a copied link previews in that language.
function langAddress(){
  if (!location.protocol.startsWith("http")) return;
  const want = location.pathname.replace(/[^/]*$/, "") + I.lang + ".html";
  if (location.pathname !== want || location.search) history.replaceState(history.state, "", want + location.hash);
}
// GoatCounter (content/seo.yml, stats): one page view per screen, counted as /<lang>/<view>
// (e.g. /es/place/samaipata), and a few actions as events: calc/<from>-<to> (route calculator),
// trip-add/<place>, idea/<itinerary>, trip-share, trip-copy, trip-open-shared.
// No cookies and nothing personal; nothing is counted on a local copy.
let counted = "", goat = null;
function stat(hit){
  const code = B.site && B.site.stats;
  if (!code || !location.protocol.startsWith("http") || /^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  if (!goat){
    window.goatcounter = {no_onload:true, endpoint:`https://${code}.goatcounter.com/count`};
    goat = BOL.loadScript("https://gc.zgo.at/count.js");
  }
  goat.then(() => window.goatcounter.count(hit)).catch(() => {});
}
function countView(){
  const path = "/" + I.lang + "/" + (location.hash.replace(/^#\/?/, "").split("?")[0] || "home");
  if (path === counted) return;
  counted = path;
  stat({path, title:document.title});
}
const countEvent = name => stat({path:name, title:name, event:true});

/* ───── Start ───── */
async function start(){
  try { await I.use(I.initial(), false); }
  catch(e){ $("#v-home").innerHTML = `<p style="padding:40px">Could not load the site texts. Please reload the page.</p>`; return; }
  langAddress();
  $("#viewToggle").dataset.act = "toggleView";
  // The app puts each page back where it was itself (see saveScroll).
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";
  document.addEventListener("scroll", () => { clearTimeout(scrollTimer); scrollTimer = setTimeout(saveScroll, 200); }, true);
  document.addEventListener("click", saveScroll, true);   // before a link leaves the page
  // Cache for photos, map and libraries (see sw.js). Not available when opened as a file.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("sw.js").catch(() => {});
  window.addEventListener("hashchange", route);
  route();
}
start();
