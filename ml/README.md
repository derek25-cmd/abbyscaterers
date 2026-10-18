# Abby's Caterers ML baseline

Three models trained on the CSV exports in `ml-data/` (gitignored: business
data). Everything runs on this PC; nothing connects to the database.

| Model | Question it answers | Inputs |
| --- | --- | --- |
| **Price check** | Is this quote in line with what the client usually pays for this meal? | client's price history; menu-only model for new clients |
| **Menu suggestion** | Which dishes to offer for this meal, price and group size? | price band, meal sections, pax, client type |
| **Cost per plate** | What does a plate of each dish cost in ingredients, and what is the margin per event? | daily Stock Out linked to the menus served that day |

## Setup (once)

```bash
python -m venv ml/.venv
ml/.venv/Scripts/python -m pip install -r ml/requirements.txt
```

## 1. Refresh the data

Run each export against production (read-only) and save it in `ml-data/`:

```bash
read -rsp "Production Session pooler URL: " DB_URL; echo; export DB_URL
for f in 10_ml_events:ml_events 20_ml_dishes_served:ml_dishes_served 30_ml_stock_movements:ml_stock_movements \
         40_ml_event_menus:ml_event_menus 50_ml_daily_dish_plates:ml_daily_dish_plates; do
  psql "$DB_URL" -v ON_ERROR_STOP=1 --csv -f "supabase/exports/${f%%:*}.sql" -o "ml-data/${f##*:}.csv"
done
unset DB_URL
```

(Or run each file in the SQL Editor and download the result as CSV under the
same name.)

Optional: `ml-data/dish_aliases.csv` with columns `dish_key,canonical`
merges dishes that are the same (e.g. `fruits,fruits cuts`).

## 2. Train

```bash
ml/.venv/Scripts/python ml/train.py --note "what changed in the data"
```

The run is saved in `ml-data/models/<timestamp>/`:

| File | Contents |
| --- | --- |
| `report.md` | data used, and every model against its baseline |
| `price_book.csv` | each client's last / usual price per meal |
| `quote_flags.csv` | past events priced 10%+ below the client's usual price |
| `dish_cost_per_plate.csv` | estimated ingredient cost per plate, per dish |
| `observed_recipes.csv` | quantity per plate of the top products, per dish |
| `event_costs.csv` | estimated food cost and margin per event |
| `*.joblib` | the trained models |

Each run also adds a line to `ml-data/models/history.csv`. Compare runs there
to see whether the cleaner data helps.

## 3. Use

```bash
ml/.venv/Scripts/python ml/use.py quote --client 000712 --meal "Breakfast+Lunch" --price 25000
ml/.venv/Scripts/python ml/use.py menu --meal Lunch --price 12000 --pax 60 --client-type NGO
```

## How the models are judged

- **No peeking at the future or at the same client.** The price book uses
  only events on earlier dates. The menu-only and menu models are tested on
  clients they never saw (grouped cross-validation). The cost model is
  trained on earlier days and tested on later days.
- **Always against a simple rule.** For price, the rule is the median price
  for the meal sections. For menus, it is the most popular dishes. For cost,
  it is one average cost per plate. A model is only worth using where it
  beats its rule.

## First results (exports of 2026-10-18, 1,285 events)

| Model | Simple rule | Model |
| --- | --- | --- |
| Price check, repeat clients (latest 30% of events) | band exact 55%, error 24% | **price book: band exact 86%, error 8%** |
| Price band, new clients (menu only) | band exact 19% | 38% (but within one band 67% vs 85%) |
| Menu, Lunch: top 5 dishes actually served (recall@5) | 34% | 35% |
| Daily Stock Out value, error on later days | 36% | **26%** |

What this says:

- **Prices are negotiated per client.** The client's own history is the
  price check; the menu adds little. For new clients, the menu-only model is
  a rough guide only.
- **Menus have a common core** (salad, fruits, vegetables, fresh juice,
  beans, …), and a client's past menus do not predict theirs better than
  that core does. Suggesting the core is right about two dishes in three.
  Better dish data (one name per dish, see `dish_name_mapping.csv`) is the
  main way to improve.
- **Cost per plate works**, and the median estimated food cost is 33% of the
  price ex VAT (Dar es Salaam). It improves with Stock Out logged every
  event day and one unit per product.

## Tests

```bash
ml/.venv/Scripts/python -m pytest -q ml/tests
```
