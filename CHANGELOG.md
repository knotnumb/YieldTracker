# Changelog

## 2026-08-26 — Duplicate YS-vault rows fixed (collector + viewer + data clean) · SW no longer needs Ctrl+F5

### Fixed — duplicate vaults in the viewer (root cause: DefiLlama symbol collisions)
- **Collector now de-dupes** (`collector.js` `dedupeRows`, run after `enrichMorpho`). DefiLlama's
  `/pools` returns several *distinct* pools under one symbol on one chain (e.g. two Base `GTUSDCP`,
  two Base `BBQUSDC`); the symbol-keyed Morpho enrich then stamped them all with the *same* vault's
  TVL/APY, so they emerged byte-identical → duplicate rows. Collapsed to one row per
  `(pool, project, chain)`, keeping the highest effective TVL. V2 vaults carry their own name, so
  they never collide and are preserved.
- **Historical `master.csv` cleaned once** — removed **1,369** duplicate `(date,pool,project,chain)`
  rows across 94 days (2026-04-18 → 2026-08-26), keeping the highest-TVL copy. `2026-04-17`'s 134
  rows were genuinely distinct pools (per the 2026-08-17 decision) and left untouched. 0 dup triples
  remain.
- **Viewer belt-and-suspenders** — `index.html` drops byte-identical rows at render (keyed on the
  display-significant fields, so genuinely-distinct same-triple vaults survive — the viewer keys on
  daily `rank`, not the triple). `chart.html` now counts each vault once per day (its `rowIndex` was
  already first-wins, so charts never double-plotted; only the `days` tally was inflated).
- Full write-up: `docs/DUPLICATE_ROWS_FIX.md`.

### Fixed — viewer no longer needs Ctrl+F5 after a deploy
- **`sw.js` HTML pages are now network-first** (were cache-first). A normal reload now always loads
  the freshest `index.html`/`chart.html` online, falling back to cache offline. Static assets stay
  cache-first. `CACHE_VERSION` → `v5` (purges the old shell once).

### Known follow-up (not fixed here)
- **Cross-chain mis-enrichment** — symbol-only YS match rules with no `chain` constraint stamp
  off-target rows (e.g. Arbitrum `BBQUSDC`) with the Base vault's TVL. Fix = make `matchVault` for
  morpho entries chain/address-specific. Tracked in `docs/DUPLICATE_ROWS_FIX.md`.

## 2026-08-17 — Comparison viewer, exit-fee tracking, hosting live, cron fix

### Changed — viewer redesigned for comparison
- **`index.html` list rebuilt into always-visible aligned columns** — Vault · APY (Base) · TVL ·
  Avail Liquidity · Util — so vaults can be scanned/compared down a column at a glance. The old
  layout hid every metric behind a per-row expand, which made comparison impossible. Rows still
  click-expand for the deep stats. Horizontal-scroll on narrow screens keeps all columns.
- **YieldSeeker tab → decision cards, split Eligible / Ineligible** (as the old tracker panel did):
  ELIGIBLE/BLOCKED verdict, threshold labels (Min $500k TVL / Min $80k liq / Max 95% util),
  AGGREGATOR/LENDING category, colour-coded metrics, and the exit-fee shown on the heading line
  (right edge, number only) so metric cells stay a uniform 4-across.

### Added — exit-fee time series
- **New `exit_fee` column (master.csv schema 20 → 21).** The collector already *computed* the
  ERC4626 withdrawal-fee (`1 − previewRedeem/convertToAssets`) but dropped it; it's now persisted.
- **Avantis exit-fee now captured.** Avantis isn't an `erc4626` share-price vault, so it never hit
  the fee calc — added a `probeExitFee` path for DefiLlama-passthrough vaults. Avantis reads
  **0.4975%** live (99× the 0.005% block threshold — confirms its BLOCKED status). Tokemak baseUSD
  0.0196%, ottoUSD 0.0244%.
- **`chart.html`** — new **Exit Fee %** metric (accrues a time series going forward).
- `tracker.html` writer aligned to 21 columns; version → `v2026-08-17a`.

### Fixed — collector cron ran on the wrong clock
- Cron was set `CRON_TZ=UTC` + `1 0 * * *`, but **Debian/Ubuntu's `cron` package ignores `CRON_TZ`**
  (a cronie feature). The job was firing at 00:01 **Perth** (16:01 UTC), not 00:01 UTC. Fixed by
  scheduling in local time: **`1 8 * * *`** (08:01 Perth ≡ 00:01 UTC permanently — Perth has no DST).

### Hosting — went live (both targets)
- **GitHub Pages** (`knotnumb.github.io/YieldTracker/`) auto-deploys on push.
- **epgpvr** (`yieldtracker.epgpvr.com`) — Caddy site block, docroot = the `/opt/yieldtracker`
  clone, serves `master.csv` live (no rebuild lag), gzip. Public, HTTPS, PWA-installable.

## 2026-08-16 — Web viewer + PWA (plan step 5)

### Added — public hosted viewer
- **New landing page (`index.html`)** — replaces the old redirect-to-tracker stub. Public,
  mobile-first "best stablecoin yields" snapshot of the latest day in `master.csv`, labelled
  **"as of DATE (UTC)"**. Reuses `chart.html`'s green-terminal design system.
  - **Layout presets:** Best APY · By Chain · By Protocol · Blue-chip (by TVL) · YieldSeeker.
  - Chain chips, min-TVL, search, Compact density toggle; **all persisted to `localStorage`**
    (so the future native Windows app inherits the user's config in its own WebView2 profile).
  - **Tap any row → expands** to full 20-column detail (base/reward, 7d, 30d, avail liquidity,
    cap util, etc.); DefiLlama `↗` protocol links per row (carried over from `chart.html`).
- **`chart.html` re-wired for hosting** — auto-`fetch('master.csv')` from its own origin on load
  (manual picker kept as a `file://`/offline fallback); two-way nav with the landing.
- **Vendored Chart.js** (`assets/chart.umd.min.js`, v4.4.0) — replaces the `cdnjs` CDN `<script>`.
  Makes graphs work offline (SW-cacheable, same-origin) and restores the project's zero-CDN ethos.
- **PWA** — `manifest.json` + `sw.js` service worker. App shell cache-first; **`master.csv`
  network-first** (fresh online, last-cached offline). Installable, offline-capable.
  - New neutral app icon (`assets/icon.svg` + generated square `icon-192/512.png`) — a green
    yield-line glyph, **not** the YieldSeeker logo (that stays only in *result* badges, where it
    refers to YS's own vaults).
  - Install-dialog screenshots (wide + narrow).

### Fixed
- Landing latest-day snapshot keys rows by the daily **`rank`** column, not `pool|project|chain`
  — 17 distinct vaults share the same triple (no address column in the schema), so a triple key
  silently dropped them (131 → 114). Rank is unique per day and also collapses any accidental
  same-day double-append.

### Notes
- **`YS_VAULTS` + `PROTOCOL_SLUG_ALIASES` are now duplicated in three files** (`tracker.html`,
  `chart.html`, `index.html`) — edit all three in lockstep until consolidated. Deferred follow-up
  recorded in `docs/VPS_COLLECTOR_PLAN.md` ("Known follow-ups").
- Remaining plan work: hosting handover (Namecheap A-record + Caddy route on epgpvr) and plan
  step 6 (native Windows app).

## 2026-08-16 — VPS auto-collector LIVE (cutover)

### Added — headless daily collector (`collector.js`)
- **The daily fetch now runs headless on the VPS**, not in the browser. `collector.js` is a
  zero-npm-dependency Node port of `tracker.html`'s data pipeline (DefiLlama + off-chain
  ERC4626/RPC + Aave + Morpho V1 enrich + V2 inject). Parity vs a browser save: mean |Δapy|
  0.0008 pp across 131/131 rows. Full run ≈24s.
- **4 fail-closed validation gates** (fetch integrity, schema/format drift, value sanity,
  CSV-injection safety). If any gate trips, nothing is written or pushed and a **Telegram alert**
  (reusing the portfolio bot) names the failed gate + source — David backfills via `tracker.html`.
- **Idempotent append → git commit → push to the public repo.** The collector rebuilds `master.csv`
  with a guaranteed trailing newline, so daily diffs are a single clean added block. Push uses a
  write-enabled deploy key over 443 (port 22 is blocked from the VPS).
- Test modes: `YT_MODE=emit` (stdout only), `YT_NO_PUSH=1`, `YT_PUSH_BRANCH=x`,
  `YT_TEST_FORCE_GATE=n`.

### Cutover (this session)
- Provisioned `/opt/yieldtracker/` under the `mosaic` group model (setgid 2775, passwordless).
- **First live run appended the 2026-08-16 snapshot (131 rows) and pushed to origin.**
- **Cron enabled at 00:01 UTC daily** (`CRON_TZ=UTC`, VPS is Perth UTC+8) — first automated run
  00:01 UTC 2026-08-17.
- Row dating is now **declared UTC** going forward (landing page will label "as of DATE (UTC)").

### Notes
- Two Node-on-this-VPS gotchas baked into `collector.js`: forces **IPv4** for Telegram
  (`dns.setDefaultResultOrder('ipv4first')` + `net.setDefaultAutoSelectFamily(false)` — the box's
  IPv6 route to `api.telegram.org` black-holes) and uses the `yt-github` SSH alias (→ 443).
- Full plan, all 14 locked decisions, validation-gate spec, and operational reference:
  `docs/VPS_COLLECTOR_PLAN.md`.

## v2026-07-18a

### Added — Morpho Vaults V2 (21 vaults)
- Added all 21 available YieldSeeker Morpho **V2** (ERC-4626v2) vaults, keyed by contract address.
  V2 vaults share both symbol and name with their V1 counterparts (e.g. two `steakUSDC`, two
  `gtusdcp`), so they can only be distinguished by address.
- New `injectMorphoV2Vaults()` — one batched `vaultV2ByAddress` GraphQL call against
  `api.morpho.org`, injected as synthetic rows. V2 vaults are **not** returned by the existing
  `vaults` query (V1 only), which is why a separate query is needed.
- `matchVault()` now short-circuits to **address matching** for `morphoV2` entries and fully
  isolates them from V1 regex matching (`v2addr` rows bind only to their `morphoV2` vault).
- APY = `netApy`, available liquidity = `liquidityUsd` — both confirmed to match YieldSeeker's
  displayed figures.
- `chart.html` `YS_VAULTS` synced with 21 matching display rules.

### Added — non-Morpho vaults
- **Compound USDC** (`compound-v3`) — via DefiLlama match.
- **Spark USDC Vault (SparkFi)** — `sUSDC` at `0x3128a0F7f0ea68E7B7c9B00AFa7E41045828e858`, via
  `OFFCHAIN_VAULTS` on-chain `shareApy`. Distinct from the Morpho `sparkUSDC` vault. No withdrawal
  fee (verified on-chain).
- Skipped three low-TVL AlphaGrowth/Euler vaults (all < $500k TVL).

### Changed — APY & fee accuracy
- **`shareApy` now uses a 7-day window** (24h fallback) instead of 24h. A 24h window annualised ^365
  turned a single autopool harvest day into a misleading spike — Tokemak baseUSD read 9.6% on 24h
  vs a sustainable 5.2% on 7d.
- **Exit-fee detection** for offchain ERC4626 vaults: `evaluateVault` now warns when
  `1 − previewRedeem/convertToAssets` exceeds `EXIT_FEE_WARN_PCT` (0.005%). Surfaces redemption
  haircuts on aggregators, which skip the liquidity/util gates (Tokemak baseUSD ~0.035%).
