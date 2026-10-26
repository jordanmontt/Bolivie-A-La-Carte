// Bolivia à la carte: practical tips page.
// #/guide: money, buses, safety, phrases; texts in content/guide/<lang>.yml.
// All js/ files are classic scripts sharing one scope, loaded in the order of index.html.
"use strict";
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
      <ol>${g.sections.map(s => `<li><a href="#/guide?s=${s.id}">${esc(s.title)}</a></li>`).join("")}<li><a href="#/guide?s=phrases">${esc(t("guide.phrases"))}</a></li><li><a href="#/guide?s=borders">${esc(t("borders.title"))}</a></li></ol>
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
      <section class="gsec" id="g-borders" aria-labelledby="gh-borders">
        <span class="gnum" aria-hidden="true">${num(g.sections.length + 1)}</span>
        <div><h2 id="gh-borders">${esc(t("borders.title"))}</h2><p class="glead">${esc(t("borders.lead"))}</p>${bordersHtml()}</div>
      </section>
      <section class="callout warn chapare" id="g-chapare" aria-labelledby="gh-chapare">
        <h2 id="gh-chapare">${esc(g.chapare.title)}</h2><p>${esc(g.chapare.text)}</p><p>${esc(g.chapare.road)}</p>
      </section>
    </div>
  </div>
  ${siteFoot()}`;
}
// Border crossings, grouped by neighbouring country (content/borders.yml).
function bordersHtml(){
  const countries = [...new Set(B.borders.map(b => b.country))];
  return countries.map(c => `<h3 class="bcountry">${esc(t("country." + c))}</h3><div class="borders">${B.borders.filter(b => b.country === c).map(b => {
    const x = I.c("borders", b.id) || {};
    return `<article class="border" id="g-${b.id}"><h4>${esc(x.name)}</h4><p>${esc(x.text)}</p>${b.place ? `<a href="#/place/${b.place}">${esc(label(b.place))} ${icon("arrow")}</a>` : ""}</article>`;
  }).join("")}</div>`).join("");
}
const guideLink = () => `<a class="guidelink" href="#/guide">${icon("info")}<span>${esc(t("guide.link"))} <b>${esc(t("guide.linkCta"))}</b></span>${icon("arrow")}</a>`;
const credit = () => `<p class="credit">${esc(t("foot.createdBy"))} <a href="https://github.com/jordanmontt" rel="author">jordanmontt</a> · ${esc(t("foot.contact"))} ${contact()}. ${esc(t("foot.credits"))} ${rights()}</p>`;
