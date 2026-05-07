# YieldTracker V4 — Next Session Brief (Claude Code)

**Context:** Handed over from a chat session on 2026-04-24. Current tracker version `v2026-04-23k`. This brief covers two tasks: (1) externalise the vaults.fyi API key, (2) cross-reference vaults.fyi to backfill blank fields on DefiLlama-scraped rows.

---

## Task 1 — Externalise the vaults.fyi API key

### Why

`tracker.html` currently embeds the key on line 326:

```js
const VAULTS_FYI_API_KEY = 'paste your key here';
```

Problems:
- Key lives in the same file as versioned code — every `tracker.html` update risks committing it, overwriting it, or handing it over in zip drops (like this session).
- If the folder is ever synced to Dropbox/Drive, the key rides along with the HTML.
- Pasting keys into HTML is cognitively the wrong place — it's code, not config.

### Design

Move the key into a sibling file `config.json` inside the YieldTracker folder (same folder as `master.csv`), which the tracker reads via the existing File System Access API folder handle it already holds. No new permissions required.

**File:** `<YieldTracker folder>/config.json`

```json
{
  "vaultsFyiApiKey": "..."
}
```

**Loader behaviour:**
- Runs once after `pickFolder()` or `restoreFolderHandle()` succeed — i.e. whenever `folderHandle` becomes non-null.
- Tries to read `config.json` from `folderHandle`. If missing, creates it with an empty-string key and a comment-style `_note` field explaining what to paste.
- Parses JSON defensively. On parse error, surface a warning in the existing `setStatus` UI slot — don't throw.
- Exposes the loaded key via a module-scoped `let vaultsFyiApiKey = ''` that replaces the `const VAULTS_FYI_API_KEY` currently on line 326.
- `fetchVaultsFyi` (line 355) and `vaultsFyiGet` (line 347) both read from this mutable, so a user editing `config.json` + clicking **Reconnect** picks up the new key without a hard reload.

**Helper needed:**

```js
async function loadConfig() {
  if (!folderHandle) return;
  try {
    const fh = await folderHandle.getFileHandle('config.json', { create: true });
    const file = await fh.getFile();
    const text = await file.text();
    if (!text.trim()) {
      // First-run: write template
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

### README changes required

- Step 6 "Add your vaults.fyi API key" — rewrite to describe `config.json` instead of editing `tracker.html`.
- Troubleshooting — add: "Changed key but tracker still uses old value → click Reconnect to reload config.json."
- Deploying a new tracker.html — note that `config.json` is preserved across tracker updates (upside of this change worth advertising).

### Acceptance criteria

- [ ] `tracker.html` line 326 replaced; no API key string remains in the file.
- [ ] Fresh folder pick with no `config.json` creates one with the template.
- [ ] Folder pick with a valid `config.json` loads the key silently.
- [ ] Folder pick with a malformed `config.json` shows a warn status and leaves the key empty (non-fatal).
- [ ] Reconnect reloads the key.
- [ ] Existing offchain enrichment still works end-to-end with Revert + Tokemak.

---

## Task 2 — Cross-reference vaults.fyi to backfill blank DefiLlama fields

### The question to answer first (do not code before this)

Which DefiLlama-scraped fields are routinely coming back blank that vaults.fyi can fill? The previous session didn't get a concrete answer. Options:

- `avail_liquidity` blank on non-Morpho lending vaults (Aave, Fluid, Euler) — possible, DL inconsistent here
- `total_pool` / `total_borrowed` blank on various rows
- APY fields blank (rare)
- All of the above

**Ask the user, or grep `master.csv` for empty fields on lending rows to find out which columns are actually sparse.**

### What vaults.fyi can provide

Endpoint: `GET /v2/detailed-vaults/{network}/{vaultAddress}` (no PRO key needed)

Relevant fields on the response:

| vaults.fyi field | Type | master.csv target |
|---|---|---|
| `apy.1day.total` | number (decimal, ×100 for %) | `apy` |
| `apy.1day.base` | number | `base_apy` |
| `apy.1day.reward` | number | `reward_apy` |
| `apy.7day.total` | number | `base_apy_7d` |
| `apy.30day.total` | number | `avg_30d` |
| `tvl.usd` | string (USD) | `tvl_raw`, `total_pool` |
| `remainingCapacity` | string (raw native units) | `avail_liquidity` (needs conversion) |
| `maxCapacity` | string (raw native units) | used for `supply_cap_util` calc |
| `asset.decimals` | number | needed for capacity conversion |
| `asset.assetPriceInUsd` | string | needed for capacity → USD |

Fields **not** available from vaults.fyi detailed-vaults:
- `total_borrowed` — not in schema
- `inception_apy` — needs historical endpoint (PRO-tier)
- `il_7d` — not exposed
- `collateral_exposure` — Morpho-specific concept, N/A

### Edge cases to handle

1. **`remainingCapacity` conversion to USD:**
   `usd = (parseFloat(remainingCapacity) / 10 ** asset.decimals) * parseFloat(asset.assetPriceInUsd)`
   Guard against: missing `assetPriceInUsd`, decimals=0, non-numeric strings.

2. **Uncapped vaults:** `maxCapacity` may be `"0"`, missing, or `2**256 - 1` (a 78-digit string). Treat any of these as "no cap" → `supply_cap_util = null`. Detect via:
   ```js
   const UNCAPPED_THRESHOLD = 1e30; // anything above this is effectively uncapped
   ```

3. **`supply_cap_util` formula:**
   `util = 1 - (remainingCapacity / maxCapacity)` — in native units, no need to convert to USD for the ratio.

4. **Only backfill blanks — never overwrite DL data.** DL is the source of truth when it has a value. Rule: `row.field = row.field ?? vaultsFyiValue`.

5. **Matching DL rows to vaults.fyi:** DL rows have `pool`, `project`, `chain` strings; vaults.fyi wants `(network, vaultAddress)`. You need a lookup table. Start with the `YS_VAULTS` whitelist — those already have addresses for Morpho vaults. For non-Morpho lending rows, you'll need to build a new lookup table mapping `(project regex, chain regex, pool regex) → (network, vaultAddress)`. Start small — just the vaults you actually care about.

6. **Network name translation:** DL uses `Base`, `OP Mainnet`, etc. vaults.fyi uses `base`, `optimism`, etc. Build a small map.

7. **Rate limits:** Free tier limits unknown — be conservative. Sequential requests with a small delay, not `Promise.all` across 50 rows.

### Suggested approach

1. Define a new config array `XREF_VAULTS` (separate from `OFFCHAIN_VAULTS` — those inject synthetic rows; this one backfills existing rows):

   ```js
   const XREF_VAULTS = [
     {
       match: { project: /aave v3/i, pool: /usdc/i, chain: /base/i },
       network: 'base',
       address: '0x...',
     },
     // ...
   ];
   ```

2. Add a function `crossReferenceBlankFields()` called after Morpho enrichment. For each DL row that matches an `XREF_VAULTS` entry and has any blank target field, fetch vaults.fyi once and fill only the `null`/missing fields.

3. Add a new button or fold into **Fetch Protocol Data** — probably the latter, to keep the workflow single-click.

4. Status reporting: `setStatus('xrefStatus', '…', 'info')` — add a new status line. Show "Backfilled N fields across M rows" on success.

### Acceptance criteria

- [ ] User confirms which blank fields are actually a problem in practice (don't code speculatively).
- [ ] Cross-reference runs only on rows that have a matching `XREF_VAULTS` entry.
- [ ] Only fills null/missing fields — never overwrites DL values.
- [ ] Gracefully handles uncapped vaults (`supply_cap_util = null`).
- [ ] Gracefully handles missing `assetPriceInUsd` (skip capacity-to-USD, leave `avail_liquidity = null`).
- [ ] Rate-limited enough not to blow through the free tier on a 50-row scrape.
- [ ] `master.csv` columns unchanged — no schema migration needed.

---

## Files you'll need

From the YieldTracker folder (user has these locally):
- `tracker.html` — main edit target
- `chart.html` — probably no changes needed
- `README.md` / `README.pdf` — update for Task 1
- `master.csv` — read to identify which columns are sparse
- `snapshots/*.csv` — also useful for sparseness analysis

## Test setup

To hit the vaults.fyi API from Claude Code:

```bash
curl -H "x-api-key: $VAULTS_FYI_KEY" \
  "https://api.vaults.fyi/v2/detailed-vaults/base/0x36AEAe0E411a1E28372e0d66f02E57744EbE7599" \
  | jq '{tvl, remainingCapacity, maxCapacity, asset: .asset | {symbol, decimals, assetPriceInUsd}}'
```

The Revert Lend Base USDC address (`0x36AEAe0E411a1E28372e0d66f02E57744EbE7599`) is a known-good test target — it's already in the `OFFCHAIN_VAULTS` list.

## Not in scope

- Pagination/listing — `/v2/detailed-vaults` list endpoint is not needed; we fetch one vault at a time.
- Historical data — deferred to PRO tier.
- Schema changes to `master.csv` — backfill only.
- UI redesign of YieldSeeker panel.

## Handover sign-off

Previous session paused mid-way through asking "which blank fields matter?" — that's the first question to resolve in the next session before writing any backfill code. The API-key externalisation (Task 1) is independent and can proceed immediately.
