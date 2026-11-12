# opencampingdb.github.io

The Open Camping DB website on GitHub Pages. It holds the owner pages at `/owners/`, where the people who run a place can claim it, update it or list their private property.

Plain HTML, CSS and JavaScript with no libraries and no trackers. Every page sets a Content Security Policy that allows scripts and styles from this site only, and network requests to this site and the feedback intake only.

| Page | What it does |
|---|---|
| `index.html` | The home page, with links for owners, for the data and for OpenStreetMap mappers |
| `owners/index.html` | Explains the three choices and how a claim works |
| `owners/claim.html` | Claim a place already in the data, found by name. A link with `?place=ocdb_...` chooses the place |
| `owners/list.html` | List a private property (farm stay), with a "Use my location" button |
| `owners/update.html` | Update a place with the owner's token, found by name the same way |
| `owners/terms.html` | The owner terms, copied from [`docs/owner-terms.md`](https://github.com/opencampingdb/feedback-engine/blob/main/docs/owner-terms.md) in feedback-engine. The summary above each form's tick box is the SDK's `OWNER_TERMS_SUMMARY`. Change the terms there first, then copy them here |

## Place search

Owners find their place by typing its name. The Pages workflow (`.github/workflows/pages.yml`) builds the search from the latest data release on every push to `main` and every 6 hours, with `scripts/build_place_search.py`, and publishes it at `owners/search/`. Each file there holds the named places with a word starting with its 3 letters (`sam.json` for "Lake Sambell Caravan Park"), as `[id, name, kind, state, postcode, lat, lon]`, so a search loads one small file. The state comes from `scripts/au_states.json`, state and territory outlines simplified from OpenStreetMap (© OpenStreetMap contributors, ODbL). `owners/search/` is not committed.

To try it locally:

```
curl -fsSLo /tmp/places.ndjson.gz https://github.com/opencampingdb/data/releases/latest/download/places.ndjson.gz
python3 scripts/build_place_search.py /tmp/places.ndjson.gz owners/search
python3 -m http.server 8765
```

and open http://127.0.0.1:8765/owners/claim.html.

## Settings

`owners/config.js` holds the intake address and the app key for the app `owner-page`, which is in the intake's `APP_KEYS` secret. The key is public: it only identifies these pages to the intake. The intake allows 5 owner submissions a day from each browser and 10 from each network. If the intake address changes, change it in `owners/config.js` and in the `connect-src` of every page's Content Security Policy.

## How the forms submit

Each form builds the JSON body from the [owner guide](https://github.com/opencampingdb/feedback-engine/blob/main/docs/owners.md) and posts it to `/v1/feedback`. A random id kept in the browser's local storage is sent as `device`, for the daily limit only. The token returned by a claim or listing is shown once on the page and is not stored anywhere in the browser.
