"""Cost per plate from daily Stock Out (Dar es Salaam).

The kitchen issues ingredients on the day of the event (daily Stock Out
value vs plates served the same day: r = 0.73). So each day,

    Stock Out value  ~=  sum over dishes ( plates of the dish x cost per plate of the dish )

A non-negative ridge regression on the days with both Stock Out and menus
estimates the cost per plate of each frequent dish; rarer dishes are pooled
per meal section ("other <section> dish"). The same fit on one product's
daily quantity gives that product's quantity per plate of each dish (the
"observed recipe").

Evaluation: time-ordered cross-validation (train on earlier days, test on
later ones), against a baseline of one average cost per plate.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.model_selection import TimeSeriesSplit

from .data import DailyKitchen


def design_matrix(plates: pd.DataFrame, dish_sections: dict[str, str], top_n: int = 40) -> pd.DataFrame:
    """Plates per day for the top_n dishes; the rest pooled per meal section."""
    totals = plates.sum().sort_values(ascending=False)
    keep = list(totals.index[:top_n])
    X = plates[keep].copy()
    rest = plates.drop(columns=keep)
    for section in sorted({dish_sections.get(d, "Other") for d in rest.columns}):
        cols = [d for d in rest.columns if dish_sections.get(d, "Other") == section]
        X[f"other {section.lower()} dish"] = rest[cols].sum(axis=1)
    return X


def _fit(X: pd.DataFrame, y: pd.Series, alpha: float) -> Ridge:
    # Scale to "per 100 plates" so alpha means the same across datasets.
    model = Ridge(alpha=alpha, positive=True, fit_intercept=False, solver="lbfgs", max_iter=5000)
    model.fit(X.to_numpy() / 100.0, y.to_numpy())
    return model


def _per_plate(model: Ridge, columns) -> pd.Series:
    return pd.Series(model.coef_ / 100.0, index=columns)


def evaluate(X: pd.DataFrame, y: pd.Series, alphas=(1.0, 10.0, 100.0), n_splits: int = 5) -> dict:
    """MAE and MAPE of the daily value on later days, model vs one-average baseline."""
    cv = TimeSeriesSplit(n_splits=n_splits)
    res = {"baseline": [], **{f"ridge_alpha_{a:g}": [] for a in alphas}}
    for tr, te in cv.split(X):
        Xtr, Xte, ytr, yte = X.iloc[tr], X.iloc[te], y.iloc[tr], y.iloc[te]
        per_plate = ytr.sum() / Xtr.to_numpy().sum()
        res["baseline"].append((yte, Xte.to_numpy().sum(axis=1) * per_plate))
        for a in alphas:
            m = _fit(Xtr, ytr, a)
            res[f"ridge_alpha_{a:g}"].append((yte, m.predict(Xte.to_numpy() / 100.0)))
    scores = {}
    for name, parts in res.items():
        t = np.concatenate([p[0].to_numpy() for p in parts])
        p = np.concatenate([p[1] for p in parts])
        scores[name] = {
            "mae_tzs": float(np.mean(np.abs(t - p))),
            "mape": float(np.mean(np.abs(t - p) / np.maximum(t, 1.0))),
            "r2": float(1 - np.sum((t - p) ** 2) / np.sum((t - t.mean()) ** 2)),
        }
    best = min((n for n in scores if n != "baseline"), key=lambda n: scores[n]["mae_tzs"])
    return {"scores": scores, "best": best, "best_alpha": float(best.rsplit("_", 1)[1])}


def dish_cost_per_plate(X: pd.DataFrame, y: pd.Series, alpha: float) -> pd.Series:
    return _per_plate(_fit(X, y, alpha), X.columns).sort_values(ascending=False)


def observed_recipes(kitchen: DailyKitchen, X: pd.DataFrame, alpha: float, top_products: int = 25,
                     min_qty_per_100: float = 0.05) -> pd.DataFrame:
    """Quantity of each top product used per plate of each dish, with how well
    the dishes explain that product's daily use (r2 on later days)."""
    rows = []
    for product_id in kitchen.products.index[:top_products]:
        if product_id not in kitchen.stock_qty.columns:
            continue
        y = kitchen.stock_qty[product_id]
        if (y > 0).sum() < 20:
            continue
        r2 = evaluate(X, y, alphas=(alpha,))["scores"][f"ridge_alpha_{alpha:g}"]["r2"]
        coef = _per_plate(_fit(X, y, alpha), X.columns)
        info = kitchen.products.loc[product_id]
        for dish, q in coef.items():
            if q * 100 >= min_qty_per_100:
                rows.append({"product_id": product_id, "product": info["product_name"], "unit": info["product_unit"],
                             "dish": dish, "qty_per_plate": round(float(q), 4),
                             "qty_per_100_plates": round(float(q * 100), 2), "fit_r2_later_days": round(r2, 2)})
    return pd.DataFrame(rows).sort_values(["product", "qty_per_plate"], ascending=[True, False]) if rows else pd.DataFrame()


def event_costs(events: pd.DataFrame, dishes: pd.DataFrame, per_plate: pd.Series, top_dishes: list[str],
                dish_sections: dict[str, str]) -> pd.DataFrame:
    """Estimated ingredient cost per plate and margin for each event, from its menu."""
    def dish_cost(d: str) -> float:
        if d in top_dishes:
            return float(per_plate.get(d, 0.0))
        return float(per_plate.get(f"other {dish_sections.get(d, 'Other').lower()} dish", 0.0))

    cost = dishes.assign(c=dishes["dish_key"].map(dish_cost)).groupby("event_id")["c"].sum()
    out = events.set_index("event_id").join(cost.rename("est_cost_per_plate"), how="inner")
    out["price_per_plate_ex_vat"] = out["price_per_plate_ex_vat"].astype(float)
    out["est_margin_per_plate"] = out["price_per_plate_ex_vat"] - out["est_cost_per_plate"]
    out["est_food_cost_pct"] = out["est_cost_per_plate"] / out["price_per_plate_ex_vat"]
    cols = ["order_id", "client_id", "event_date", "branch", "meal_sections", "pax", "price_per_plate_ex_vat",
            "est_cost_per_plate", "est_margin_per_plate", "est_food_cost_pct"]
    return out[cols].round({"est_cost_per_plate": 0, "est_margin_per_plate": 0, "est_food_cost_pct": 3}).reset_index()
