# Agent log

## 2026-11-03: Repository setup and document review

- **User requests:** “这是这门课的website project的作业，帮我看一下要求，整理成一个step list”; later “能不能不用这个github的ai”.
- **Agent produced:** ChatGPT explained the assignment and guided template setup, GitHub Pages publication and adding the site URL to About. The user supplied screenshots showing a public repository, a successful deployment and the About link. The user then supplied GitHub Copilot's summary of the dataset description, limitations and a proposed city-comparison dashboard.
- **Prompt supplied for Copilot:** The following is the exact prompt ChatGPT provided for the user to send. The actual submitted text was not separately retrieved from Copilot:

```text
Read AGENTS.md and docs/data_description_sheet.md first.
Summarize the dataset, its main fields, and any data limitations or filtering rules.
Then propose a simple dashboard comparing home sales across cities.
```

- **An error and correction:** ChatGPT initially told the user to choose `View all sessions` from the GitHub Copilot menu. The user's screenshot showed `In immersive chat` instead. ChatGPT acknowledged the menu mismatch and corrected the instruction using the screenshot. This was an interface-guidance error, not a data correction.
- **Scope clarification:** The assignment's example excludes prices below $10,000, but that example is not a mandatory cutoff. The supplied data description uses at least $1,000 for its published city medians. The first dashboard follows that documented convention and discloses it.

## 2026-11-03: ChatGPT Codex implementation and validation

- **User requests:** “我能不能把你关联到github里”; then “已连接”. These followed the discussion of having ChatGPT Codex build the first city-comparison website and prepare reviewable changes in the existing repository.
- **Agent plan:** Read `AGENTS.md` and `docs/data_description_sheet.md`; make a simple English dashboard with city transaction counts, median prices, a comparison chart, state filtering and city search; use `sale_price >= 1000`; preserve the five originals; check figures and prepare a pull request for review.
- **Agent produced:** Replaced the placeholder page; added plain CSS and JavaScript, a reproducible CSV-to-JSON preparation script, the committed derived JSON, an independent SQLite verification script, and a completed README. No framework, production build step, server or paid service was added.
- **Checks performed by the agent:** Original CSV: 35,442 distinct listing IDs, 35,438 eligible sales, 4 excluded records, $410,000 overall median. SQL on the separate SQLite file matched all 18 city counts, medians and complete sorted price lists. Browser checks exercised state filtering, case-insensitive search, an empty result, reset and sorting, plus the narrow-width layout. The Illinois view matched a separate SQL result: 3,664 eligible sales, 3 cities and a $245,000 median. JavaScript syntax was checked with Node.
- **Data safeguards:** No address deduplication; no upper price cutoff; no use of unreliable home types; no zero-imputation for missing dates or floor area; no average of city medians. The source files and existing deployment workflow remain unchanged.
- **Student review:** Pending. The log does not claim that the student independently performed the agent's checks or that the new dashboard has already been deployed publicly.
