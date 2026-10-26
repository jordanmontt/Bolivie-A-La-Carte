// Bolivia à la carte: culture pages.
// #/culture (overview) and #/culture/<topic>: festivals, food, unesco, crafts, legends.
// Everything is computed from content/ (festivals.yml, dishes.yml and the places' dishes,
// unesco.yml, crafts.yml, legends.yml), so nothing is written twice.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
const TOPICS = ["festivals", "food", "unesco", "crafts", "legends"];
const TOPIC_COVER = {festivals:"oruro", food:"cbba", unesco:"potosi", crafts:"tarabuco", legends:"isladelsol"};
const ctext = (kind, id) => (I.c(kind, id) || {});

/* ───── Festival dates ───── */
function easterSunday(y){
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}
function festivalDay(f, y){
  if (f.date){ const [m, d] = f.date.split("-").map(Number); return new Date(y, m - 1, d); }
  if (f.easter !== undefined){ const d = easterSunday(y); d.setDate(d.getDate() + f.easter); return d; }
  const [m, wd, n] = f.nth;
  if (n > 0){ const d = new Date(y, m - 1, 1); d.setDate(1 + (wd - d.getDay() + 7) % 7 + 7 * (n - 1)); return d; }
  const d = new Date(y, m, 0); d.setDate(d.getDate() - (d.getDay() - wd + 7) % 7); return d;
}
// The next time a festival happens (today included): {start, end} or {month, year}.
function nextFestival(f){
  const today = new Date(); today.setHours(0, 0, 0, 0);
  for (let y = today.getFullYear(); y <= today.getFullYear() + 2; y++){
    if (f.month){
      if (f.even && y % 2) continue;
      if (new Date(y, f.month, 0) >= today) return {month:f.month - 1, year:y};
      continue;
    }
    const start = festivalDay(f, y), end = new Date(start);
    end.setDate(end.getDate() + (f.days || 1) - 1);
    if (end >= today) return {start, end};
  }
}
function festivalWhen(f){
  const n = nextFestival(f);
  if (n.month !== undefined) return t("festival.month", {month:I.month(n.month), year:n.year}) + (f.even ? ` (${t("festival.even")})` : "");
  const fmt = new Intl.DateTimeFormat(I.lang, {weekday:"long", day:"numeric", month:"long", year:"numeric"});
  return n.end > n.start && fmt.formatRange ? fmt.formatRange(n.start, n.end) : fmt.format(n.start);
}
const festivalMonth = f => { const n = nextFestival(f); return n.month !== undefined ? n.month : n.start.getMonth(); };
const festivalOrder = f => { const n = nextFestival(f); return n.start ? +n.start : +new Date(n.year, n.month, 1); };

/* ───── Small parts ───── */
const placeChip = id => `<a class="chip" href="#/place/${id}">${esc(label(id))}</a>`;
const whereLine = ids => ids && ids.length ? `<p class="cwhere"><span>${esc(t("culture.where"))}</span> ${ids.map(placeChip).join(" ")}</p>` : "";
const unescoOf = (key, id) => B.unesco.find(u => key === "festival" ? u.festival === id : (u.places || []).includes(id));
const unescoChip = u => u ? `<a class="chip unesco" href="#/culture/unesco?s=${u.id}">UNESCO · ${esc(u.year)}</a>` : "";
function card(id, title, body, extra){
  return `<article class="ccard" id="g-${id}"><h3>${esc(title)}</h3>${extra || ""}<p>${esc(body)}</p></article>`;
}

/* ───── Pages ───── */
function cultureHub(){
  return `<div class="ctopics">${TOPICS.map(k => `<a class="region" href="#/culture/${k}"><img src="${esc(small(cover(TOPIC_COVER[k])))}" alt="" loading="lazy" decoding="async"><div class="txt"><h3>${esc(t("culture." + k))}</h3><p>${esc(t("culture." + k + ".lead"))}</p></div></a>`).join("")}</div>`;
}
function festivalsPage(){
  const list = B.festivals.slice().sort((a, b) => festivalOrder(a) - festivalOrder(b));
  const shown = S.month >= 0 ? list.filter(f => festivalMonth(f) === S.month) : list;
  let month = -1, html = "";
  for (const f of shown){
    const m = festivalMonth(f);
    if (m !== month){ html += `${month < 0 ? "" : "</div>"}<h2 class="cmonth">${esc(I.month(m))}</h2><div class="cgrid">`; month = m; }
    const c = ctext("festivals", f.id);
    html += card(f.id, c.name, c.text, `<p class="cwhen">${esc(festivalWhen(f))}</p><div class="row">${f.place ? placeChip(f.place) : `<span class="chip">${esc(t("festival.nationwide"))}</span>`}${unescoChip(unescoOf("festival", f.id))}</div>`);
  }
  if (html) html += "</div>";
  return `<div class="cfilter"><label class="field">${esc(t("filter.month"))}<select data-set="month">${monthOptions()}</select></label>${S.month >= 0 ? `<button type="button" class="btn small ghost" data-act="allMonths">${esc(t("festival.all"))}</button>` : ""}</div>
    ${html || `<p class="empty">${esc(t("festival.none"))}</p>`}`;
}
function foodPage(){
  // Each dish once, under the first region where it is eaten, with every place that serves it.
  const where = {}, home = {};
  B.places.forEach(p => (B.food[p.id] || []).forEach(d => { (where[d] = where[d] || []).push(p.id); if (!home[d]) home[d] = p.region; }));
  return REGIONS.map(r => {
    const dishes = Object.keys(home).filter(d => home[d] === r);
    if (!dishes.length) return "";
    return `<h2 class="cmonth">${esc(t("region." + r))}</h2><div class="cgrid">${dishes.map(d => {
      const x = I.c("dishes", d) || [d, ""];
      return `<article class="ccard" id="g-${d}"><h3>${esc(x[0])}</h3><p>${esc(x[1])}</p>${whereLine(where[d])}</article>`;
    }).join("")}</div>`;
  }).join("");
}
function unescoPage(){
  return ["world", "intangible"].map(kind => `<h2 class="cmonth">${esc(t("unesco." + kind))}</h2><div class="cgrid">${B.unesco.filter(u => u.kind === kind).map(u => {
    const f = u.festival && B.festivals.find(x => x.id === u.festival);
    return `<article class="ccard" id="g-${u.id}"><h3>${esc(I.c("unesco", u.id))}</h3><p class="cwhen">${esc(t("unesco.year", {year:u.year}))}</p>
      ${f ? `<p><a href="#/culture/festivals?s=${f.id}">${esc(ctext("festivals", f.id).name)}</a> · ${esc(festivalWhen(f))}</p>` : ""}${whereLine(u.places)}</article>`;
  }).join("")}</div>`).join("");
}
const simplePage = kind => `<div class="cgrid">${B[kind].map(x => { const c = ctext(kind, x.id); return `<article class="ccard" id="g-${x.id}"><h3>${esc(c.name)}</h3><p>${esc(c.text)}</p>${whereLine(x.places)}</article>`; }).join("")}</div>`;

function renderCulture(){
  const k = S.topic;
  const body = !k ? cultureHub() : {festivals:festivalsPage, food:foodPage, unesco:unescoPage, crafts:() => simplePage("crafts"), legends:() => simplePage("legends")}[k]();
  $("#v-home").innerHTML = `
  <section class="pagehead"><div class="in">
    ${k ? `<a class="kicker" href="#/culture">${esc(t("culture.back"))}</a>` : `<p class="kicker">${esc(t("nav.culture"))}</p>`}
    <h1 tabindex="-1" id="pageTitle">${esc(t(k ? "culture." + k : "culture.title"))}</h1>
    <p class="lead">${esc(t(k ? "culture." + k + ".lead" : "culture.lead"))}</p>
    ${k ? `<nav class="ctabs" aria-label="${esc(t("culture.title"))}">${TOPICS.map(x => `<a href="#/culture/${x}" ${x === k ? 'aria-current="page"' : ""}>${esc(t("culture." + x))}</a>`).join("")}</nav>` : ""}
  </div></section>
  <div class="weave thick"></div>
  <div class="culture">${body}</div>
  ${siteFoot()}`;
}

/* ───── On a place page: what else happens here ───── */
function placeExtras(id){
  const rows = [];
  // A listed festival shows once, as a festival marked UNESCO.
  B.unesco.filter(u => !u.festival && (u.places || []).includes(id)).forEach(u => rows.push(`<li><a href="#/culture/unesco?s=${u.id}"><b>${esc(t("place.unesco"))}</b> ${esc(I.c("unesco", u.id))}</a></li>`));
  B.festivals.filter(f => f.place === id).forEach(f => rows.push(`<li><a href="#/culture/festivals?s=${f.id}"><b>${esc(t("culture.festivals"))}${unescoOf("festival", f.id) ? " · UNESCO" : ""}</b> ${esc(ctext("festivals", f.id).name)}, ${esc(festivalWhen(f))}</a></li>`));
  B.crafts.filter(x => (x.places || []).includes(id)).forEach(x => rows.push(`<li><a href="#/culture/crafts?s=${x.id}"><b>${esc(t("culture.crafts"))}</b> ${esc(ctext("crafts", x.id).name)}</a></li>`));
  B.legends.filter(x => (x.places || []).includes(id)).forEach(x => rows.push(`<li><a href="#/culture/legends?s=${x.id}"><b>${esc(t("culture.legends"))}</b> ${esc(ctext("legends", x.id).name)}</a></li>`));
  B.borders.filter(x => x.place === id).forEach(x => rows.push(`<li><a href="#/guide?s=${x.id}"><b>${esc(t("place.border"))}</b> ${esc(ctext("borders", x.id).name)}</a></li>`));
  return rows.length ? `<section class="sec"><h2>${esc(t("place.here"))}</h2><ul class="extras">${rows.join("")}</ul></section>` : "";
}
const placeUnescoChip = id => unescoChip(unescoOf("place", id));
