# Campus Comps

Campus Comps explores 35,442 completed home sales in 18 cities around 11 university campuses. Compare prices, days on market, annual property taxes and distance to campus. The site includes ten market questions, a filterable city map, and a comparison of two places.

[Open the live site](https://hhhhyyyyyy21035.github.io/BDI475-Hongyi.He-/)

## Explore the project

- **Explore sales** links filters, map selections, summary numbers and a sortable city table. Use the page address to share a selection.
- **Market questions** displays the six dataset-wide results and recalculates Q7–Q10 from each question's controls.
- **Insights** measures the effect of missing sale-history dates and describes the coding-agent workflow.
- **Data & methods** explains the price window, missing values, location definitions and source.

## Run locally

From the repository root, start a static file server:

```sh
python -m http.server 8000
```

Open [localhost:8000](http://localhost:8000). The site reads the original CSV in the browser and uses plain HTML, CSS and JavaScript. GitHub Pages publishes the repository through the existing workflow.

## How we checked our numbers

```sh
python checks/verify_final.py
```

The script calculates expected results from the original SQLite file with separate SQL and Python, then compares them with the browser's analysis module running on the CSV. It checks every city or campus result for Q1–Q6 and several input settings per dynamic question, including exact price boundaries and no-match cases.

| Result | Independent check |
| --- | --- |
| 35,442 source records and 35,371 sales in scope | SQLite row count and inclusive price predicate |
| Davis, CA leads Q1 at $889,000 | City-by-city medians of eligible sale prices |
| Athens, GA leads Q2 with a 32.8% gap | City mean and median on all reported prices |
| 28,028 scoped sales have both market-time dates | Count of non-null listing and contract dates |

The earlier Q1 summary generator and its check are retained as a separate workflow. Run `python scripts/summarize.py` followed by `python checks/verify_summary.py` to reproduce and verify that summary.

## Tools and source

ChatGPT Codex implemented the analysis, interactive site and independent checks. The [agent log](AGENT_LOG.md) records the project history.

College-town home sales dataset, version 1.0 (2026). University of Illinois–Deloitte Foundation Center for Business Emerging Technologies. Data collected March 2026. [Data description](docs/data_description_sheet.md)
