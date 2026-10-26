// Bolivia à la carte: one place.
// #/place/<id> panel: photos, story, facts, weather, food and how to get there.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
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
      <div class="row"><span class="chip c"><span class="d"></span>${esc(t("cat." + p.cat))}</span>${placeUnescoChip(id)}</div>
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
    ${placeExtras(id)}
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
