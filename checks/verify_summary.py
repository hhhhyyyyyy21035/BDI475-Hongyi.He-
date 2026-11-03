"""Independently verify browser data using SQL on the original SQLite file."""
import hashlib
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    data = json.loads((ROOT / "data/city_summary.json").read_text())
    db = sqlite3.connect(f"file:{ROOT / 'data/college_town_home_sales.sqlite'}?mode=ro", uri=True)
    source_count, distinct_ids = db.execute(
        "SELECT COUNT(*), COUNT(DISTINCT listing_id) FROM home_sales"
    ).fetchone()
    assert source_count == distinct_ids == data["source_count"]
    eligible_count, overall_median = db.execute("""
        WITH ranked AS (
            SELECT sale_price, ROW_NUMBER() OVER (ORDER BY sale_price) AS rn,
                   COUNT(*) OVER () AS n
            FROM home_sales WHERE sale_price >= 1000
        )
        SELECT MAX(n), AVG(sale_price) FROM ranked
        WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
    """).fetchone()
    assert eligible_count == data["eligible_count"]
    assert overall_median == data["median"]
    assert source_count - eligible_count == data["excluded_count"]
    sql_cities = db.execute("""
        WITH ranked AS (
            SELECT city, state, sale_price,
                   ROW_NUMBER() OVER (PARTITION BY city, state ORDER BY sale_price) AS rn,
                   COUNT(*) OVER (PARTITION BY city, state) AS n
            FROM home_sales WHERE sale_price >= 1000
        )
        SELECT city, state, MAX(n), AVG(sale_price) FROM ranked
        WHERE rn IN ((n + 1) / 2, (n + 2) / 2)
        GROUP BY city, state ORDER BY city, state
    """).fetchall()
    assert len(sql_cities) == len(data["cities"])
    for city, state, count, midpoint in sql_cities:
        actual = next(item for item in data["cities"] if (item["city"], item["state"]) == (city, state))
        assert (actual["count"], actual["median"]) == (count, midpoint), (city, state)
        expected_prices = [r[0] for r in db.execute(
            "SELECT sale_price FROM home_sales WHERE city=? AND state=? AND sale_price>=1000 ORDER BY sale_price",
            (city, state),
        )]
        assert actual["prices"] == expected_prices, (city, state, "prices")
        raw_count = db.execute("SELECT COUNT(*) FROM home_sales WHERE city=? AND state=?", (city, state)).fetchone()[0]
        assert actual["source_count"] == raw_count
        assert actual["excluded_count"] == raw_count - count
    assert hashlib.sha256((ROOT / data["source"]).read_bytes()).hexdigest() == data["source_sha256"]
    print(f"PASS: original rows {source_count:,}; eligible {eligible_count:,}; excluded {source_count - eligible_count}; "
          f"overall median ${overall_median:,.2f}; all {len(sql_cities)} city counts, medians and complete price lists match SQLite.")
    db.close()


if __name__ == "__main__":
    main()
