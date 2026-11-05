# opencampingdb.github.io

The Open Camping DB website on GitHub Pages. It holds the owner pages at `/owners/`, where the people who run a place can claim it, update it or list their private property.

Plain HTML, CSS and JavaScript with no libraries and no trackers. Every page sets a Content Security Policy that allows scripts and styles from this site only, and network requests to this site and the feedback intake only.

| Page | What it does |
|---|---|
| `owners/index.html` | Explains the three choices and how a claim works |
| `owners/claim.html` | Claim a place already in the data, found by name. A link with `?place=ocdb_...` chooses the place |
| `owners/list.html` | List a private property (farm stay), with a "Use my location" button |
| `owners/update.html` | Update a place with the owner's token, found by name the same way |
| `owners/terms.html` | The owner terms, copied from `feedback-engine/docs/owner-terms.md` |

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

`owners/config.js` holds the intake address and the app key. Replace `REPLACE_WITH_OWNER_PAGE_APP_KEY` with the key for the app `owner-page` in the intake's `APP_KEYS` secret. Until then the forms say the page is not set up yet and send nothing.

The key is public: it identifies this page to the intake, which limits each browser to 5 owner submissions a day.

## Before going live

1. Set the app key in `owners/config.js`.
2. Turn on GitHub Pages for this repository: Settings, Pages, source GitHub Actions. The Pages workflow builds and deploys the site.

## How the forms submit

Each form builds the JSON body from the [owner guide](https://github.com/opencampingdb/feedback-engine/blob/main/docs/owners.md) and posts it to `/v1/feedback`. A random id kept in the browser's local storage is sent as `device`, for the daily limit only. The token returned by a claim or listing is shown once on the page and is not stored anywhere in the browser.
