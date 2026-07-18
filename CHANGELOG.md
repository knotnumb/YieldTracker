# Changelog

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
