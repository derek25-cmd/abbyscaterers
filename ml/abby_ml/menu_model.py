"""Menu suggestion: rank the dishes to offer for an event, per meal section.

Context: price band, meal sections, pax, client type, weekday. For each
section (Breakfast, Lunch, ...) a model scores every dish that section has
served often enough, and the top k are suggested.

Three rankers are compared, with grouped cross-validation by client:
  popularity       most served dishes in the section (baseline)
  band_popularity  most served dishes in the section at that price band
  logistic         one logistic model per dish on the context
Metric: of the dishes actually served in a section, how many are in the top
k suggestions (recall@k), and how many of the top k were served (precision@k).
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.multiclass import OneVsRestClassifier
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

CONTEXT_CAT = ["price_band", "meal_sections", "client_type", "weekday_iso"]
CONTEXT_NUM = ["log_pax"]


def _context_pipeline() -> ColumnTransformer:
    return ColumnTransformer([
        ("cat", OneHotEncoder(handle_unknown="ignore", min_frequency=3), CONTEXT_CAT),
        ("num", StandardScaler(), CONTEXT_NUM),
    ])


@dataclass
class SectionRanker:
    section: str
    dishes: list[str]
    popularity: pd.Series                     # dish -> share of events
    band_popularity: dict[str, pd.Series] = field(default_factory=dict)
    model: Pipeline | None = None

    def scores(self, ctx: pd.DataFrame, method: str) -> np.ndarray:
        """Rows = ctx rows, columns = self.dishes."""
        if method == "popularity":
            return np.tile(self.popularity.reindex(self.dishes).fillna(0).to_numpy(), (len(ctx), 1))
        if method == "band_popularity":
            base = self.popularity.reindex(self.dishes).fillna(0).to_numpy()
            rows = []
            for band in ctx["price_band"]:
                bp = self.band_popularity.get(band)
                # Shrink the band's shares toward the section's when the band has few events.
                rows.append(base if bp is None else 0.8 * bp.reindex(self.dishes).fillna(0).to_numpy() + 0.2 * base)
            return np.vstack(rows)
        if method == "logistic":
            return self.model.predict_proba(ctx)
        raise ValueError(method)


def _fit_section(events: pd.DataFrame, dishes: pd.DataFrame, section: str, min_events: int) -> SectionRanker | None:
    sec = dishes[dishes["meal_section"] == section]
    ev = events[events["event_id"].isin(sec["event_id"])]
    if len(ev) < 20:
        return None
    counts = sec.groupby("dish_key")["event_id"].nunique()
    keep = sorted(counts[counts >= min_events].index)
    if len(keep) < 5:
        return None
    Y = (
        sec[sec["dish_key"].isin(keep)]
        .assign(v=1)
        .pivot_table(index="event_id", columns="dish_key", values="v", aggfunc="max", fill_value=0)
        .reindex(index=ev["event_id"], columns=keep, fill_value=0)
    )
    popularity = Y.mean()
    band_pop = {b: Y.loc[ev.loc[ev["price_band"] == b, "event_id"]].mean()
                for b in ev["price_band"].unique() if (ev["price_band"] == b).sum() >= 10}
    model = Pipeline([
        ("ctx", _context_pipeline()),
        ("clf", OneVsRestClassifier(LogisticRegression(max_iter=2000, C=0.5))),
    ])
    # A dish served at every event of the fold (or none) cannot be learned per dish:
    # those columns fall back to their popularity.
    model.fit(ev.set_index("event_id").loc[Y.index], Y.to_numpy())
    return SectionRanker(section, keep, popularity, band_pop, model)


def fit(events: pd.DataFrame, dishes: pd.DataFrame, min_events: int = 8) -> dict[str, SectionRanker]:
    out = {}
    for section in dishes["meal_section"].dropna().unique():
        r = _fit_section(events, dishes, section, min_events)
        if r is not None:
            out[section] = r
    return out


def _rank_metrics(scores: np.ndarray, dishes: list[str], served: list[set[str]], k: int) -> tuple[float, float]:
    rec, prec = [], []
    top = np.argsort(-scores, axis=1)[:, :k]
    for row, actual in zip(top, served):
        if not actual:
            continue
        hits = len({dishes[j] for j in row} & actual)
        rec.append(hits / len(actual))
        prec.append(hits / k)
    return (float(np.mean(rec)) if rec else float("nan"), float(np.mean(prec)) if prec else float("nan"))


def evaluate(events: pd.DataFrame, dishes: pd.DataFrame, n_splits: int = 5, ks=(5, 10)) -> pd.DataFrame:
    """Grouped CV by client; one row per section, method and k."""
    rows = []
    cv = GroupKFold(n_splits=n_splits)
    for train_idx, test_idx in cv.split(events, groups=events["client_id"]):
        tr, te = events.iloc[train_idx], events.iloc[test_idx]
        rankers = fit(tr, dishes[dishes["event_id"].isin(tr["event_id"])])
        te_dishes = dishes[dishes["event_id"].isin(te["event_id"])]
        for section, r in rankers.items():
            sec = te_dishes[te_dishes["meal_section"] == section]
            ctx = te[te["event_id"].isin(sec["event_id"])].set_index("event_id", drop=False)
            if ctx.empty:
                continue
            served = [set(sec.loc[sec["event_id"] == e, "dish_key"]) for e in ctx.index]
            for method in ("popularity", "band_popularity", "logistic"):
                s = r.scores(ctx, method)
                for k in ks:
                    rec, prec = _rank_metrics(s, r.dishes, served, k)
                    rows.append({"section": section, "method": method, "k": k, "events": len(ctx),
                                 "recall": rec, "precision": prec})
    df = pd.DataFrame(rows)
    # Weight each fold by its number of events.
    agg = (df.assign(wr=df.recall * df.events, wp=df.precision * df.events)
             .groupby(["section", "method", "k"], as_index=False)[["wr", "wp", "events"]].sum())
    agg["recall"] = agg.wr / agg.events
    agg["precision"] = agg.wp / agg.events
    return agg.drop(columns=["wr", "wp"])


def suggest(rankers: dict[str, SectionRanker], context: dict, method: str = "logistic", k: int = 8) -> dict[str, list[tuple[str, float]]]:
    """Suggested dishes per section for one event context, e.g.
    {"price_band": "C 11-15k", "meal_sections": "Lunch", "client_type": "NGO",
     "weekday_iso": 2, "log_pax": np.log1p(60)}."""
    ctx = pd.DataFrame([context])
    out = {}
    for section in str(context.get("meal_sections", "")).split("+"):
        r = rankers.get(section)
        if r is None:
            continue
        s = r.scores(ctx, method)[0]
        order = np.argsort(-s)[:k]
        out[section] = [(r.dishes[j], round(float(s[j]), 3)) for j in order]
    return out
