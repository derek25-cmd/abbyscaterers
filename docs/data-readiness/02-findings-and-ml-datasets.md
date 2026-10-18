# Data readiness 02: live findings and the ML datasets

This page records what the live audit found (run 2026-10-18 against
production, read-only), the decisions taken from it, and the three export
queries that produce the ML datasets. It supersedes the "confirm against live
DB" items in `01-schema-inventory.md`.

## 1. What the live database showed

### Volumes (audit Q4)

| Table | Rows | Note |
| --- | --- | --- |
| `orders` | 2,051 | holding **2,713 events** in `"clientEvents"` |
| `daily_menus` | 1,555 | about **14,500 dish entries** |
| `stock_logs` | 6,360 | 650 Stock In, ~5,700 Stock Out |
| `recipes` | 404 | **all with an empty ingredient list** |
| `ingredients` | **0** | empty |
| `products` | 387 | 148 of them appear in Stock In |
| `invoices` / `proforma_invoices` | 422 / 452 | |
| `purchases` / `expenses` | 60 / 70 | too few for cost modelling |
| `sales`, `daily_orders`, `suppliers`, `vat_wht_ledger` | **0** | unused |

Live tables missing from the repo or code inventory: `otp_codes` and
`quotation_requests` exist live but appear nowhere in this repo (probably the
Flutter marketer app). `recipe_ingredients` and `equipment` (in repo schema
files) **do not exist** live.

### Columns (audit Q7)

- Everything the code writes exists, including columns no migration creates:
  `orders.client_id/start_date/end_date/region`,
  `daily_menus.event_id/region`, `stock_logs.actual_quantity`.
- Prices and quantities in `products` and `stock_logs` are **numeric**.
  Nothing was rounded, so risk 13 in `01-…md` does not apply.
- `recipes."recipeType"` is plain text: the `recipe_type` enum is not live.
- `orders.start_date` and `end_date` are **text**, not dates.
- `orders` has **both** `proforma_id` (written now) and `"proformaId"`
  (older rows).
- `invoices."invoiceDate"` is a **timestamp with time zone**: convert to
  Africa/Dar_es_Salaam before grouping by day.
- `purchases` columns are lower-case (`unitcost`, `totalcost`).

### Data quality (audit checks A–E and follow-ups)

| Area | Finding |
| --- | --- |
| Events (A) | **Clean.** No bad pax, 17 zero-price events, 1 cancelled, 1 unreadable date, every order has a status. Real volume starts **March 2026**: ~350–440 events per month April–September, 40–80 pax, ~15,000–17,000 TZS per head. **No event carries recipes**; dishes are recorded in daily menus instead. |
| Event IDs (B) | **No duplicates** and no missing ids, so `event_id` is a reliable join key. |
| Recipe ingredients (C) | Not applicable: every recipe's ingredient list is empty. |
| Menu dishes (D) | From April 2026, **under 1%** of dishes lack a `recipeId` (March: 50%). June has fewer dish entries than its event count suggests, so some days were probably not entered. |
| Most-served dishes | Top 20 recipes = 54% of servings, top 40 = 73%. Duplicate recipes for one dish (fresh juice: RN-00225, RN-00275, RN-00191; "fruits" / "Fruits cuts"; "Beans" / "Yellow beans"). Category-like "dishes" ("vegetable", "salad", "fruits", "Greens"). `recipeType` is unreliable (e.g. "Beef roast" = Breakfast, tea = Lunch) and includes "Lunch/Dinner", which is not in the app's own list. |
| Stock In (E) | 650 rows, Nov 2025 – Sep 2026, mostly Dar es Salaam. **Gaps:** July 1 row, September 2 rows. Arusha and Dodoma only 2–3 months. **Pack-size mix-ups** up to 143× on one product (ndizi moshi, nyanya tenga, potatoes, cooking oil, charcoal, eggs). Duplicate products (cashew variants, chicken weight classes) and names with stray spaces. Non-food items (gas, charcoal, foil, cups) and free-text lines mixed in. |
| Stock Out | **The dependable record:** every month Oct 2025 – Oct 2026 for Dar, always priced, 700–1,100 rows/month since May. Stock In is far lower in value (e.g. May: 17 M in vs 45 M out), so purchases are under-recorded. Arusha and Dodoma Stock Out appear only from September 2026, so **branch is reliable only from 2026-09-01**. |
| Plausibility | June, Dar: Stock Out 48 M TZS vs ~18,600 plates (439 events × 42 pax) ≈ 2,600 TZS per plate, against ~15,900 TZS revenue per head: a food-cost ratio of ~16%. Caterers typically run 30–35%. **To check with the kitchen** before using Stock Out for costing: is consumption under-logged, valued low, or are pax counts including non-meal items? |
| Menu saving | The daily-menu and special-menu pages both upsert the same `(event_id, menu_date)` row, so saving one page can overwrite the dishes saved from the other for that event and day. |

## 2. Decisions (2026-10-18)

1. **Revenue for forecasting:** order events (pax × price per head), not
   invoices.
2. **Region → branch:** Dar es Salaam, Morogoro, Pwani → **Dar es Salaam**;
   Arusha → **Arusha**; Dodoma, Mwanza, Mbeya → **Dodoma**.
3. **Where the work runs:** read-only export queries, saved in this repo,
   exported to CSV and analysed on the PC. Nothing is created in the database.

## 3. Readiness

| Use | Status |
| --- | --- |
| Sales forecasting (events, pax, revenue by day / region / branch) | ✅ Ready. About 7 months of usable history (March–October 2026): daily, weekly and weekday patterns, but no yearly seasonality yet. |
| Menu recommendation (which dishes for which client / meal / event) | ✅ Ready, after grouping duplicate recipes. Meal slot taken from the menu sheet section, not `recipeType`. |
| Costing, top-down (cost per plate per month, Dar) | 🟡 Possible from Stock Out once the ~16% food-cost ratio is explained. |
| Costing per dish | ❌ Needs ingredients for the most-served recipes. |

## 4. The datasets

Each file in `supabase/exports/` is one read-only `SELECT`. Run it in the
Supabase SQL Editor, export the result as CSV and save it under `ml-data/` in
the repository root (gitignored: it is business data). Each file has a
`params` block with a date range. If the editor cuts an export off, export in
parts and join the files.

Nothing is dropped for quality reasons: problem rows are kept and marked with
`flag_*` columns, so each analysis decides what to exclude.

### `10_ml_events.sql` → `ml-data/ml_events.csv` (one row per event)

| Columns | Meaning |
| --- | --- |
| `event_id`, `order_id`, `event_index`, `events_in_order` | Keys. `event_id` joins to the dishes file. |
| `client_id`, `client_type` | Client code and organisation type only (no names or contacts). |
| `event_date`, `weekday_iso` (1 = Monday), `iso_week`, `month` | Event date, parsed safely; unreadable dates → NULL. |
| `region`, `branch` | Event region (falls back to the order's), branch per decision 2. |
| `meal_type`, `particular_type`, `event_type` | As entered. |
| `pax`, `unit_price`, `vat_type` | Per head. Numbers stored as text are parsed. |
| `revenue_as_entered`, `revenue_ex_vat` | pax × price; ex-VAT divides inclusive prices by 1.18 (Tanzania standard VAT, set in `params`). |
| `order_status`, `booking_id`, `proforma_id` | `proforma_id` takes whichever of the two columns is filled. |
| `flag_cancelled`, `flag_date_unreadable`, `flag_future`, `flag_bad_pax`, `flag_zero_price`, `flag_vat_unknown`, `flag_region_missing`, `flag_event_id_nonstandard` | Quality flags. `flag_future` = after today in Dar es Salaam (advance bookings). |

For forecasting, daily totals per branch are a group-by over this file:
exclude cancelled, future and zero-price rows, then sum pax and
`revenue_ex_vat` per `event_date` and `branch`.

### `20_ml_dishes_served.sql` → `ml-data/ml_dishes_served.csv` (one row per dish on a menu)

| Columns | Meaning |
| --- | --- |
| `daily_menu_id`, `menu_date`, `weekday_iso`, `month`, `event_id`, `order_id`, `region`, `branch` | Where and when. Join to events on `event_id`. |
| `row_index`, `meal_section` | Slot from the menu sheet: 1–10 Breakfast, 12–26 Lunch (daily-menu page); 100–110 Brunch, 111–125 Evening Tea, 126–145 Dinner, 146–165 Cocktail (special-menu page). |
| `recipe_id`, `recipe_name`, `recipe_type_as_entered` | Recipe link; `recipeType` kept only for reference. |
| `dish_name`, `dish_key` | Name as typed, and a normalised key (lower case, spaces collapsed, no spaces inside brackets). |
| `flag_no_recipe_id`, `flag_recipe_id_unknown`, `flag_no_event_id`, `flag_unknown_section` | Quality flags. |

Grouping duplicate recipes (e.g. the three fresh-juice recipes) needs a
small mapping of `recipe_id → canonical dish`, to be agreed with the kitchen.

### `30_ml_stock_movements.sql` → `ml-data/ml_stock_movements.csv` (one row per stock log)

| Columns | Meaning |
| --- | --- |
| `stock_log_id`, `date`, `weekday_iso`, `month`, `type`, `branch` | Stock In / Stock Out per branch. |
| `product_id`, `product_name`, `product_key`, `product_category`, `product_unit` | `product_key` = normalised name. Category and unit come from `products`. |
| `quantity`, `actual_quantity`, `unit_price`, `line_value` | `line_value` is the stored line total (`price`); `unit_price` is `actual_unit_price` (0 → NULL). |
| `median_unit_price_same_product` | Median unit price of that product, branch and type. |
| `reason`, `status`, `is_transfer` | `is_transfer` = reason starts with "Branch Transfer" (none so far). |
| `flag_branch_unreliable` | Before 2026-09-01, when branch was not recorded properly. |
| `flag_no_product_id`, `flag_product_not_in_catalogue`, `flag_no_unit_price` | Quality flags. |
| `flag_price_outlier` | Unit price more than 5× above or below the median (factor in `params`). Marks pack-size mix-ups; does not correct them. |

Rows with no `date` are left out.

### `40_ml_event_menus.sql` → `ml-data/ml_event_menus.csv` (one row per event with a posted menu)

The price per plate and the menu served for that event, side by side.
`daily_menus.event_id` links to the event's id in `orders."clientEvents"`.
A menu whose `event_id` matches no event (e.g. `EVT-00000`, an order number)
is **recovered** when its order has exactly one event on the menu date.
Otherwise it is left out.

| Columns | Meaning |
| --- | --- |
| `event_id`, `order_id`, `events_in_order`, `client_id`, `client_type` | Keys and client type, as in the events file. |
| `event_date`, `weekday_iso`, `month`, `region`, `branch` | As in the events file. |
| `meal_type`, `particular_type`, `event_type`, `pax`, `unit_price`, `vat_type` | As entered on the event. |
| `price_per_plate_ex_vat` | `unit_price`, divided by 1.18 when VAT-inclusive. |
| `menu_days`, `first_menu_date`, `last_menu_date` | Menus posted for the event (1, or 2 for a few). |
| `dishes_total`, `dishes_per_day`, `n_breakfast` … `n_cocktail`, `n_unknown_section` | Dishes on the menu, by section (same row-index rule as the dishes file). |
| `meal_sections` | Sections present, e.g. `Breakfast+Lunch`. |
| `recipe_ids`, `dish_keys` | `\|`-separated, distinct, sorted. One-hot them for a model. |
| `n_no_recipe_id` | Dishes typed without a recipe link. |
| `flag_*` | As in the events file, plus `flag_link_recovered`, `flag_menu_date_differs` (menu not on the event date) and `flag_meal_type_mismatch` (the meal type names none of the menu's sections, e.g. "Lunch only" with breakfast dishes). |

#### What the link shows (staging = production copy, 2026-10-18)

- **The link is clean.** All 1,362 posted menus carry an `event_id`. 1,307
  match an event directly, and 17 more are recovered through order and date,
  giving **1,301 events with a menu**. On 1,306 of the 1,307 direct links the
  menu's `order_id` agrees with the event's. 1,285 menus are dated on the event
  day, and 22 are 1–2 days off (flagged). No event has two menus on the same
  day.
- **Coverage: about half of past events have a menu, and it depends on the
  branch.** From April to October 2026, Dar es Salaam has a menu for 1,253 of
  1,717 events (73%). Dodoma has 6 of 179, Arusha 2 of 31, and events with no
  region 17 of 554. So this dataset is **effectively Dar es Salaam**.
  Recording menus at Dodoma and Arusha (and the region on every event) is
  what would widen it.
- **Meal type agrees with the menu.** For example, "Lunch only" → Lunch
  sections 557 / 567, "Breakfast only" → Breakfast 315 / 328, "Breakfast and
  lunch" → both 319 / 321. Only 9 events are flagged as mismatches.
- **Price per plate rises with the menu.** Ex VAT, Dar es Salaam:

  | Menu | Events | Price per plate (10th / median / 90th pct) | corr(dishes per day, price) |
  | --- | --- | --- | --- |
  | Breakfast | 324 | 3,644 / 6,780 / 11,441 | 0.29 |
  | Lunch | 576 | 8,475 / 10,169 / 16,949 | 0.36 |
  | Breakfast + lunch | 330 | 16,949 / 25,424 / 29,661 | 0.29 |

  Specific dishes separate the price tiers, beyond the dish count. The table
  shows how often each dish appears in the most expensive third of events
  against the cheapest third:

  | Menu | Dish | Most expensive third | Cheapest third |
  | --- | --- | --- | --- |
  | Lunch | fresh juice | 73% | 27% |
  | Lunch | braised beef | 15% | 5% |
  | Lunch | peas | 14% | 1% |
  | Lunch | ugali | 10% | 31% |
  | Breakfast | fruits cuts | 78% | 4% |
  | Breakfast | black & milk tea | 74% | 2% |
  | Breakfast | vegetable | 64% | 6% |

  Cheap breakfasts are snacks only (bagia, kachori, mini doughnuts).
- **Prices are list prices.** The 10 most common prices (12,000; 8,000;
  35,000; 10,000 …) cover 89% of events. A model should treat the price as a
  tier (classification) rather than a continuous target.
- **Few clients, many events.** 44 clients with 3 or more linked events
  account for 1,237 of the events. Only 14% of them always pay one price, so
  price is not fixed per client. **Split train and test by client** (grouped
  folds), or a model will learn the client instead of the menu.

#### What it can train

1. **Price tier from the menu** (quote check): given the meal sections and
   the dishes, predict the price tier. This is useful to flag quotes that are
   low for the menu.
2. **Menu from the price** (menu recommendation): given the meal type, price
   tier, pax and client type, rank the dishes to propose. This is the
   recommendation baseline in section 6, now conditioned on price.
3. **Food cost per plate**, once recipes have ingredients (Phase 2): cost
   each posted menu and compare with `price_per_plate_ex_vat`, which gives the
   margin per event.

Limits: Dar es Salaam only for now; about 1,300 events; dish names need the
canonical-dish mapping (e.g. "fruits" / "fruits cuts", three fresh-juice
recipes, "pumpikns").

## 5. Fixes for the business (no code needed)

In order of value for the ML work:

1. **Enter ingredients for the most-served recipes**, starting with the top
   40 (73% of servings): vegetable, fruits cuts, salad, boiled eggs, fruits,
   fresh juice, baked chicken, banana stew, tea, beans, … This is the only way
   to get per-dish costing.
2. **Merge duplicate recipes** (three fresh-juice recipes, fruits / fruits
   cuts, beans variants), and split category-like entries ("vegetable",
   "salad") into real dishes where that matters.
3. **Record every purchase as Stock In**, at all three branches. July and
   September 2026 are nearly empty.
4. **Use one unit per product** (per kg, per litre or per piece), and log
   packs by converting to that unit. Fix the outliers flagged by
   `flag_price_outlier`.
5. **Merge duplicate products** (cashew variants, chicken weight classes if
   they are the same item) and trim names.
6. **Explain the food-cost ratio** (section 1): is everything issued to the
   kitchen logged as Stock Out, at current prices?
7. **Correct the 17 zero-price events** and the one with an unreadable date.
8. **Enter the menu for every event, at every branch** (Dodoma and Arusha
   post almost none; see `40_ml_event_menus.sql`), and set the region on
   every event. **Enter the menu every day** (June looks incomplete), and avoid saving the
   daily and special menus for the same event and day from both pages.

## 6. Next steps

1. Run the four exports and save the CSVs in `ml-data/`.
2. Analysis on the PC (next stage):
   - **forecasting baseline**: daily events / pax / revenue per branch, with
     weekday effects;
   - **menu recommendation baseline**: which dishes are served together and
     for which meal, client type and pax;
   - **cost per plate** from Stock Out vs plates served (Dar), to settle the
     food-cost question.
