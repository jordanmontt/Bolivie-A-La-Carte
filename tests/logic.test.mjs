// The little logic there is: routes and trips (js/model.js) and festival dates (js/views/culture.js).
// The browser scripts are run as they are, in a sandbox standing in for the page.
import {test} from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.resolve(import.meta.dirname, "..");
const page = vm.createContext({});
page.window = page;
for (const f of ["data/places.js", "js/model.js", "js/views/culture.js"]) vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), page, {filename:f});
const M = page.BOL.model;
// Objects made inside the sandbox have its own prototypes: compare them as plain data.
const plain = x => JSON.parse(JSON.stringify(x));
const ymd = d => [d.getFullYear(), d.getMonth() + 1, d.getDate()].join("-");

test("every place can be reached from La Paz", () => {
  for (const p of page.BOL.places) assert.ok(M.shortest("lapaz", p.id, "route") || M.shortest("lapaz", p.id, "avion"), p.id);
});

test("flying is never slower than going by road", () => {
  const road = M.shortest("lapaz", "santacruz", "route"), air = M.shortest("lapaz", "santacruz", "avion");
  assert.ok(air.hours <= road.hours);
  assert.ok(road.steps.every(s => s.e.mode !== "avion"));
});

test("a shared trip link gives back the same trip", () => {
  const trip = M.cleanTrip({stops:[{id:"lapaz", d:2}, {id:"uyuni", d:3}, {id:"sucre", d:2}], days:14, end:"last", pref:"route"});
  assert.deepEqual(plain(M.decode(M.encode(trip))), plain(trip));
  assert.equal(M.decode("nonsense"), null);
});

test("unknown places are dropped from a saved trip", () => {
  assert.deepEqual(plain(M.cleanTrip({stops:[{id:"atlantis", d:2}, {id:"sucre", d:99}]}).stops), [{id:"sucre", d:30}]);
});

test("Easter and the festival dates computed from it", () => {
  assert.equal(ymd(vm.runInContext("easterSunday(2025)", page)), "2025-4-20");
  assert.equal(ymd(vm.runInContext("easterSunday(2026)", page)), "2026-4-5");
  assert.equal(ymd(vm.runInContext(`festivalDay({easter:-50}, 2026)`, page)), "2026-2-14");   // Carnival Saturday
  assert.equal(ymd(vm.runInContext(`festivalDay({date:"08-15"}, 2026)`, page)), "2026-8-15");
  assert.equal(ymd(vm.runInContext(`festivalDay({nth:[1, 0, 1]}, 2026)`, page)), "2026-1-4");  // first Sunday of January
  assert.equal(ymd(vm.runInContext(`festivalDay({nth:[5, 6, -1]}, 2026)`, page)), "2026-5-30"); // last Saturday of May
});
