// Makes the plain HTML pages that search engines read, from the same data as the site.
// The interactive site lives in one page (index.html) whose views are #/… addresses, which
// Google treats as a single page. So the build also writes, for each language:
//   <lang>/                 home: every place, region by region, and the culture topics
//   <lang>/<place-slug>/    one page per place (slug made from the place's name)
//   <lang>/<tips-slug>/     the practical tips
//   <lang>/<topic-slug>/    festivals, food, UNESCO, crafts, legends (slugs in content/seo.yml)
//   <lang>.html             a copy of index.html (the interactive site) whose title, description
//                           and link preview image are in that language: the site keeps this
//                           address in the address bar, so a shared link previews in its language.
//                           Its public address has no .html (<site>/es): Cloudflare Pages serves
//                           es.html there and redirects es.html to it. Links keep the .html, which
//                           also works on a local copy.
// plus sitemap.xml and robots.txt. The pages need no JavaScript and link back to <lang>.html.
// Their few own texts are in content/seo.yml; everything else comes from content/.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
export const slugify = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// The month (0-11) a festival falls in this year. Same rules as festivalDay() in js/views/culture.js.
function festivalMonth(f, y = new Date().getFullYear()){
  if (f.month) return f.month - 1;
  if (f.date) return Number(f.date.split("-")[0]) - 1;
  if (f.easter !== undefined){
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
    const g = Math.floor((b - Math.floor((b + 8) / 25) + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    const l = (32 + 2 * e + 2 * Math.floor(c / 4) - h - c % 4) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    const easter = new Date(y, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
    easter.setDate(easter.getDate() + f.easter);
    return easter.getMonth();
  }
  return f.nth[0] - 1;
}
const ldJson = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

// d: everything tools/build.mjs read (see the call there). Returns {files:{path: text}, problems:[]}.
export function makePages(d){
  const {LANGS, site, seo, ui, regions, places, placeText, photos, itemPhotos, food, dishText, edges, edgeText, culture, cultureText, guide, release, logo, indexHtml, stats} = d;
  const files = {}, problems = [];
  const byId = Object.fromEntries(places.map(p => [p.id, p]));
  const TOPICS = ["festivals", "food", "unesco", "crafts", "legends"];

  // Address of every page, per language, relative to the site root.
  const paths = {};
  for (const l of LANGS){
    const seen = new Map([[slugify(seo[l]["tips.slug"]), "the tips page"]]);
    paths[l] = {home:`${l}/`, tips:`${l}/${slugify(seo[l]["tips.slug"])}/`, place:{}, topic:{}};
    for (const k of TOPICS){
      const s = slugify(seo[l][k + ".slug"]);
      if (seen.has(s)) problems.push(`content/seo.yml (${l}): "${k}.slug" gives the same page address "${s}" as ${seen.get(s)}`);
      seen.set(s, `the ${k} page`);
      paths[l].topic[k] = `${l}/${s}/`;
    }
    for (const p of places){
      const name = placeText[l][p.id] && placeText[l][p.id].name;
      if (!name) continue;
      const s = slugify(name);
      if (seen.has(s)) problems.push(`content/places/${p.id}.yml (${l}): its name gives the same page address "${s}" as ${seen.get(s)}; change one of the names`);
      seen.set(s, `"${p.id}"`);
      paths[l].place[p.id] = `${l}/${s}/`;
    }
  }
  if (problems.length) return {files, problems};

  for (const l of LANGS){
    const S = seo[l], U = ui[l], P = placeText[l];
    const plural = new Intl.PluralRules(l);
    const t = (k, vars) => {
      let v = k in S ? S[k] : U[k];
      if (v === undefined) return k;
      if (typeof v === "object") v = v[plural.select(vars && typeof vars.n === "number" ? vars.n : 0)] ?? v.other;
      return String(v).replace(/\{(\w+)\}/g, (m, x) => vars && vars[x] !== undefined ? vars[x] : m);
    };
    const num = (n, digits) => new Intl.NumberFormat(l, {maximumFractionDigits:digits ?? 1}).format(n);
    const days = n => t("days", {n, d:num(n)});
    const deptName = dep => (`dept.named.${dep}` in U) ? t(`dept.named.${dep}`) : t("dept.named", {d:dep});
    const label = id => P[id].label || P[id].name;
    const n = places.length;
    // Link into the interactive site, in this language: <lang>.html#/…
    const app = (root, hash) => `${root}${l}.html#${hash}`;
    const LOCALE = {fr:"fr_FR", en:"en_US", es:"es_ES"};

    // One page: head, header, body, footer. depth: 1 for <lang>/, 2 for <lang>/<slug>/.
    function page({key, depth, title, desc, image, ld, body}){
      const root = "../".repeat(depth), path = key(l);
      const alt = LANGS.map(x => `<link rel="alternate" hreflang="${x}" href="${esc(site + key(x))}">`).join("\n");
      const langs = LANGS.map(x => `<a href="${esc(root + key(x))}" hreflang="${x}" lang="${x}" ${x === l ? 'aria-current="true"' : ""}>${x.toUpperCase()}</a>`).join("");
      files[path + "index.html"] = `<!doctype html>
<html lang="${l}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(site + path)}">
${alt}
<link rel="alternate" hreflang="x-default" href="${esc(site + key("en"))}">
<meta name="theme-color" content="#1f1747">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${esc(t("brand"))}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(site + path)}">
<meta property="og:image" content="${esc(site + (image || `assets/og-${l}.png`))}">
<meta property="og:locale" content="${LOCALE[l] || l}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Unbounded:wght@600;700;800&display=swap">
<link rel="stylesheet" href="${root}css/style.css?v=${release}">
${ld ? ldJson(ld) : ""}
${stats ? `<script data-goatcounter="https://${esc(stats)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ""}
</head>
<body class="static">
<header class="site-head"><div class="bar">
  <a class="brand" href="${root}${l}/">${logo}<span class="bname">${esc(t("brand"))}<small>${esc(t("brand.tagline"))}</small></span></a>
  <nav class="snav" aria-label="${esc(t("nav.label"))}"><a href="${root}${paths[l].home}#culture">${esc(t("nav.culture"))}</a><a href="${root}${paths[l].tips}">${esc(t("nav.guide"))}</a><a href="${app(root, "/map")}">${esc(t("nav.map"))}</a><span class="sep" aria-hidden="true"></span>${langs}</nav>
</div><div class="weave thin"></div></header>
<main id="main">
${body(root)}
</main>
<footer class="site-foot"><div class="weave"></div><div class="in">
  <div><b>${esc(t("brand"))}</b><p>${esc(t("foot.about"))}</p></div>
  <div><p>${esc(t("foot.createdBy"))} <a href="https://github.com/jordanmontt" rel="author">jordanmontt</a> · ${esc(t("foot.contact"))} <a href="mailto:sebastian.jordan.m&#64;proton.me">sebastian.jordan.m&#64;proton.me</a></p><p class="small">${esc(t("foot.credits"))}</p><p class="small">${esc(t("foot.rights", {year:new Date().getFullYear()}))}</p></div>
</div></footer>
</body>
</html>
`;
    }
    const cover = id => (photos[id] || [])[0];
    const small = src => src.replace("photos/", "photos/sm/");
    const card = (id, root) => {
      const c = cover(id);
      return `<li><a href="${root}${paths[l].place[id]}">${c ? `<img src="${esc(root + small(c.src))}" alt="" loading="lazy" decoding="async">` : `<span class="noimg"></span>`}<span><b>${esc(P[id].name)}</b><span>${esc(P[id].short)}</span></span></a></li>`;
    };
    // A topic's cover: the first of its items that has a photo (the food page: a dish), or else
    // the cover of the first place it mentions.
    const topicCover = k => {
      const own = Object.values(itemPhotos[k === "food" ? "dishes" : k] || {})[0];
      const ids = k === "food" ? Object.keys(food) : (culture[k] || []).flatMap(x => [].concat(x.places || [], x.place || []));
      return own || ids.map(id => cover(id)).find(Boolean);
    };
    // The site's lead texts may speak of the interactive page ("dates calculated for this year").
    const topicLead = k => (k + ".intro") in S ? t(k + ".intro") : t("culture." + k + ".lead");
    const credit = x => `<figcaption>${esc(t("photos.by"))} <a href="${esc(x.page)}" rel="noopener">${esc(x.artist || "Wikimedia Commons")}</a>${x.lic ? ", " + esc(x.lic) : ""}</figcaption>`;

    /* ───── Home of the language ───── */
    page({
      key:x => paths[x].home, depth:1,
      title:t("home.title"), desc:t("home.description", {n}),
      ld:{"@context":"https://schema.org", "@type":"WebSite", name:t("brand"), url:site + paths[l].home, inLanguage:l, description:t("home.description", {n}), author:{"@type":"Person", name:"jordanmontt", url:"https://github.com/jordanmontt"}},
      body:root => `<section class="pagehead"><div class="in">
  <h1>${esc(t("home.h1"))}</h1>
  <p class="lead">${esc(t("home.intro", {n}))}</p>
  <div class="row"><a class="btn cta" href="${app(root, "/map")}">${esc(t("home.explore"))}</a><a class="btn on-dark" href="${root}${paths[l].tips}">${esc(t("tips.more"))}</a></div>
</div></section>
<div class="weave thick"></div>
<div class="sp wide">
${regions.map(r => `<section class="sp-region" id="r-${r.id}"><h2>${esc(t("region." + r.id))}</h2><p class="muted">${esc(t("regionDesc." + r.id))}</p>
<ul class="sp-places">${r.places.filter(id => byId[id]).map(id => card(id, root)).join("")}</ul></section>`).join("\n")}
<section class="sp-region" id="culture"><h2>${esc(t("culture.title"))}</h2><p class="muted">${esc(t("culture.lead"))}</p>
<div class="ctopics">${TOPICS.map(k => { const ph = topicCover(k); return `<a class="region" href="${root}${paths[l].topic[k]}">${ph ? `<img src="${esc(root + small(ph.src))}" alt="" loading="lazy" decoding="async">` : ""}<div class="txt"><h3>${esc(t("culture." + k))}</h3><p>${esc(topicLead(k))}</p></div></a>`; }).join("")}</div></section>
</div>`
    });

    /* ───── One page per place ───── */
    for (const p of places){
      const c = P[p.id], ph = photos[p.id] || [], region = t("region." + p.region);
      const url = site + paths[l].place[p.id];
      const conns = edges.filter(e => e.a === p.id || e.b === p.id).sort((a, b) => a.h - b.h);
      const dishes = (food[p.id] || []).filter(k => dishText[l][k]).map(k => [k, ...dishText[l][k]]);
      const stay = p.days[0] === p.days[1] ? days(p.days[1]) : t("daysRange", {a:num(p.days[0]), b:days(p.days[1])});
      const ct = (kind, id) => cultureText[l][kind][id];
      // [kind, name, text, link]
      const extras = [
        ...culture.unesco.filter(u => !u.festival && (u.places || []).includes(p.id)).map(u => [t("place.unesco"), ct("unesco", u.id), "", `${paths[l].topic.unesco}#g-${u.id}`]),
        ...culture.festivals.filter(f => f.place === p.id).map(f => [t("culture.festivals") + (culture.unesco.some(u => u.festival === f.id) ? " · UNESCO" : ""), ct("festivals", f.id).name, ct("festivals", f.id).text, `${paths[l].topic.festivals}#g-${f.id}`]),
        ...["crafts", "legends"].flatMap(k => culture[k].filter(x => (x.places || []).includes(p.id)).map(x => [t("culture." + k), ct(k, x.id).name, ct(k, x.id).text, `${paths[l].topic[k]}#g-${x.id}`])),
        ...culture.borders.filter(x => x.place === p.id).map(x => [t("place.border"), ct("borders", x.id).name, ct("borders", x.id).text, `${paths[l].tips}#g-${x.id}`])
      ];
      const others = regions.find(r => r.id === p.region).places.filter(id => id !== p.id && byId[id]);
      page({
        key:x => paths[x].place[p.id], depth:2,
        title:t("place.title", {name:c.name}), desc:c.short, image:ph[0] && ph[0].src,
        ld:{"@context":"https://schema.org", "@graph":[
          {"@type":"TouristAttraction", name:c.name, description:c.short, url, inLanguage:l,
            image:ph.slice(0, 3).map(x => site + x.src),
            geo:{"@type":"GeoCoordinates", latitude:p.lat, longitude:p.lng, elevation:p.alt},
            address:{"@type":"PostalAddress", addressRegion:p.dept, addressCountry:"BO"}},
          {"@type":"BreadcrumbList", itemListElement:[
            {"@type":"ListItem", position:1, name:t("home.h1"), item:site + paths[l].home},
            {"@type":"ListItem", position:2, name:region, item:site + paths[l].home + "#r-" + p.region},
            {"@type":"ListItem", position:3, name:c.name}]}]},
        body:root => `<article class="sp" style="--c:var(--c-${p.cat})">
  <nav class="crumbs" aria-label="${esc(t("home.h1"))}"><a href="../">${esc(t("home.h1"))}</a> › <a href="../#r-${p.region}">${esc(region)}</a></nav>
  <header class="stack" style="gap:10px">
    <h1>${esc(c.name)}</h1>
    <p class="where"><span><b>${esc(deptName(p.dept))}</b> · ${esc(t("cat." + p.cat))}</span></p>
  </header>
  ${ph[0] ? `<figure class="sp-hero"><img src="${esc(root + ph[0].src)}" alt="${esc(t("photos.alt", {name:c.name, i:1}))}" fetchpriority="high" decoding="async">${credit(ph[0])}</figure>` : ""}
  <p class="story">${esc(c.story)}</p>
  <div class="facts"><div><b>${esc(t("alt", {a:num(p.alt, 0)}))}</b><span>${esc(t("fact.alt"))}</span></div><div><b>${esc(stay)}</b><span>${esc(t("fact.days"))}</span></div></div>
  <div class="row"><a class="btn primary" href="${app(root, "/place/" + p.id)}">${esc(t("place.openMap"))}</a><a class="btn ghost" href="https://www.google.com/maps/search/?api=1&amp;query=${p.lat},${p.lng}" rel="noopener">Google Maps</a></div>
  ${p.alt >= 3500 ? `<div class="callout warn"><strong>${esc(t("alt.warnTitle"))}</strong> ${esc(t("alt.warn"))}</div>` : ""}
  <section class="sec"><h2>${esc(t("place.todo"))}</h2><ul class="todo">${c.todo.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
  ${dishes.length ? `<section class="sec"><h2>${esc(t("place.food"))}</h2><ul class="food">${dishes.map(([k, dn, dt]) => `<li><b><a href="${root}${paths[l].topic.food}#g-${k}">${esc(dn)}</a></b><span>${esc(dt)}</span></li>`).join("")}</ul></section>` : ""}
  ${c.tips ? `<div class="callout"><strong>${esc(t("place.tip"))}</strong> ${esc(c.tips)}</div>` : ""}
  ${extras.length ? `<section class="sec"><h2>${esc(t("place.here"))}</h2><ul class="sp-extras">${extras.map(([k, nm, tx, href]) => `<li><b>${esc(k)}</b> <a href="${root}${href}">${esc(nm)}</a>${tx ? `<span>${esc(tx)}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
  ${conns.length ? `<section class="sec"><h2>${esc(t("place.getTo", {name:label(p.id)}))}</h2><ul class="sp-routes">${conns.map(e => {
          const o = e.a === p.id ? e.b : e.a, x = edgeText[l][e.id];
          return `<li><h3><a href="${root}${paths[l].place[o]}">${esc(label(o))}</a> <span>${esc(t("mode." + e.mode))} · ${esc(x.t)}</span></h3><p>${esc(x.how)}</p>${x.note ? `<p class="muted">${esc(x.note)}</p>` : ""}</li>`;
        }).join("")}</ul></section>` : ""}
  ${ph.length > 1 ? `<section class="sec"><h2>${esc(t("photos.label", {name:c.name}))}</h2><div class="sp-photos">${ph.slice(1).map((x, i) => `<figure><img src="${esc(root + small(x.src))}" alt="${esc(t("photos.alt", {name:c.name, i:i + 2}))}" loading="lazy" decoding="async">${credit(x)}</figure>`).join("")}</div></section>` : ""}
  ${others.length ? `<section class="sec"><h2>${esc(t("place.nearby"))}</h2><ul class="sp-places">${others.map(id => card(id, root)).join("")}</ul></section>` : ""}
</article>`
      });
    }

    /* ───── Practical tips (same sections as #/guide) ───── */
    const g = guide[l];
    const countries = [...new Set(culture.borders.map(b => b.country))];
    page({
      key:x => paths[x].tips, depth:2,
      title:t("tips.title"), desc:g.intro,
      ld:{"@context":"https://schema.org", "@type":"Article", headline:t("tips.title"), description:g.intro, inLanguage:l, url:site + paths[l].tips, author:{"@type":"Person", name:"jordanmontt", url:"https://github.com/jordanmontt"}},
      body:() => `<section class="pagehead"><div class="in">
  <p class="kicker">${esc(t("guide.kicker"))}</p>
  <h1>${esc(t("guide.title"))}</h1>
  <p class="lead">${esc(g.intro)}</p>
</div></section>
<div class="weave thick"></div>
<div class="guide">
  <nav class="toc" aria-label="${esc(t("guide.toc"))}"><p>${esc(t("guide.toc"))}</p>
    <ol>${g.sections.map(s => `<li><a href="#g-${s.id}">${esc(s.title)}</a></li>`).join("")}<li><a href="#g-phrases">${esc(t("guide.phrases"))}</a></li><li><a href="#g-borders">${esc(t("borders.title"))}</a></li></ol></nav>
  <div class="gbody">
    ${g.sections.map((s, i) => `<section class="gsec" id="g-${s.id}"><span class="gnum" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span>
      <div><h2>${esc(s.title)}</h2><p class="glead">${esc(s.lead)}</p><ul class="todo">${s.points.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div></section>`).join("\n    ")}
    <section class="gsec" id="g-phrases"><span class="gnum" aria-hidden="true">${String(g.sections.length + 1).padStart(2, "0")}</span>
      <div><h2>${esc(t("guide.phrases"))}</h2><p class="glead">${esc(t("guide.phrasesLead"))}</p><dl class="phrases">${g.phrases.map(([es, tr]) => `<div><dt lang="es">${esc(es)}</dt><dd>${esc(tr)}</dd></div>`).join("")}</dl></div></section>
    <section class="gsec" id="g-borders"><span class="gnum" aria-hidden="true">${String(g.sections.length + 2).padStart(2, "0")}</span>
      <div><h2>${esc(t("borders.title"))}</h2><p class="glead">${esc(t("borders.lead"))}</p>${countries.map(k => `<h3 class="bcountry">${esc(t("country." + k))}</h3><div class="borders">${culture.borders.filter(b => b.country === k).map(b => {
        const x = cultureText[l].borders[b.id];
        return `<article class="border" id="g-${b.id}"><h4>${esc(x.name)}</h4><p>${esc(x.text)}</p></article>`;
      }).join("")}</div>`).join("")}</div></section>
    <section class="callout warn chapare" id="g-chapare"><h2>${esc(g.chapare.title)}</h2><p>${esc(g.chapare.text)}</p><p>${esc(g.chapare.road)}</p></section>
  </div>
</div>`
    });

    /* ───── Culture: one page per topic (same cards as #/culture/<topic>) ───── */
    const ct = (kind, id) => cultureText[l][kind][id];
    const chip = (id, root, dept) => `<a class="chip" href="${root}${paths[l].place[id]}">${esc(dept && P[id].name !== byId[id].dept ? `${P[id].name} · ${byId[id].dept}` : label(id))}</a>`;
    const where = (ids, root, dept) => ids && ids.length ? `<p class="cwhere"><span>${esc(t("culture.where"))}</span> ${ids.map(id => chip(id, root, dept)).join(" ")}</p>` : "";
    const photoFig = (ph, root, alt) => ph ? `<figure class="cimg"><img src="${esc(root + small(ph.src))}" alt="${esc(alt)}" loading="lazy" decoding="async" width="640" height="427">${credit(ph)}</figure>` : "";
    const ccard = (id, ph, title, root, extra, text, after) => `<article class="ccard" id="g-${id}">${photoFig(ph, root, title)}<div class="cbody"><h3>${esc(title)}</h3>${extra || ""}${text ? `<p>${esc(text)}</p>` : ""}${after || ""}</div></article>`;
    const monthName = m => new Intl.DateTimeFormat(l, {month:"long"}).format(new Date(2025, m, 15));
    // When a festival happens, in words that stay true every year (the interactive page gives the exact dates).
    const festivalWhen = f => {
      if (f.date){ const [m, dd] = f.date.split("-").map(Number); return new Intl.DateTimeFormat(l, {day:"numeric", month:"long"}).format(new Date(2025, m - 1, dd)); }
      if (f.month) return monthName(f.month - 1);
      return `${monthName(festivalMonth(f))} (${t("culture.moving")})`;
    };
    const topicBody = {
      festivals: root => {
        const list = culture.festivals.slice().sort((a, b) => festivalMonth(a) - festivalMonth(b) || (a.date || "").localeCompare(b.date || ""));
        return [...new Set(list.map(festivalMonth))].map(m => `<h2 class="cmonth">${esc(monthName(m))}</h2><div class="cgrid">${list.filter(f => festivalMonth(f) === m).map(f => {
          const x = ct("festivals", f.id), u = culture.unesco.find(v => v.festival === f.id);
          return ccard(f.id, itemPhotos.festivals[f.id], x.name, root, `<p class="cwhen">${esc(festivalWhen(f))}</p><div class="row">${f.place ? chip(f.place, root, true) : `<span class="chip">${esc(t("festival.nationwide"))}</span>`}${u ? `<a class="chip unesco" href="${root}${paths[l].topic.unesco}#g-${u.id}">UNESCO · ${esc(u.year)}</a>` : ""}</div>`, x.text);
        }).join("")}</div>`).join("");
      },
      food: root => {
        const at = {}, home = {};
        places.forEach(p => (food[p.id] || []).forEach(k => { (at[k] = at[k] || []).push(p.id); if (!home[k]) home[k] = p.region; }));
        return regions.map(r => {
          const ks = Object.keys(home).filter(k => home[k] === r.id);
          return ks.length ? `<h2 class="cmonth">${esc(t("region." + r.id))}</h2><div class="cgrid">${ks.map(k => ccard(k, itemPhotos.dishes[k], dishText[l][k][0], root, "", dishText[l][k][1], where(at[k], root))).join("")}</div>` : "";
        }).join("");
      },
      unesco: root => ["world", "intangible"].map(kind => `<h2 class="cmonth">${esc(t("unesco." + kind))}</h2><div class="cgrid">${culture.unesco.filter(u => u.kind === kind).map(u => {
        const f = u.festival && culture.festivals.find(x => x.id === u.festival);
        const ph = f ? itemPhotos.festivals[f.id] : (u.places || []).map(id => cover(id)).find(Boolean);
        return ccard(u.id, ph, ct("unesco", u.id), root, `<p class="cwhen">${esc(t("unesco.year", {year:u.year}))}</p>`, "", `${f ? `<p><a href="${root}${paths[l].topic.festivals}#g-${f.id}">${esc(ct("festivals", f.id).name)}</a> · ${esc(festivalWhen(f))}</p>` : ""}${where(u.places, root, true)}`);
      }).join("")}</div>`).join(""),
      crafts: root => `<div class="cgrid">${culture.crafts.map(x => ccard(x.id, itemPhotos.crafts[x.id], ct("crafts", x.id).name, root, "", ct("crafts", x.id).text, where(x.places, root, true))).join("")}</div>`,
      legends: root => `<div class="cgrid">${culture.legends.map(x => ccard(x.id, itemPhotos.legends[x.id], ct("legends", x.id).name, root, "", ct("legends", x.id).text, where(x.places, root, true))).join("")}</div>`
    };
    for (const k of TOPICS){
      const ph = topicCover(k), lead = topicLead(k);
      page({
        key:x => paths[x].topic[k], depth:2,
        title:t(k + ".title"), desc:lead, image:ph && ph.src,
        ld:{"@context":"https://schema.org", "@graph":[
          {"@type":"Article", headline:t(k + ".title"), description:lead, inLanguage:l, url:site + paths[l].topic[k], image:ph ? site + ph.src : undefined, author:{"@type":"Person", name:"jordanmontt", url:"https://github.com/jordanmontt"}},
          {"@type":"BreadcrumbList", itemListElement:[
            {"@type":"ListItem", position:1, name:t("home.h1"), item:site + paths[l].home},
            {"@type":"ListItem", position:2, name:t("culture.title"), item:site + paths[l].home + "#culture"},
            {"@type":"ListItem", position:3, name:t("culture." + k)}]}]},
        body:root => `<section class="pagehead"><div class="in">
  <a class="kicker" href="../#culture">${esc(t("culture.title"))}</a>
  <h1>${esc(t("culture." + k))}</h1>
  <p class="lead">${esc(lead)}</p>
  <nav class="ctabs" aria-label="${esc(t("culture.title"))}">${TOPICS.map(x => `<a href="${root}${paths[l].topic[x]}" ${x === k ? 'aria-current="page"' : ""}>${esc(t("culture." + x))}</a>`).join("")}</nav>
</div></section>
<div class="weave thick"></div>
<div class="culture">${topicBody[k](root)}
  <p><a class="btn primary" href="${app(root, "/culture/" + k)}">${esc(t("place.openMap"))}</a></p>
</div>`
      });
    }

    /* ───── <lang>.html: the interactive site, with its head in this language ───── */
    let h = indexHtml;
    const sub = (re, to) => { if (!re.test(h)) problems.push(`index.html: cannot find ${re} to make ${l}.html`); h = h.replace(re, to); };
    const appTitle = `${t("brand")}: ${t("home.h1")}`, appDesc = t("home.description", {n});
    sub(/<!doctype html>\n<html lang="\w+">/, `<!doctype html>\n<!-- Generated by tools/build.mjs from index.html: edit index.html, not this file. -->\n<html lang="${l}" data-lang="${l}">`);
    sub(/<title>.*?<\/title>/, `<title>${esc(appTitle)}</title>`);
    sub(/<meta name="description" content=".*?">/, `<meta name="description" content="${esc(appDesc)}">`);
    sub(/<link rel="canonical" href=".*?">/, `<link rel="canonical" href="${esc(site + l)}">`);
    sub(/<meta property="og:title" content=".*?">/, `<meta property="og:title" content="${esc(appTitle)}">\n<meta property="og:locale" content="${LOCALE[l] || l}">`);
    sub(/<meta property="og:description" content=".*?">/, `<meta property="og:description" content="${esc(appDesc)}">`);
    sub(/<meta property="og:url" content=".*?">/, `<meta property="og:url" content="${esc(site + l)}">`);
    sub(/<meta property="og:image" content=".*?">/, `<meta property="og:image" content="${esc(site)}assets/og-${l}.png">`);
    sub(/<meta property="og:image:alt" content=".*?">/, `<meta property="og:image:alt" content="${esc(appTitle)}">`);
    files[l + ".html"] = h;
  }

  /* ───── Sitemap and robots.txt ───── */
  const groups = [LANGS, LANGS.map(x => paths[x].home), LANGS.map(x => paths[x].tips), ...TOPICS.map(k => LANGS.map(x => paths[x].topic[k])), ...places.map(p => LANGS.map(x => paths[x].place[p.id]))];
  const urls = groups.flatMap(g => g.map(u => `<url><loc>${esc(site + u)}</loc>${g.map((v, i) => `<xhtml:link rel="alternate" hreflang="${LANGS[i]}" href="${esc(site + v)}"/>`).join("")}</url>`));
  files["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
<url><loc>${esc(site)}</loc></url>
${urls.join("\n")}
</urlset>
`;
  // Search engines only read robots.txt at the root of a domain: it takes effect with a custom domain.
  files["robots.txt"] = `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`;
  return {files, problems, paths};
}
