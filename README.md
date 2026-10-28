# Bolivia à la carte

A free travel guide to Bolivia: 110 places on an interactive map, with photos, food, weather
and routes, practical tips (money, buses, safety, visas, border crossings), culture pages and
an optional trip planner. In French, English and Spanish.

Site: https://bolivia-alacarte.jordanmontt.fr/

Made by [jordanmontt](https://github.com/jordanmontt) · sebastian.jordan.m@proton.me

## Editing the site (no programming needed)

All the content is in the `content/` folder, in simple text files (YAML). Each piece of
information is written once, and the site shows it everywhere it is needed.

| I want to… | File to edit |
| --- | --- |
| change a place's description, things to do or tip | `content/places/<place>.yml` (`fr:`, `en:`, `es:` parts) |
| add or remove a photo of a place | put the image in `photos/`, then list it under `photos:` in `content/places/<place>.yml` |
| change a route (duration, how to travel) | `content/routes.yml` |
| change a dish | `content/dishes.yml` (places list their dishes under `dishes:`) |
| add or change the photo of a dish, festival, craft or legend | put the image in `photos/`, then set `photo:` in its entry (in `dishes.yml`, `festivals.yml`, `crafts.yml` or `legends.yml`) |
| change a region's name or description, or the order of places | `content/regions.yml` |
| change the practical tips page | `content/guide/fr.yml`, `en.yml`, `es.yml` |
| change a button or title of the site | `content/ui/fr.yml`, `en.yml`, `es.yml` |
| change an itinerary idea | `content/itineraries.yml` |
| change a festival (date, text) | `content/festivals.yml` |
| change UNESCO heritage, crafts, legends | `content/unesco.yml`, `content/crafts.yml`, `content/legends.yml` |
| change a border crossing | `content/borders.yml` |
| change what Google shows (titles, descriptions) | `content/seo.yml` |
| turn on visitor statistics | `stats:` in `content/seo.yml` (see below) |

**Add a place:** copy `content/places/_template.yml` to `content/places/<id>.yml` (a short
id with no spaces or accents, e.g. `sorata`), fill it in, then add `<id>` to its region's
`places:` list in `content/regions.yml`.

**A few rules of the format:**
- indent with spaces, never tabs;
- a long text can go on several lines after `>-`; they are joined;
- if a text starts with a special sign (`«`, `"`, `[`, `-`) or contains `: `, put it between
  quotes `"…"`, and write `\"` for a quote inside;
- a line starting with `#` is a comment.

**Publishing:** edit the file directly on github.com (pencil button) and commit. The
"Build site" action rebuilds the site in a minute or two. If something is wrong (a missing
translation, a photo that isn't there, an unknown place), the action fails, says exactly
what and where, and the live site is not changed.

**Hosting:** Cloudflare Pages publishes every change pushed to `main` (settings in
[technical.md](technical.md), "Hosting").

## Visitor statistics

The site can count its visitors with [GoatCounter](https://www.goatcounter.com) (free, no
cookies, so no consent banner). Create an account there, choose a code (for example
`bolivia-alacarte`), and write it after `stats:` in `content/seo.yml`. You then see at
`https://<code>.goatcounter.com` the visits per day, the most viewed pages (e.g.
`/es/place/sucre` or `/fr/culture/festivals`), where visitors come from (Google, Facebook…),
their countries and devices (the language is the start of each page address). It also
counts what visitors do: the routes they look up in the calculator (`calc/lapaz-uyuni`…),
the places they add to a trip (`trip-add/…`), the itinerary ideas they open and the trips
they share. In GoatCounter's settings you can make the dashboard public, to show the
numbers to a partner or sponsor.

## Sharing a link

The address bar shows `…/es`, `…/fr` or `…/en`, depending on the language chosen. A link copied from there shows its preview (title and image) in that language.

## On a computer

Open `index.html` in a browser: it works without a server. To check and rebuild after
editing `content/`, then run the tests (Node.js 22 or newer):

```
node tools/build.mjs
node --test "tests/*.test.mjs"
```

How the code works is explained in [technical.md](technical.md).

## Copyright

© jordanmontt. All rights reserved: the code, texts, design and logo of this site may not
be reused without permission. Contact: sebastian.jordan.m@proton.me

The photos keep their own Creative Commons licence, shown under each photo (Wikimedia
Commons). Map data: Natural Earth, SRTM, OpenStreetMap (OSRM), Esri.
