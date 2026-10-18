"""Train and evaluate the Abby's Caterers models on the CSVs in ml-data/.

    ml/.venv/Scripts/python ml/train.py            (Windows, Git Bash)

Each run writes ml-data/models/<timestamp>/ (gitignored: business data):
    report.md                 what was trained, on what data, and how well
    price_book.csv            each client's last / usual price per meal sections
    quote_flags.csv           events priced 10%+ below the client's own usual price
    price_model.joblib        menu-only price band model (new clients)
    menu_model.joblib         menu suggestion rankers
    dish_cost_per_plate.csv   estimated ingredient cost per plate, per dish
    observed_recipes.csv      quantity per plate of the top products, per dish
    event_costs.csv           estimated food cost and margin per event
and appends one line to ml-data/models/history.csv, so retraining on newer or
cleaner exports can be compared with earlier runs.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from abby_ml import cost_model, menu_model, price_book, price_model  # noqa: E402
from abby_ml.data import DATA_DIR, load_daily_kitchen, load_event_menus  # noqa: E402


def pct(x: float) -> str:
    return f"{x * 100:.0f}%"


def main() -> None:
    # Windows consoles default to cp1252; the report has non-ASCII (≥, →).
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", type=Path, default=DATA_DIR)
    ap.add_argument("--note", default="", help="free text stored with the run, e.g. 'after kitchen mapping'")
    args = ap.parse_args()

    run_id = datetime.now().strftime("%Y-%m-%d_%H%M")
    out = args.data_dir / "models" / run_id
    out.mkdir(parents=True, exist_ok=True)
    report: list[str] = [f"# Model run {run_id}", ""]
    if args.note:
        report += [f"Note: {args.note}", ""]

    # ── Data ────────────────────────────────────────────────────────────────
    em = load_event_menus(args.data_dir)
    ev, dishes = em.events, em.dishes
    kitchen = load_daily_kitchen(data_dir=args.data_dir)
    report += [
        "## Data", "",
        f"- Events with a menu and a usable price: **{len(ev):,}** "
        f"({ev.event_date.min():%Y-%m-%d} to {ev.event_date.max():%Y-%m-%d}), "
        f"{ev.client_id.nunique()} clients, {dishes.dish_key.nunique()} distinct dishes",
        f"- Price bands: " + ", ".join(f"{b} {n}" for b, n in ev.price_band.value_counts().sort_index().items()),
        f"- Kitchen days (Dar es Salaam, Stock Out and menus): **{len(kitchen.plates)}**, "
        f"TZS {kitchen.stock_value.sum():,.0f} issued for {kitchen.plates.to_numpy().sum():,.0f} dish-plates",
        "",
    ]

    # ── 1. Price check ───────────────────────────────────────────────────────
    scored = price_book.add_market_median(price_book.expected_prices(ev))
    cut = ev.event_date.quantile(0.7)
    pb = price_book.evaluate(scored, since=cut)
    report += ["## 1. Price check", "",
               "### 1a. Client price book (clients seen before)", "",
               f"Expected price = the client's last price for the same meal sections (else their usual ratio to the "
               f"market), from earlier events only. Scored on the latest 30% of events (after {cut:%Y-%m-%d}); "
               f"{pct(pb['coverage_client_history'])} of them had client history.", "",
               "| Method | Events | Exact band | Within one band | Mean error (TZS) | Mean error % |",
               "| --- | --- | --- | --- | --- | --- |"]
    for name in ("market median (baseline)", "price book"):
        v = pb[name]
        report.append(f"| {name} | {v['events']} | {pct(v['band_exact'])} | {pct(v['within_one_band'])} | "
                      f"{v['mae_tzs']:,.0f} | {pct(v['mape'])} |")
    flags = price_book.quote_flags(scored)
    flags.to_csv(out / "quote_flags.csv", index=False)
    price_book.current_book(ev).to_csv(out / "price_book.csv", index=False)
    report += ["", f"**{len(flags)} events** were priced at least 10% below the client's own usual price for the "
               f"same meal: `quote_flags.csv`. Today's book per client and meal: `price_book.csv`.", ""]

    pr = price_model.evaluate(ev)
    s = pr["scores"]
    report += ["### 1b. Menu-only model (new clients)", "",
               "Grouped by client: each client's events are scored by a model that never saw that client. "
               "Prices are negotiated per client, so the menu alone predicts the band only loosely.", "",
               "| Model | Exact band | Within one band | Mean bands off |", "| --- | --- | --- | --- |"]
    for name, v in s.items():
        report.append(f"| {name}{' (best)' if name == pr['best'] else ''} | {pct(v['accuracy'])} | "
                      f"{pct(v['within_one_band'])} | {v['mean_band_error']:.2f} |")
    joblib.dump(price_model.fit_final(ev, pr["best"]), out / "price_model.joblib")
    report.append("")

    # ── 2. Menu suggestion ───────────────────────────────────────────────────
    mm = menu_model.evaluate(ev, dishes)
    report += ["## 2. Menu suggestion (dishes for a meal section)", "",
               "Recall@k: share of the dishes actually served that are in the top k suggestions.", "",
               "| Section | Events | Method | Recall@5 | Precision@5 | Recall@10 |", "| --- | --- | --- | --- | --- | --- |"]
    menu_summary = {}
    for (section, method), g in mm.groupby(["section", "method"]):
        r5 = g[g.k == 5].iloc[0]
        r10 = g[g.k == 10].iloc[0]
        menu_summary[(section, method)] = float(r5.recall)
        report.append(f"| {section} | {int(r5.events)} | {method} | {pct(r5.recall)} | {pct(r5.precision)} | {pct(r10.recall)} |")
    rankers = menu_model.fit(ev, dishes)
    joblib.dump(rankers, out / "menu_model.joblib")
    example = {"price_band": "C 11-15k", "meal_sections": "Lunch", "client_type": "NGO", "weekday_iso": 2,
               "log_pax": float(np.log1p(60))}
    sug = menu_model.suggest(rankers, example)
    report += ["", f"Example: Lunch, 11–15k, NGO, 60 pax → " +
               ", ".join(d for d, _ in sug.get("Lunch", [])), ""]

    # ── 3. Cost per plate ────────────────────────────────────────────────────
    dp = pd.read_csv(args.data_dir / "ml_daily_dish_plates.csv")
    dish_sections = (dp.assign(meal_section=dp["meal_section"].fillna("Other"))
                       .groupby("dish_key")["meal_section"].agg(lambda s: s.mode().iloc[0]).to_dict())
    X = cost_model.design_matrix(kitchen.plates, dish_sections)
    cm = cost_model.evaluate(X, kitchen.stock_value)
    report += ["## 3. Cost per plate (from daily Stock Out)", "",
               "Time-ordered: trained on earlier days, tested on later days.", "",
               "| Model | Daily MAE (TZS) | Daily error % | R² |", "| --- | --- | --- | --- |"]
    for name, v in cm["scores"].items():
        report.append(f"| {name}{' (best)' if name == cm['best'] else ''} | {v['mae_tzs']:,.0f} | {pct(v['mape'])} | {v['r2']:.2f} |")
    per_plate = cost_model.dish_cost_per_plate(X, kitchen.stock_value, cm["best_alpha"])
    def section_of(dish: str) -> str:
        if dish.startswith("other ") and dish.endswith(" dish"):
            return dish[len("other "):-len(" dish")].title()
        return dish_sections.get(dish, "Other")

    pd.DataFrame({"dish": per_plate.index, "meal_section": [section_of(d) for d in per_plate.index],
                  "est_cost_per_plate_tzs": per_plate.round(0).to_numpy()}).to_csv(out / "dish_cost_per_plate.csv", index=False)
    recipes = cost_model.observed_recipes(kitchen, X, cm["best_alpha"])
    recipes.to_csv(out / "observed_recipes.csv", index=False)
    top_dishes = [c for c in X.columns if not c.startswith("other ")]
    costs = cost_model.event_costs(ev, dishes, per_plate, top_dishes, dish_sections)
    costs.to_csv(out / "event_costs.csv", index=False)
    dar = costs[costs.branch == "Dar es Salaam"]
    report += ["", "Highest estimated cost per plate: " +
               ", ".join(f"{d} {v:,.0f}" for d, v in per_plate.head(6).items()),
               f"Median estimated food cost: **{pct(dar.est_food_cost_pct.median())}** of the price ex VAT "
               f"(Dar es Salaam events); `event_costs.csv` has every event.",
               f"Observed recipes for {recipes['product'].nunique() if len(recipes) else 0} products: `observed_recipes.csv`.", ""]

    report += ["## Caveats", "",
               "- Trained on the exports as they are: unmapped dish names, mixed units and missing Stock Out days "
               "blur the results. Retrain after the clean-up and compare in `history.csv`.",
               "- Dar es Salaam data stands for all branches (decision 2026-10-18).",
               "- Cost per plate is an estimate from daily totals; dishes always served together share their cost.", ""]
    (out / "report.md").write_text("\n".join(report), encoding="utf-8")

    best_menu = max(v for (sec, m), v in menu_summary.items() if sec == "Lunch" and m != "popularity") if menu_summary else float("nan")
    hist_row = {
        "run": run_id, "note": args.note, "events": len(ev), "clients": ev.client_id.nunique(),
        "last_event_date": f"{ev.event_date.max():%Y-%m-%d}", "kitchen_days": len(kitchen.plates),
        "price_book_exact": round(pb["price book"]["band_exact"], 3), "price_book_mape": round(pb["price book"]["mape"], 3),
        "price_market_exact": round(pb["market median (baseline)"]["band_exact"], 3),
        "new_client_model": pr["best"], "new_client_exact": round(s[pr["best"]]["accuracy"], 3),
        "new_client_baseline_exact": round(s["baseline"]["accuracy"], 3),
        "menu_lunch_recall5_best": round(best_menu, 3),
        "menu_lunch_recall5_popularity": round(menu_summary.get(("Lunch", "popularity"), float("nan")), 3),
        "cost_daily_mape": round(cm["scores"][cm["best"]]["mape"], 3), "cost_baseline_mape": round(cm["scores"]["baseline"]["mape"], 3),
        "quote_flags": len(flags),
    }
    hist = args.data_dir / "models" / "history.csv"
    pd.DataFrame([hist_row]).to_csv(hist, mode="a", header=not hist.exists(), index=False)
    (out / "metrics.json").write_text(json.dumps(hist_row, indent=2), encoding="utf-8")

    print("\n".join(report))
    print(f"\nSaved to {out}")


if __name__ == "__main__":
    main()
