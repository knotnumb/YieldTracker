# Session Log

## 2026-07-18 — Morpho V2 vaults + non-Morpho additions + APY/fee accuracy

- Added 21 Morpho **V2** vaults (address-keyed). Established that V1/V2 collide on both symbol and
  name — contract address is the only unique key. Resolved all 21 authoritatively via Morpho's
  `vaultV2ByAddress` (the `vaults` query returns V1 only). New `injectMorphoV2Vaults()`; `matchVault`
  reworked to address-match and isolate V2 from V1 regex. `chart.html` synced.
- Added **Compound USDC** (DefiLlama) and **Spark USDC Vault (SparkFi)** (`sUSDC`, on-chain
  `shareApy`, distinct from Morpho `sparkUSDC`). Verified SparkFi is a real USDC ERC4626, $7.14m TVL,
  0% withdrawal fee. Skipped three low-TVL AlphaGrowth/Euler vaults.
- **Tokemak baseUSD investigation:** it topped the eligible list on a 14.2% APY that turned out to be
  a 24h-annualised spike (24h 9.6% vs 7d 5.2%), plus a ~0.035% exit haircut and autopool withdrawal
  constraints — none of which the aggregator gating caught. Two fixes shipped:
  1. `shareApy` switched to a **7-day** window (24h fallback) to de-noise autopool harvest steps.
  2. **Exit-fee warning** — offchain ERC4626 vaults now surface a `previewRedeem` haircut above the
     0.005% threshold.
- Verified endpoint choice: `api.morpho.org/graphql` is canonical (`blue-api` is the SDK alias for
  the same backend). All on-chain reads via `base.drpc.org` + `rpcCall` 4-endpoint fallback.
- Docs updated (CHANGELOG, CLAUDE.md, SESSION_LOG, README). No secrets touched; no personal position
  data written to the repo.
