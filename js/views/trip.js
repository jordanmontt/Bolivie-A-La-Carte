// Bolivia à la carte: trip planner.
// #/trip: stops, days, legs, altitude chart, sharing.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
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
