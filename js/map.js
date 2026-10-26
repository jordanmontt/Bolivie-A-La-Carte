// Bolivia à la carte: map.
// Leaflet map (loaded on demand), pins, lines, and the phone bottom card.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
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
