# YieldTracker V5 — Task Brief

**Context:** Continuation from V4 chat session (2026-04-24). Repo: `github.com/knotnumb/YieldTracker` (private). Current version `v2026-05-11a`.

**Parser history (v2026-05-09a → v2026-05-11a):**
- Scrape data comes from the Dropbox bookmarklet (`bookmarklet.txt`) — **old format**: clean tabs, TVL before APY, ~10 columns.
- On 2026-05-09, raw DOM innerText was pasted (not bookmarklet) — **new format**: 15+ spacer tabs, APY before TVL, "Hidden" markers.
- Parser auto-detects: `raw.length > 15` → new format. Both use positional offsets — fragile. Task 3 fixes this.
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

CSV sparseness analysis of `master.csv` (2,517 rows):

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

## Execution order

1. **Task 0 + Task 1 together** — externalise the key, then make the initial commit with clean history
2. **Task 2** — after Task 1 is verified working
3. **Task 3** — bookmarklet rewrite (can be done independently)

---

## Task 3 — Rewrite bookmarklet with header-based column extraction

### Why

The bookmarklet currently dumps each row's `innerText` as tab-separated values. Column order depends on DeFi Llama's DOM structure, which can change without notice (it did on ~2026-05-09 when APY and TVL swapped positions in `innerText`). A quick fix was applied in `parseScrape()` (v2026-05-09a) using raw tab offsets, but this is fragile — any further DOM change will break it again.
Additionally, raw copy-paste from the DeFi Llama page (selecting the table and pasting, instead of running the bookmarklet) produces yet another format. The parser should either handle this gracefully or show a clear error telling the user to use the bookmarklet.

### Three input formats to handle

| Format | Source | Detection | TVL/APY order |
|---|---|---|---|
| Old bookmarklet | `bookmarklet.txt` | ≤15 tabs | TVL before APY |
| Raw DOM paste | Copy-paste from DL table | >15 tabs, "Hidden" | APY before TVL |
| New bookmarklet (Task 3) | First line has field names | Header row present | Defined by header |

### Design

**Bookmarklet** reads the `<thead>` column headers from the yields table, maps each header to a known field name, then extracts each data row by column index. The output includes a header line so the parser can map by name.

**Step 1 — Read headers:**

```js
const thead = document.querySelector('thead tr') || document.querySelector('.vf-header');
const headers = [...thead.children].map(th => th.innerText.trim().toLowerCase());
```

Build a mapping from header text → output field name:

```js
const HEADER_MAP = {
  'pool': 'pool',
  'project': 'project', 
  'chain': 'chain',
  'tvl': 'tvl',
  'apy': 'apy',
  'base apy': 'base_apy',
  'reward apy': 'reward_apy',
  '7d base apy': 'base_apy_7d',
  '7d il': 'il_7d',
  '30d avg apy': 'avg_30d',
  'inception apy': 'inception_apy',
  'supplied': 'total_pool',       // or 'total supplied'
  'borrowed': 'total_borrowed',   // or 'total borrowed'  
  'available': 'avail_liquidity',
};
```

**Step 2 — Extract each row by column index** instead of `row.innerText`:

```js
const colIdx = {};
headers.forEach((h, i) => { if (HEADER_MAP[h]) colIdx[HEADER_MAP[h]] = i; });

// For each .vf-row:
const values = OUTPUT_FIELDS.map(field => {
  const idx = colIdx[field];
  if (idx == null) return '';
  const cell = row.children[idx];
  return cell ? cell.innerText.trim().replace(/\n/g, ' ') : '';
});
```

**Step 3 — Output with header line:**

```
pool\tproject\tchain\ttvl\tapy\tbase_apy\treward_apy\tbase_apy_7d\til_7d\tavg_30d\tinception_apy\ttotal_pool\ttotal_borrowed\tavail_liquidity
USDC\tAave V3\tBase\t$24.27m\t3.35%\t3.35%\t\t\t\t3.34%\t\t$177.22m\t$152.94m\t$24.27m
```

**Step 4 — Update `parseScrape()`** to detect the header line (first line contains known field names) and parse by column name instead of positional offsets. Fall back to the current offset-based logic if no header line is present (backward compatibility with old bookmarklet).

### Pre-work

Someone needs to inspect the live DeFi Llama DOM to confirm:
- The exact CSS selector for header cells (`.vf-header`, `thead tr`, etc.)
- The exact header text strings (case, spacing, abbreviations)
- Whether chain is a column or extracted from an image (current bookmarklet does image regex)

Best done interactively in browser DevTools, not speculatively.

### Acceptance criteria

- [ ] Bookmarklet outputs a header line followed by data lines
- [ ] Column mapping is driven by header text, not DOM position
- [ ] `parseScrape()` detects header line and parses by name
- [ ] `parseScrape()` still works with old-format (no header) input for backward compat
- [ ] Chain extraction still works (may need special handling if it's image-based)
- [ ] All fields populated correctly regardless of DL column reordering

---

## Files to upload for Claude Code session

- `tracker.html` (from repo after Task 0+1, or from local folder)
- `CLAUDE.md` (already in repo)
- `BRIEF_v5.md` (already in repo)
- `master.csv` (for sparseness analysis / testing if needed)
- `bookmarklet.txt` (current bookmarklet for reference during Task 3)

