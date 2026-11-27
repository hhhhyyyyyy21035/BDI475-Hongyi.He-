# Campus Comps — College Town Home Sales Explorer

## What this site is for

Compare completed home sales across US university communities. Q1 ranks all 18 cities by median sale price. The city explorer has state filtering, case-insensitive city search, four sort orders, and an Illinois shortcut. Its summary cards, chart and table use the same selected transactions. Q1 always uses the full city coverage and the stated price range.

## Live site

https://hhhhyyyyyy21035.github.io/BDI475-Hongyi.He-/

GitHub Pages serves the latest successful deployment from `main`. To check a change on another branch, preview it locally.

## Preview it on your own computer

From the repository folder:

```bash
python -m http.server 8000
```

Open http://localhost:8000/. Opening `index.html` directly as a file will not load the data.

The production website uses plain HTML, CSS and JavaScript. It needs no framework, package installation, server-side code, external chart library, API key or build step. All asset and data paths are relative, including under a GitHub Pages repository path.

## Data notes

- Source: `data/college_town_home_sales.csv`, version 1.0. All five original data files are unchanged.
- Price scope for Q1 and the city explorer: a finite sale price from $10,000 to $5,000,000, inclusive. The data contains **35,442 source records**, **35,371 eligible sales** and **71 excluded records**.
- Records use `listing_id`, which is checked for uniqueness. Repeated street addresses are preserved. ZIP codes, FIPS codes and parcel numbers are never converted to numbers.
- Each group is a `(city, state)` pair. An eligible-sale count is the number of transactions, not the number of buildings or housing units in the city. The default view contains 18 cities across 11 states.
- The median is the middle transaction price, or the mean of the two middle prices for an even count. A filtered overall median is recalculated from all underlying eligible prices; city medians are never averaged. Half-dollar city medians are displayed with cents.
- The website uses neither the unreliable `home_type` column nor incomplete property features. It does not calculate days on market or price per square foot, so missing dates and zero living areas are not converted into misleading zero values or ratios.
- Collection date (March 2026) is not the sale-date range. Only completed sales are represented. Coverage is not a census of all sales or homes, and values are source-reported, not verified against county records. City comparisons do not adjust for size, age, timing, distance or other property differences.

### Reproduce the browser data

```bash
python scripts/summarize.py
```

This reads the CSV and writes `data/city_summary.json` under a new name. The committed JSON is about 252 KB, compared with the 9 MB CSV, and includes city-level source/excluded counts and the eligible price lists needed for exact filtered medians. Commit both the generator and its output if the source changes. This is a preparation command, **not** a Pages build step.

## How we checked our numbers

```bash
python checks/verify_summary.py
node --check assets/app.js
```

`checks/verify_summary.py` opens the original SQLite dataset read-only. Independent SQL window queries compute the median from ranked transactions, without using the CSV generator's median function or the website's JavaScript. It checks every city's count, median and entire sorted price list, global counts and the overall median, unique listing IDs, and the source CSV SHA-256 checksum.

| Number on the site | Where it appears | Independent check | Result |
|---|---|---|---|
| 35,371 eligible sales | Q1 scope note and default summary card | SQL count using `sale_price BETWEEN 10000 AND 5000000` | Matches |
| 71 excluded records | Default source-record note and method notes | SQL total minus eligible count | Matches |
| $410,000 overall median | Default summary card | SQL window ranks and mean of middle prices | Matches |
| $889,000 median, highest of 18 cities | Davis, CA in Q1 | SQL grouped ranks for every city and comparison of medians | Matches |
| 2,285 sales, $240,000 median | Champaign table row | SQL grouped ranks for Champaign, IL | Matches |
| 1,131 sales, $229,900 median | Urbana table row | SQL grouped ranks for Urbana, IL | Matches |
| 92 sales, $876,985.50 median | Pittsboro table row | SQL grouped ranks for Pittsboro, NC | Matches |

## Tools we used

GitHub Pages, plain HTML/CSS/JavaScript, and Python standard-library CSV and SQLite support. GitHub Copilot summarized the supplied documents during Part 1. ChatGPT Codex implemented the dashboard and Q1 and ran the data checks. The project history is recorded in `AGENT_LOG.md`.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026.
