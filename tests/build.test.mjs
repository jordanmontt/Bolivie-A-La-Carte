// The build (tools/build.mjs): content/ is valid, and the pages for search engines are sound.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {execFileSync} from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = fs.mkdtempSync(path.join(os.tmpdir(), "bolivia-build-"));
execFileSync(process.execPath, [path.join(ROOT, "tools/build.mjs"), "--out", OUT]);
const pages = fs.globSync("{fr,en,es}/**/index.html", {cwd:OUT});

test("the generated data matches what is committed (run node tools/build.mjs after editing content/)", () => {
  for (const f of ["data/places.js", "data/photos.js", "data/site.js", "es.html", "data/culture.js", "locales/es.js", "locales/es.content.js", "sitemap.xml"])
    assert.equal(fs.readFileSync(path.join(OUT, f), "utf8"), fs.readFileSync(path.join(ROOT, f), "utf8"), f);
});

test("one page per place and language, plus a home, a tips page and five culture pages", () => {
  const places = fs.readdirSync(path.join(ROOT, "content/places")).filter(f => f.endsWith(".yml") && !f.startsWith("_")).length;
  assert.equal(pages.length, 3 * (places + 7));
});

test("es.html, fr.html and en.html are index.html with a head in their language", () => {
  const index = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
  const body = html => html.slice(html.indexOf("<body>"));
  for (const l of ["fr", "en", "es"]){
    const html = fs.readFileSync(path.join(OUT, l + ".html"), "utf8");
    assert.equal(body(html), body(index), l);
    assert.match(html, new RegExp(`<html lang="${l}" data-lang="${l}">`));
    assert.match(html, new RegExp(`og:image" content="[^"]+/assets/og-${l}\\.png"`));
    assert.ok(fs.existsSync(path.join(ROOT, `assets/og-${l}.png`)), `assets/og-${l}.png`);
  }
});

test("every page has a title, a description, a canonical address and its other languages", () => {
  for (const p of pages){
    const html = fs.readFileSync(path.join(OUT, p), "utf8");
    assert.match(html, /<title>[^<]{10,}<\/title>/, p);
    assert.match(html, /<meta name="description" content="[^"]{30,}">/, p);
    assert.match(html, /<link rel="canonical" href="https:\/\/[^"]+\/">/, p);
    for (const l of ["fr", "en", "es", "x-default"]) assert.match(html, new RegExp(`hreflang="${l}"`), p);
    JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
  }
});

test("links between pages and to photos lead somewhere", () => {
  for (const p of pages){
    const html = fs.readFileSync(path.join(OUT, p), "utf8");
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)){
      if (/^(https?:|mailto:|#)/.test(url) || url.includes("?")) continue;
      const rel = path.join(path.dirname(p), url.split("#")[0]);
      const file = rel.endsWith("/") || !path.extname(rel) ? path.join(rel, "index.html") : rel;
      assert.ok(fs.existsSync(path.join(OUT, file)) || fs.existsSync(path.join(ROOT, file)), `${p} links to ${url}`);
    }
  }
});
