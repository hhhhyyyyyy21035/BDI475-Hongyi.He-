"""Create browser data from the untouched CSV. Uses the Python standard library only."""
import csv
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from statistics import median

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "data/college_town_home_sales.csv"
OUTPUT = ROOT / "data/city_summary.json"
PRICE_FLOOR = 1000


def main():
    groups = defaultdict(lambda: {"source_count": 0, "prices": []})
    seen = set()
    with SOURCE.open(newline="", encoding="utf-8-sig") as stream:
        # DictReader preserves identifiers, ZIP codes, FIPS and parcel numbers as text.
        for row in csv.DictReader(stream):
            key = row["listing_id"]
            if not key or key in seen:
                raise ValueError(f"Missing or duplicate listing_id: {key!r}")
            seen.add(key)
            group = groups[(row["city"], row["state"])]
            group["source_count"] += 1
            try:
                price = float(row["sale_price"])
            except (ValueError, TypeError):
                continue
            if math.isfinite(price) and price >= PRICE_FLOOR:
                group["prices"].append(int(price) if price.is_integer() else price)
    cities = []
    for (city, state), group in sorted(groups.items()):
        prices = sorted(group["prices"])
        cities.append({
            "city": city, "state": state, "source_count": group["source_count"],
            "count": len(prices), "excluded_count": group["source_count"] - len(prices),
            "median": median(prices) if prices else None, "prices": prices,
        })
    all_prices = [p for city in cities for p in city["prices"]]
    result = {
        "source": "data/college_town_home_sales.csv", "collection": "March 2026",
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "price_floor": PRICE_FLOOR, "source_count": len(seen),
        "eligible_count": len(all_prices), "excluded_count": len(seen) - len(all_prices),
        "median": median(all_prices) if all_prices else None, "cities": cities,
    }
    OUTPUT.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {OUTPUT.relative_to(ROOT)}: {len(seen):,} source rows; "
          f"{len(all_prices):,} eligible; {len(cities)} cities; median ${result['median']:,.2f}")


if __name__ == "__main__":
    main()
