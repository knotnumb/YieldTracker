# Bookmarklet + `parseScrape` formats

Moved out of `CLAUDE.md` on 2026-10-06 (lean-file trim). **Read when touching `bookmarklet.txt` or
`parseScrape` in `tracker.html`.** Bookmarklet output is untrusted scraped data (runs in DefiLlama's
page context).

## Bookmarklet (v2)

`bookmarklet.txt` extracts each column by `row.children[N]` index instead of `row.innerText`. It strips
"Bookmark\nopen in new tab" UI noise from the pool cell and reads chain from `children[2]` image src.

Output: 14 tab-separated columns per line, no spacer tabs:
```
pool \t project \t $TVL \t APY% \t base% \t reward% \t 7d% \t il% \t 30d% \t inception% \t supplied \t borrowed \t available \t chain
```

## Parser — three formats

Auto-detected by column count (after popping chain from the end):

| Columns | Format | Source |
|---|---|---|
| 13 | **V2 bookmarklet** — direct field mapping by index | `bookmarklet.txt` v2 |
| >15 | **DOM paste** — spacer tabs, APY before TVL, raw offsets | Copy-paste from DefiLlama |
| Other | **Old bookmarklet** — TVL before APY, positional offsets | Legacy `bookmarklet.txt` |
