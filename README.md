# Sanasto — Finnish flashcards

Static site plus one serverless function. Deployed to
[suomi-sanasto.netlify.app](https://suomi-sanasto.netlify.app) from this repo.

- `index.html` — the whole app (UI, logic, styles)
- `vocab.js` — 3,413 entries generated from `Cowork Files/Claude/FINNISH_VOCAB.md`
  and `sanasto-entries-2026-08-03.xlsx`
- `netlify/functions/progress.mjs` — the progress store (Netlify Blobs)
- `_redirects`, `netlify.toml`, `package.json` — deploy config

Open `index.html` directly and everything still works offline against
localStorage; the server store only engages over http/https.

## UI language
English or Suomi, switchable on the login screen and in the header. The whole
interface is in one language at a time — never both. Stored in `localStorage`
under `sanasto:lang`, so it survives a reload and applies before login.

## Grading
Four buttons, keys 1–4:

| Button | Effect on the current batch | Effect on the word |
|---|---|---|
| Hard | reinserted ~2 cards later, you see it again almost immediately | status `learning`, easy-streak reset to 0 |
| Medium | pushed to the back of the batch, comes round once more | status `learning`, streak reset to 0 |
| Easy | leaves this batch | streak +1; at 3 straight the word becomes `going well` |
| I know this | leaves this batch | status `known` — never appears in a batch again |

A round ends only when every card in the batch has been cleared with Easy or
I know this, so a word you keep missing keeps coming back inside the same
sitting. Batches walk the pool in order and the position is remembered per
pool, so you progress instead of resampling 3,400 words at random.

## Bookmarking your name
Once deployed, `https://<site>/alex` opens straight into Alex's words with no name
screen. `?u=alex` and `#alex` work too, and the hash form is what works when you open
`index.html` off the disk. Logging in rewrites the address bar to your own link, so you
can just bookmark whatever page you are on. "Switch" clears it.

`_redirects` is what makes the `/alex` form work on Netlify: it serves every path as
`index.html` (and keeps `vocab.js` reachable from any depth). Without that file you get
a 404 on `/alex` — the `?u=` and `#` forms still work.

A name in the URL is not a login. It selects a local profile; it does not carry progress
between devices. Anyone opening your link on their own machine gets an empty profile
under that name.

## Progress storage

Two layers, and the server one is what makes progress actually stick.

**Server (Netlify Blobs).** One JSON blob per lowercased name, behind
`/.netlify/functions/progress` (`/api/progress` is the same thing):

- `GET  ?u=alex` → `{ user, profile|null }`
- `PUT  ?u=alex` ← `{ profile: {...} }`

There is no password and no account — a name is a slot, same as before. Anyone
who knows the name can read and write that slot, so treat it as a bookmark, not
a login. Profiles are capped at 2 MB.

**Device (localStorage, `sanasto:v2:<name>`).** Still written on every change, so
the app works with no connection and works opened straight off the disk.

**How they meet.** Login reads the local copy instantly, then pulls the server
copy and merges: the more advanced status wins per word, the record with more
attempts wins per word, saved lists are unioned by id, and preferences come from
whichever profile has the newer `updated` stamp. The merged result is written
back to both sides. Saves are pushed on a 1.2 s debounce, plus a `sendBeacon`
flush when the tab is hidden or closed. A small pill at the bottom of the screen
reports Saved / restored / no connection.

This replaces the old localStorage-only setup, which silently lost everything
whenever the Netlify subdomain changed, the browser was cleared, or you opened
the app on a different device.

Export/import JSON on the Stats tab still works and is still the way to hand a
profile to someone else.

## Regenerating vocab.js
Word IDs are `md5(finnish|english)[:10]`, so progress survives a rebuild as
long as the word pair is unchanged. Ask Cowork to rebuild when FINNISH_VOCAB.md
grows.
