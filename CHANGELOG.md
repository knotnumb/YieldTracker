# Changelog

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
