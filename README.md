# opencampingdb.github.io

The Open Camping DB website on GitHub Pages. It holds the owner pages at `/owners/`, where the people who run a place can claim it, update it or list their private property.

Plain HTML, CSS and JavaScript with no build step, no libraries and no trackers. Every page sets a Content Security Policy that allows scripts and styles from this site only and network requests to the feedback intake only.

| Page | What it does |
|---|---|
| `owners/index.html` | Explains the three choices and how a claim works |
| `owners/claim.html` | Claim a place already in the data. Fills in the place id from `?place=ocdb_...` |
| `owners/list.html` | List a private property (farm stay), with a "Use my location" button |
| `owners/update.html` | Update a place with the owner's token |
| `owners/terms.html` | The owner terms, copied from `feedback-engine/docs/owner-terms.md` |

## Settings

`owners/config.js` holds the intake address and the app key. Replace `REPLACE_WITH_OWNER_PAGE_APP_KEY` with the key for the app `owner-page` in the intake's `APP_KEYS` secret. Until then the forms say the page is not set up yet and send nothing.

The key is public: it identifies this page to the intake, which limits each browser to 5 owner submissions a day.

## Before going live

1. The owner terms are a draft. Update `owners/terms.html` and the summary in the forms if the approved wording differs.
2. Set the app key in `owners/config.js`.
3. Turn on GitHub Pages for this repository: Settings, Pages, deploy from the `main` branch, root folder.

## How the forms submit

Each form builds the JSON body from the [owner guide](https://github.com/opencampingdb/feedback-engine/blob/main/docs/owners.md) and posts it to `/v1/feedback`. A random id kept in the browser's local storage is sent as `device`, for the daily limit only. The token returned by a claim or listing is shown once on the page and is not stored anywhere in the browser.
