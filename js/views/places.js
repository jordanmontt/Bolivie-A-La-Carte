// Bolivia à la carte: places list.
// #/map panel: search, filters and the list grouped by region or department.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
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
  const html = groups.filter(([, , ps]) => ps.length)
    .map(([k, title, ps]) => `<section class="zone"><h3>${esc(title)}<span>${ps.length}</span></h3><ul class="plist">${ps.map(placeRow).join("")}</ul></section>`).join("");
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
