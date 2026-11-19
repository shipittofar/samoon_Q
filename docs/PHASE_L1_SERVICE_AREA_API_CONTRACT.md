---
title: Phase L1 — Service Area & Maps API Contract
status: frontend implemented against mock data · backend: to implement
roadmap: BUSINESS_SERVICES_ROADMAP.md (phase L)
source_of_truth: src/types/branch.ts (BranchServiceArea), src/lib/geo.ts, src/config/modules/maps.ts
---

# Phase L1 — Service Area & Maps API Contract

Every branch gets a **service area**: where it delivers, sends staff
(on-site service), or — for visit-only businesses — whose "near me"
results it appears in. Additive and backward compatible: branches without
the field keep working through the fallback chain in §3.

## 1. Branch field: `serviceArea`

Branch payloads use camelCase (like `checkout`, `marketplaceVisible`).

```json
{
  "serviceArea": {
    "mode": "on_site",
    "shape": { "type": "circle", "radiusKm": 6 },
    "zones": [
      { "upToKm": 3, "fee": 0, "etaMinutes": 30 },
      { "upToKm": 6, "fee": 2.5, "etaMinutes": 45 }
    ]
  }
}
```

| field | type | rules |
|---|---|---|
| `mode` | `"delivery" \| "on_site" \| "visit_only"` | required |
| `shape.type` | `"circle" \| "polygon"` | required |
| `shape.radiusKm` | number | circle only; `0 < r ≤ maps.max_service_radius_km` (platform setting, default 50) |
| `shape.points` | `[{ "lat": number, "lng": number }]` | polygon only; ≥ 3 vertices, ring closes implicitly, must contain the branch point |
| `zones[]` | optional | `upToKm` ascending, each `≤ radiusKm`; `fee ≥ 0`; `etaMinutes ≥ 0` |

The current frontend editor writes circles only; polygons and zones are part
of the contract now so the model doesn't change when their editor ships.

### Read
`GET` branch detail / list / public branch endpoints include `serviceArea`
when the branch has a custom one; omit it (or `null`) otherwise.

### Write
- `PATCH` branch (update): `serviceArea` object sets a custom area; `serviceArea: null`
  **clears** it (back to defaults); omitted = unchanged.
- Console create (`branchFormToCreateRequest`): `serviceArea` is sent only when custom.

## 2. Branch coordinates must be trustworthy

Nearby search is only as accurate as `location.latitude/longitude`. The
console editor lets owners click the map to place the pin exactly.
Backend suggestions:
- reject `(0, 0)` and out-of-range values;
- optionally store `locationVerifiedAt` when the owner confirms the pin (used by L2/L3 to flag unverified pins).

## 3. Effective area (fallback chain — implement identically server-side)

`resolveBranchServiceArea()` in `src/lib/geo.ts`:

1. the branch's own `serviceArea`;
2. else, if `checkout.orderTypes.delivery` is true and `checkout.delivery.radius > 0` →
   `{ mode: "delivery", shape: circle(radius) }`;
3. else the vertical default (`src/verticals/registry.ts → defaultServiceArea`):

| vertical | mode | radius km |
|---|---|---|
| restaurant, bar, food_court, other | visit_only | 5 |
| cafe, food_truck, mobile_cafe | visit_only | 3 |
| hotel | visit_only | 20 |
| beauty_salon | visit_only | 5 |
| clinic | visit_only | 15 |

Circle radii are clamped to `maps.max_service_radius_km`.

## 4. Storage (suggested)

PostGIS:
- `Branch.location` → `geography(Point, 4326)` with a GiST index;
- `BranchServiceArea` table (1:1 with branch): `mode`, `shape_type`, `radius_m`,
  `polygon geography(Polygon, 4326)`, `zones jsonb`;
- "is user inside": `ST_DWithin(branch.location, user_point, radius_m)` for circles,
  `ST_Covers(polygon, user_point)` for polygons.

These power the L3 "near me" endpoint (separate contract).

## 5. Platform settings (`maps` module)

Stored in Platform Configuration; the frontend reads them via
`src/lib/maps/config.ts`. Only **browser** (domain-restricted) keys live here.
Paid server-side geocoding/routing keys belong in backend secrets behind a proxy.

| field | default |
|---|---|
| `maps.provider` | `osm` (`osm \| neshan \| mapir \| google`) |
| `maps.fallback_provider` | `osm` |
| `maps.osm_tile_url` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `maps.neshan_web_key`, `maps.mapir_web_key`, `maps.google_web_key` | `""` |
| `maps.default_center_lat/lng` | `35.6892 / 51.389` (Tehran) |
| `maps.default_zoom` | `12` |
| `maps.max_service_radius_km` | `50` |
| `maps.geolocation_enabled` | `true` |
| `maps.min_location_accuracy_m` | `1000` |

L1 renders with Leaflet + OpenStreetMap. Neshan / Map.ir / Google are selectable
but fall back to the configured fallback (then OSM) until their adapters ship.

**Production note:** the public OSM tile servers have a strict usage policy —
point `maps.osm_tile_url` at a self-hosted or commercial tile server before launch.

---

# Phase L2 — Customer Location (addendum)

Frontend: `src/lib/location/evaluate.ts`, `src/stores/location-store.ts`,
`src/hooks/location.ts`, `src/components/location/*`.

## 1. Branch field: `locationVerifiedAt`

| field | type | meaning |
|---|---|---|
| `locationVerifiedAt` | ISO 8601 string \| null | when the owner confirmed the map pin is exact; `null` = unverified |

- The console sends it in branch create/update. Moving the pin in the editor sends `null`.
- Backend: accept it but **set the stored value to server time** when a non-null value arrives
  (don't trust client clocks), and reset it to `null` whenever `location.latitude/longitude` change
  in the same or a later request without a fresh confirmation.
- Returned on branch read/list/public endpoints. L3 shows an "unverified location" hint for `null`.

## 2. Reverse geocoding (existing endpoint)

`POST /users/addresses/reverse-geocode/ { latitude, longitude }` is reused for the
"Near you: <area>, <city>" label. The frontend reads `city` and `district`
(optional). It calls it only when the position moves > 1 km or the city is unknown,
so the volume is low — but it should be rate-limited and cached server-side
(round the key to ~3 decimals).

## 3. Optional: IP-based city (`ip` source — reserved)

When device location is unavailable and the customer has no saved address, the
fallback is the platform default centre. A future
`GET /geo/ip-location/ → { city, latitude, longitude, accuracyKm }` (server-side
GeoIP, no third-party call from the browser) can be plugged in as the `ip` source.

## 4. Privacy rules (frontend already follows these)

- Live GPS positions are never persisted on the device and never sent to the backend
  except as query parameters of the nearby-search request that needs them (L3).
- Only the customer's own choice (a hand-picked location) is stored locally.
- Analytics may only receive positions rounded to ~110 m (`roundForAnalytics`).
- The browser permission prompt is shown only after the customer taps
  "Use my location" — never on page load.

---

# Phase L3 — Nearby Search & Discover Map (addendum)

Frontend: `src/lib/nearby.ts`, `src/lib/search-normalize.ts`, `src/lib/travel.ts`,
`src/components/location/{DiscoverMap,ProximityLine}.tsx`, `src/app/discover/DiscoverClientPage.tsx`.
Today it ranks the already-loaded Discover payload on the client; the endpoints below take
over when the catalogue grows.

## 1. Discover payload additions (`GET /public/discover/` → `branches[]`)

| field | type | notes |
|---|---|---|
| `location.latitude`, `location.longitude` | number | required for distance / map pins; branches without them are listed but never ranked by distance |
| `serviceArea` | `BranchServiceArea \| null` | as in §1 of L1 |
| `locationVerifiedAt` | ISO \| null | L2; `null` shows "approximate location" |
| `menuItemNames` | string[] | available items only; used for item search ("pizza near me") |
| `menuCategoryNames` | string[] | fallback match when no item name matches |

## 2. Ranking (implement identically server-side)

Per business, every located branch gets `distanceKm` (haversine), `inside` (effective
service area, L1 §3), and an ETA. The **best branch** is ordered by:
menu match (only during an item search) → inside → open now → distance.

Businesses are ordered: has a located branch → `inside` first → distance of the best branch;
when two are within `max(0.3 km, 10%)` of each other, open-now then rating break the tie.

Discover ranks by distance when `sort=nearest`, or when `sort=recommended` and the customer
is searching or picked a map area — only if the location is real (not the platform default centre).

## 3. Text normalization (search index + query)

Lowercase; ZWNJ/ZWJ → space; drop tatweel; `ي ى ئ→ی`, `ك→ک`, `ة ۀ→ه`, `أ إ آ ٱ→ا`, `ؤ→و`;
Persian/Arabic-Indic digits → ASCII; strip combining marks (tashkeel, Latin accents);
collapse whitespace. A small alias table maps Persian ⇄ English menu words
(پیتزا ⇄ pizza …); the backend should own the full synonym table.

## 4. Travel time

Client estimate: `straight-line × 1.35 ÷ speed` (+ overhead), speeds walk 4.8, bike 13,
drive 22 km/h; walk up to 2.5 km, otherwise drive. Replace with routing for the top results:

`POST /geo/travel-matrix/` `{ origin: {lat,lng}, destinations: [{id,lat,lng}] (≤ 25), mode: "walk"|"drive"|"bike" }`
→ `{ results: [{ id, durationSec, distanceM }] }` — server-side, via the configured routing
provider (Neshan / Map.ir / Google / OSRM), cached ~5 min on rounded coordinates.

## 5. Nearby endpoint (when client-side ranking stops scaling)

`GET /public/discover/nearby/?lat=&lng=&q=&category=&openNow=&servesMe=&bbox=s,w,n,e&limit=`
→ same items as Discover plus per business
`nearest: { branchId, distanceKm, inside, mode, etaMinutes, menuMatches[] }`, already ranked (§2).
`bbox` powers "Search this area". PostGIS: `ST_DWithin` prefilter, `ST_Distance` order.
Coordinates are request parameters only — never stored or logged unrounded (L2 §4).

## 6. URL state

`/discover?q=&category=&openNow=1&sort=nearest&near=1&view=map` — `near=1` = "Serves my area"
(only businesses whose effective area contains the customer); `view=map` = split list + map
(desktop button, mobile floating toggle).

---

# Phase L4 — Navigation (addendum)

Frontend: `src/lib/navigation/deep-links.ts`, `src/services/routing.service.ts`,
`src/stores/navigation-store.ts`, `src/components/location/{DirectionsSheet,DirectionsButton}.tsx`.
Entry points: "Directions" on Discover cards (best branch) and on the branch page info panel.

## 1. In-app route — `POST /geo/route/`

Request: `{ "origin": {"lat","lng"}, "destination": {"lat","lng"}, "mode": "drive"|"taxi"|"walk"|"bike" }`

Response:
```json
{ "distanceM": 7012, "durationSec": 845, "geometry": [[51.40, 35.70], [51.41, 35.7575]] }
```
- `geometry` is GeoJSON order **[lng, lat]**, full overview, ≥ 2 points.
- `taxi` = driving route + pickup wait (the client adds 5 min for OSRM; the backend should include it).
- Server-side provider (Neshan Direction API / Map.ir / Google / OSRM) with keys in backend secrets;
  cache ~5 min on coordinates rounded to 4 decimals; rate-limit per user/IP.
- Origin is a request parameter only — never stored or logged unrounded (L2 §4).
- Any error → the client falls back to the estimate and says so.

## 2. Platform settings (`maps` module, section "Directions & Navigation")

| field | default | notes |
|---|---|---|
| `maps.routing_source` | `estimate` | `estimate` (dashed straight guide + estimated time), `backend` (§1), `osrm` |
| `maps.osrm_url` | `""` | https base of a self-hosted OSRM; the customer position is sent to it |
| `maps.nav_neshan_url` | `https://neshan.org/maps/@{lat},{lng},17z` | https-only template; `{lat} {lng} {label}` |
| `maps.nav_balad_url` | `https://balad.ir/location?latitude={lat}&longitude={lng}&zoom=17` | same |

**Verify before launch:** the Neshan and Balad default link formats are best-effort; confirm them
with each provider (or switch to their official deep-link/intent formats) and update the templates —
no release needed.

## 3. Hand-off to navigation apps

Neshan, Balad, Google Maps, Waze (all platforms), Apple Maps (iOS), `geo:` chooser (Android).
Links carry **only the destination** — every app starts from the device's own live position.
The chosen app and travel mode are remembered on the device (`samoon-navigation`: `preferredApp`,
`travelMode`); a non-auto travel mode also drives the ETAs on Discover cards.

---

# Phase L5 — Day Planner (addendum)

Frontend: `src/lib/planner/{plan,candidates}.ts`, `src/stores/day-plan-store.ts`,
`src/app/plan/` (route `/plan`, linked from Discover as "Plan my day").

## 1. What it solves

The customer lists up to **8** things to do. Each is a business type ("beauty_salon"), free
text matched against names, tags and menus ("pizza", "آش"), or one specific business. Optional
per task: visit length (default by vertical — restaurant 45, café 30, salon 60, clinic 40 …)
and a fixed start time (appointment; up to 10 min late is accepted). Options: start time,
travel mode, "find the best order" vs "keep my order", return to start.

## 2. Algorithm (implement identically if moved server-side)

- Candidates per task: the **4** nearest located, marketplace-visible branches to the start.
- Exact DP over (visited-task subset, last branch) — Held–Karp with candidate choice and time
  windows. Waiting is allowed, so the earliest feasible start is monotone in arrival time (FIFO)
  and keeping the earliest finish per state is exact. Size 2⁸ × 32 states.
- Visit feasibility: start ≥ arrival, inside an opening window of **the plan day** (today's hours,
  including today's overnight part and yesterday's spill past midnight) with the whole visit
  before closing; appointments start in `[at, at + 10 min]`. Tomorrow's opening is never used.
  Branches without published hours are assumed open and flagged.
- Objective: most tasks kept → earliest finish (incl. the way back) → least travel.
  Tasks that cannot fit are reported (`no_candidates` | `not_feasible`).
- "Keep my order" = the same DP restricted to the listed order (tasks may still be skipped).
- The page also plans the listed order and shows the time saved.

## 3. Backend (when needed)

- `POST /geo/travel-matrix/` (L3 §4) — the planner takes a `travelMinutes(from, to, mode)`
  override; feed it the matrix for all (start + candidates) points instead of estimates.
- Reserve the tenant slug **`plan`** (the frontend already treats `/plan` as a platform route).
- Optional later: `POST /planner/plan/` running the same algorithm with live availability
  (Phase 3 booking slots as extra time windows).

## 4. Hand-off

"Open the whole route in Google Maps": stops as `waypoints`, last stop as `destination`, no
origin (Google starts from the device position). Each stop also has its own Directions sheet (L4).

## 5. Privacy

The task list and options are stored on the device (`samoon-day-plan`); no positions are stored.
