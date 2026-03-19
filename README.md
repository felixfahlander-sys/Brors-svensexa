# 🎩 Bachelor Control Panel

A mobile-first, dark-mode, drunk-proof bachelor party web app.
Static files only — no backend, no build step.

## Features

| Tab | What it does |
|-----|-------------|
| 💸 Who Pays? | Weighted random pick · exclude once · reroll |
| 🤬 Who's to Blame? | Weighted culprit + random reason · blame tally |
| 🎡 Wheel of Fate | Animated canvas wheel with consequences |
| 🏆 Scoreboard | Per-player category scoring · top 3 leaderboard · copy results |
| 📝 Night Log | Timestamped entries · optional photo · export as .txt |
| ⚙️ Settings | Edit players, wheel items, categories, sounds, haptics, party mode |

**Header quick actions:**
- ❓ **Should we do this?** — random decision helper with `{{NAME}}` placeholders
- 🎛️ **Rigged Mode** — long-press the "🎩 BCP" title for 800ms to reveal the secret rigging panel

## Run locally

```bash
# Python 3
python -m http.server 8080

# Node (npx)
npx serve .
```

Then open `http://localhost:8080` in your browser.

## Deploy to GitHub Pages

1. Push to a GitHub repo
2. Go to **Settings → Pages → Source → Deploy from branch → main / (root)**
3. Done — your URL will be `https://<user>.github.io/<repo>/`

### Alternative: Netlify

Drag and drop the folder to [netlify.com/drop](https://app.netlify.com/drop) — live in 30 seconds.

## PWA — Install on phone

Open the deployed URL in Safari (iOS) or Chrome (Android) and use **Add to Home Screen**.
The app works fully offline after first load.

## State

All state lives in `localStorage` under the key `bcp_state`.
Reset it via ⚙️ Settings → Factory Reset.

## Default players

`Felix, Erik, Jonas, Max, Oskar, Bachelor`

Change them in ⚙️ Settings.

## Known limitations

- PNG icons (`icon-192.png`, `icon-512.png`) referenced in the manifest are not included.
  The SVG icon works fine in modern browsers. Generate PNGs from `icon.svg` if needed.
- Safari PWA audio requires a user gesture before the audio context unlocks.
- Photos are stored as base64 in localStorage; large photos are compressed to 800px/JPEG-72.
