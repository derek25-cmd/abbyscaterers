"""Loading and preparing the ML datasets (the CSV exports in ml-data/).

The exports come from supabase/exports/*.sql, run in the Supabase SQL Editor
or with psql --csv. Booleans arrive as t/f (psql) or true/false (editor);
both are accepted. Nothing here connects to a database.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "ml-data"

_BOOL = {"t": True, "true": True, "1": True, "f": False, "false": False, "0": False}

# Price bands on the price per plate as entered (VAT-inclusive for 1,280 of
# 1,286 events). The menu prices are list prices (12,000; 8,000; 35,000 ...),
# and each band holds a group of them.
PRICE_BANDS = [
    (0, 6_000, "A <6k"),
    (6_000, 11_000, "B 6-11k"),
    (11_000, 15_000, "C 11-15k"),
    (15_000, 22_000, "D 15-22k"),
    (22_000, 30_000, "E 22-30k"),
    (30_000, float("inf"), "F 30k+"),
]
BAND_LABELS = [b[2] for b in PRICE_BANDS]

MEAL_SECTIONS = ["Breakfast", "Lunch", "Brunch", "Evening Tea", "Dinner", "Cocktail"]

# Events far below any list price are typing errors (e.g. 130 for 13,000).
MIN_PLAUSIBLE_PRICE = 1_000


def _read(name: str, data_dir: Path | None = None) -> pd.DataFrame:
    path = (data_dir or DATA_DIR) / name
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Export it with supabase/exports/ (see ml/README.md)."
        )
    df = pd.read_csv(path, low_memory=False)
    for col in df.columns:
        if col.startswith("flag_") or col.startswith("is_") or col.startswith("link_"):
            df[col] = df[col].astype(str).str.strip().str.lower().map(_BOOL).fillna(False).astype(bool)
    return df


def price_band(price: float) -> str | None:
    if price is None or not np.isfinite(price):
        return None
    for lo, hi, label in PRICE_BANDS:
        if lo <= price < hi:
            return label
    return None


def load_dish_aliases(data_dir: Path | None = None) -> dict[str, str]:
    """Optional ml-data/dish_aliases.csv (columns dish_key, canonical): merges
    dishes that are the same (e.g. 'fruits' -> 'fruits cuts')."""
    path = (data_dir or DATA_DIR) / "dish_aliases.csv"
    if not path.exists():
        return {}
    df = pd.read_csv(path)
    return {str(a).strip().lower(): str(c).strip().lower() for a, c in zip(df["dish_key"], df["canonical"])}


def _canon(keys: pd.Series, aliases: dict[str, str]) -> pd.Series:
    keys = keys.fillna("").astype(str).str.strip().str.lower()
    return keys.map(lambda k: aliases.get(k, k)) if aliases else keys


@dataclass
class EventMenus:
    """One row per usable event with a posted menu (ml_event_menus.csv)."""
    events: pd.DataFrame          # one row per event, with price_band and features
    dishes: pd.DataFrame          # event_id, meal_section, dish_key (one row per dish on the menu)


def load_event_menus(data_dir: Path | None = None) -> EventMenus:
    em = _read("ml_event_menus.csv", data_dir)
    usable = (
        ~em["flag_cancelled"]
        & ~em["flag_zero_price"]
        & ~em["flag_bad_pax"]
        & ~em["flag_date_unreadable"]
        & (em["unit_price"] >= MIN_PLAUSIBLE_PRICE)
    )
    ev = em[usable].copy()
    ev["event_date"] = pd.to_datetime(ev["event_date"])
    ev["price_band"] = ev["unit_price"].map(price_band)
    ev["client_id"] = ev["client_id"].fillna("unknown").astype(str)
    ev["client_type"] = ev["client_type"].fillna("Unknown").replace({"Government": "Governmental"})
    ev["meal_sections"] = ev["meal_sections"].fillna("")
    ev["log_pax"] = np.log1p(ev["pax"].astype(float))
    aliases = load_dish_aliases(data_dir)
    ev["dish_keys"] = ev["dish_keys"].fillna("").map(
        lambda s: "|".join(sorted({aliases.get(k, k) for k in s.split("|") if k}))
    )

    ds = _read("ml_dishes_served.csv", data_dir)
    ds = ds[ds["event_id"].isin(ev["event_id"]) & ds["meal_section"].notna()].copy()
    ds["dish_key"] = _canon(ds["dish_key"], aliases)
    ds = ds[ds["dish_key"] != ""].drop_duplicates(["event_id", "meal_section", "dish_key"])
    return EventMenus(events=ev.reset_index(drop=True), dishes=ds[["event_id", "meal_section", "dish_key"]].reset_index(drop=True))


@dataclass
class DailyKitchen:
    """Dar es Salaam days with both Stock Out and posted menus."""
    plates: pd.DataFrame      # index date, columns dish_key -> plates served
    stock_value: pd.Series    # index date -> TZS issued (Stock Out, Internal Use)
    stock_qty: pd.DataFrame   # index date, columns product_id -> quantity issued
    products: pd.DataFrame    # product_id -> product_name, product_unit


def load_daily_kitchen(branch: str = "Dar es Salaam", data_dir: Path | None = None) -> DailyKitchen:
    aliases = load_dish_aliases(data_dir)
    dp = _read("ml_daily_dish_plates.csv", data_dir)
    dp = dp[dp["branch"] == branch].copy()
    dp["dish_key"] = _canon(dp["dish_key"], aliases)
    dp["menu_date"] = pd.to_datetime(dp["menu_date"])
    plates = dp.pivot_table(index="menu_date", columns="dish_key", values="plates", aggfunc="sum", fill_value=0)

    sm = _read("ml_stock_movements.csv", data_dir)
    so = sm[(sm["type"] == "Stock Out") & (sm["branch"] == branch) & (sm["reason"] == "Internal Use")].copy()
    so["date"] = pd.to_datetime(so["date"])
    so = so[so["product_id"].notna()]
    value = so.groupby("date")["line_value"].sum()
    qty = so.pivot_table(index="date", columns="product_id", values="quantity", aggfunc="sum", fill_value=0)
    products = (
        so.sort_values("date")
        .groupby("product_id")
        .agg(product_name=("product_name", "last"), product_unit=("product_unit", "last"), value=("line_value", "sum"))
        .sort_values("value", ascending=False)
    )

    days = plates.index.intersection(value.index).sort_values()
    return DailyKitchen(
        plates=plates.loc[days],
        stock_value=value.loc[days],
        stock_qty=qty.reindex(days, fill_value=0),
        products=products,
    )
