# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Validation — mandatory after every change

After every change, run a review using all four agents in `agents/`. Do not consider anything done until all four have approved.

- `agents/product-owner.md` — validates user value, scope, and Swedish language
- `agents/architect.md` — validates code structure, separation of concerns, PWA compliance
- `agents/designer.md` — validates mobile UI, touch targets, visual consistency
- `agents/tester.md` — validates happy path, edge cases, offline, regression

Each agent responds with ✅ APPROVED or ❌ REJECTED. A rejection means changes must be fixed and re-reviewed before moving on.

## Running the app

No build step. Serve the root as static files:

```bash
python -m http.server 8080
# or
npx serve .
```

## Architecture

All logic lives in three files:
- `index.html` — Single-page shell with all tab panels in the DOM (hidden via `hidden` attribute)
- `assets/app.js` — All application logic
- `assets/app.css` — All styling

No frameworks, no bundlers, no external dependencies.

### Tabs

Five tabs: `pays`, `wheel`, `log`, `decision`, `settings`. `switchTab(tab)` toggles visibility and triggers re-renders for dynamic tabs.

### State

Single global `state` object persisted to `localStorage` under key `bcp_state`. Load via `loadState()` (uses `deepMerge(DEFAULTS, saved)` for backward compat). Save via `saveState()` after every mutation.

### Key patterns

- **XSS**: all user strings rendered via `esc(s)`
- **Slot machine** (`tab-wheel`): CSS `translateY` animation via `buildSlotTrack()` / `spinSlot()`. `SLOT_ITEM_H = 90` is the single source of truth linking JS and CSS.
- **Weighted random** (`weightedPick`): used for "Vem betalar". Combines base weight, rigged mode, anti-repeat, and party mode chaos.
- **Audio**: Web Audio API only, no audio files. `playTone()` is the primitive.
- **Service worker**: cache-first for offline support.

### Rules

- All styles in `assets/app.css` — no inline styles
- All logic in `assets/app.js`
- Language is Swedish throughout
- Mobile-first — test at 390px width
