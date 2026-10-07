# Forge — personal gym tracker

A phone-first, offline-capable workout log. There is no account or backend. Routine templates and sessions live in this browser's IndexedDB, and backups are explicit JSON files.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For a production build, run `npm run build`; the static site is in `dist/`. Run `npm run preview` to check that build locally. Run `npm test` for progression and backup checks.

## Put it on an iPhone

The Home Screen app and offline service worker need an HTTPS origin. This repository includes a GitHub Pages workflow. The workflow builds with `--mode pages` so assets and the service worker use `/forge-gym-tracker/`. A root-hosted build (`npm run build`) can instead be uploaded to a static HTTPS host such as Cloudflare Pages. No server, database, or Apple developer account is needed.

On the iPhone, open that HTTPS URL in Safari, use **Share → Add to Home Screen**, then open Forge from the new icon while online once. The service worker precaches the app shell for later offline use. A desktop local-network URL such as `http://192.168.x.x:4173` is useful for a quick preview but does not provide the secure context needed for reliable installation and offline caching on iPhone.

The static JavaScript bundle contains the initial routine names and weights transcribed from the three supplied screenshots. Those starting values are inspectable by someone who can access the hosted site. Workout sessions and edits are stored only on the iPhone unless the user exports and shares a backup file.

## Data and behavior

- First launch creates five editable training days with 34 exercises. Screenshot results are starting weights and notes, not fabricated history.
- Each set saves to IndexedDB when changed or marked complete. An unfinished session resumes after reopening the app.
- Once all planned normal sets reach their target reps, the next suggested working load is the lowest completed planned-set weight plus 2.5 kg. If the target is missed or sets are unfinished, the load repeats. Drop portions and extra sets do not affect the suggestion. Bodyweight exercises show readiness without a numeric increase.
- Use **Settings → Export backup** regularly. On iPhone the share sheet can save the JSON file to Files; on desktop it downloads. **Import backup** replaces all current local data after a confirmation.
- iOS may clear website storage under some conditions. The backup file is the recovery method.

## Notes to review on first launch

The screenshots are partly ambiguous. Check the starting weight and mode for DB rows, DB Romanian deadlifts, low-to-high chest flies, and any machine with a 2.5 kg increment that it cannot physically make. Suggestions are editable when starting or logging a workout.
