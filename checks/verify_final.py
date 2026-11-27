"""Check the browser's ten answers against the independent, read-only SQLite data."""

import json
import math
import sqlite3
import subprocess
from pathlib import Path
from statistics import median


ROOT = Path(__file__).resolve().parents[1]
CITY = "city || ', ' || state"
SCOPED = "sale_price BETWEEN 10000 AND 5000000"
DOM = "julianday(contract_date) - julianday(list_date)"
CASES = [
    (7, {"beds": 0}), (7, {"beds": 3}), (7, {"beds": 99}),
    (8, {"min": 250000, "max": 500000}), (8, {"min": 10000, "max": 10000}),
    (8, {"min": 5000000, "max": 5000000}), (8, {"min": 0, "max": 9999}),
    (9, {"city": "Champaign, IL", "year": 2025}),
    (9, {"city": "Athens, GA", "year": 2024}),
    (9, {"city": "Davis, CA", "year": 2026}),
    (10, {"campus": "University of Illinois Urbana-Champaign", "max": 300000, "beds": 3}),
    (10, {"campus": "University of Georgia", "max": 10000, "beds": 0}),
    (10, {"campus": "University of Wisconsin-Madison", "max": 9999, "beds": 0}),
]


class SqlMedian:
    def __init__(self):
        self.values = []

    def step(self, value):
        if value is not None:
            self.values.append(value)

    def finalize(self):
        return median(self.values) if self.values else None


def query(db, sql, params=()):
    return [dict(row) for row in db.execute(sql, params)]


def city_medians(db, metric, condition, params=()):
    return query(db, f"""
        WITH cities AS (SELECT DISTINCT {CITY} AS city FROM home_sales),
        grouped AS (
            SELECT {CITY} AS city, median({metric}) AS median, COUNT({metric}) AS count
            FROM home_sales WHERE {condition}
            GROUP BY city, state
        )
        SELECT cities.city, grouped.median, COALESCE(grouped.count, 0) AS count
        FROM cities LEFT JOIN grouped USING (city)
        ORDER BY cities.city
    """, params)


def fixed_reference(db):
    return {
        "q1": city_medians(db, "sale_price", SCOPED),
        "q2": query(db, f"""
            WITH stats AS (
                SELECT {CITY} AS city, AVG(sale_price) AS mean, median(sale_price) AS median,
                       COUNT(*) AS count, SUM(sale_price > 5000000) AS aboveCeiling,
                       MAX(sale_price) AS topPrice,
                       AVG(sale_price) FILTER (WHERE sale_price <= 5000000) AS meanWithoutAboveCeiling
                FROM home_sales GROUP BY city, state
            )
            SELECT *, (mean - median) / NULLIF(median, 0) AS gap FROM stats ORDER BY city
        """),
        "q3": query(db, f"""
            WITH means AS (
                SELECT {CITY} AS city, AVG(sale_price) AS rawMean,
                       AVG(sale_price) FILTER (WHERE {SCOPED}) AS scopedMean
                FROM home_sales GROUP BY city, state
            ), ranked AS (
                SELECT *, RANK() OVER (ORDER BY rawMean DESC) AS rawRank,
                       RANK() OVER (ORDER BY scopedMean DESC) AS scopedRank FROM means
            )
            SELECT *, rawRank - scopedRank AS change FROM ranked ORDER BY city
        """),
        "q4": query(db, f"""
            WITH campus_prices AS (
                SELECT university AS campus,
                       median(sale_price) FILTER (WHERE strftime('%Y', sale_date) = '2024') AS median2024,
                       median(sale_price) FILTER (WHERE strftime('%Y', sale_date) = '2025') AS median2025
                FROM home_sales WHERE {SCOPED} GROUP BY university
            )
            SELECT *, 1.0 * (median2025 - median2024) / median2024 AS change
            FROM campus_prices ORDER BY campus
        """),
        "q5": query(db, f"""
            SELECT university AS campus, median({DOM}) AS median, COUNT({DOM}) AS count
            FROM home_sales WHERE {SCOPED} GROUP BY university ORDER BY campus
        """),
        "q6": query(db, f"""
            WITH totals AS (
                SELECT university AS campus, COUNT(*) AS count,
                       SUM(tax_annual_amount) AS taxTotal, SUM(sale_price) AS priceTotal
                FROM home_sales
                WHERE {SCOPED} AND tax_annual_amount > 0 AND 10 * tax_annual_amount < sale_price
                GROUP BY university
            )
            SELECT *, taxTotal / priceTotal AS burden FROM totals ORDER BY campus
        """),
    }


def dynamic_reference(db, question, params):
    if question == 7:
        return city_medians(db, "sale_price", f"{SCOPED} AND beds = ?", (params["beds"],))
    if question == 8:
        return city_medians(db, DOM, f"{SCOPED} AND sale_price BETWEEN ? AND ?",
                            (params["min"], params["max"]))
    if question == 9:
        counts = dict(db.execute(f"""
            SELECT CAST(strftime('%m', sale_date) AS INTEGER) AS month, COUNT(*)
            FROM home_sales WHERE {CITY} = ? AND strftime('%Y', sale_date) = ? GROUP BY month
        """, (params["city"], str(params["year"]))))
        return [{"month": month, "count": counts.get(month, 0)} for month in range(1, 13)]
    distances = [row[0] for row in db.execute(f"""
        SELECT miles_to_campus FROM home_sales
        WHERE {SCOPED} AND university = ? AND sale_price <= ? AND beds >= ?
        ORDER BY miles_to_campus
    """, (params["campus"], params["max"], params["beds"]))]
    known_distances = [distance for distance in distances if distance is not None]
    return {"median": median(known_distances) if known_distances else None,
            "count": len(distances), "distances": known_distances}


def browser_answers():
    runner = r"""
        const fs = require('node:fs');
        const vm = require('node:vm');
        const context = {
            window: {},
            fetch: async path => ({ok: true, text: async () => fs.readFileSync(path, 'utf8')})
        };
        vm.runInNewContext(fs.readFileSync('assets/analysis.js', 'utf8'), context);
        async function run() {
            const cases = JSON.parse(fs.readFileSync(0, 'utf8'));
            const analysis = context.window.CampusData;
            const data = await analysis.load();
            const dynamics = cases.map(([question, params]) => analysis.dynamic(data, question, params));
            for (let index = 0; index < cases.length; index += 1) {
                if (cases[index][0] === 10) dynamics[index].distances.sort((a, b) => a - b);
            }
            process.stdout.write(JSON.stringify({
                counts: [data.rows.length, data.scoped.length, data.cities.length, data.campuses.length],
                fixed: analysis.fixed(data), dynamics,
            }));
        }
        run().catch(error => { console.error(error); process.exitCode = 1; });
    """
    output = subprocess.run(["node", "-e", runner], input=json.dumps(CASES),
                            capture_output=True, check=True, text=True, cwd=ROOT)
    return json.loads(output.stdout)


def compare(expected, actual, path):
    if isinstance(expected, dict):
        for key, value in expected.items():
            assert key in actual, f"{path}: missing {key}"
            compare(value, actual[key], f"{path}.{key}")
    elif isinstance(expected, list):
        assert len(expected) == len(actual), f"{path}: list lengths differ"
        for index, (left, right) in enumerate(zip(expected, actual)):
            compare(left, right, f"{path}[{index}]")
    elif isinstance(expected, (int, float)):
        assert isinstance(actual, (int, float)) and math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-9), (
            f"{path}: SQLite {expected!r}, browser {actual!r}"
        )
    else:
        assert expected == actual, f"{path}: SQLite {expected!r}, browser {actual!r}"


def main():
    dataset = ROOT / "data/college_town_home_sales.sqlite"
    with sqlite3.connect(f"{dataset.as_uri()}?mode=ro", uri=True) as db:
        db.row_factory = sqlite3.Row
        db.create_aggregate("median", 1, SqlMedian)
        counts = list(db.execute(f"""
            SELECT COUNT(*), SUM({SCOPED}), COUNT(DISTINCT {CITY}), COUNT(DISTINCT university)
            FROM home_sales
        """).fetchone())
        expected_fixed = fixed_reference(db)
        expected_dynamic = [dynamic_reference(db, question, params) for question, params in CASES]

    results = browser_answers()
    compare(counts, results["counts"], "source counts")
    for question, expected in expected_fixed.items():
        sort_key = "city" if "city" in expected[0] else "campus"
        actual = sorted(results["fixed"][question], key=lambda row: row[sort_key])
        compare(expected, actual, question)
    for (question, params), expected, actual in zip(CASES, expected_dynamic, results["dynamics"], strict=True):
        if question in (7, 8):
            actual = sorted(actual, key=lambda row: row["city"])
        compare(expected, actual, f"Q{question} {params}")
    print(f"PASS: {counts[0]:,} raw sales, {counts[1]:,} in scope, six fixed answers, and "
          f"{len(CASES)} dynamic scenarios match the independent SQLite calculations.")


if __name__ == "__main__":
    main()
