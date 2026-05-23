# YieldTracker V5 — Task Brief

**Context:** Continuation from V4 chat session (2026-04-24). Repo: `github.com/knotnumb/YieldTracker` (private). Current version `v2026-05-22a`.

**Parser history (v2026-04-23f → v2026-05-14c):**
- v2026-04-23f: Original parser, anchored on first `$` cell for TVL. Worked with old bookmarklet output.
- v2026-05-09a: DeFi Llama DOM changed — APY before TVL in `innerText`. Fixed parser to anchor on first `%` cell. Used raw tab offsets after TVL for column mapping.
- v2026-05-11a: Discovered the 2026-05-09 scrape was raw DOM paste, not the bookmarklet. Added dual-format detection: `raw.length > 15` → DOM paste format, else old bookmarklet format.
- v2026-05-14b: New v2 bookmarklet extracts columns by `row.children[N]` index instead of `row.innerText`. Outputs 14 clean tab-separated columns (13 + chain). Parser updated with three-format detection by column count (13 = v2, >15 = DOM paste, other = old).
- v2026-05-14c: Fixed `$0` showing for empty liquidity fields — `parseTVL()` returns 0 for empty DL cells, now treated as null via `|| null`.

**Bookmarklet history:**
- Original (`bookmarklet.txt` in Dropbox): Used `row.innerText` + `getChain(row.children[4])`. Worked on home PC.
- On work laptop: `.vf-row` children included "Bookmark" / "open in new tab" UI text in `children[0]`, and chain image moved to `children[2]`.
- v2 bookmarklet: Extracts each column by child index. Strips UI noise from pool cell. Chain from `children[2]`. Output: `pool, project, TVL, APY, base, reward, 7d, IL, 30d, inception, supplied, borrowed, available, chain`.

---

## Task 0 — Git hygiene setup

### Why

Repo is new (1 commit, just `CLAUDE.md`). Before committing any code, set up `.gitignore` and the config template so the API key never touches git history.

### Steps

1. Create `.gitignore`:

```
config.json
test/
*.pdf
```

2. Create `config.example.json`:

```json
{
  "_note": "Paste your vaults.fyi API key between the quotes. Sign up free at https://vaults.fyi/api",
  "vaultsFyiApiKey": ""
}
```

3. Commit all project files (`tracker.html`, `chart.html`, `bookmarklet.txt`, `master.csv`, `snapshots/`, `README.md`, `config.example.json`, `.gitignore`, `CLAUDE.md`, `BRIEF_v5.md`).

4. **Pre-commit audit**: grep staged files for the string `paEzC7` (the live API key prefix). If found, abort and fix.

### Acceptance criteria

- [ ] `.gitignore` committed and excludes `config.json`
- [ ] `config.example.json` committed with empty key
- [ ] `tracker.html` in repo does NOT contain the live API key (Task 1 must complete first, or key must be blanked before initial commit)
- [ ] `git log -p` shows no API key anywhere in history

**⚠️ Task 0 and Task 1 are coupled.** Either complete Task 1 first (externalise the key), or blank line 326 before committing. Do NOT commit `tracker.html` with the live key.

---

## Task 1 — Externalise the vaults.fyi API key

### Why

`tracker.html` line 326 currently embeds the live key:

```js
const VAULTS_FYI_API_KEY = 'paEzC7kM7fk9tOVfdPD9ceE0tAxHzdSKVExfguHB4r4';
```

This must move to `config.json` (read via File System Access API) so the key never enters the repo.

### Design

Move the key into a sibling file `config.json` inside the user-picked folder (same folder as `master.csv`). The tracker already holds a `folderHandle` — no new permissions required.

**Loader behaviour:**

- Runs once after `pickFolder()` or `restoreFolderHandle()` succeed — i.e. whenever `folderHandle` becomes non-null.
- Tries to read `config.json` from `folderHandle`. If missing, creates it from the template with an empty key and a `_note` field.
- Parses JSON defensively. On parse error, surface a warning via `setStatus` — don't throw.
- Exposes the loaded key via a module-scoped `let vaultsFyiApiKey = ''` replacing the current `const VAULTS_FYI_API_KEY` on line 326.
- `fetchVaultsFyi` (line 355) and `vaultsFyiGet` (line 347) both read from this mutable, so editing `config.json` + clicking **Reconnect** picks up the new key without a hard reload.

**Helper function:**

```js
async function loadConfig() {
  if (!folderHandle) return;
  try {
    const fh = await folderHandle.getFileHandle('config.json', { create: true });
    const file = await fh.getFile();
    const text = await file.text();
    if (!text.trim()) {
      const template = {
        _note: "Paste your vaults.fyi API key between the quotes. Sign up free at https://vaults.fyi/api",
        vaultsFyiApiKey: ""
      };
      await writeFile(folderHandle, 'config.json', JSON.stringify(template, null, 2));
      vaultsFyiApiKey = '';
      setStatus('morphoStatus', 'Created config.json — paste your vaults.fyi API key and click Reconnect.', 'warn');
      return;
    }
    const parsed = JSON.parse(text);
    vaultsFyiApiKey = parsed.vaultsFyiApiKey || '';
  } catch (e) {
    setStatus('morphoStatus', `config.json read failed: ${e.message}`, 'warn');
    vaultsFyiApiKey = '';
  }
}
```

Call `loadConfig()` at the end of `pickFolder()` and `restoreFolderHandle()` success paths.

### v2026-05-22a
- Morpho API dropped support for several chains. Removed: Scroll, Ink, Corn, Fraxtal, BOB, old Katana.
- Verified working chains via console forEach snippet.
- Added defensive `?? null` on `row.apy` to prevent `.toFixed()` crash when API fails silently.
- CLAUDE.md and BRIEF_v5.md updated to reflect.

### Code changes

1. **Line 326**: Replace `const VAULTS_FYI_API_KEY = '...';` with `let vaultsFyiApiKey = '';`
2. **Line 347** (`vaultsFyiGet`): Change `VAULTS_FYI_API_KEY` → `vaultsFyiApiKey`
3. **Line 357** (`fetchVaultsFyi`): Change `VAULTS_FYI_API_KEY` → `vaultsFyiApiKey`, update error message to reference `config.json`
4. **Add `loadConfig()`** function near line 326
5. **Call `loadConfig()`** at end of `pickFolder()` and `restoreFolderHandle()` success paths

### README changes

- Step 6 "Add your vaults.fyi API key" — rewrite to describe `config.json` instead of editing `tracker.html`
- Troubleshooting — add: "Changed key but tracker still uses old value → click Reconnect to reload config.json"
- Deploying section — note that `config.json` survives tracker updates

### Acceptance criteria

- [ ] No API key string remains in `tracker.html`
- [ ] Fresh folder with no `config.json` → template created, warn status shown
- [ ] Folder with valid `config.json` → key loads silently
- [ ] Folder with malformed `config.json` → warn status, key empty, non-fatal
- [ ] Reconnect reloads the key from `config.json`
- [ ] Offchain enrichment (Revert + Tokemak) still works end-to-end
- [ ] README updated

---

## Task 2 — Cross-reference vaults.fyi to backfill blank DefiLlama fields

### The problem (now quantified)

CSV sparseness analysis of `master.csv` (2,517 rows at time of analysis):

| Column | % Blank | Notes |
|---|---|---|
| `base_apy_7d` | 64.0% | Blank across nearly all non-Morpho projects |
| `total_pool` | 76.7% | DeFi Llama inconsistent on lending protocols |
| `avail_liquidity` | 78.7% | Same |
| `supply_cap_util` | 83.6% | Currently Morpho-only |
| `avg_30d` | 15.7% | Partially sparse |
| `total_borrowed` | 95.1% | vaults.fyi can't help (not in schema) |
| `inception_apy` | 100% | vaults.fyi can't help (PRO tier) |
| `il_7d` | 99.2% | Expected — stablecoin pools have no IL |

**Note:** The v2 bookmarklet now captures supplied/borrowed/available directly from DeFi Llama's DOM, so some of these fields are already less sparse for new scrapes. The backfill is still valuable for protocols where DL shows empty cells.

**Target fields for backfill:** `base_apy_7d`, `total_pool`, `avail_liquidity`, `supply_cap_util`, `avg_30d`

**Projects that would benefit most:** Aave V3, Compound V3, Kamino Lend, Fluid Lending, Euler V2, Moonwell, Exactly — the lending protocols where DL doesn't return pool-level data. Morpho Blue already gets enriched via the Morpho API.

### What vaults.fyi provides

Endpoint: `GET /v2/detailed-vaults/{network}/{vaultAddress}`

| vaults.fyi field | master.csv target |
|---|---|
| `apy.1day.total` (×100) | `apy` |
| `apy.1day.base` (×100) | `base_apy` |
| `apy.1day.reward` (×100) | `reward_apy` |
| `apy.7day.total` (×100) | `base_apy_7d` |
| `apy.30day.total` (×100) | `avg_30d` |
| `tvl.usd` | `tvl_raw`, `total_pool` |
| `remainingCapacity` (raw units) | `avail_liquidity` (needs conversion) |
| `maxCapacity` (raw units) | `supply_cap_util` calc |
| `asset.decimals` | capacity conversion |
| `asset.assetPriceInUsd` | capacity → USD |

**Not available:** `total_borrowed`, `inception_apy`, `il_7d`, `collateral_exposure`

### Design

1. Define `XREF_VAULTS` array (separate from `OFFCHAIN_VAULTS` — those inject synthetic rows, this backfills existing DL rows):

```js
const XREF_VAULTS = [
  {
    match: { project: /aave v3/i, pool: /usdc/i, chain: /base/i },
    network: 'base',
    address: '0x...',
  },
  // add entries as needed
];
```

2. Add `crossReferenceBlankFields()` — called after Morpho enrichment during Fetch Protocol Data. For each DL row matching an `XREF_VAULTS` entry that has blank target fields, fetch vaults.fyi once and fill only null/missing fields.

3. Fold into the existing **Fetch Protocol Data** button workflow.

4. Status line: `setStatus('xrefStatus', '…', 'info')` — "Backfilled N fields across M rows".

### Edge cases

| Case | Handling |
|---|---|
| `remainingCapacity` → USD | `usd = (parseFloat(remainingCapacity) / 10 ** asset.decimals) * parseFloat(asset.assetPriceInUsd)` |
| Missing `assetPriceInUsd` | Skip, leave `avail_liquidity = null` |
| Uncapped vaults (`maxCapacity` = 0, missing, or ≥ 1e30) | `supply_cap_util = null` |
| `supply_cap_util` formula | `util = 1 - (remainingCapacity / maxCapacity)` — native units, no USD conversion needed |
| Existing DL value present | Never overwrite: `row.field = row.field ?? vaultsFyiValue` |
| Network name translation | Map: `{ 'Base': 'base', 'OP Mainnet': 'optimism', 'Arbitrum': 'arbitrum', 'Solana': 'solana' }` |
| Rate limits | Sequential requests with delay, not `Promise.all` |

### First step

Before writing backfill code, the user needs to populate the `XREF_VAULTS` array with vault addresses for the protocols they actually track. Start with Aave V3 Base USDC as a test target, confirm the data comes back correctly, then expand.

### Acceptance criteria

- [ ] Cross-reference runs only on rows matching `XREF_VAULTS` entries
- [ ] Only fills null/missing fields — never overwrites DL values
- [ ] Handles uncapped vaults gracefully
- [ ] Handles missing `assetPriceInUsd` gracefully
- [ ] Rate-limited (sequential with delay)
- [ ] No schema changes to `master.csv`
- [ ] Status reporting shows backfill summary

---

## Task 3 — Bookmarklet robustness (PARTIALLY DONE)

### Status

The v2 bookmarklet (v2026-05-14) already extracts by `children[N]` index, which is a major improvement over `row.innerText`. However, it still uses hardcoded child indices (0=pool, 1=project, 2=chain, 3=TVL, etc.) which will break if DeFi Llama adds/removes columns.

### Remaining work

The fully robust version would read column headers from the DOM and map dynamically. This requires:

1. Inspect DeFi Llama's DOM to find the header element (`.vf-header`, `thead`, etc.)
2. Read header text to build a name→index map
3. Extract data rows using the dynamic map instead of hardcoded indices
4. Output a header line so the parser can map by name

### Known issues with current v2 bookmarklet

- **Hardcoded `children[2]` for chain**: Will break if DL adds/removes a column before the chain icon. Already broke once (was `children[4]` on home PC, `children[2]` on work laptop).
- **Reward-only LP pools**: Velodrome V2, Aerodrome V1 show `base=APY, reward=APY` because empty base cell falls through to APY fallback. Cosmetic — APY itself is correct.
- **`$0` in empty liquidity cells**: DeFi Llama renders empty supplied/borrowed/available as `$0` in some cases. Parser handles this with `|| null` but bookmarklet could filter at source.

### Acceptance criteria (for full Task 3)

- [ ] Bookmarklet reads column headers from DOM
- [ ] Column mapping driven by header text, not hardcoded index
- [ ] Output includes header line for parser to map by name
- [ ] `parseScrape()` detects header line and parses by name
- [ ] Backward compatibility with v2 bookmarklet output (13 columns, no header)
- [ ] Backward compatibility with old bookmarklet and DOM paste formats

---

## Execution order

1. **Task 0 + Task 1 together** — externalise the key, then make the initial commit with clean history
2. **Task 2** — after Task 1 is verified working
3. **Task 3 remainder** — header-based bookmarklet (can be done independently, requires DevTools inspection)

## Files to upload for Claude Code session

- `tracker.html` (from repo or Dropbox)
- `bookmarklet.txt` (v2 — from Dropbox)
- `CLAUDE.md` (in repo)
- `BRIEF_v5.md` (in repo)
- `master.csv` (for sparseness analysis / testing if needed)
