// Bolivia à la carte: home page.
// Hero, regions, themes, itinerary ideas, good-to-know tips and the site footer.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
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
  <section class="section" aria-labelledby="h-cu"><header><div><h2 id="h-cu">${esc(t("home.culture"))}</h2><p>${esc(t("home.cultureLead"))}</p></div><a class="btn" href="#/culture">${esc(t("nav.culture"))}</a></header>
    <div class="themes">${TOPICS.map(k => `<a class="theme" href="#/culture/${k}" style="--c:var(--accent)"><span class="dmd"></span><b>${esc(t("culture." + k))}</b><span>${esc(t("culture." + k + ".lead"))}</span></a>`).join("")}</div>
  </section>
  <section class="section" aria-labelledby="h-id"><header><div><h2 id="h-id">${esc(t("ideas.title"))}</h2><p>${esc(t("ideas.lead"))}</p></div></header>
    <div class="ideas">${B.itineraries.map(it => ideaCard(it, false)).join("")}</div>
  </section>
  <section class="section" aria-labelledby="h-tips"><header><div><h2 id="h-tips">${esc(t("tips.title"))}</h2></div><a class="btn" href="#/guide">${icon("info")}${esc(t("tips.more"))}</a></header>
    <div class="tips">${[["money","money"],["transport","city"],["altitude","health"],["seasons",""]].map(([k, s]) => { const inner = `<h3><span class="dmd"></span>${esc(t("tips." + k))}</h3><p>${esc(t("tips." + k + ".text"))}</p>${k === "money" && RATES ? `<p class="tip-rate">${esc(ratesLine())}</p>` : ""}`; return s ? `<a class="tip" href="#/guide?s=${s}">${inner}</a>` : `<div class="tip">${inner}</div>`; }).join("")}</div>
  </section>
  ${siteFoot()}`;
}
// Contact address, assembled here so it isn't sitting whole in the page source for spam bots.
const MAIL = ["sebastian.jordan.m", "proton.me"].join("@");
const contact = () => `<a href="mailto:${MAIL}">${MAIL}</a>`;
const rights = () => esc(t("foot.rights", {year:new Date().getFullYear()}));
const siteFoot = () => `<footer class="site-foot"><div class="weave"></div><div class="in">
    <div><b>${esc(t("brand"))}</b><p>${esc(t("foot.about"))}</p></div>
    <div><p>${esc(t("foot.createdBy"))} <a href="https://github.com/jordanmontt" rel="author">jordanmontt</a> · ${esc(t("foot.contact"))} ${contact()}</p><p class="small">${esc(t("foot.credits"))}</p><p class="small"><a href="${I.lang}/">${esc(t("foot.index"))}</a></p><p class="small">${rights()}</p></div>
  </div></footer>`;
