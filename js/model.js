// Travel logic with no UI: the route network, shortest paths, climate and trips.
//
// A trip is {stops:[{id, d}], days, end, pref}:
//   stops  places in visiting order; the first one is where the trip starts; d = days spent there
//   days   planned length in days, or null when the traveller has no fixed length
//   end    "start" (come back to the first stop), "last" (finish at the last stop) or a place id
//   pref   "route" (ground transport only) or "avion" (fly when it is faster)
(function(){
"use strict";
const B = window.BOL;
const byId = Object.fromEntries(B.places.map(p => [p.id, p]));
const edgeById = Object.fromEntries(B.edges.map(e => [e.id, e]));
const adj = {};
B.places.forEach(p => adj[p.id] = []);
B.edges.forEach(e => { adj[e.a].push({e, to:e.b, rev:false}); adj[e.b].push({e, to:e.a, rev:true}); });

// Flights count the time spent at the airport; ground legs get a small penalty per change.
const legCost = (e, pref) => e.mode === "avion" ? (pref === "avion" ? e.h + 2.5 : Infinity) : e.mode === "train" ? e.h + 0.3 : e.h + 0.15;
const legHours = e => e.mode === "avion" ? e.h + 1.5 : e.h;

function shortest(from, to, pref){
  if (from === to) return {steps:[], hours:0};
  const dist = {}, prev = {}, done = new Set();
  B.places.forEach(p => dist[p.id] = Infinity); dist[from] = 0;
  for (;;){
    let u = null;
    for (const k in dist) if (!done.has(k) && (u === null || dist[k] < dist[u])) u = k;
    if (u === null || dist[u] === Infinity || u === to) break;
    done.add(u);
    for (const n of adj[u]){ const c = dist[u] + legCost(n.e, pref); if (c < dist[n.to]){ dist[n.to] = c; prev[n.to] = {from:u, e:n.e, rev:n.rev}; } }
  }
  if (dist[to] === Infinity) return null;
  const steps = []; let cur = to;
  while (cur !== from){ const s = prev[cur]; steps.unshift({e:s.e, rev:s.rev, from:s.from, to:cur}); cur = s.from; }
  return {steps, hours: steps.reduce((t, s) => t + legHours(s.e), 0)};
}
// Days a journey eats from the plan: short hops are free, half a day, then a full day.
const travelDays = h => h <= 1.5 ? 0 : h <= 4.5 ? 0.5 : 1;

// Monthly climate from the January / July profile (cosine between the two).
function climate(id, m){
  const v = B.climates[byId[id].clim]; if (!v) return null;
  const [xJ, xL, nJ, nL, rJ, rL] = v, t = (1 + Math.cos(2 * Math.PI * m / 12)) / 2;
  return {max:Math.round(xL + (xJ - xL) * t), min:Math.round(nL + (nJ - nL) * t), rain:Math.round(rL + (rJ - rL) * t * t)};
}

const emptyTrip = () => ({stops:[], days:null, end:"start", pref:"avion"});
function cleanTrip(t){
  const out = emptyTrip();
  if (!t || typeof t !== "object") return out;
  out.stops = Array.isArray(t.stops) ? t.stops.filter(s => s && byId[s.id]).map(s => ({id:s.id, d:Math.max(0, Math.min(30, +s.d || 0))})) : [];
  out.days = t.days ? Math.max(1, Math.min(120, Math.round(+t.days))) : null;
  out.end = t.end === "last" || byId[t.end] ? t.end : "start";
  out.pref = t.pref === "route" ? "route" : "avion";
  return out;
}
function legs(trip){
  const ids = trip.stops.map(s => s.id);
  if (ids.length){
    const target = trip.end === "start" ? ids[0] : trip.end === "last" ? null : trip.end;
    if (target && (ids.length > 1 || target !== ids[0]) && ids[ids.length - 1] !== target) ids.push(target);
  }
  const out = [];
  for (let i = 1; i < ids.length; i++){
    const r = shortest(ids[i-1], ids[i], trip.pref);
    out.push({from:ids[i-1], to:ids[i], r, days: r ? travelDays(r.hours) : 0});
  }
  return out;
}
function totals(trip){
  const ls = legs(trip);
  const stay = trip.stops.reduce((t, s) => t + s.d, 0);
  const travel = ls.reduce((t, l) => t + l.days, 0);
  return {legs:ls, stay, travel, total:stay + travel};
}
// Keep the start, then always go to the nearest remaining stop.
function optimize(trip){
  if (trip.stops.length < 3) return trip;
  const rest = trip.stops.slice(1), out = [trip.stops[0]];
  let cur = out[0].id;
  while (rest.length){
    let bi = 0, bh = Infinity;
    rest.forEach((s, i) => { const r = shortest(cur, s.id, trip.pref); const h = r ? r.hours : 999; if (h < bh){ bh = h; bi = i; } });
    const [s] = rest.splice(bi, 1); out.push(s); cur = s.id;
  }
  return Object.assign({}, trip, {stops:out});
}
// Compact, URL-safe form: days.pref.end.id~d.id~d…
function encode(trip){
  return [trip.days || 0, trip.pref === "route" ? "r" : "a", trip.end, ...trip.stops.map(s => s.id + "~" + s.d)].join(".");
}
function decode(str){
  const parts = String(str || "").split(".");
  if (parts.length < 4 || !/^\d+$/.test(parts[0])) return null;
  const t = cleanTrip({
    days: +parts[0] || null, pref: parts[1] === "r" ? "route" : "avion", end: parts[2],
    stops: parts.slice(3).map(x => { const [id, d] = x.split("~"); return {id, d}; })
  });
  return t.stops.length ? t : null;
}

B.model = {byId, edgeById, adj, shortest, legHours, travelDays, climate, emptyTrip, cleanTrip, legs, totals, optimize, encode, decode};
})();
