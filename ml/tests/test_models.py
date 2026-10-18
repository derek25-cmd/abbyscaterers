"""Tests on small synthetic data (no business data needed)."""
import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from abby_ml import cost_model, price_book  # noqa: E402
from abby_ml.data import _read, price_band  # noqa: E402


def test_price_band_edges():
    assert price_band(4800) == "A <6k"
    assert price_band(6000) == "B 6-11k"
    assert price_band(12000) == "C 11-15k"
    assert price_band(35000) == "F 30k+"
    assert price_band(float("nan")) is None


def test_booleans_from_psql_and_editor(tmp_path):
    pd.DataFrame({"flag_a": ["t", "f", "true", "false", ""], "x": [1, 2, 3, 4, 5]}).to_csv(tmp_path / "f.csv", index=False)
    df = _read("f.csv", tmp_path)
    assert df["flag_a"].tolist() == [True, False, True, False, False]


def _events(rows):
    df = pd.DataFrame(rows, columns=["event_id", "client_id", "event_date", "meal_sections", "unit_price"])
    df["event_date"] = pd.to_datetime(df["event_date"])
    df["price_band"] = df["unit_price"].map(price_band)
    df["order_id"] = "ORD"
    df["pax"] = 10
    return df


def test_price_book_uses_only_earlier_events():
    ev = _events([
        ("E1", "c1", "2026-01-01", "Lunch", 12000),
        ("E2", "c1", "2026-01-05", "Lunch", 15000),
        ("E3", "c1", "2026-01-09", "Lunch", 15000),
        ("E4", "c2", "2026-01-09", "Lunch", 10000),
    ])
    s = price_book.expected_prices(ev).set_index("event_id")
    assert s.loc["E1", "expected_from"] == "none"            # nothing earlier
    assert s.loc["E2", "expected_price"] == 12000            # E2 itself not used
    assert s.loc["E3", "expected_price"] == 15000            # last price
    assert s.loc["E4", "expected_from"] == "market median"   # new client


def test_quote_flags_only_with_client_history():
    ev = _events([
        ("E1", "c1", "2026-01-01", "Lunch", 12000),
        ("E2", "c1", "2026-01-05", "Lunch", 9000),    # 25% below the client's last price
        ("E3", "c2", "2026-01-06", "Lunch", 5000),    # new client: never flagged
    ])
    flags = price_book.quote_flags(price_book.expected_prices(ev))
    assert flags["event_id"].tolist() == ["E2"]
    assert abs(flags["below_expected_pct"].iloc[0] - 0.25) < 1e-9


def test_cost_model_recovers_known_cost_per_plate():
    rng = np.random.default_rng(0)
    days = pd.date_range("2026-04-01", periods=120)
    plates = pd.DataFrame({"fish": rng.integers(0, 300, 120), "rice": rng.integers(50, 600, 120),
                           "salad": rng.integers(50, 600, 120)}, index=days).astype(float)
    true = {"fish": 1200.0, "rice": 400.0, "salad": 150.0}
    value = sum(plates[d] * c for d, c in true.items()) * rng.normal(1, 0.05, 120)
    est = cost_model.dish_cost_per_plate(plates, pd.Series(value, index=days), alpha=1.0)
    for d, c in true.items():
        assert abs(est[d] - c) / c < 0.1, (d, est[d])
