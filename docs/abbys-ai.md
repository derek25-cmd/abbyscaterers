# Abby's AI (beta)

A page in the catering system (sidebar → **Abby's AI**) that puts the ML
baseline (`ml/`) in front of staff to test. Every answer has a 👍 / 👎 and
a comment box, saved in `ai_feedback`.

| Tab | Who | What it does | Where the answer comes from |
| --- | --- | --- | --- |
| **Quote check** | all active staff | Is this price per plate in line with what this client usually pays for this meal? Flags quotes 10% or more below. | `abby_ai_quote_check()`: live orders. The client's last price for the same meal, else their usual level on other meals × the market price, else the market price. Back-tested on 2,675 events: band exact 87%, error ~9% (market price alone: 41%, 28%). |
| **Menu ideas** | all active staff | The dishes most served for this meal, weighted toward events at the same price band. | `abby_ai_menu_ideas()`: live daily menus. |
| **Cost estimate** | admin, general manager, finance | Ingredient cost per plate of a menu, food cost % and margin. | `ai_dish_costs`: published from a trained run of `ml/train.py` (daily Stock Out vs plates per dish, Dar es Salaam). |

Meal types are read as meals: "Lunch only" = lunch, "Breakfast and lunch" =
breakfast + lunch, and so on. Test and cancelled orders, prices under 1,000
and events with no date or pax are left out, as in `ml/`.

## Roll out to production

1. **Backup** (as in the runbooks):
   ```bash
   read -rsp "Production Session pooler URL: " DB_URL; echo; export DB_URL
   scripts/db/backup.sh
   unset DB_URL
   ```
2. **Migration**: run `supabase/migrations/20261018170000_abbys_ai.sql` in
   the production SQL Editor. It is idempotent. Check:
   ```sql
   SELECT to_regprocedure('public.abby_ai_quote_check(text,text,numeric,date)') IS NOT NULL AS quote_fn,
          to_regprocedure('public.abby_ai_menu_ideas(text,numeric,integer)') IS NOT NULL AS menu_fn,
          to_regclass('public.ai_dish_costs') IS NOT NULL AS costs_table,
          to_regclass('public.ai_feedback') IS NOT NULL AS feedback_table;   -- expect all true
   ```
3. **Publish the cost model**, from the latest run in `ml-data/models/`:
   ```bash
   read -rsp "Production Session pooler URL: " TARGET_DB_URL; echo; export TARGET_DB_URL
   scripts/db/publish-ai-model.sh
   unset TARGET_DB_URL
   ```
   It shows the run and the project ref, asks you to type the ref, and
   prints the number of dish costs published.
4. **Merge** the branch: the app deploys with the new page.

Without step 3, the quote check and menu ideas work, and the Cost estimate
tab says that no cost model is published yet.

Rollback: redeploy the previous app; then, if wanted, run the rollback
lines at the top of the migration.

## Retrain and publish

When the data has improved (dish mapping applied, Stock Out logged every
day, units cleaned):

1. Re-export the CSVs and retrain (`ml/README.md`, steps 1–2). Compare the
   new line in `ml-data/models/history.csv` with earlier runs.
2. If the cost model is better, publish it (step 3 above). The page shows
   the published run ("model …" at the top right).

The quote check and menu ideas need no retraining: they read live orders and
menus, so they learn from every new event.

## Reading the testers' feedback

Admins can read all feedback (others see only their own). In the SQL Editor:

```sql
SELECT f.created_at::date, f.tool, f.rating, f.comment, f.input, f.output, f.model_run, s.role
FROM public.ai_feedback f
LEFT JOIN public.staff_users s ON s.id = f.created_by
ORDER BY f.created_at DESC;

SELECT tool, count(*) AS answers, round(avg((rating = 1)::int) * 100) AS pct_useful
FROM public.ai_feedback GROUP BY tool;
```

👎 with a comment is the most useful signal. It shows where a rule is wrong,
for example a client whose prices change by season, or a dish suggested for
the wrong meal.
