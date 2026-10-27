// Makes the plain HTML pages that search engines read, from the same data as the site.
// The interactive site lives in one page (index.html) whose views are #/… addresses, which
// Google treats as a single page. So the build also writes, for each language:
//   <lang>/                 home: every place, region by region
//   <lang>/<place-slug>/    one page per place (slug made from the place's name)
//   <lang>/<tips-slug>/     the practical tips
// plus sitemap.xml and robots.txt. These pages need no JavaScript and link back to the map.
// Their few own texts are in content/seo.yml; everything else comes from content/.

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
export const slugify = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const ldJson = o => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, "\\u003c")}</script>`;

// d: everything tools/build.mjs read (see the call there). Returns {files:{path: text}, problems:[]}.
export function makePages(d){
  const {LANGS, site, seo, ui, regions, places, placeText, photos, food, dishText, edges, edgeText, culture, cultureText, guide, release, logo} = d;
  const files = {}, problems = [];
  const byId = Object.fromEntries(places.map(p => [p.id, p]));

  // Address of every page, per language, relative to the site root.
  const paths = {};
  for (const l of LANGS){
    const seen = new Map([[slugify(seo[l]["tips.slug"]), "the tips page"]]);
    paths[l] = {home:`${l}/`, tips:`${l}/${slugify(seo[l]["tips.slug"])}/`, place:{}};
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
<meta property="og:image" content="${esc(site + (image || "assets/og.png"))}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="${root}assets/icon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Unbounded:wght@600;700;800&display=swap">
<link rel="stylesheet" href="${root}css/style.css?v=${release}">
${ld ? ldJson(ld) : ""}
</head>
<body class="static">
<header class="site-head"><div class="bar">
  <a class="brand" href="${root}${l}/">${logo}<span>${esc(t("brand"))}</span></a>
  <nav class="snav" aria-label="${esc(t("nav.label"))}"><a href="${root}${paths[l].tips}">${esc(t("nav.guide"))}</a><a href="${root}?lang=${l}#/map">${esc(t("nav.map"))}</a><span class="sep" aria-hidden="true"></span>${langs}</nav>
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
    const credit = x => `<figcaption>${esc(t("photos.by"))} <a href="${esc(x.page)}" rel="noopener">${esc(x.artist || "Wikimedia Commons")}</a>${x.lic ? ", " + esc(x.lic) : ""}</figcaption>`;

    /* ───── Home of the language ───── */
    page({
      key:x => paths[x].home, depth:1,
      title:t("home.title"), desc:t("home.description", {n}),
      ld:{"@context":"https://schema.org", "@type":"WebSite", name:t("brand"), url:site + paths[l].home, inLanguage:l, description:t("home.description", {n}), author:{"@type":"Person", name:"jordanmontt", url:"https://github.com/jordanmontt"}},
      body:root => `<section class="pagehead"><div class="in">
  <p class="kicker">${esc(t("brand"))}</p>
  <h1>${esc(t("home.h1"))}</h1>
  <p class="lead">${esc(t("home.intro", {n}))}</p>
  <div class="row"><a class="btn cta" href="${root}?lang=${l}#/map">${esc(t("home.explore"))}</a><a class="btn on-dark" href="${root}${paths[l].tips}">${esc(t("tips.more"))}</a></div>
</div></section>
<div class="weave thick"></div>
<div class="sp wide">
${regions.map(r => `<section class="sp-region" id="r-${r.id}"><h2>${esc(t("region." + r.id))}</h2><p class="muted">${esc(t("regionDesc." + r.id))}</p>
<ul class="sp-places">${r.places.filter(id => byId[id]).map(id => card(id, root)).join("")}</ul></section>`).join("\n")}
</div>`
    });

    /* ───── One page per place ───── */
    for (const p of places){
      const c = P[p.id], ph = photos[p.id] || [], region = t("region." + p.region);
      const url = site + paths[l].place[p.id];
      const conns = edges.filter(e => e.a === p.id || e.b === p.id).sort((a, b) => a.h - b.h);
      const dishes = (food[p.id] || []).map(k => dishText[l][k]).filter(Boolean);
      const stay = p.days[0] === p.days[1] ? days(p.days[1]) : t("daysRange", {a:num(p.days[0]), b:days(p.days[1])});
      const ct = (kind, id) => cultureText[l][kind][id];
      const extras = [
        ...culture.unesco.filter(u => !u.festival && (u.places || []).includes(p.id)).map(u => [t("place.unesco"), ct("unesco", u.id), ""]),
        ...culture.festivals.filter(f => f.place === p.id).map(f => [t("culture.festivals") + (culture.unesco.some(u => u.festival === f.id) ? " · UNESCO" : ""), ct("festivals", f.id).name, ct("festivals", f.id).text]),
        ...["crafts", "legends"].flatMap(k => culture[k].filter(x => (x.places || []).includes(p.id)).map(x => [t("culture." + k), ct(k, x.id).name, ct(k, x.id).text])),
        ...culture.borders.filter(x => x.place === p.id).map(x => [t("place.border"), ct("borders", x.id).name, ct("borders", x.id).text])
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
  <div class="row"><a class="btn primary" href="${root}?lang=${l}#/place/${p.id}">${esc(t("place.openMap"))}</a><a class="btn ghost" href="https://www.google.com/maps/search/?api=1&amp;query=${p.lat},${p.lng}" rel="noopener">Google Maps</a></div>
  ${p.alt >= 3500 ? `<div class="callout warn"><strong>${esc(t("alt.warnTitle"))}</strong> ${esc(t("alt.warn"))}</div>` : ""}
  <section class="sec"><h2>${esc(t("place.todo"))}</h2><ul class="todo">${c.todo.map(x => `<li>${esc(x)}</li>`).join("")}</ul></section>
  ${dishes.length ? `<section class="sec"><h2>${esc(t("place.food"))}</h2><ul class="food">${dishes.map(([dn, dt]) => `<li><b>${esc(dn)}</b><span>${esc(dt)}</span></li>`).join("")}</ul></section>` : ""}
  ${c.tips ? `<div class="callout"><strong>${esc(t("place.tip"))}</strong> ${esc(c.tips)}</div>` : ""}
  ${extras.length ? `<section class="sec"><h2>${esc(t("place.here"))}</h2><ul class="sp-extras">${extras.map(([k, nm, tx]) => `<li><b>${esc(k)}</b> ${esc(nm)}${tx ? `<span>${esc(tx)}</span>` : ""}</li>`).join("")}</ul></section>` : ""}
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
  }

  /* ───── Sitemap and robots.txt ───── */
  const groups = [LANGS.map(x => paths[x].home), LANGS.map(x => paths[x].tips), ...places.map(p => LANGS.map(x => paths[x].place[p.id]))];
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
