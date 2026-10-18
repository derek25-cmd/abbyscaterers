"""Use the latest trained models (ml-data/models/<latest run>/).

Check a quote against the client's price book (falls back to the market
median for the meal, or the menu-only model for a new client):
    ml/.venv/Scripts/python ml/use.py quote --client 000712 --meal "Breakfast+Lunch" --price 25000

Suggest dishes for an event:
    ml/.venv/Scripts/python ml/use.py menu --meal Lunch --price 12000 --pax 60 --client-type NGO
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from abby_ml import menu_model  # noqa: E402,F401  (needed to load the pickled rankers)
from abby_ml.data import DATA_DIR, price_band  # noqa: E402


def latest_run(data_dir: Path) -> Path:
    runs = sorted(p for p in (data_dir / "models").glob("*") if p.is_dir())
    if not runs:
        raise SystemExit("No trained model yet: run ml/train.py first.")
    return runs[-1]


def cmd_quote(a, run: Path) -> None:
    book = pd.read_csv(run / "price_book.csv", dtype={"client_id": str})
    row = book[(book.client_id == a.client) & (book.meal_sections == a.meal)]
    if len(row):
        r = row.iloc[0]
        expected, source = float(r.last_price), f"client's last price for {a.meal} ({int(r.events)} events, usual {r.median_price:,.0f})"
    else:
        all_meal = book[book.meal_sections == a.meal]
        if len(all_meal):
            expected, source = float(all_meal.last_price.median()), f"market median for {a.meal} (no history for this client and meal)"
        else:
            raise SystemExit(f"No events with meal sections '{a.meal}' yet.")
    gap = 1 - a.price / expected
    print(f"Quote {a.price:,.0f} (band {price_band(a.price)}) vs expected {expected:,.0f} (band {price_band(expected)})")
    print(f"  expected from: {source}")
    if gap >= 0.10:
        print(f"  FLAG: {gap:.0%} below expected - check before sending.")
    elif gap <= -0.10:
        print(f"  Note: {-gap:.0%} above expected.")
    else:
        print("  OK: within 10% of expected.")


def cmd_menu(a, run: Path) -> None:
    rankers = joblib.load(run / "menu_model.joblib")
    ctx = {"price_band": price_band(a.price), "meal_sections": a.meal, "client_type": a.client_type,
           "weekday_iso": a.weekday, "log_pax": float(np.log1p(a.pax))}
    for section, dishes in menu_model.suggest(rankers, ctx, k=a.k).items():
        print(f"{section}:")
        for dish, score in dishes:
            print(f"  {dish:35} {score:.0%}")


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=DATA_DIR)
    sub = ap.add_subparsers(dest="cmd", required=True)
    q = sub.add_parser("quote", help="check a quote against the price book")
    q.add_argument("--client", required=True, help="client_id, e.g. 000712")
    q.add_argument("--meal", required=True, help='meal sections as in the data, e.g. "Lunch" or "Breakfast+Lunch"')
    q.add_argument("--price", required=True, type=float, help="price per plate as quoted (VAT-inclusive)")
    m = sub.add_parser("menu", help="suggest dishes")
    m.add_argument("--meal", required=True)
    m.add_argument("--price", required=True, type=float)
    m.add_argument("--pax", type=int, default=50)
    m.add_argument("--client-type", default="Unknown")
    m.add_argument("--weekday", type=int, default=2, help="1 = Monday")
    m.add_argument("-k", type=int, default=8)
    a = ap.parse_args()
    run = latest_run(a.data_dir)
    print(f"(models from {run.name})")
    {"quote": cmd_quote, "menu": cmd_menu}[a.cmd](a, run)


if __name__ == "__main__":
    main()
