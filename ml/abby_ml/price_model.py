"""Menu-only price band model: the price check for a NEW client.

Inputs: meal sections, dishes, dishes per day, pax, client type, weekday.
The client's identity is not an input, so the model learns "what this menu
usually costs". For clients with history, abby_ml.price_book is far better
(prices are negotiated per client); this model is the fallback.

Evaluation: grouped cross-validation by client (a client's events are all
in training or all in testing), against a baseline that predicts the most
common band for the meal sections.
"""
from __future__ import annotations

import numpy as np
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import FunctionTransformer, OneHotEncoder, StandardScaler

from .data import BAND_LABELS

NUMERIC = ["log_pax", "dishes_per_day", "menu_days", "events_in_order",
           "n_breakfast", "n_lunch", "n_brunch", "n_evening_tea", "n_dinner", "n_cocktail"]
CATEGORICAL = ["meal_sections", "client_type", "weekday_iso"]


def _split_pipe(s: str) -> list[str]:
    return [t for t in s.split("|") if t]


def _to_dense(X) -> np.ndarray:
    # Module-level (not a lambda) so a fitted model can be saved with joblib.
    return np.asarray(X, dtype=float)


def _features(min_dish_events: int) -> ColumnTransformer:
    return ColumnTransformer([
        ("num", StandardScaler(), NUMERIC),
        ("cat", OneHotEncoder(handle_unknown="ignore", min_frequency=3), CATEGORICAL),
        ("dishes", CountVectorizer(tokenizer=_split_pipe, token_pattern=None, lowercase=False,
                                   binary=True, min_df=min_dish_events), "dish_keys"),
    ], sparse_threshold=0.0)


def make_models(min_dish_events: int = 10) -> dict[str, Pipeline]:
    dense = FunctionTransformer(_to_dense)
    return {
        "logistic": Pipeline([
            ("features", _features(min_dish_events)),
            ("clf", LogisticRegression(max_iter=3000, C=0.5, class_weight="balanced")),
        ]),
        "gradient_boosting": Pipeline([
            ("features", _features(min_dish_events)),
            ("dense", dense),
            ("clf", HistGradientBoostingClassifier(max_iter=250, learning_rate=0.06, max_leaf_nodes=15,
                                                   l2_regularization=1.0, random_state=0)),
        ]),
    }


def _band_index(labels) -> np.ndarray:
    pos = {b: i for i, b in enumerate(BAND_LABELS)}
    return np.array([pos[b] for b in labels])


def _scores(y_true, y_pred) -> dict[str, float]:
    t, p = _band_index(y_true), _band_index(y_pred)
    return {
        "accuracy": float(np.mean(t == p)),
        "within_one_band": float(np.mean(np.abs(t - p) <= 1)),
        "mean_band_error": float(np.mean(np.abs(t - p))),
    }


def _baseline_predict(train: pd.DataFrame, test: pd.DataFrame) -> np.ndarray:
    overall = train["price_band"].mode().iloc[0]
    by_sections = train.groupby("meal_sections")["price_band"].agg(lambda s: s.mode().iloc[0])
    return test["meal_sections"].map(by_sections).fillna(overall).to_numpy()


def evaluate(events: pd.DataFrame, n_splits: int = 5) -> dict:
    """Grouped CV by client. Returns scores per model and out-of-fold predictions."""
    X, y, groups = events, events["price_band"].to_numpy(), events["client_id"].to_numpy()
    cv = GroupKFold(n_splits=n_splits)
    oof = {name: np.empty(len(events), dtype=object) for name in ["baseline", *make_models()]}
    proba = {name: np.zeros((len(events), len(BAND_LABELS))) for name in make_models()}
    for train_idx, test_idx in cv.split(X, y, groups):
        train, test = events.iloc[train_idx], events.iloc[test_idx]
        oof["baseline"][test_idx] = _baseline_predict(train, test)
        for name, model in make_models().items():
            model.fit(train, train["price_band"])
            oof[name][test_idx] = model.predict(test)
            p = model.predict_proba(test)
            for j, cls in enumerate(model.classes_):
                proba[name][test_idx, BAND_LABELS.index(cls)] = p[:, j]
    scores = {name: _scores(y, pred) for name, pred in oof.items()}
    best = max((n for n in scores if n != "baseline"), key=lambda n: (scores[n]["accuracy"], scores[n]["within_one_band"]))
    return {"scores": scores, "best": best, "oof": oof, "proba": proba}


def fit_final(events: pd.DataFrame, name: str) -> Pipeline:
    model = make_models()[name]
    model.fit(events, events["price_band"])
    return model

