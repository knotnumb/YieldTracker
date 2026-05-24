# DeFi Yield Tracker

A local-first stablecoin yield monitoring tool. Pull live data from DefiLlama, enrich it with on-chain protocol data, and build a private time-series of the stablecoin yield market — all from a single HTML file with no server, no build step, and no API keys required.

Built around the vault selection maintained by **[<img src="data:image/png;base64,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" height="14" alt="" style="vertical-align:middle"> YieldSeeker](https://www.yieldseeker.xyz/)** — and easily adapted to track any set of protocols you care about.

---

## What it does

- Fetches filtered stablecoin yield data from the **DefiLlama API** on demand
- Enriches **Morpho vaults** with live supply cap utilisation, available liquidity, and collateral breakdowns via the Morpho API
- Reads **on-chain APY and liquidity** directly from ERC4626 vault contracts for protocols not listed on DefiLlama
- Flags vaults against a configurable watchlist — pre-loaded with the **YieldSeeker** curated selection (marked <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAABiCAYAAAAlf09yAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAuASURBVHhe7Zz7VxNJHsX3794jJN2dDigigg/eCKggoigo8hBU0NGV3Zlx5viYUVnH9XFmcGZMP5J+pDvfvZVUJAQCJOkKCfTlfE//QLrC+XBz61vd1fkHhRKmEK5AhXAFKoQrUCFcgQrhClQIV6BCuAIVwhWoEK5AhXAFKoQrUCFcgQrhCtSRhpvJZOid9xc9sNdp1X1HesbmvwlGRxbu2/QXatWX6JgxR03GIjWZi6To9wD7K39F9TpycN2MTzOpn6lJm6WIfZeUzArJ2XpIUecBtRqr/JXV60jBfY8IaDeW4NRZktLLJPv3AfUBjgzuKkn+Q/xumd56f/MzqtORgbtgvaAmfYai9jxALsOx93BkcDedK2ceIR7u0S/en/ys6nTo4W74OnUhW5uNGbh1AVCX4FQUg1vkXAb4GF77xU/ys6vToYWbwc+K/StJ+k249TagYsLKsIxdQm06tzBzZcRCFJNaUDqUcL/6JvWYzK1TJKfvANo8Kf4CjououyjmXu5cf9O5EUxoPeYaH6V6HTq4a84bUrQpuHUaQO/AmXM4Am7WuaxYJBRmLuBy50bs+zRtveQjVa9DBXci9RhunYRbZwB0lheHy537LXPzzi3I3KbkMq25H/ho1evQwJ23fqRo6hrFMrcA8jaOAJvhzs3knbt75h5Dm/bR0/iI1atsuFbGon/ZT2jcHKe51By9cF9idv3Cf3swsjMuomASUFkUMNfmAOedu2vmFjj3n4kFPmIwKguuh59+o5diSYnitopjjBQzRpIWo1iilXqNAZpKzdBDwH/jrmOtbvAzxep1+jNFkhMUA9y8cxXm3HzmFjl3pz5XSq9Qp/EdHzEYlQV3ycIfaEapxVNRcVQL6jjqBLWk20h1TlDMOkFyEqW3UTRxguJaJw0aYzRrLdFT50f6Lf0BTnP4iMFoxX6BSCh2LodbKnOL+tyIcw+Z/TMfMRiVBbfbOENxV6FWgG31W3BsxTEHt9U/SS1+O+oUqgN1GtVJca+LVLcT0LsAvZNko5Mi2mnqM67QS/ctH7k6TaQekexch2s3nVtu5janlmnVecdHDEblwdUB15YBcwfnem0oAPbaAfQU6jQqBzfu4TzvLOocqptUlGKdp0jiDL1y/8tHr1yd+i10CFOAWkHm8j6XXRV7E9CyN6+y4K6iyY6ZEhyrorY6t8XncJlzPe5cwG3xc3BbfID1z6O6UT2oXlLTvYiNXmSzyd+hfPkZn5q1cTj1ZkHmogozdx997jF9gVKYGINUWXDT+OnUTpFqKwC3u3NbSjmXwYVzs3C9Pji4h4awkqpU770N9LZXAPYmIBZnbs65e/W5Uvo+teoP+IjBqSy4TJ+8TyQn2KSG3C3OXIDd4lxkbovPXLuzc+N+H2qAJKObHtvP+DuUpzXnNUWTV4ucW17mRp1lGk1+z0cMTmXDZXpg4T9uSIBYeebGvZxzVb+fYul+khEPG37511GnU0+x1L0KoMXO3X+fy/L2e+cTHzE4VQSXadAYJNVC9u6WuVnnAu4ezo37gxSz+9GNTPLR968+c55kl3UKW527rz4XcJtTd6nbfMxHC1YVw/3qfyU1oaI1a83BLStz+YQG58bhXNUbgIOHKGr2opcu76qUrF0hxbtRInNL97nR9BImsTvUA7BBT2R5VQyX6QfnB1IMNrmV7nOLM7elhHPjgBv3hrDa60Oub/B32F0bfgKT2RjAAi5z7j773Ig1j177DhYf65ThY4lQVXCZxpNwTpJ1DpVnbs65iBnAVZwh6tDH0Jd4/B1K6wdnnSIm3t9nPe7emSu583DrLTpnrOIfI35pXjVcdiHnpI72zGXZW5S5e/S5m85lNQTAF1DDJCUH6Lb1iL9DaY0YyyRhMvvm3G+ZiyrqcyPWLB3TpmnZ/pWfLV5Vw2V6m17HxxmrtvR+M5cB3p65zLkMruqNUETvp387r/g7bNdr9yM165co5jHXlsrcWazcZqlJv0md+Ed8RozUUoHAZZqzFkgx4d4K+tx85jLnxhlcfwTQRimKjmQRE5yJT0debJfMU+sXUnXEgTsJp07t4Nxc5katabh1ihas5/zs2iowuGz1dlZHntptcGblmZt3ruqPAtZFklLDcCjL4UkaMO6gQxlDzl5Ch8Di4BqKOXdr5srpaUx01+mUPk8fvL/4X1h7BQaX6Xf/D4prbQDMsre8PrfYuSrA5uoyCh2BNwan4phmS908WNbfbnWuZN+gY4lJumM9w7/b53/ZwShQuEzv0r9RW6KLZP0EKal2UqwOijnMwXv3ufkJLQd3FJWDG8vWOIqBZRfFGVxEwjfn3iAlfQNuvUonjdv0bp+tnGgFDjev994Hemyv0VRqFiuvYYom2imqd5BsdgH4WQBn8cDcW9DnbnPupSxc5lwVcFXAVTMMLCqz6VzJmqQmbZxmrP/sq4WrlYTBLZaPn8/eH1jDP6fZ1D0snyeRn91o5s9i4jpPcqoXwJmDCzLXywGOeTs7V0lPUsQYp+P6DVr3fufvVD+qGdxS+hPL6OfuG5pHX3tcg8PZPbo0i4fNWMg7l8FVOVzZnoBbL+GT8SR7g7IedeBwi7VoP6FIAoCz7uXOLcpcycbkpo3RqwD3GIhQ3cFlmk0+xCqNTXDbMzfmTZCsXUaLVR+T1m6qS7hWxqaoNgCQLBq2OleyLtP11N5L43pQXcJl6jHRYrksGrY6N2qM0hsv+AvbIlS3cAeNGVKcHNxC5zYlhut2AitW3cKNaRd4K1bQLaTHqAPL2kZRXcJdsJ5Q1GSZu7XPlezLNJ4MbnOyaNUd3LvWUywsWK+bb8U2nRtNXaT79k/8lfWvuoH7t69RvzFFER1gXbYEzi8iNruFCCazV+7/+Bn1r7qA+9T5CRnbh962j+Je6WsLzVjBaZlgHgaphQ4ULtvGNIQJKpI4h86AXR3bfj0371wFk5mKxUMj6cDgsgs4qtZDcpJdgty8h1bqeq7iXKLhZLCbk0Wr5nANfKxHsUCIal2k2Oy67v6u50qYzObL3NNw0Kop3J+cl9SqdZNkdgEoA7v1TsRu13Oj5gg9c9b5SI2hmsGdSM5QNHEqe6F83/fQCvrcZv0CbfjBPVFeC9UE7hXzJslGB6Dx2zx77FvYFguAK2ujfLTGkXC4790PyFe2l6G8fQuFfa7sXKRe4xYfsXEkHO6ctUxKiu1jqOTuby5zZWuUZlLBPmlTCwmHO2TgY20X3P0tc98CAxxNDtOa8wsfsXEkHK6qnQasrqr2LUQwmX1sgDsPxRIK9y//b3QIbAfOmU3nVrBvoTkxlL173GgSCve5+4pkk+3X3dxxs+v+3B0yV3EvUpfeONdwCyUU7t3UCpa3bN9YgXPLyVz0ubI9QleT9/mIjSWhcC+Zk6Q6HVm4u2du6T5XwmT20A72sdFaSSjck4lz2UdTK9mfm4cb0QcxmR3sU/GVShhcM5PE4oE95cNcu5dzd+4WZGuYes1pPmLjSRhc9pUAks46hfL358bSbOv+IPUbM5QM+CsAaylhcFftx6Qk2dM95e3PjdmDJGv9tGL/mP2GpUaWMLgT5g1SLNYp7PRMxPY+N+YNZp9DO6Nfod/9g9sNHqSEwe3S4UyX7S7fmrk79bkxu48krZsWrScNuVgoJSFwnYxLka/H4dDdn4mIpXvh1nPUro+gI6i//bXVSgjcP/wNTGbskdXSz6Ep9nl0E2doFgsNN5PmZx4uCYH7xf8TH/MTgLrduap3niSji9q0AVpvoD0IlUhY5vYYWG05+esKOecq9pns99tcS80F/iVC9ShhcD8jQ9sSZ+HSdpKTHYgAgMaK7YX7mr/i8EsYXKYkVmnPnOd03/6OHtlrlCp4EvIoSCjco64QrkCFcAUqhCtQIVyBCuEKVAhXoEK4AhXCFagQrkCFcAUqhCtQIVyBCuEKVAhXmIj+DwxFQaNyIuByAAAAAElFTkSuQmCC" height="13" alt="YS" style="vertical-align:middle"> YS)
- Saves each daily fetch as an append-only CSV time-series you own and control
- Includes a separate **historical chart viewer** (`chart.html`) for visualising APY trends across any vaults in your dataset

---

## Why local-first?

- **No account, no subscription, no cloud** — your data lives in a folder you pick
- Sync to Dropbox, Google Drive, or OneDrive if you want backup and multi-device access
- The HTML files run directly from `file://` — nothing to install or deploy

---

## Requirements

- **Browser:** Chrome or Brave (requires the File System Access API — Firefox does not support it)
- **Brave users:** enable file system access once at `brave://settings/content/filesystem`

That is all. No Node.js, no Python, no API keys.

---

## Quick start

1. **Clone or download** this repository
2. Open `tracker.html` in Chrome or Brave
3. Click **Pick Folder** and choose a local folder where your data will be saved (can be inside a Dropbox/Drive folder for automatic sync)
4. Click **Fetch from DefiLlama** — pulls filtered stablecoin yield data from the DefiLlama API
5. Click **Fetch Protocol Data** — enriches results with Morpho API data and on-chain vault reads
6. Click **Save Snapshot + Append to Master** — writes today's snapshot and appends to `master.csv`

The included `master.csv` has ~35 days of historical data so the chart works immediately.

---

## Daily workflow

### 1 — Fetch from DefiLlama

Click **Fetch from DefiLlama**. The tracker calls the DefiLlama yields API with your configured filters and populates the preview table.

Default filters (adjustable in `config.json`):

| Filter | Default |
|---|---|
| Asset type | Stablecoins only |
| Chains | Base, Arbitrum, Optimism, Polygon, Unichain |
| Min TVL | $500k |
| Max APY | 50% |
| Row limit | 100 |
| Exclude outliers | Yes |

### 2 — Fetch Protocol Data

Click **Fetch Protocol Data**. This runs three enrichment passes:

**Morpho vaults** — queries the Morpho API for any Morpho vaults in your results and adds:
- Available liquidity (remaining withdrawal/deposit capacity)
- Supply cap utilisation %
- Collateral exposure breakdown

**Off-chain vaults** — for vaults not indexed by DefiLlama (or where on-chain data is more reliable), the tracker reads directly from the contract:
- **ERC4626 share-price APY** — compares `convertToAssets()` at current block vs ~24 hours ago and annualises the growth rate
- **Euler interest-rate APY** — reads the live borrow rate, utilisation, and protocol fee directly from the Euler V2 vault contract
- **Available liquidity** — reads the underlying token balance held by the vault

**Aave V3 Base** — queries on-chain for USDC supply APY and liquidity.

### 3 — Check <img src="data:image/png;base64,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" height="16" alt="" style="vertical-align:middle"> YieldSeeker panel

The **YieldSeeker** panel (section 05) automatically filters the enriched results against the pre-configured vault watchlist. Each eligible vault shows its APY, TVL, available liquidity, and supply cap status. Vaults flagged as operationally blocked (e.g. no exit liquidity) are shown with a ⊘ marker.

> YieldSeeker curates a selection of stablecoin yield vaults focused on capital safety and exit liquidity. Learn more at [yieldseeker.xyz](https://www.yieldseeker.xyz/).

### 4 — Save

Click **Save Snapshot + Append to Master**. This:
- Writes `snapshots/YYYY-MM-DD.csv` — the raw day's data
- Appends all rows to `master.csv` — the append-only time-series

---

## Historical chart viewer

Open `chart.html` separately in the same browser. Click **Open master.csv** and navigate to your data folder.

**Selecting vaults:**
- Filter by protocol, chain, or <img src="data:image/png;base64,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" height="13" alt="YS" style="vertical-align:middle"> YS whitelist status
- Set minimum APY and TVL thresholds
- Search by name
- Sort by APY, TVL, or days of history
- Use **Top 5 / 10 / 15** buttons to auto-select the highest-ranking vaults from the current filter
- Page through results (15 per page)

**Charting:**
- Up to 15 vaults simultaneously
- Metrics: APY, Base APY, Reward APY, 30d Average, TVL, Available Liquidity, Supply Cap Util %
- Date ranges: 7d, 14d, 30d, All
- Hover over legend names to isolate a single series

---

## Customising your watchlist

The pre-loaded watchlist tracks the YieldSeeker vault selection. To build your own:

### Adding on-chain vaults (not on DefiLlama)

Edit the `OFFCHAIN_VAULTS` array in `tracker.html`. Each entry needs:

```javascript
{
  name: 'My Vault',
  address: '0x...',                    // vault contract address
  network: 'base',                     // network slug (for future use)
  chain: 'Base',                       // display chain name
  project: 'My Protocol',             // display project name
  pool: 'USDC',                        // display pool name
  matchRe: { project: /myprotocol/i }, // regex to detect if DL already has it
  erc4626: {
    rpc: 'https://base.drpc.org',
    decimals: 6,
    shareApy: true   // use share-price APY (most ERC4626 vaults)
    // eulerApy: true  // use Euler V2 interest-rate model instead
  },
  liquidityRpc: {                      // optional: on-chain liquidity read
    rpc: 'https://base.drpc.org',
    token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // underlying token
    decimals: 6
  }
}
```

### Adding watchlist rules

Edit the `YS_VAULTS` array. Each rule is a set of regex conditions — a vault matches if all specified conditions match:

```javascript
{ pool: /mypool/i, project: /myprotocol/i, chain: /base/i }
```

Add `blocked: true` to mark a vault as ineligible (shown in the YS panel with a ⊘ warning rather than hidden).

### Adjusting DefiLlama filters

Edit `config.json` in your data folder (created automatically on first run). The file is excluded from git — your overrides are local only.

```json
{
  "defiLlama": {
    "chains": ["Base", "Arbitrum", "Optimism"],
    "minTvl": 1000000,
    "maxApy": 30,
    "limit": 50,
    "stablecoinOnly": true,
    "excludeOutliers": true
  }
}
```

---

## master.csv schema

20 columns, append-only. Do not edit directly. If opening in Excel, choose **Don't Save** when closing.

| Column | Description |
|---|---|
| `date` | YYYY-MM-DD |
| `rank` | APY rank on that day |
| `pool` | Pool name |
| `project` | Protocol name |
| `chain` | Blockchain |
| `tvl` | TVL display string |
| `tvl_raw` | TVL as a number (USD) |
| `apy` | Total APY % |
| `base_apy` | Base/native APY % |
| `reward_apy` | Incentive APY % |
| `base_apy_7d` | 7-day base APY % |
| `il_7d` | 7-day impermanent loss % |
| `avg_30d` | 30-day average APY % |
| `inception_apy` | APY since inception % |
| `top_10_pct` | Top 10% APY threshold on that day |
| `total_pool` | Total pool size (USD) |
| `total_borrowed` | Total borrowed (USD) |
| `avail_liquidity` | Available liquidity (USD) |
| `supply_cap_util` | Supply cap utilisation % (Morpho vaults) |
| `collateral_exposure` | JSON collateral breakdown (Morpho vaults) |

---

## <img src="data:image/png;base64,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" height="20" alt="" style="vertical-align:middle"> About YieldSeeker

[YieldSeeker](https://www.yieldseeker.xyz/) curates a selection of stablecoin yield vaults with a focus on capital safety, withdrawal liquidity, and sustainable APY. The <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAABiCAYAAAAlf09yAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAuASURBVHhe7Zz7VxNJHsX3794jJN2dDigigg/eCKggoigo8hBU0NGV3Zlx5viYUVnH9XFmcGZMP5J+pDvfvZVUJAQCJOkKCfTlfE//QLrC+XBz61vd1fkHhRKmEK5AhXAFKoQrUCFcgQrhClQIV6BCuAIVwhWoEK5AhXAFKoQrUCFcgQrhCtSRhpvJZOid9xc9sNdp1X1HesbmvwlGRxbu2/QXatWX6JgxR03GIjWZi6To9wD7K39F9TpycN2MTzOpn6lJm6WIfZeUzArJ2XpIUecBtRqr/JXV60jBfY8IaDeW4NRZktLLJPv3AfUBjgzuKkn+Q/xumd56f/MzqtORgbtgvaAmfYai9jxALsOx93BkcDedK2ceIR7u0S/en/ys6nTo4W74OnUhW5uNGbh1AVCX4FQUg1vkXAb4GF77xU/ys6vToYWbwc+K/StJ+k249TagYsLKsIxdQm06tzBzZcRCFJNaUDqUcL/6JvWYzK1TJKfvANo8Kf4CjououyjmXu5cf9O5EUxoPeYaH6V6HTq4a84bUrQpuHUaQO/AmXM4Am7WuaxYJBRmLuBy50bs+zRtveQjVa9DBXci9RhunYRbZwB0lheHy537LXPzzi3I3KbkMq25H/ho1evQwJ23fqRo6hrFMrcA8jaOAJvhzs3knbt75h5Dm/bR0/iI1atsuFbGon/ZT2jcHKe51By9cF9idv3Cf3swsjMuomASUFkUMNfmAOedu2vmFjj3n4kFPmIwKguuh59+o5diSYnitopjjBQzRpIWo1iilXqNAZpKzdBDwH/jrmOtbvAzxep1+jNFkhMUA9y8cxXm3HzmFjl3pz5XSq9Qp/EdHzEYlQV3ycIfaEapxVNRcVQL6jjqBLWk20h1TlDMOkFyEqW3UTRxguJaJw0aYzRrLdFT50f6Lf0BTnP4iMFoxX6BSCh2LodbKnOL+tyIcw+Z/TMfMRiVBbfbOENxV6FWgG31W3BsxTEHt9U/SS1+O+oUqgN1GtVJca+LVLcT0LsAvZNko5Mi2mnqM67QS/ctH7k6TaQekexch2s3nVtu5janlmnVecdHDEblwdUB15YBcwfnem0oAPbaAfQU6jQqBzfu4TzvLOocqptUlGKdp0jiDL1y/8tHr1yd+i10CFOAWkHm8j6XXRV7E9CyN6+y4K6iyY6ZEhyrorY6t8XncJlzPe5cwG3xc3BbfID1z6O6UT2oXlLTvYiNXmSzyd+hfPkZn5q1cTj1ZkHmogozdx997jF9gVKYGINUWXDT+OnUTpFqKwC3u3NbSjmXwYVzs3C9Pji4h4awkqpU770N9LZXAPYmIBZnbs65e/W5Uvo+teoP+IjBqSy4TJ+8TyQn2KSG3C3OXIDd4lxkbovPXLuzc+N+H2qAJKObHtvP+DuUpzXnNUWTV4ucW17mRp1lGk1+z0cMTmXDZXpg4T9uSIBYeebGvZxzVb+fYul+khEPG37511GnU0+x1L0KoMXO3X+fy/L2e+cTHzE4VQSXadAYJNVC9u6WuVnnAu4ezo37gxSz+9GNTPLR968+c55kl3UKW527rz4XcJtTd6nbfMxHC1YVw/3qfyU1oaI1a83BLStz+YQG58bhXNUbgIOHKGr2opcu76qUrF0hxbtRInNL97nR9BImsTvUA7BBT2R5VQyX6QfnB1IMNrmV7nOLM7elhHPjgBv3hrDa60Oub/B32F0bfgKT2RjAAi5z7j773Ig1j177DhYf65ThY4lQVXCZxpNwTpJ1DpVnbs65iBnAVZwh6tDH0Jd4/B1K6wdnnSIm3t9nPe7emSu583DrLTpnrOIfI35pXjVcdiHnpI72zGXZW5S5e/S5m85lNQTAF1DDJCUH6Lb1iL9DaY0YyyRhMvvm3G+ZiyrqcyPWLB3TpmnZ/pWfLV5Vw2V6m17HxxmrtvR+M5cB3p65zLkMruqNUETvp387r/g7bNdr9yM165co5jHXlsrcWazcZqlJv0md+Ed8RozUUoHAZZqzFkgx4d4K+tx85jLnxhlcfwTQRimKjmQRE5yJT0debJfMU+sXUnXEgTsJp07t4Nxc5katabh1ihas5/zs2iowuGz1dlZHntptcGblmZt3ruqPAtZFklLDcCjL4UkaMO6gQxlDzl5Ch8Di4BqKOXdr5srpaUx01+mUPk8fvL/4X1h7BQaX6Xf/D4prbQDMsre8PrfYuSrA5uoyCh2BNwan4phmS908WNbfbnWuZN+gY4lJumM9w7/b53/ZwShQuEzv0r9RW6KLZP0EKal2UqwOijnMwXv3ufkJLQd3FJWDG8vWOIqBZRfFGVxEwjfn3iAlfQNuvUonjdv0bp+tnGgFDjev994Hemyv0VRqFiuvYYom2imqd5BsdgH4WQBn8cDcW9DnbnPupSxc5lwVcFXAVTMMLCqz6VzJmqQmbZxmrP/sq4WrlYTBLZaPn8/eH1jDP6fZ1D0snyeRn91o5s9i4jpPcqoXwJmDCzLXywGOeTs7V0lPUsQYp+P6DVr3fufvVD+qGdxS+hPL6OfuG5pHX3tcg8PZPbo0i4fNWMg7l8FVOVzZnoBbL+GT8SR7g7IedeBwi7VoP6FIAoCz7uXOLcpcycbkpo3RqwD3GIhQ3cFlmk0+xCqNTXDbMzfmTZCsXUaLVR+T1m6qS7hWxqaoNgCQLBq2OleyLtP11N5L43pQXcJl6jHRYrksGrY6N2qM0hsv+AvbIlS3cAeNGVKcHNxC5zYlhut2AitW3cKNaRd4K1bQLaTHqAPL2kZRXcJdsJ5Q1GSZu7XPlezLNJ4MbnOyaNUd3LvWUywsWK+bb8U2nRtNXaT79k/8lfWvuoH7t69RvzFFER1gXbYEzi8iNruFCCazV+7/+Bn1r7qA+9T5CRnbh962j+Je6WsLzVjBaZlgHgaphQ4ULtvGNIQJKpI4h86AXR3bfj0371wFk5mKxUMj6cDgsgs4qtZDcpJdgty8h1bqeq7iXKLhZLCbk0Wr5nANfKxHsUCIal2k2Oy67v6u50qYzObL3NNw0Kop3J+cl9SqdZNkdgEoA7v1TsRu13Oj5gg9c9b5SI2hmsGdSM5QNHEqe6F83/fQCvrcZv0CbfjBPVFeC9UE7hXzJslGB6Dx2zx77FvYFguAK2ujfLTGkXC4790PyFe2l6G8fQuFfa7sXKRe4xYfsXEkHO6ctUxKiu1jqOTuby5zZWuUZlLBPmlTCwmHO2TgY20X3P0tc98CAxxNDtOa8wsfsXEkHK6qnQasrqr2LUQwmX1sgDsPxRIK9y//b3QIbAfOmU3nVrBvoTkxlL173GgSCve5+4pkk+3X3dxxs+v+3B0yV3EvUpfeONdwCyUU7t3UCpa3bN9YgXPLyVz0ubI9QleT9/mIjSWhcC+Zk6Q6HVm4u2du6T5XwmT20A72sdFaSSjck4lz2UdTK9mfm4cb0QcxmR3sU/GVShhcM5PE4oE95cNcu5dzd+4WZGuYes1pPmLjSRhc9pUAks46hfL358bSbOv+IPUbM5QM+CsAaylhcFftx6Qk2dM95e3PjdmDJGv9tGL/mP2GpUaWMLgT5g1SLNYp7PRMxPY+N+YNZp9DO6Nfod/9g9sNHqSEwe3S4UyX7S7fmrk79bkxu48krZsWrScNuVgoJSFwnYxLka/H4dDdn4mIpXvh1nPUro+gI6i//bXVSgjcP/wNTGbskdXSz6Ep9nl0E2doFgsNN5PmZx4uCYH7xf8TH/MTgLrduap3niSji9q0AVpvoD0IlUhY5vYYWG05+esKOecq9pns99tcS80F/iVC9ShhcD8jQ9sSZ+HSdpKTHYgAgMaK7YX7mr/i8EsYXKYkVmnPnOd03/6OHtlrlCp4EvIoSCjco64QrkCFcAUqhCtQIVyBCuEKVAhXoEK4AhXCFagQrkCFcAUqhCtQIVyBCuEKVAhXmIj+DwxFQaNyIuByAAAAAElFTkSuQmCC" height="13" alt="YS" style="vertical-align:middle"> YS badge in this tracker marks vaults that meet the YieldSeeker criteria. The ⊘ Blocked badge marks vaults that are monitored but currently excluded due to operational concerns such as illiquid exit conditions.

This tracker was built to support the YieldSeeker research workflow. The vault list, enrichment logic, and YS panel reflect the criteria applied at [yieldseeker.xyz](https://www.yieldseeker.xyz/).

---

## Data and privacy

- `master.csv` contains only public market data (APYs, TVLs, pool names scraped from DefiLlama and public APIs). No wallet addresses, no personal positions, no account data.
- All data is stored locally in the folder you choose.
- The tracker makes outbound API calls to DefiLlama, the Morpho API, and public blockchain RPC endpoints. No data is sent to any other service.
- `config.json` is excluded from git (see `.gitignore`). It contains only DefiLlama filter settings — no secrets.

---

## Troubleshooting

**Brave asks for folder permission every session**
→ Expected for `file://` pages. Click **Reconnect** at the top of the tracker.

**File system access blocked in Brave**
→ Go to `brave://settings/content/filesystem` and enable file system access.

**Fetch Protocol Data shows 0 Morpho vaults enriched**
→ Check your internet connection. The Morpho API is public and requires no authentication.

**Save fails with a file lock error**
→ `master.csv` is open in Excel or another application. Close it and try again. Do not open `master.csv` in Excel while the tracker is running.

**Chart shows a gap in a vault's history**
→ DefiLlama changed project name casing in May 2026. The chart normalises keys to lowercase automatically. If you still see a gap, the vault may have been briefly renamed — check the vault list for a second entry with a slightly different name.

---

## Architecture notes

Both `tracker.html` and `chart.html` are self-contained single-file vanilla JS applications. There is no build step, no npm, no bundler, and no external dependencies beyond Chart.js (loaded from CDN in `chart.html`).

File I/O uses the browser's [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API) — files are read and written directly to your local folder without any server involvement.

To modify the tracker: edit `tracker.html` in any text editor. There is nothing to compile or build. Hard-reload the browser (Ctrl+Shift+R) after saving.

---

## License

MIT — do whatever you like with it.
