// Bolivia à la carte: routes.
// #/routes and #/route/<id>: the route calculator and every travel link.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
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
