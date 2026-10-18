"""Price check from each client's own price history (the "price book").

Finding (2026-10-18 data): prices are set per client, not by the menu. With
a client's events held out, menu models barely beat "the median price for
those meal sections"; but 94% of events come from clients seen before, and
their own last price for the same meal sections predicts the price within
~8% (band exact 86%).

Expected price for an event, from events on EARLIER dates only:
  1. the client's last price for the same meal sections;
  2. else the client's usual ratio to the market median x the median for
     those meal sections;
  3. else (new client) the median for those meal sections.
A quote is flagged when it is at least `threshold` below the expected price
and the expectation comes from the client's own history (1 or 2).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .data import BAND_LABELS, price_band


def expected_prices(events: pd.DataFrame) -> pd.DataFrame:
    """Leak-free expected price for every event (uses only earlier dates)."""
    ev = events.sort_values(["event_date", "event_id"]).reset_index(drop=True)
    exp = np.full(len(ev), np.nan)
    source = np.empty(len(ev), dtype=object)
    history_n = np.zeros(len(ev), dtype=int)
    dates = ev["event_date"].to_numpy()
    for i, r in enumerate(ev.itertuples()):
        prior = ev[dates < r.event_date]
        if prior.empty:
            source[i] = "none"
            continue
        sec_med = prior.groupby("meal_sections")["unit_price"].median()
        market = float(sec_med.get(r.meal_sections, prior["unit_price"].median()))
        pc = prior[prior["client_id"] == r.client_id]
        history_n[i] = len(pc)
        same = pc[pc["meal_sections"] == r.meal_sections]
        if len(same):
            exp[i], source[i] = float(same["unit_price"].iloc[-1]), "client, same meal"
        elif len(pc):
            ratio = float((pc["unit_price"] / pc["meal_sections"].map(sec_med).fillna(prior["unit_price"].median())).median())
            exp[i], source[i] = market * ratio, "client, other meals"
        else:
            exp[i], source[i] = market, "market median"
    ev["expected_price"] = exp
    ev["expected_from"] = source
    ev["client_prior_events"] = history_n
    return ev


def evaluate(scored: pd.DataFrame, since: pd.Timestamp | None = None) -> dict:
    """Scores of the price book vs the market-median baseline on events after `since`."""
    df = scored[scored["expected_price"].notna()]
    if since is not None:
        df = df[df["event_date"] > since]
    idx = {b: i for i, b in enumerate(BAND_LABELS)}
    t_band = df["price_band"].map(idx).to_numpy()
    out = {}
    for name, pred in (("market median (baseline)", df["market_median"]), ("price book", df["expected_price"])):
        p_band = np.array([idx[price_band(x)] for x in pred])
        err = np.abs(pred.to_numpy() - df["unit_price"].to_numpy())
        out[name] = {
            "events": int(len(df)),
            "band_exact": float(np.mean(t_band == p_band)),
            "within_one_band": float(np.mean(np.abs(t_band - p_band) <= 1)),
            "mae_tzs": float(err.mean()),
            "mape": float(np.mean(err / df["unit_price"].to_numpy())),
        }
    out["coverage_client_history"] = float(df["expected_from"].str.startswith("client").mean())
    return out


def add_market_median(scored: pd.DataFrame) -> pd.DataFrame:
    """Baseline: median price for the meal sections, from earlier dates only."""
    ev = scored.copy()
    dates = ev["event_date"].to_numpy()
    mm = np.full(len(ev), np.nan)
    for i, r in enumerate(ev.itertuples()):
        prior = ev[dates < r.event_date]
        if len(prior):
            mm[i] = float(prior.groupby("meal_sections")["unit_price"].median().get(r.meal_sections, prior["unit_price"].median()))
    ev["market_median"] = mm
    return ev


def quote_flags(scored: pd.DataFrame, threshold: float = 0.10) -> pd.DataFrame:
    """Events priced at least `threshold` below the client's own usual price."""
    df = scored[scored["expected_from"].str.startswith("client", na=False)].copy()
    df["below_expected_pct"] = 1 - df["unit_price"] / df["expected_price"]
    df = df[df["below_expected_pct"] >= threshold]
    cols = ["event_id", "order_id", "client_id", "event_date", "meal_sections", "pax", "unit_price",
            "expected_price", "expected_from", "below_expected_pct", "client_prior_events"]
    return df[cols].round({"expected_price": 0, "below_expected_pct": 3}).sort_values("below_expected_pct", ascending=False)


def current_book(events: pd.DataFrame) -> pd.DataFrame:
    """Today's price book: per client and meal sections, the last and usual price."""
    ev = events.sort_values("event_date")
    g = ev.groupby(["client_id", "meal_sections"])
    book = g.agg(events=("event_id", "count"), last_price=("unit_price", "last"), median_price=("unit_price", "median"),
                 min_price=("unit_price", "min"), max_price=("unit_price", "max"), last_event=("event_date", "max"))
    return book.reset_index().sort_values(["client_id", "meal_sections"])
