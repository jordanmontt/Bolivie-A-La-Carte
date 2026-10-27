# Technical guide

How the site is built and how the code works. Read this first before changing anything:
it is meant to save you from reading the whole code base.

## In one paragraph

A static site served by GitHub Pages from the root of `main`. No framework, no npm
dependencies, no bundler. The interactive site is one page (`index.html`) with hash routes
(`#/place/sucre`). All content lives once in `content/*.yml`; `tools/build.mjs` checks it and
generates the JavaScript data files the page loads (`data/*.js`, `locales/*.js`) plus plain
HTML pages for search engines (`fr/`, `en/`, `es/`, `sitemap.xml`). Generated files are
committed. A GitHub Action rebuilds them whenever `content/` changes, so the owner can edit
texts on github.com without tools.

## Repository map

| Path | What it is | Edit? |
| --- | --- | --- |
| `content/` | The single source of truth: places, routes, dishes, culture, texts | yes |
| `content/places/<id>.yml` | Everything about one place (facts, photos, fr/en/es texts) | yes |
| `content/places/_template.yml` | Template for a new place (files starting with `_` are skipped) | yes |
| `data/places.js`, `photos.js`, `itineraries.js`, `culture.js` | Generated data (`window.BOL`) | no |
| `locales/<lang>.js`, `<lang>.content.js` | Generated interface texts and content texts | no |
| `fr/`, `en/`, `es/`, `sitemap.xml`, `robots.txt` | Generated pages for search engines | no |
| `data/geo.js`, `assets/relief.jpg` | Map geometry (borders, lakes, road shapes) and relief image | rarely |
| `data/rates.js` | Exchange rates, written daily by `tools/update-rates.mjs` | no |
| `index.html` | The app shell; loads every script in order | yes |
| `css/style.css` | All styles ("Aguayo" theme, light and dark) | yes |
| `js/i18n.js` | Language choice and text lookup (`BOL.i18n`) | yes |
| `js/model.js` | Logic with no UI: route network, shortest paths, climate, trips (`BOL.model`) | yes |
| `js/core.js` | Constants, helpers, app state, weather block | yes |
| `js/views/*.js` | One file per page: home, guide, places, place, routes, trip, culture | yes |
| `js/map.js` | Leaflet map, loaded on demand | yes |
| `js/app.js` | Router, header/tab bar, render, event delegation, start-up | yes |
| `sw.js` | Service worker (cache) | yes |
| `tools/build.mjs` | The build and all content checks | yes |
| `tools/pages.mjs` | Makes the search-engine pages, sitemap and robots.txt | yes |
| `tools/yaml.mjs` | Own YAML subset reader/writer (no dependency) | rarely |
| `tools/make-small-photos.py` | 640 px copies in `photos/sm/` (Pillow) | rarely |
| `tools/update-rates.mjs` | Fetches the Banco Central de Bolivia rates | rarely |
| `tests/*.test.mjs` | Tests, run with `node --test tests/` | yes |
| `photos/`, `photos/sm/` | Photos (Wikimedia Commons) and their small copies | add only |

## Data flow

```
content/*.yml ──► tools/build.mjs ──► data/*.js, locales/*.js   (loaded by index.html)
                        │
                        └──► tools/pages.mjs ──► fr/ en/ es/ sitemap.xml robots.txt
```

`node tools/build.mjs` reads everything, collects every problem, and writes nothing if
there is any (exit code 1, one line per problem with file and field). `--check` only
checks; `--out DIR` writes elsewhere (used by the tests). It also prints the places that
have no photo (a reminder, not an error).

What the build checks: category, climate and dish ids exist; lat/lng/altitude are numbers;
`days` is `[min, ideal]`; every photo file exists; every place is in exactly one region and
every region lists existing places; route ends and culture items point to existing places;
ids are unique; festival dates use exactly one rule; all three languages have every text;
`content/ui/*.yml` and `content/seo.yml` have the same keys in every language; the guide
has the same sections and number of phrases in every language; every `t("key")` used in
`js/**` exists in `content/ui/en.yml`; no two places get the same page address.

## Content files

The YAML is a subset (see the header of `tools/yaml.mjs`): maps, lists, `[a, b]` short lists,
`>-` folded text, `|-` literal text, quoted strings, `#` comments. No `{…}` maps.

| File | Shape |
| --- | --- |
| `places/<id>.yml` | `department`, `category` (ville, culture, nature, altiplano, jungle, aventure), `lat`, `lng`, `altitude`, `days: [min, ideal]`, `climate`, optional `tour: true` (Salar tour), `major: true` (bigger on the map), `dishes: [ids]`, `photos: [{file, author, licence, source}]`, and `fr/en/es: {name, label, short, story, todo: [..], tips}` |
| `regions.yml` | list of `{id, cover, places: [ids in display order], fr/en/es: {name, desc}}`; a place's region is the region that lists it |
| `routes.yml` | list of `{id, from, to, mode (bus, train, avion, bateau, tour, velo), hours, via?, geom?, straight?, tourgeom?, fr/en/es: {t, how, road?, note?}}` |
| `climates.yml` | `id: {data: [maxJan, maxJul, minJan, minJul, rainJan, rainJul], fr/en/es: {title, text}}`; months in between are interpolated |
| `dishes.yml` | `id: {fr/en/es: {name, text}}` |
| `festivals.yml` | list of `{id, place?, fr/en/es: {name, text}}` plus one date rule: `date: MM-DD` (+ `days`), `easter: N` (days from Easter Sunday), `nth: [month, weekday 0=Sun, n]` (n = -1 for last), or `month: M` (+ `even: true` for even years) |
| `unesco.yml` | list of `{id, kind: world/intangible, year, places?, festival?, fr/en/es: "name"}` |
| `crafts.yml`, `legends.yml` | list of `{id, places, fr/en/es: {name, text}}` |
| `borders.yml` | list of `{id, country (peru, chile, argentina, brazil, paraguay), place?, fr/en/es: {name, text}}` |
| `tour.yml` | Salar tour stops `{id, lat, lng, fr, en, es}` |
| `itineraries.yml` | `{id, days, pref, end, stops: [[place, days]], fr/en/es: {name, desc}}` |
| `ui/<lang>.yml` | flat `key: text`; `{name}` placeholders; plurals as an indented map (`days:` then `one:` and `other:` lines); `dept.named.<Dept>` overrides the generic `dept.named` |
| `guide/<lang>.yml` | `intro`, `sections: [{id, title, lead, points: [..]}]`, `phrases: [[spanish, translation]]`, `chapare: {title, text, road}` |
| `seo.yml` | `site` (public URL ending with `/`) and per language the titles/descriptions of the search-engine pages, `tips.slug` |

## The interactive page (runtime)

`index.html` loads classic scripts in this order; they share one global scope:
`data/places.js`, `itineraries.js`, `culture.js`, `photos.js`, `rates.js`, `js/i18n.js`,
`js/model.js`, `js/core.js`, `js/views/*.js`, `js/map.js`, `js/app.js` (which calls `start()`).
Language catalogues (`locales/<lang>.js` and `.content.js`) are injected on demand by i18n.

**Data (`window.BOL`, alias `B`):**
- `B.regions [{id, cover}]`, `B.places [{id, region, cat, dept, lat, lng, alt, days, clim, tour?, major?}]`
- `B.edges [{id, a, b, mode, h, via?, geom?, straight?, tourgeom?}]`, `B.tourStops`, `B.climates`, `B.food {placeId: [dishIds]}`
- `B.photos {placeId: [{src, artist, lic, page}]}` (`small(src)` gives the 640 px copy)
- `B.itineraries`, `B.festivals`, `B.unesco`, `B.crafts`, `B.legends`, `B.borders`, `B.rates`
- `B.locales[lang].ui` (interface) and `.places .edges .dishes .climates .tour .festivals .unesco .crafts .legends .borders .guide`

**i18n (`I = B.i18n`):** `t(key, vars)` interface text; `I.c(section, id)` content text (e.g.
`I.c("places", "sucre").story`); `I.num`, `I.month`, `I.list`; `I.use(lang, persist)`.
Language order: `?lang=` in the URL, saved choice (localStorage), browser languages, English.

**State (`core.js`):** `S` holds the view, open place/route, filters, month, list scroll, culture
topic; `trip` is `{stops: [{id, d}], days, end, pref}` saved in localStorage
(`bolivia-trip`); UI preferences in `bolivia-ui`. Helpers: `esc` (always escape text put into
HTML), `pc/name/label`, `photos/cover/small`, `deptName`, `fmtH`, `fmtDays`, `icon`, `toast`.

**Model (`M = B.model`):** `shortest(from, to, pref)` (Dijkstra; flights cost airport time),
`climate(id, month)`, `cleanTrip`, `legs`, `totals`, `optimize` (nearest neighbour),
`encode/decode` (shareable trip string).

**Routes (`app.js`):**

| Hash | View | Rendered by |
| --- | --- | --- |
| `#/` | home | `renderHome()` in `views/home.js` |
| `#/guide?s=<section>` | practical tips | `renderGuide()` in `views/guide.js` |
| `#/culture`, `#/culture/<topic>?s=<id>` | culture (festivals, food, unesco, crafts, legends) | `renderCulture()` in `views/culture.js` |
| `#/map?region=&cat=` | places list + map | `panelMap()` in `views/places.js` |
| `#/place/<id>` | one place | `panelPlace()` in `views/place.js` |
| `#/routes`, `#/route/<id>` | route calculator, one route | `views/routes.js` |
| `#/trip?t=<code>` | trip planner | `views/trip.js` |

`route()` parses the hash into `S`, then `render(navigated)`. Home, guide and culture are full
pages written into `#v-home`; the other views go into `#panel` beside the map (`#v-app`).
Views return HTML strings; clicks and changes are handled once, by delegation, through
`data-act="…"` and `data-set="…"` attributes (see the two `switch` blocks in `app.js`).
`update()` re-renders without moving focus or scroll. Phones show a 5-tab bar; Culture is in
the desktop menu and on the home page only.

**Derived blocks (nothing written twice):** the culture pages are computed from
`festivals.yml`, the places' `dishes`, `unesco.yml`, `crafts.yml`, `legends.yml`; a place
page shows "Also here" (`placeExtras()` in `views/culture.js`) only when something points to
it; a festival listed by UNESCO is shown once, as a festival with a UNESCO mark. Festival
dates (Easter-based, nth weekday…) are computed in the browser (`nextFestival()`).

**Map (`map.js`):** Leaflet 1.9.4 from cdnjs and `data/geo.js` load on the first map view
(`ensureMap()`). Pins, route lines (`edgeLine()` uses road geometry when present), Salar tour
line, basemap switch (relief image or Esri tiles), phone bottom card (`renderSheet()`).

## Pages for search engines (`tools/pages.mjs`)

Google sees the hash-routed app as a single page, so the build also writes plain HTML pages
(no JavaScript) for each language:

- `<lang>/` home: every place, region by region;
- `<lang>/<slug>/` one page per place: photos with credits, story, facts, things to do,
  food, tip, "also here", how to get there (every route with its text), other places of the
  region, and a button to open the place in the interactive map (`../../?lang=xx#/place/id`);
- `<lang>/<tips-slug>/` the practical tips (same markup classes as `views/guide.js`; keep the
  two in step when the tips page layout changes).

Each page has a title and description, a canonical URL, `hreflang` links to the two other
languages (and `x-default` to English), Open Graph tags with the first photo, and JSON-LD
(`TouristAttraction` + `BreadcrumbList`, `WebSite`, `Article`). `sitemap.xml` lists every page
with its alternates. The slug comes from the place's `name` in that language, so **renaming a
place changes its address** (old links break and Google has to re-learn it): rename only
when needed. Styles are the `.static`/`.sp*` rules at the end of `css/style.css`; the pages
load `css/style.css?v=` with the release number read from `index.html`.

The app links to these pages from its footer ("All places, page by page") and from a
`<noscript>` block in `index.html`. `robots.txt` is only read at a domain root, so it takes
effect once the site has its own domain (then also change `site:` in `content/seo.yml`, the
canonical and `og:` URLs in `index.html`, and add a `CNAME` file).

## Caching and releases

- `sw.js`: photos, relief image, tiles, fonts and libraries are cache-first; pages, code,
  data and texts are network-first (cache as offline fallback). Bump `VERSION` when a
  cached file (e.g. a photo) is replaced under the same name.
- For each code or style release, bump the `?v=` numbers in `index.html` **and** `RELEASE`
  in `js/i18n.js` (same number). Data generated by the build keeps the same `?v=`, which is
  fine because the service worker always revalidates code and data.
- The home page loads only the active language, place data and photos; Leaflet and
  `data/geo.js` load with the map. Lists use `photos/sm/`.

## GitHub Actions

- `.github/workflows/build.yml` (on pushes touching content, photos, tools, tests, js,
  index.html): `node tools/build.mjs`, `python tools/make-small-photos.py`,
  `node --test tests/`, then commits the generated files and asks GitHub Pages to rebuild
  (pushes made by an Action don't trigger Pages by themselves).
- `.github/workflows/rates.yml` (twice each morning, Bolivian time): updates `data/rates.js`.

## Tests

`node --test tests/` (Node.js 22+, no dependencies), about half a second:
- `yaml.test.mjs`: the YAML reader (maps, lists, folded text, errors with line numbers, round trip);
- `build.test.mjs`: builds into a temporary folder and checks the committed generated files are
  up to date, one page per place and language, every page has title/description/canonical/
  hreflang/valid JSON-LD, and every relative link or image resolves;
- `logic.test.mjs`: runs `data/places.js`, `js/model.js` and `js/views/culture.js` in a `vm`
  sandbox: every place reachable, flights vs road, trip encode/decode, trip cleaning, Easter
  and festival date rules.

## Previewing

Any static server at the repository root works, e.g. `python3 -m http.server`. Opening
`index.html` from disk also works (the service worker is then off). `.claude/launch.json`
serves a copy made with `rsync` into the session scratchpad.

## Recipes

- **Add a place:** copy `content/places/_template.yml`, fill it in, add the id to a region in
  `content/regions.yml`, add photos to `photos/`, add at least one route in `content/routes.yml`
  (otherwise it can't be reached by the route calculator; a test checks it), run the build.
- **Add an interface text:** add the key to `content/ui/en.yml`, `fr.yml` and `es.yml`; use it
  with `t("key")`.
- **Add a culture-like section:** a YAML list in `content/`, one `items("name", …)` line in
  `tools/build.mjs` (it validates ids and texts and outputs `B.<name>` and
  `B.locales[l].<name>`), a page function in `js/views/culture.js` (add it to `TOPICS` and
  `TOPIC_COVER`), and its `culture.<name>` / `culture.<name>.lead` texts in `content/ui/*.yml`.
- **Change the domain:** see the end of "Pages for search engines".

## Editorial and design decisions (keep them)

- A tourist guide first; the trip planner is optional. Don't overload pages: short cards,
  derived blocks only when they have content, five tabs on phones.
- Every fact is written once in `content/` and shown wherever it is relevant.
- Tone is gentle and practical. Safety advice is soft (avoid walking late at night, take
  care crossing streets). Taxis: about 15 Bs in town, InDrive and Yango as apps, radio-taxi
  stands at night, agree the price first; don't mention Uber.
- Money: carry cash in bolivianos; foreign cards rarely work; Bolivian QR codes need a
  Bolivian bank account; ATMs charge fees; exchange houses pay better for clean notes.
- The Chapare is not featured; the note explaining why is only at the end of the tips page.
  Puerto Quijarro is deliberately not a place ("nothing to see").
- El Alto is a separate place from La Paz. Every place shows its department.
- Contact address is assembled in JavaScript (`MAIL` in `views/home.js`) to slow down spam bots.
- Copyright: all rights reserved (no open-source licence). Photos keep their own licences.
- Documentation and code comments are in English; site texts exist in fr, en and es.

## Known gaps

The build prints the current list of places without photos. As of October 2026:

- **No photo:** Espejillos, Iruito, Viscachani, Cotagaita, Candelaria, Zudáñez
  (nothing usable found on Wikimedia Commons for most of them).
- **Only one photo:** Yunga Cruz, Obrajes. **Two:** Huatajata, Suriki, Coipasa, Coimata,
  Cotoca, Porvenir, Puerto Rico.
- **Texts to verify on the ground** (written from few sources, kept cautious):
  Candelaria, Zudáñez, Iruito, Viscachani.
- **Search engines:** Google Search Console and Bing Webmaster Tools are not set up yet (needs
  the owner's account, then submit `sitemap.xml`). The site has no own domain yet.
