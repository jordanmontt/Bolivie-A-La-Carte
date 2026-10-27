# Technical guide

How the site is built and how the code works. Read this first before changing anything:
it is meant to save you from reading the whole code base.

## In one paragraph

A static site served by GitHub Pages from the root of `main`. No framework, no npm
dependencies, no bundler. The interactive site is one page (`index.html`) with hash routes
(`#/place/sucre`). All content lives once in `content/*.yml`; `tools/build.mjs` checks it and
generates the JavaScript data files the page loads (`data/*.js`, `locales/*.js`), one copy
of `index.html` per language (`fr.html`, `en.html`, `es.html`) and plain HTML pages for search
engines (`fr/`, `en/`, `es/`, `sitemap.xml`). Generated files are
committed. A GitHub Action rebuilds them whenever `content/` changes, so the owner can edit
texts on github.com without tools.

## Repository map

| Path | What it is | Edit? |
| --- | --- | --- |
| `content/` | The single source of truth: places, routes, dishes, culture, texts | yes |
| `content/places/<id>.yml` | Everything about one place (facts, photos, fr/en/es texts) | yes |
| `content/places/_template.yml` | Template for a new place (files starting with `_` are skipped) | yes |
| `data/places.js`, `photos.js`, `itineraries.js`, `culture.js`, `site.js` | Generated data (`window.BOL`) | no |
| `locales/<lang>.js`, `<lang>.content.js` | Generated interface texts and content texts | no |
| `fr/`, `en/`, `es/`, `sitemap.xml`, `robots.txt` | Generated pages for search engines | no |
| `fr.html`, `en.html`, `es.html` | Generated copies of `index.html` with a head in one language | no |
| `assets/og-<lang>.png` | Link preview images (1200×630), made from `tools/og.html` | rarely |
| `data/geo.js`, `assets/relief.jpg` | Map geometry (borders, lakes, road shapes) and relief image | rarely |
| `data/rates.js` | Exchange rates, written daily by `tools/update-rates.mjs` | no |
| `index.html` | The app shell; loads every script in order (its `<body>` is copied to `<lang>.html`) | yes |
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
| `tools/og.html` | Template of the link preview images (how to remake them is in its header) | rarely |
| `tools/update-rates.mjs` | Fetches the Banco Central de Bolivia rates | rarely |
| `tests/*.test.mjs` | Tests, run with `node --test "tests/*.test.mjs"` | yes |
| `photos/`, `photos/sm/` | Photos (Wikimedia Commons) and their small copies | add only |

## Data flow

```
content/*.yml ──► tools/build.mjs ──► data/*.js, locales/*.js   (loaded by index.html)
                        │
index.html ─────────────┴──► tools/pages.mjs ──► fr/ en/ es/ fr.html en.html es.html
                                                  sitemap.xml robots.txt
```

`node tools/build.mjs` reads everything, collects every problem, and writes nothing if
there is any (exit code 1, one line per problem with file and field). `--check` only
checks; `--out DIR` writes elsewhere (used by the tests). It also prints the places,
festivals, crafts, legends and dishes that have no photo (a reminder, not an error).

What the build checks: category, climate and dish ids exist; lat/lng/altitude are numbers;
`days` is `[min, ideal]`; every photo file exists; every place is in exactly one region and
every region lists existing places; route ends and culture items point to existing places;
ids are unique; festival dates use exactly one rule; all three languages have every text;
`content/ui/*.yml` and `content/seo.yml` have the same keys in every language; the guide
has the same sections and number of phrases in every language; every `t("key")` used in
`js/**` exists in `content/ui/en.yml`; no two pages get the same address; every dish is
listed by at least one place (an unlisted dish would never show); `stats` is a bare code.

## Content files

The YAML is a subset (see the header of `tools/yaml.mjs`): maps, lists, `[a, b]` short lists,
`>-` folded text, `|-` literal text, quoted strings, `#` comments. No `{…}` maps.

| File | Shape |
| --- | --- |
| `places/<id>.yml` | `department`, `category` (ville, culture, nature, altiplano, jungle, aventure), `lat`, `lng`, `altitude`, `days: [min, ideal]`, `climate`, optional `tour: true` (Salar tour), `major: true` (bigger on the map), `dishes: [ids]`, `photos: [{file, author, licence, source}]`, and `fr/en/es: {name, label, short, story, todo: [..], tips}` |
| `regions.yml` | list of `{id, cover, places: [ids in display order], fr/en/es: {name, desc}}`; a place's region is the region that lists it |
| `routes.yml` | list of `{id, from, to, mode (bus, train, avion, bateau, tour, velo), hours, via?, geom?, straight?, tourgeom?, fr/en/es: {t, how, road?, note?}}` |
| `climates.yml` | `id: {data: [maxJan, maxJul, minJan, minJul, rainJan, rainJul], fr/en/es: {title, text}}`; months in between are interpolated |
| `dishes.yml` | `id: {photo?, fr/en/es: {name, text}}` |
| `festivals.yml` | list of `{id, place?, photo?, fr/en/es: {name, text}}` plus one date rule: `date: MM-DD` (+ `days`), `easter: N` (days from Easter Sunday), `nth: [month, weekday 0=Sun, n]` (n = -1 for last), or `month: M` (+ `even: true` for even years) |
| `unesco.yml` | list of `{id, kind: world/intangible, year, places?, festival?, fr/en/es: "name"}` |
| `crafts.yml`, `legends.yml` | list of `{id, places, photo?, fr/en/es: {name, text}}` |
| `borders.yml` | list of `{id, country (peru, chile, argentina, brazil, paraguay), place?, fr/en/es: {name, text}}` |
| `tour.yml` | Salar tour stops `{id, lat, lng, fr, en, es}` |
| `itineraries.yml` | `{id, days, pref, end, stops: [[place, days]], fr/en/es: {name, desc}}` |
| `ui/<lang>.yml` | flat `key: text`; `{name}` placeholders; plurals as an indented map (`days:` then `one:` and `other:` lines); `dept.named.<Dept>` overrides the generic `dept.named` |
| `guide/<lang>.yml` | `intro`, `sections: [{id, title, lead, points: [..]}]`, `phrases: [[spanish, translation]]`, `chapare: {title, text, road}` |
| `seo.yml` | `site` (public URL ending with `/`), `stats` (GoatCounter code, empty = off) and per language the titles/descriptions/slugs of the search-engine pages (`tips.*`, `<topic>.slug/title`, `festivals.intro`) |

`photo` (festivals, crafts, legends, dishes) is one `{file, author, licence, source}`, like
a place's photos, with the file in `photos/` (name it `<kind>-<id>.jpg`, e.g. `dish-saltena.jpg`).

## The interactive page (runtime)

`index.html` loads classic scripts in this order; they share one global scope:
`data/places.js`, `itineraries.js`, `culture.js`, `photos.js`, `rates.js`, `site.js`, `js/i18n.js`,
`js/model.js`, `js/core.js`, `js/views/*.js`, `js/map.js`, `js/app.js` (which calls `start()`).
Language catalogues (`locales/<lang>.js` and `.content.js`) are injected on demand by i18n.

**Data (`window.BOL`, alias `B`):**
- `B.regions [{id, cover}]`, `B.places [{id, region, cat, dept, lat, lng, alt, days, clim, tour?, major?}]`
- `B.edges [{id, a, b, mode, h, via?, geom?, straight?, tourgeom?}]`, `B.tourStops`, `B.climates`, `B.food {placeId: [dishIds]}`
- `B.photos {placeId: [{src, artist, lic, page}]}` (`small(src)` gives the 640 px copy)
- `B.itemPhotos {festivals|crafts|legends|dishes: {id: {src, artist, lic, page}}}`
- `B.site {url, stats}` (from `content/seo.yml`)
- `B.itineraries`, `B.festivals`, `B.unesco`, `B.crafts`, `B.legends`, `B.borders`, `B.rates`
- `B.locales[lang].ui` (interface) and `.places .edges .dishes .climates .tour .festivals .unesco .crafts .legends .borders .guide`

**i18n (`I = B.i18n`):** `t(key, vars)` interface text; `I.c(section, id)` content text (e.g.
`I.c("places", "sucre").story`); `I.num`, `I.month`, `I.list`; `I.use(lang, persist)`.
Language order: `?lang=` in the URL, the page's language (`<html data-lang>` in `<lang>.html`),
saved choice (localStorage), browser languages, English.

**Address in the language (`langAddress()` in `app.js`):** at start and after a language change
the app replaces the address with `<lang>.html#…` (same folder, hash kept, `?lang` dropped).
`es.html`/`fr.html`/`en.html` are `index.html` with title, description and `og:` image in
that language, so a link copied from the address bar previews in the visitor's language
(link previews never run JavaScript and ignore the hash). Not done when opened as a file.

**Visitor statistics (`countView()` and `countEvent()` in `app.js`):** when `stats` is set in
`content/seo.yml`, each screen is counted once in GoatCounter as `/<lang>/<hash path>` (e.g.
`/es/place/sucre`, `/fr/culture/festivals`), and a few actions as events: `calc/<from>-<to>`
(route calculator), `trip-add/<place>`, `idea/<itinerary>`, `trip-share`, `trip-copy`,
`trip-open-shared`. `count.js` is loaded on the first hit. Nothing on localhost or
from a file. The search-engine pages carry the standard GoatCounter tag (counted under their
real address, e.g. `/Bolivie-A-La-Carte/es/sucre/`, which shows Google arrivals). No
cookies, no personal data, so no consent banner is needed.

**State (`core.js`):** `S` holds the view, open place/route, filters, month, culture topic; `trip` is `{stops: [{id, d}], days, end, pref}` saved in localStorage
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
`update()` re-renders without moving focus or scroll. Every history entry remembers where its
page was scrolled (`saveScroll()` writes `{win, panel}` into `history.state` on scroll and before
each click), so going back, or reloading, returns to the same spot on any page; a new link
opens at the top. Phones show a 6-tab bar (Discover,
Culture, Map, Routes, Tips, My trip), the same items as the desktop menu; labels shrink below
390 px so "Mon voyage" fits on a 360 px phone.

**Derived blocks (nothing written twice):** the culture pages are computed from
`festivals.yml`, the places' `dishes`, `unesco.yml`, `crafts.yml`, `legends.yml`; a place
page shows "Also here" (`placeExtras()` in `views/culture.js`) only when something points to
it; a festival listed by UNESCO is shown once, as a festival with a UNESCO mark. Festival
dates (Easter-based, nth weekday…) are computed in the browser (`nextFestival()`). Festival,
craft and legend cards name each place with its department ("Tarabuco · Chuquisaca").
Cards show their item's photo (`B.itemPhotos`, small copy, `loading="lazy"`, fixed ratio so
nothing jumps); a UNESCO card borrows its festival's photo or its first place's cover.

**Map (`map.js`):** Leaflet 1.9.4 from cdnjs and `data/geo.js` load on the first map view
(`ensureMap()`). Pins, route lines (`edgeLine()` uses road geometry when present), Salar tour
line, basemap switch (relief image or Esri tiles), phone bottom card (`renderSheet()`).

## Pages for search engines (`tools/pages.mjs`)

Google sees the hash-routed app as a single page, so the build also writes plain HTML pages
(no JavaScript) for each language:

- `<lang>/` home: every place, region by region;
- `<lang>/<slug>/` one page per place: photos with credits, story, facts, things to do,
  food, tip, "also here", how to get there (every route with its text), other places of the
  region, and a button to open the place in the interactive map (`../../xx.html#/place/id`);
- `<lang>/<tips-slug>/` the practical tips (same markup classes as `views/guide.js`; keep the
  two in step when the tips page layout changes);
- `<lang>/<topic-slug>/` festivals (by calendar month, with dates in words that stay true
  every year; `festivalMonth()` repeats the Easter rule of `views/culture.js`), food (by
  region), UNESCO, crafts, legends: the same cards and photos as `#/culture/<topic>`; the
  language home lists them under "Culture" (`#culture`);
- `<lang>.html`: `index.html` with its head rewritten (lang, title, description, canonical,
  `og:` tags and `assets/og-<lang>.png`). The build stops if a tag it rewrites is missing.

Each page has a title and description, a canonical URL, `hreflang` links to the two other
languages (and `x-default` to English), Open Graph tags (place pages: the first photo;
others: `assets/og-<lang>.png`), and JSON-LD
(`TouristAttraction` + `BreadcrumbList`, `WebSite`, `Article`). `sitemap.xml` lists every page
with its alternates. The slug comes from the place's `name` in that language, so **renaming a
place changes its address** (old links break and Google has to re-learn it): rename only
when needed. Styles are the `.static`/`.sp*` rules at the end of `css/style.css`; the pages
load `css/style.css?v=` with the release number read from `index.html`.

The app links to these pages from its footer ("All places, page by page") and from a
`<noscript>` block in `index.html`. `robots.txt` is only read at a domain root, so it takes
effect once the site has its own domain (then also change `site:` in `content/seo.yml`, the
canonical, `hreflang` and `og:` URLs in `index.html`, and add a `CNAME` file).

## Caching and releases

- `sw.js`: photos, relief image, tiles, fonts and libraries are cache-first; pages, code,
  data and texts are network-first (cache as offline fallback). Bump `VERSION` when a
  cached file (e.g. a photo) is replaced under the same name.
- For each code or style release, bump the `?v=` numbers in `index.html` **and** `RELEASE`
  in `js/i18n.js` (same number). Data generated by the build keeps the same `?v=`, which is
  fine because the service worker always revalidates code and data.
- The home page loads only the active language, place data and photos; Leaflet and
  `data/geo.js` load with the map. Lists use `photos/sm/`.
- Photos: full size at most 960 px; `photos/sm/` copies are 640 px at JPEG quality 72
  (about 50 KB; older copies were made at 80). Every photo in a list or card has
  `loading="lazy"`, `decoding="async"` and its width/height, so a page with dozens of
  photos (Food has 39) only downloads the ones near the screen, and nothing jumps while
  they load. Measured on a cold cache: the home page downloads 3 photos (about 170 KB).

## GitHub Actions

- `.github/workflows/build.yml` (on pushes touching content, photos, tools, tests, js,
  index.html): `node tools/build.mjs`, `python tools/make-small-photos.py`,
  `node --test "tests/*.test.mjs"`, then commits the generated files and asks GitHub Pages to rebuild
  (pushes made by an Action don't trigger Pages by themselves).
- `.github/workflows/rates.yml` (twice each morning, Bolivian time): updates `data/rates.js`.

## Tests

`node --test "tests/*.test.mjs"` (Node.js 22+, no dependencies), about half a second:
- `yaml.test.mjs`: the YAML reader (maps, lists, folded text, errors with line numbers, round trip);
- `build.test.mjs`: builds into a temporary folder and checks the committed generated files are
  up to date, the page count, `<lang>.html` = `index.html` body with a head in its language,
  every page has title/description/canonical/hreflang/valid JSON-LD, and every relative link
  or image resolves;
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
  `TOPIC_COVER`), its `culture.<name>` / `culture.<name>.lead` texts in `content/ui/*.yml`,
  and its static page in `tools/pages.mjs` (`TOPICS`, `topicBody`, `<name>.slug/title` in
  `content/seo.yml`).
- **Add a photo to a festival, craft, legend or dish:** put the file in `photos/` and add
  `photo: {file, author, licence, source}` (as indented lines) to its entry; run the build and
  `make-small-photos.py` (the Action does both).
- **Change the domain:** see the end of "Pages for search engines".

## Editorial and design decisions (keep them)

- A tourist guide first; the trip planner is optional. Don't overload pages: short cards,
  derived blocks only when they have content, six tabs on phones (Culture included, at the
  owner's request).
- Pages stay light despite many photos: lists and cards use the 640 px copies, only the first
  photo of a page loads eagerly, everything else is `loading="lazy"`.
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

- **No photo:** Iruito, Viscachani, Cotagaita, Candelaria, Zudáñez, Apote (nothing usable
  found on Wikimedia Commons). Culture items without a photo: the Ch'utillos festival, the Los
  Pozos market, Cotoca pottery and the Chiquitos cheeses (the build lists them).
- **Only one photo:** Yunga Cruz, Obrajes. **Two:** Yungapampa, Huatajata, Suriki, Coipasa, Coimata,
  Cotoca, Porvenir, Puerto Rico.
- **Texts to verify on the ground** (written from few sources, kept cautious):
  Candelaria, Zudáñez, Iruito, Viscachani, Yungapampa (access and lodge), Apote (the dams
  above the waterfalls), Casa de Moneda and Villa Albina opening hours.
- **Search engines:** Google Search Console and Bing Webmaster Tools are not set up yet (needs
  the owner's account, then submit `sitemap.xml`). The site has no own domain yet.
