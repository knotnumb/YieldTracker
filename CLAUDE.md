# YieldTracker — Claude Code Instructions

## Project overview

Local-first DeFi stablecoin yield tracker. Single-file vanilla JS app (`tracker.html`) that runs from `file://` in Brave/Chrome. Uses File System Access API to read/write a local folder containing CSV data. No server, no build step, no dependencies.

Current version: `v2026-04-23f`

## Repo structure

```
tracker.html          # The app — all HTML/CSS/JS in one file
chart.html            # Historical chart viewer (reads master.csv)
bookmarklet.txt       # DefiLlama scraper bookmarklet
master.csv            # Append-only time-series data (public market data, no secrets)
snapshots/            # Daily raw CSV captures (YYYY-MM-DD.csv)
config.json           # LOCAL ONLY — API keys, never committed
config.example.json   # Template showing required config shape
README.md             # User documentation
README.pdf            # PDF export of README
BRIEF_v5.md           # Current task brief
.gitignore            # Excludes config.json, test/, PDFs
```

## Git hygiene — CRITICAL

### Never commit secrets

- `config.json` contains the vaults.fyi API key and must NEVER be committed
- Before any commit, verify: `git diff --cached -- config.json` returns nothing
- The `.gitignore` excludes `config.json` — do not remove that entry
- If a secret is accidentally committed, treat the key as compromised and rotate it

### Pre-commit mental checklist

1. No API keys, tokens, or secrets in staged files
2. No personal financial data (wallet addresses, balances, position sizes)
3. `config.json` is NOT staged
4. Version string in `tracker.html` line 163 is updated

### Contract addresses are fine

The `0x...` addresses in `YS_VAULTS` and `OFFCHAIN_VAULTS` are public on-chain contract addresses, not wallet addresses. These are safe to commit.

## Coding conventions

- **Single file architecture**: all HTML, CSS, and JS live in `tracker.html`. Do not split into separate files.
- **No build tools**: no npm, no bundler, no transpiler. Vanilla JS only.
- **No external dependencies**: no CDN imports, no libraries. Everything is self-contained.
- **File System Access API**: the app reads/writes via a `folderHandle` obtained from `showDirectoryPicker()`. All file I/O goes through this handle.
- **Status reporting**: use `setStatus(elementId, message, level)` where level is `'info'`, `'ok'`, `'warn'`, or `'error'`.
- **Version string**: update the version in the `<div class="sub">` on line 163 after every functional change. Format: `v{YYYY-MM-DD}{letter}` where letter increments within a day.

## Key code landmarks

| Line | What |
|---|---|
| 163 | Version string |
| 249–310 | `YS_VAULTS` — whitelist of tracked vaults with match patterns |
| 311–320 | `matchVault()` — regex matcher for vault identification |
| 326 | `VAULTS_FYI_API_KEY` — TO BE MOVED to config.json (Task 1) |
| 328–345 | `OFFCHAIN_VAULTS` — vaults not on DefiLlama (Revert, Tokemak) |
| 347–429 | vaults.fyi fetch + enrichment functions |
| 431–600 | Morpho API fetch + enrichment |
| 660+ | YieldSeeker panel logic |
| 903–963 | `parseScrape()` — anchors on first `%` cell (APY), uses raw tab offsets for column mapping (v2026-05-09a fix) |

## Config system (after Task 1)

`config.json` lives in the same folder as `master.csv` (the user-picked folder, not the repo). Read via File System Access API — no `fetch()` to a file path.

```json
{
  "_note": "Paste your vaults.fyi API key. Sign up free at https://vaults.fyi/api",
  "vaultsFyiApiKey": ""
}
```

## Testing

No automated tests. Manual testing workflow:

1. Open `tracker.html` in Brave from `file://`
2. Pick the project folder
3. Paste sample DefiLlama scrape data
4. Click Parse Data — verify preview renders, sort warning absent
5. Click Fetch Protocol Data — verify Morpho enrichment + offchain vault injection
6. Save Snapshot — verify `snapshots/YYYY-MM-DD.csv` and `master.csv` append

## Data notes

- `master.csv` contains public protocol-level market data scraped from DefiLlama (TVLs, APYs, utilisation). No wallet addresses or personal positions.
- Snapshots are daily captures — one file per scrape day.
- CSV schema is 20 columns, documented in README.md. Do not add/remove/rename columns without updating the README.

## What NOT to do

- Do not add `node_modules`, `package.json`, or any build infrastructure
- Do not split `tracker.html` into multiple files
- Do not use `fetch()` for local file reads — use File System Access API
- Do not commit `config.json` under any circumstances
- Do not modify `master.csv` schema without explicit approval
