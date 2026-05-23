# DeFi Yield Tracker

A local-first stablecoin yield tracker. Scrapes DefiLlama daily, enriches Morpho vault data via the Morpho API, and saves everything to a local CSV time-series you own and control.

---

## What's in this folder

| File | Purpose |
|---|---|
| `tracker.html` | The app — open this in Brave or Chrome |
| `bookmarklet.txt` | The scrape script — set this up once as a browser bookmark |
| `master.csv` | Your complete time-series data — append-only, never edit directly |
| `snapshots/` | Daily raw CSV captures |
| `README.pdf` | This documentation |

---

## Requirements

- **Browser:** Brave or Chrome (requires File System Access API — Firefox will not work)
- **Syncing (optional):** Dropbox, Google Drive, or any folder-sync service keeps your data backed up and available across machines
- **vaults.fyi API key (required for off-chain vaults):** Revert Lend and Tokemak are not listed on DefiLlama. Their APY, TVL, and liquidity data is fetched from the vaults.fyi API. Sign up for a free key at `vaults.fyi/api` and add it to the tracker config (see One-time setup Step 6).

---

## One-time setup

### Step 1 — Enable file system access in Brave

Brave blocks file system access for local files by default. Enable it once:

1. Go to `brave://settings/content/filesystem`
2. Ensure **Sites can ask to access files and folders** is enabled

> Chrome users: file system access is enabled by default — skip this step.

### Step 2 — Open the tracker

Open `tracker.html` in Brave or Chrome by dragging it into the browser or double-clicking from File Explorer.

### Step 3 — Pick your folder

Click **Pick Folder** and select this folder. Grant the read/write permission when prompted.

> Brave requires re-granting permission each browser session. Click **Reconnect** at the top of the tracker when you return.

### Step 4 — Set up the scrape bookmarklet

1. Open `bookmarklet.txt` in any text editor
2. Copy the entire contents (one long `javascript:...` line)
3. Show the bookmarks bar in your browser (Ctrl+Shift+B)
4. Right-click the bookmarks bar → **Add page**
5. Name it something like `Scrape DefiLlama` and paste the copied text into the URL field
6. Save

### Step 5 — Bookmark the DefiLlama filter URL

Bookmark this URL. It applies chain and column filters automatically. Adjust the chain list to match your preferences:

```
https://defillama.com/yields?token=ALL_USD_STABLES&attribute=stablecoins&attribute=no_il&attribute=audited&attribute=no_outlier&minTvl=500000&show7dBaseApy=true&show7dIL=true&showInceptionApy=true&showTotalSupplied=true&showTotalBorrowed=true&showAvailable=true&chain=Base&chain=Solana&chain=Hyperliquid+L1&chain=Arbitrum&chain=Monad&chain=Katana&chain=OP+Mainnet&chain=Unichain
```

Filters applied: All USD Stablecoins, Audited, No IL, No Outliers, Min TVL $500k. Extra columns enabled: 7d Base APY, 7d IL, Inception APY, Total Supplied, Total Borrowed, Available Liquidity. Chains: Base, Solana, Hyperliquid L1, Arbitrum, Monad, Katana, OP Mainnet, Unichain.

To change chains, add or remove `&chain=ChainName` parameters from the URL.

### Step 6 — Add your vaults.fyi API key

Revert Lend and Tokemak are not listed on DefiLlama. The tracker fetches their full data (APY, TVL, liquidity) from the vaults.fyi API, which requires a free API key.

1. Go to `vaults.fyi/api` and sign up for a free account
2. Copy your API key
3. Open `tracker.html` in a text editor
4. Find the line near the top of the script that reads `const VAULTS_FYI_API_KEY = '';`
5. Paste your key between the quotes: `const VAULTS_FYI_API_KEY = 'your-key-here';`
6. Save the file and hard-reload in Brave/Chrome (Ctrl+Shift+R)

> Without an API key, Revert and Tokemak rows will still appear in the master but APY fields will be blank.

---

## Daily workflow

### 1. Open DefiLlama

Open your saved DefiLlama bookmark.

### 2. Sort by APY

Click the **APY column header** to sort descending. Do this every session — the sort is not saved in the URL.

### 3. Open DevTools — CRITICAL STEP

Press **F12** to open the browser DevTools panel before running the bookmarklet.

> DefiLlama lazy-renders chain icons. Without DevTools open, the icons never fully render and all chain fields come back empty. Keeping DevTools open during the scrape forces the layout computation that triggers rendering. Minimise the panel if you like — just don't close it.

### 4. Run the bookmarklet

Click your **Scrape DefiLlama** bookmark. The page scrolls and extracts rows automatically. An alert confirms the row and chain count.

Adjust the target row count in `bookmarklet.txt` to match the total rows shown on your filtered DefiLlama page.

### 5. Paste and parse

Switch to the tracker tab. Right-click the text box and **Paste** (or click **Paste from Clipboard**). Then click **Parse Data**.

Verify the preview shows APY sorted descending and chain names populated.

> Sort warning: the tracker warns if data is not sorted by APY descending. If you see this, go back to DefiLlama, re-sort, and re-scrape.

### 6. Fetch Protocol Data

Click **Fetch Protocol Data**. This does two things:

**Morpho vaults** — queries the Morpho API for any Morpho V1 vaults in your parsed rows and adds:
- **Available liquidity** — remaining deposit/withdrawal capacity
- **Supply cap utilisation** — how full the vault is as a % of its cap
- **Collateral exposure** — breakdown of borrower collateral assets as % of vault

**Off-chain vaults (Revert Lend, Tokemak)** — fetches full data from vaults.fyi including APY (1d/7d/30d), TVL, and available liquidity. These vaults are not on DefiLlama so they are injected as additional rows at the end of the parsed data. Requires a vaults.fyi API key (see One-time setup Step 6).

Takes a few seconds. The status bar confirms how many vaults were enriched.

> If any API is unavailable you can still save — the tracker will warn you and ask for confirmation first.

### 7. Verify and save

Check the preview — Cap Util%, Avail. Liq., and Collateral columns should be populated for Morpho rows.

Click **Save Snapshot + Append to Master**. This writes a dated snapshot to `snapshots/YYYY-MM-DD.csv` and appends today's rows to `master.csv`. If using a sync service, files sync automatically after saving.

---

## YieldSeeker panel

Evaluates vaults against configurable rules and highlights eligible opportunities. Updates automatically after parsing and after Fetch Protocol Data.

The panel comes pre-configured with example rules. To tailor it to your own needs, open `tracker.html` in a text editor and edit the `YS_VAULTS` array and rule constants near the top of the script section.

---

## master.csv schema

The master file has 20 columns:

| Column | Description |
|---|---|
| date | YYYY-MM-DD |
| rank | APY rank on that day |
| pool | Pool name from DefiLlama |
| project | Protocol name |
| chain | Blockchain |
| tvl | TVL display string |
| tvl_raw | TVL as a number |
| apy | Total APY % |
| base_apy | Native/base APY % |
| reward_apy | Incentive/reward APY % |
| base_apy_7d | 7-day base APY % |
| il_7d | 7-day impermanent loss % |
| avg_30d | 30-day average APY % |
| inception_apy | APY since inception % |
| top_10_pct | Top 10% APY threshold |
| total_pool | Total pool size USD |
| total_borrowed | Total borrowed USD |
| avail_liquidity | Available liquidity USD |
| supply_cap_util | Supply cap utilisation % (Morpho vaults only) |
| collateral_exposure | JSON collateral breakdown % (Morpho vaults only) |

> Never edit master.csv directly. If opening in Excel, choose Don't Save on close so the source file stays untouched.

---

## Morpho API — chains covered

Ethereum (chainId 1) is excluded. To add or remove chains, edit the `chainId_in` array in the `fetchAndEnrichMorpho` function inside `tracker.html`.

| Chain | Chain ID | Chain | Chain ID |
|---|---|---|---|
| Base | 8453 | Unichain | 130 |
| Optimism | 10 | Ink | 57073 |
| Arbitrum | 42161 | Corn | 21000000 |
| Polygon | 137 | Katana | 747 |
| Scroll | 534352 | Fraxtal | 252 |
| Monad | 143 | Hyperliquid EVM | 999 |

---

## Deploying a new tracker.html

1. Overwrite `tracker.html` in this folder with the new version
2. Hard-reload in Brave or Chrome: **Ctrl+Shift+R**
3. Confirm the version string under the title has updated

> Pick Folder only changes where data is saved — it does not control which tracker.html is loaded. The address bar shows the actual file being run.

---

## Troubleshooting

**Chain column is empty after scraping**
→ F12 DevTools was not open. Reopen DevTools, scroll DefiLlama to the top, re-run the bookmarklet.

**Brave asks for folder permission every session**
→ Normal for `file://` pages. Click Reconnect at the top of the tracker.

**File system access blocked in Brave**
→ Go to `brave://settings/content/filesystem` and enable file system access.

**Fetch Protocol Data returns 0 vaults enriched**
→ Check your internet connection. The Morpho API is public and needs no authentication. Try again.

**Off-chain vaults (Revert/Tokemak) show blank APY**
→ A vaults.fyi API key is required. See One-time setup Step 6.

**Save fails with "state cached" error**
→ master.csv is open in Excel or another application. Close it before saving.

**master.csv appears truncated after saving**
→ Do not open master.csv in Excel while the tracker is running. Excel locks the file and can interrupt the write.

**Sort warning after parsing**
→ Click the APY column on DefiLlama to sort descending, then re-scrape.

**master.csv has empty columns for older dates**
→ Expected. Columns added after initial setup will be blank for rows scraped before the upgrade.

**Version string didn't update after replacing tracker.html**
→ Ctrl+Shift+R for a hard reload. Check the address bar to confirm which file is loaded.
