# Bolivia à la carte

Where to go in Bolivia: an interactive map of 49 places with photos, food, weather and
routes, plus an optional trip planner. In French, English and Spanish.

Live site: https://jordanmontt.github.io/Bolivie-A-La-Carte/

Created by [jordanmontt](https://github.com/jordanmontt).

## How it is organised

No build step: open `index.html` in a browser (it also works from the file system).

| Path | What it holds |
| --- | --- |
| `data/places.js` | Places, travel links, climates and dishes per place (no text) |
| `data/itineraries.js` | Ready-made itinerary ideas |
| `data/photos.js`, `photos/` | Wikimedia Commons photos with author and licence |
| `data/geo.js`, `assets/relief.jpg` | Base map vectors, road geometry and relief image |
| `locales/<lang>.js` | Interface strings |
| `locales/<lang>.content.js` | Place descriptions, route details, dishes, climates |
| `js/i18n.js` | Language choice and string lookup |
| `js/model.js` | Route network, shortest paths, climate, trip maths |
| `js/app.js` | Views, map and interactions |

## Languages

The language comes from `?lang=` in the URL, then the visitor's saved choice, then the
browser's preferred languages, and falls back to English. Each language is a pair of
catalogues loaded on demand; missing strings fall back to English.

To add a language, copy `locales/en.js` and `locales/en.content.js`, translate them, add
the code to `SUPPORTED` and `NAMES` in `js/i18n.js`, then check that nothing is missing:

```
node tools/check-locales.mjs
```

## Licences

Code: MIT (see `LICENSE`). Photos keep their own Creative Commons licences, credited under
each photo. Map data: Natural Earth, SRTM terrain tiles, OpenStreetMap (via OSRM), Esri.
