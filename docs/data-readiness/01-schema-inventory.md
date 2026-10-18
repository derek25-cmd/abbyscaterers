# Data readiness 01: schema inventory (from the code)

What the apps actually read and write, where (if anywhere) the repo defines
it, and what that means for the ML work: sales forecasting, menu
recommendation and costing. It was built **from the code only**, with no
database access. Everything below about the live database is an inference to
confirm with `supabase/audit/01_schema_audit.sql` (query Q7 lists the ML
columns) and `supabase/audit/02_baseline_quality.sql`.

How it was built:

- **Code usage**: every `.from('…')` (Supabase table/view, not Storage) and
  `.rpc('…')` in `apps/` and `packages/`, `node_modules` excluded:
  ~500 call sites, 84 tables/views, 49 distinct RPCs. The operation was taken from the
  first `.select/.insert/.update/.upsert/.delete` after each call.
  Dynamic `.from(variable)` calls were checked by hand. The only Supabase one
  is `api/marketing/uploads/route.ts:66`, which picks `visit_documents` or
  `company_documents`.
- **Repo definitions**: `CREATE TABLE / VIEW / FUNCTION / TYPE` and
  `ALTER TABLE` in `supabase/migrations/*.sql`, `supabase/base_schema.sql`,
  `supabase/menu_costing_schema.sql`, `db/schema.sql`, `schema.sql` and
  `apps/catering-system/src/lib/schema.sql`.
- **Columns**: from `apps/catering-system/src/types/index.ts` and the insert
  / update payloads in `apps/catering-system/src/services/*.ts`.

Path shorthand: `cs/` = `apps/catering-system/src/`, `ap/` =
`apps/admin-portal/src/`, `mig/` = `supabase/migrations/`.

## Headline findings

1. **5 tables the code uses are not defined anywhere in the repo**:
   `service_feedback`, `supervisor_reports`, `suppliers`,
   `training_evaluations`, `training_participants`.
2. **Most of the core business data has no migration.** `orders`, `clients`,
   `products`, `stock_logs`, `recipes`, `ingredients`, `daily_menus`,
   `invoices`, `proforma_invoices`, `purchases`, `sales`, `employees`,
   `payroll`, `attendance` and more are created only in loose schema files
   (mostly `db/schema.sql`). Those files are **out of date**: `db/schema.sql`'s
   `orders` has no `client_id`, `start_date`, `end_date`, `region` or
   `status`. Its `products` has no branch columns and stores prices as
   `integer`. Its `daily_menus` has no `event_id`. The code uses all of these
   every day, so they exist live but were added outside the repo. **The live
   database is the only accurate schema**, hence the `db pull` in
   `00-backup-and-staging.md`.
3. **Column names don't follow one convention**, and two in the ML list are
   probably named differently live:
   - `orders` dates are `start_date` / `end_date` (`cs/services/orderService.ts:12-13,115-116`),
     not `"startDate"` / `"endDate"`.
   - The client is `client_id`, not `"clientId"`.
   - `purchases` was created with unquoted camelCase, so its columns are
     lower-case: `unitcost`, `totalcost`, `invoicenumber`
     (`cs/services/purchaseService.ts:82,125-136`). `sales` is the same.
   - Q7 of the audit checks both spellings.
4. **Recipe schema verdict**: the code uses **`recipes.ingredients` JSONB**.
   `recipe_ingredients` and the `recipe_type` enum from `schema.sql` are
   unused (section c).

## a. Tables used by the code

**Defined in** shows where `CREATE TABLE` is. **(mig)** = a migration;
**(schema file)** = only a loose schema file, not a migration, so the live
shape may differ; **NOT IN REPO** = nowhere. *R* = read, *W* = write
(insert / update / upsert / delete).

### Sales, orders and invoicing

| Table | Defined in | Read / written by | Columns the code relies on |
| --- | --- | --- | --- |
| `orders` | `db/schema.sql` (schema file); `status` + check added in mig/20260901040000, 20260901150000. `client_id`, `start_date`, `end_date`, `region`, `proforma_id` **not in repo** | RW `cs/services/orderService.ts`; R `cs/services/clientService.ts`, `dailyMenuService.ts`, `proformaInvoiceService.ts`, `cs/components/orders/unconfirmed-orders-reminder.tsx`, `ap/app/(portal)/reports/orders/page.tsx`, `ap/components/dashboard/dashboard-content.tsx` | `id` (ORD-NNNNN), `name`, `client_id`, `start_date`, `end_date`, `description`, `proforma_id`, `booking_id`, `region`, `status` (pending_confirmation / confirmed / completed / cancelled), `"clientEvents"` JSONB, `"createdAt"`, `"updatedAt"` (`orderService.ts:6-23,113-125`) |
| `clients` | `db/schema.sql` (schema file) | RW `cs/services/clientService.ts`; R `deliveryNoteService.ts`, `ap/components/rfq/rfq-form.tsx`, `ap/components/invoices/request-invoice-by-client.tsx`, `ap/components/tax-settings/tax-settings.tsx` | `id`, `"companyName"`, `"companyEmail"`, `"phoneNumber"`, `address1`, `address2`, `"postalCode"`, `"primaryLocation"`, `"typeOfOrganization"`, `contacts` JSONB, `"lastContacted"`, timestamps |
| `proforma_invoices` | `db/schema.sql` (schema file); voiding columns mig/20260901070000, review mig/20260901130000 | RW `cs/services/proformaInvoiceService.ts`; R ~10 admin-portal and catering screens | `id`, `"invoiceDate"`, `"clientId"`, `region`, `"numberOfDays"`, `"multiplyByDays"`, `"serviceCharge"`, `"transportCosts"`, `"vatType"`, `"startDate"`, `"endDate"`, `items` JSONB, `"isInvoiced"`, `"isVoided"`, `booking_id` (`types/index.ts:172-200`) |
| `invoices` | `db/schema.sql` (schema file) | W via RPC `create_invoice_from_proforma(p_invoice)` (`cs/services/invoiceService.ts:37-58`, also `cs/app/requests/page.tsx:298`), update `invoiceService.ts:60-83`; R ~12 screens incl. admin-portal sales/VAT/revenue reports | as proforma plus `status` (outstanding / paid / partially paid), `"paymentDate"`, `"amountPaid"`, `"proformaId"` (`types/index.ts:204-234`) |
| `bookings` | mig/20240731000002, 20240801120000 (two files) and `db/schema.sql` | RW `cs/services/bookingService.ts`; R `proformaInvoiceService.ts` | `id`, `client_id`, `name`, `start_date`, `end_date`, `status`, `proforma_invoice_id` |
| `daily_orders` | mig/20240731000002, 20240801120000 | RW `cs/services/bookingService.ts:85-148` | `booking_id`, `order_date`, `menu` (text), `quantity`, `unit_price`, `total` |
| `sales` | `db/schema.sql` (schema file); `event_id`, `efd_receipt` mig/20260529124000 | RW `cs/services/saleService.ts`; R `clientService.ts` | lower-case live names: `customerid`, `invoicenumber`, `unitprice`, `totalamount`, `taxamount`, plus `event_id`, `date`, `quantity`, `paymentmethod`, `paymentstatus` (`saleService.ts:60-75,103-120`) |
| `delivery_notes` | `db/schema.sql` (schema file) | RW `cs/services/deliveryNoteService.ts` | `id`, `order_id`, `event_id`, `client_id`, `delivery_date`, `items` JSONB (qty, itemCode = recipe number, description) |
| `service_feedback` | **NOT IN REPO** (only an `ALTER` in a migration) | RW `cs/services/feedbackService.ts` | `id`, `report_date`, `order_id`, `overall_summary`, `positive_feedback`, `complaints`, `waiter_challenges` |
| `rfqs`, `rfq_status_history`, `rfq_proforma_links` | mig/20260901000000, 20260901010000 | admin-portal RFQ screens; R `cs/app/requests/page.tsx` | as defined in those migrations |
| `portal_invoice_requests`, `portal_costing_requests`, `portal_notifications`, `portal_users`, `portal_audit_log`, `proforma_comments` | mig/202609010300…202609012000 | admin-portal | as defined in those migrations |
| `invoice_tax_rates`, `client_invoice_tax_settings`, `tax_rates`, `vat_wht_ledger` | mig/20260901140000, 20260727000000, 20260529124000 | admin-portal reports; `cs/services/taxRatesService.ts`, `taxService.ts` | as defined in those migrations |

### Menus, recipes, ingredients and costing

| Table | Defined in | Read / written by | Columns the code relies on |
| --- | --- | --- | --- |
| `recipes` | four conflicting files: `supabase/base_schema.sql`, `db/schema.sql`, `cs/lib/schema.sql` (JSONB `ingredients`), and `schema.sql` (no `ingredients`, enum type). No migration | RW `cs/services/recipeService.ts`; R `menuCostingService.ts`, `deliveryNoteService.ts` | `"recipeNumber"`, `"recipeName"`, `"recipeType"`, `ingredients` JSONB, `user_id`, timestamps (`types/index.ts:95-103`) |
| `ingredients` | `base_schema.sql`, `db/schema.sql`, `cs/lib/schema.sql` (schema files) | RW `cs/services/ingredientService.ts`; R `menuCostingService.ts` | `"itemNumber"`, `"itemDescription"`, `"itemClassification"`, `units` JSONB `[{unit, price}]` (`types/index.ts:75-84`) |
| `daily_menus` | `db/schema.sql` (schema file; no `event_id`, `region`; unique key is `(order_id, menu_date)`) | W `cs/services/dailyMenuService.ts:18-83` (upsert on `event_id, menu_date`); R same file | `order_id`, `event_id`, `menu_date`, `recipes` JSONB, `region` (`types/index.ts:530-539`) |
| `catering_menus`, `catering_menu_recipes`, `menu_types`, `menu_planned_ingredients` | `supabase/menu_costing_schema.sql` (schema file) | RW `cs/services/menuCostingService.ts` | `base_people`, `price_per_person`, `menu_type_id`; `recipe_number`; `ingredient_name`, `planned_quantity`, `unit`, `unit_cost` (`types/index.ts:638-686`) |
| `costing_reports` | `db/schema.sql` (schema file); `branch` mig/20260409000000 | RW `cs/services/costingService.ts`; R `cs/components/reports/supervisor-report-form.tsx` | `report_date`, `type` (income / expense), `description`, `amount`, `branch` |

### Stock, purchasing and finance

| Table | Defined in | Read / written by | Columns the code relies on |
| --- | --- | --- | --- |
| `products` | `db/schema.sql` (prices `integer`) and `base_schema.sql` (`numeric`), schema files; branch columns mig/20260409000000 | RW `cs/services/productService.ts`; R `menuCostingService.ts` (`name, "unitPrice", unit`) | `id`, `sku`, `name`, `category`, `unit`, `quantity` + `"unitPrice"` (legacy), `quantity_dar/_arusha/_dodoma`, `"unitPrice_dar"/_arusha/_dodoma`, `"minStock"`, `"maxStock"`, `"expiryDate"` (`types/index.ts:484-505`) |
| `stock_logs` | `db/schema.sql` (schema file; `quantity`, `price`, `actual_unit_price` are `integer`); `branch` mig/20260409000000 | RW `cs/services/stockLogService.ts`; written from `cs/app/(hr-ops)/operations/stock-logs/page.tsx` and `cs/components/finances/add-purchase-dialog.tsx` | `"productId"`, `"productName"`, `type` (Stock In / Stock Out), `quantity`, `price` (= line total), `actual_unit_price`, `reason`, `date`, `status`, `branch`; `actual_quantity` in the type but **not in any SQL** |
| `purchases` | `db/schema.sql` (schema file, unquoted names); `event_id`, `supplier_tin`, `efd_receipt` mig/20260529124000. `supplier_id`, `amount_paid`, `payment_date` **not in repo** | RW `cs/services/purchaseService.ts` | lower-case: `date`, `supplier`, `supplier_id`, `invoicenumber`, `description`, `quantity`, `unitcost`, `totalcost`, `taxamount`, `amount_paid`, `paymentmethod`, `paymentstatus`, `expensecategory`, `event_id` (`purchaseService.ts:120-140`) |
| `suppliers` | **NOT IN REPO** | RW `cs/services/supplierService.ts` | `id`, `name`, `contact_person`, `email`, `phone`, `address`, `tin`, `notes` |
| `expenses` | mig/20260529124000 | RW `cs/services/expenseService.ts` | `event_id` (or 'OVERHEAD'), `date`, `category`, `amount`, `vat_amount` |
| `assets`, `issuance` | `db/schema.sql` (schema file) | RW `cs/services/assetService.ts`, `issuanceService.ts`, `cs/components/hr/new-issuance-dialog.tsx` | assets: `unitPrice`, `quantity`, `branch`; issuance: `orderId`, `items` JSONB, `branch`, `totalValue` |
| `supervisor_reports` | **NOT IN REPO** | RW `cs/services/supervisorReportService.ts` | `report_date`, `supervisor_id`, `status`, `criteria` JSONB |

### HR (not needed for the first ML steps)

| Table | Defined in | Read / written by |
| --- | --- | --- |
| `employees`, `attendance`, `payroll`, `positions` | `db/schema.sql` (schema file) plus many HR migrations | `cs/services/employeeService.ts`, `attendanceService.ts`, `payrollService.ts`, `trainingService.ts`, HR screens; admin-portal payroll and attendance reports |
| `training_participants`, `training_evaluations` | **NOT IN REPO** | `cs/services/trainingService.ts` |
| `staff_users` | mig/20260714000000 | role hooks, staff admin |
| `leave_*`, `public_holidays`, `hr_notifications`, `hr_document*`, `candidates`, `employment_contracts`, `disciplinary_records`, `recognition_records` | mig/20261014000600 … 20261014001600 | `cs/services/leaveService.ts`, `hrDocumentService.ts`, `hrRecordsService.ts`, `candidateService.ts`, `hrImportService.ts` |
| `app_settings`, `audit_log`, `push_subscriptions` | mig/20260901160000, 20260726010000, 20260901230000 | settings hooks, audit page, admin-portal push |

### Marketing CRM (field sales; useful later for lead scoring, not for Steps 2–4)

All defined in migrations `mig/202606201200…20260623400000`, read and written
by `cs/app/api/marketing/**` and `cs/features/marketing/**`: `companies`,
`company_notes`, `company_documents`, `company_collaborators`, `visits`,
`visit_documents`, `follow_ups`, `regions`, `marketing_users`,
`marketing_targets`, `marketing_target_analyses`, `marketing_performance`,
`marketing_monthly_expenses`, `marketing_notifications`,
`marketer_commissions`, `marketer_daily_reports`, `marketer_documents`,
`marketer_approval_log`, `marketer_account_actions`, and the views
`company_map_pins`, `marketer_live_locations`, `marketer_account_overview`,
`pending_marketer_applications`.

### RPCs

All 49 functions the apps call with `.rpc()` are defined in a migration (full
list in the appendix). The ID generator `claim_ids` (mig/20260702100000)
matters for ML: before it, order and event IDs came from a race-prone
"max + 1" scan (risk 7).

## b. JSONB structures

### `orders."clientEvents"`: one element per event (the main sales record)

Type `ClientEvent` (`cs/types/index.ts:119-133`), validated by
`ClientEventSchema` (`cs/lib/schemas.ts:144-159`), where **every field is
optional**.

| Field | Type in code | Notes |
| --- | --- | --- |
| `id` | `EVT-NNNNN` | Assigned by `claim_ids` on save (`orderService.ts:97-109`); existing `EVT-` ids are kept |
| `date` | ISO date string | Sometimes a full timestamp; audit Check A parses defensively |
| `numberOfPeople` | number ≥ 0 | Pax. `0` passes validation |
| `mealType` | string | Free text, nominally one of `MEAL_TYPES` (`types/index.ts:105-116`) |
| `recipes` | `[{ recipeId }]` | `recipeId` = `recipes."recipeNumber"`. Often empty |
| `unitPrice` | number ≥ 0 | Price per head. `0` passes validation |
| `total` | number | Stored by the forms (`order-form.tsx`, `add-daily-order-dialog.tsx:65-75`), not in the type |
| `vatType` | inclusive / exclusive | Changes what `unitPrice` means |
| `region` | one of 7 `REGIONS` | Per event, in addition to `orders.region` |
| `particularType`, `particularDescription`, `eventType`, `customEventType` | strings | Event classification for invoices |
| `clientId` | string | Only filled when events are flattened in memory; not expected in stored JSON |

Written by `cs/services/orderService.ts` (`addOrder` 84-139, `updateOrder`
141-183, `bulkAddOrders` 223-282), from `cs/components/orders/order-form.tsx`,
`cs/components/bookings/add-daily-order-dialog.tsx`,
`add-bulk-item-dialog.tsx` and `cs/hooks/use-order-storage.ts`.

### `recipes.ingredients`

`[{ ingredientId, quantity, unit }]` (`RecipeIngredientItem`,
`types/index.ts:86-90`). `ingredientId` = `ingredients."itemNumber"`; `unit` is
nominally `kg | gms | bunch | item`. Written by `cs/services/recipeService.ts`
(`addRecipe` 53-85, `updateRecipe` 87-96).

### `ingredients.units`

`[{ unit, price }]` (`UnitAndPrice`, `types/index.ts:70-73`). A **separate
price source** for each ingredient. Menu costing ignores it in favour of
`products` (risk 3). Written by `cs/services/ingredientService.ts`.

### `daily_menus.recipes`

`[{ rowIndex, recipeId?, name }]` (`types/index.ts:535`). Built in
`cs/app/reports/daily-menu/page.tsx:189-208`: `recipeId` is set only when the
typed dish name exactly equals a recipe name (line 195). Also built in
`cs/app/reports/special-menu/page.tsx:163-172`, from a picker. Saved by
`cs/services/dailyMenuService.ts:18-83`.

### `invoices.items` and `proforma_invoices.items`

`InvoiceItem` (`types/index.ts:155-169`): `id` (the event id), `orderId`,
`eventType`, `customEventType`, `mealType`, `pax`, `unitPrice`, `total`,
`date`, `particularType`, `particularDescription`, `vatType`, `region`.

- Proforma items are built from order events in
  `cs/components/proforma-invoices/proforma-invoice-form.tsx:255-270`
  (`total = pax × unitPrice`, recomputed on edit at lines 332-333) and from
  bookings in `cs/app/bookings/[id]/booking-details-page-component.tsx:247`.
  They are saved by `cs/services/proformaInvoiceService.ts:37-60`.
- Invoice items come from the invoice form, which starts from the proforma
  (`cs/app/proforma-invoices/[id]/proforma-invoice-view-page-component.tsx:383`)
  and can be edited before saving. They are sent whole to the RPC
  `create_invoice_from_proforma(p_invoice)` (`invoiceService.ts:51`, also
  `cs/app/requests/page.tsx:298`; latest definition
  mig/20260901070000_void_proforma.sql), and later edits go through
  `invoiceService.ts:60-83`. Invoice items can therefore differ from the
  proforma's.

`delivery_notes.items` (`[{qty, itemCode, description}]`) and
`issuance.items` are other JSONB lists, not needed for Steps 2–4.

## c. The recipe schema conflict

| | `supabase/base_schema.sql` (also `db/schema.sql:57-65`, `cs/lib/schema.sql`) | `schema.sql` (repo root) |
| --- | --- | --- |
| Ingredients of a recipe | `recipes.ingredients` JSONB | separate `recipe_ingredients` table (`recipeNumber`, `ingredientId`, `quantity`, `unit`) |
| `recipeType` | `TEXT` | enum `recipe_type` ('Breakfast', 'Lunch', 'Dinner', 'Evening Tea') |

**Verdict: the code uses the JSONB model (`base_schema.sql`).**

- `cs/services/recipeService.ts:61-76` inserts `ingredients` as part of the
  recipe row; `updateRecipe` (87-96) updates it the same way.
- `cs/services/menuCostingService.ts:256` and `:470` read
  `recipe.ingredients` directly.
- No file in `apps/` or `packages/` references `recipe_ingredients` or
  the `recipe_type` enum. The only `recipe_type` hits are an unrelated text
  field built for `catering_menu_recipes` rows (`menuCostingService.ts:139`,
  `types/index.ts:664`).
- The code's `RECIPE_TYPES` (`types/index.ts:92`) includes `Brunch` and
  `Cocktail`. The enum would reject those, so the enum can't be live (or
  saving those recipes would fail).

`schema.sql` looks like an abandoned redesign; treat it as dead. For ML,
`recipe → ingredient` rows will have to be produced by unnesting the JSONB
(see audit Check C). Q1 of the schema audit will show which `recipeType` type
is live.

## d. Columns the ML steps depend on: confirm against the live DB

All **confirm against live DB** (`supabase/audit/01_schema_audit.sql`, Q7).
"Repo" says what the repo shows.

| Table | Column(s) | Repo | Confirm against live DB |
| --- | --- | --- | --- |
| `orders` | `id`, `status` | `id` in `db/schema.sql`; `status` mig/20260901040000 | confirm against live DB |
| `orders` | `region` | not in any SQL; written by `orderService.ts:120` | confirm against live DB |
| `orders` | `"clientId"` | code uses **`client_id`** (`orderService.ts:11,114`); neither in SQL | confirm against live DB, both spellings |
| `orders` | `"startDate"`, `"endDate"` | code uses **`start_date`, `end_date`** (`orderService.ts:12-13`); index on `(status, start_date)` in mig/20260901040000 | confirm against live DB, both spellings |
| `orders` | `"clientEvents"` | `db/schema.sql` (jsonb not null) | confirm against live DB |
| `stock_logs` | `"productId"`, `"productName"`, `date`, `type`, `quantity`, `price`, `actual_unit_price`, `reason`, `status` | `db/schema.sql`, all numbers `integer` | confirm against live DB, incl. types (integer would truncate kg fractions and cents) |
| `stock_logs` | `branch` | mig/20260409000000 (default 'Dar es Salaam') | confirm against live DB |
| `stock_logs` | `actual_quantity` | in the type only | confirm against live DB |
| `products` | `unit`, `name`, `"unitPrice"` | `db/schema.sql` (`"unitPrice"` integer) | confirm against live DB |
| `products` | `"unitPrice_dar"`, `"unitPrice_arusha"`, `"unitPrice_dodoma"`, `quantity_dar/_arusha/_dodoma` | mig/20260409000000, numeric(10,2) | confirm against live DB |
| `ingredients` | `"itemNumber"`, `"itemDescription"` | three schema files | confirm against live DB |
| `daily_menus` | `recipes`, `menu_date` | `db/schema.sql` | confirm against live DB |
| `daily_menus` | `event_id` (and its unique key with `menu_date`) | not in any SQL; the upsert needs a unique constraint on `(event_id, menu_date)` (`dailyMenuService.ts:33,72`) while `db/schema.sql:260` has `(order_id, menu_date)` | confirm against live DB (Q2 / Q3) |
| `purchases` | `event_id` | mig/20260529124000 | confirm against live DB |
| `purchases` | `"unitCost"` | code writes **`unitcost`** (`purchaseService.ts:129`) | confirm against live DB, both spellings |

## e. Data-quality risks visible in the code

Ordered by how much they affect the ML steps.

1. **Ingredient prices are found by name.** `menuCostingService.ts:446-456`
   (and 270-302 for planned ingredients) builds a map of
   `lower(trim(products.name))`. Each recipe ingredient's `ingredientId` is
   turned into `ingredients."itemDescription"` (line 473; if the id is
   unknown, **the id itself is used as the name**) and looked up by that
   name (line 482). Any spelling difference ("Tomato" vs "Tomatoes"), or two
   products with the same name, gives a **unit cost of 0, silently** (line
   483 and line 302), and the dish looks cheaper than it is. There is no
   foreign key between ingredients and products. (Audit Check C.)
2. **Menu costing uses the legacy single price, not branch prices.** It
   selects only `name, "unitPrice", unit` (`menuCostingService.ts:270-272,
   447-449`). `"unitPrice"` is set to the **Dar** price when a product is
   created (`productService.ts:29`) and is **never updated** when branch
   prices change: `updateProduct` recomputes only the legacy `quantity`
   (`productService.ts:71-81`). Arusha and Dodoma costs are therefore Dar
   prices, and possibly old ones.
3. **Units are not reconciled with the price's unit.** Recipe quantities are
   normalised to kg / litres / pcs (`menuCostingService.ts:336-355`), but the
   product's `unit` is loaded and ignored. The price is applied per normalised
   unit whatever unit it was quoted in (lines 478-497). Grams to kg is
   handled; a price per bunch applied to kg is not. `ingredients.units` holds
   yet another set of prices that costing ignores.
4. **Hard-coded costing factors.** 10% wastage (`useWastage ? 1.1 : 1.0`,
   `menuCostingService.ts:461`). An "efficiency factor" of up to +20% for
   small groups and −2% per multiple of the base group, capped at −10% (lines
   361-384, applied at 459-464). None is measured from data. A cost model
   trained on these outputs would learn the constants back.
5. **No costing history is kept anywhere.** `cs/lib/costing-data.ts` stores
   daily costing snapshots in the browser's localStorage
   (`caterSmartCostingHistory`, lines 6-35). **Nothing imports it.** So
   snapshots are not even saved locally: estimated cost per event or day is
   not recorded at all. `costing_reports` (manual income / expense lines) is
   the only persisted costing data.
6. **Daily-menu dishes often have no `recipeId`.** It is optional in the type
   (`types/index.ts:535`), and the daily-menu sheet sets it only when the
   typed name exactly matches a recipe name (`app/reports/daily-menu/page.tsx:195`).
   A typo or a different capitalisation breaks the link to recipes and
   ingredients. That is the link menu recommendation needs. (Audit Check D.)
7. **Duplicate or missing event IDs.** Before mig/20260702100000_id_counters.sql,
   IDs came from a race-prone "max + 1" scan, so older events can share an id.
   Events without an id are also possible (every field is optional). Event IDs
   are the join key to daily menus, purchases, expenses, sales and invoice
   items. (Audit Check B.)
8. **Event fields are weakly validated, and form defaults become data.**
   `ClientEventSchema` makes everything optional and allows `0` pax and `0`
   price (`lib/schemas.ts:144-159`). New orders start with 10 pax, price 0 and
   region "Dar es Salaam" (`components/orders/order-form.tsx:309-318`).
   Booking daily orders start with 1 pax and price 0
   (`components/bookings/add-daily-order-dialog.tsx:50-58`). Unchanged
   defaults look like real sales. (Audit Check A.)
9. **Region versus branch.** Sales carry one of **7 regions**
   (`types/index.ts:8`: Dar es Salaam, Arusha, Dodoma, Morogoro, Mwanza,
   Mbeya, Pwani) on the order and on each event. Stock, prices and costing
   reports use **3 branches** (`types/index.ts:300`). There is no mapping in
   the code, so a Mwanza event has no branch price. A region-to-branch rule
   has to be agreed before sales and costs can be joined.
10. **Stock history defaults to Dar and mixes in transfers and copies.**
    - `stock_logs.branch` defaults to 'Dar es Salaam' in both the migration
      (mig/20260409000000:24) and the service (`stockLogService.ts:47`).
      Every log from before the multi-branch change reads as Dar.
    - Branch transfers are logged as Stock Out plus **Stock In** at the
      source price (`app/(hr-ops)/operations/stock-logs/page.tsx:246-270`).
    - "Paste" copies whole logs to another date (same page, 478-490).
    - Purchases of non-catalogue items log `"productId"` as `''`
      (`components/finances/add-purchase-dialog.tsx:385-394`).
    - All of these distort a price or consumption history. (Audit Check E
      separates transfers.)
11. **The multi-branch migration lost prices of out-of-stock products.**
    `mig/20260409000000_multi_branch_stock.sql:16-19` copied `"unitPrice"`
    into `"unitPrice_dar"` only `WHERE quantity > 0`. Products with no stock
    on that day kept a Dar price of 0.
12. **Purchases can live only in one browser.** If the Supabase insert fails,
    `addPurchase` retries without `event_id`, `supplier_tin`, `efd_receipt`,
    `amount_paid` and `supplier_id` (`purchaseService.ts:148-157`). If that
    also fails, the purchase is kept **only in localStorage** (lines 175-183).
    `event_id` survives only in that browser's storage (read back at line 90),
    so event-level cost links can be missing from the database.
13. **Integer money and quantities in the original schema.** `db/schema.sql`
    declares `products."unitPrice"`, `products.quantity`, `stock_logs.quantity`,
    `price` and `actual_unit_price` as `integer` (lines 220-222, 239-246). If
    that is still true live, fractional kg and cents were rounded on write.
    Q1 of the audit shows the live types.
14. **Line totals are not revenue.** Invoice and proforma `items[].total` and
    event `total` are `pax × unitPrice`, computed in the browser
    (`proforma-invoice-form.tsx:263-265, 332-333`). The billed amount also
    depends on `numberOfDays` × `multiplyByDays`, `serviceCharge`,
    `transportCosts` and `vatType`. Revenue has to be recomputed from those,
    not summed from line totals.
15. **More than one record of the same sale.** Booking sales exist both as
    `daily_orders` rows (`bookingService.ts:85-148`) and as orders with
    `booking_id` and `"clientEvents"` (`add-daily-order-dialog.tsx`). The
    finance `sales` ledger and `invoices` are further separate records.
    Forecasting must pick one source of truth per period and not add them up.
16. **Orders whose `"clientEvents"` is not an array** are skipped by the app
    (`orderService.ts:19` defaults to `[]`) and by the audit queries. If Q4
    shows more orders than Check A can account for, count them separately.

## Appendix: everything the repo defines

Generated from the SQL files listed at the top: 80 tables, 5 views,
126 functions, 10 enum types.

### Tables created in repo SQL but not referenced by `.from()` in the apps

| Table | Created in |
| --- | --- |
| `contract_expiry_notices` | 20261014001600_hr_letter_records.sql |
| `equipment` | db/schema.sql |
| `hr_document_counters` | 20261014001200_hr_documents.sql |
| `id_counters` | 20260702100000_id_counters.sql |
| `recipe_ingredients` | schema.sql |

### Views

| View | Created in | Used by code |
| --- | --- | --- |
| `company_map_pins` | 20260620150000_add_realtime_helpers.sql | yes |
| `marketer_account_overview` | 20260621100000_marketer_account_authority.sql, 20260726000000_fix_rls_gaps.sql | yes |
| `marketer_landed_clients` | 20260623400000_nearby_and_landed_clients.sql | no |
| `marketer_live_locations` | 20260620150000_add_realtime_helpers.sql | yes |
| `pending_marketer_applications` | 20260621000000_google_auth_onboarding.sql, 20260726000000_fix_rls_gaps.sql | yes |

### Types (enums)

| Type | Created in |
| --- | --- |
| `business_size` | 20260620120000_add_marketing_crm.sql |
| `follow_up_status` | 20260620120000_add_marketing_crm.sql |
| `follow_up_type` | 20260620120000_add_marketing_crm.sql |
| `interest_level` | 20260620120000_add_marketing_crm.sql |
| `marketing_notification_type` | 20260620150000_add_realtime_helpers.sql |
| `marketing_user_role` | 20260620120000_add_marketing_crm.sql |
| `pipeline_stage` | 20260620120000_add_marketing_crm.sql |
| `recipe_type` | schema.sql |
| `visit_outcome` | 20260620120000_add_marketing_crm.sql |
| `visit_purpose` | 20260620120000_add_marketing_crm.sql |

### Functions (126)

Functions the apps call with `.rpc()` are marked **rpc**. The rest are trigger functions, RLS helpers or SQL-only jobs. When a function is redefined, the latest file is shown.

| Function | Latest definition | rpc |
| --- | --- | --- |
| `_hr_ops_reset_policies` | 20261014000200_hr_ops_rls.sql |  |
| `acknowledge_caution` | 20260621100000_marketer_account_authority.sql |  |
| `aggregate_marketing_performance` | 20260620160000_add_performance_aggregation.sql | **rpc** |
| `approve_hr_document` | 20261014001700_hr_letter_effects.sql (+1 earlier) | **rpc** |
| `approve_marketer` | 20260623160000_marketer_codes.sql (+1 earlier) | **rpc** |
| `approve_proforma` | 20260901210000_notifications_and_audit_wiring.sql (+1 earlier) | **rpc** |
| `attendance_leave_guard` | 20261014000700_leave_rpc.sql |  |
| `audit_row_change` | 20261016000000_hr_documents_export_not_stored.sql (+3 earlier) |  |
| `audit_staff_user_change` | 20261014000500_staff_employee_link.sql (+1 earlier) |  |
| `auto_reinstate_expired_suspensions` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `can_manage_hr` | 20261014000000_hr_ops_roles.sql |  |
| `can_manage_ops` | 20261014000000_hr_ops_roles.sql |  |
| `can_manage_settings` | 20261014000000_hr_ops_roles.sql |  |
| `cancel_leave_request` | 20261014000700_leave_rpc.sql | **rpc** |
| `candidates_guard` | 20261014001600_hr_letter_records.sql |  |
| `caution_marketer` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `claim_ids` | 20260702100000_id_counters.sql | **rpc** |
| `cleanup_uat_data` | 20261014002100_uat_cleanup.sql |  |
| `complete_past_orders` | 20260901150000_order_completed_status.sql | **rpc** |
| `contracts_due_for_reminder` | 20261014001700_hr_letter_effects.sql |  |
| `create_invoice_from_proforma` | 20260901070000_void_proforma.sql (+1 earlier) | **rpc** |
| `current_employee_id` | 20261014000500_staff_employee_link.sql |  |
| `delete_employee` | 20261015000000_hr_inactive_frozen_and_delete.sql | **rpc** |
| `delete_invoice_and_revert_proforma` | 20260719000100_atomic_invoice_writes.sql | **rpc** |
| `delete_marketer` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `disable_marketer` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `employee_history` | 20261015000000_hr_inactive_frozen_and_delete.sql | **rpc** |
| `employees_delete_guard` | 20261015000000_hr_inactive_frozen_and_delete.sql |  |
| `employees_status_guard` | 20261015000000_hr_inactive_frozen_and_delete.sql (+1 earlier) |  |
| `end_employment_without_letter` | 20261014001700_hr_letter_effects.sql | **rpc** |
| `ensure_leave_balance` | 20261014000700_leave_rpc.sql |  |
| `expire_offers` | 20261014001700_hr_letter_effects.sql |  |
| `find_nearby_companies` | 20260623400000_nearby_and_landed_clients.sql |  |
| `get_employee_directory` | 20261014000200_hr_ops_rls.sql | **rpc** |
| `get_employee_directory_for_portal` | 20260901190000_hr_reports_access.sql | **rpc** |
| `guard_company_settings` | 20261014001100_app_settings_company.sql |  |
| `guard_hr_settings` | 20261014001900_hr_go_live_settings.sql |  |
| `has_portal_role` | 20260901000000_add_portal_users_and_rfqs.sql |  |
| `has_staff_role` | 20261014000000_hr_ops_roles.sql |  |
| `hr_doc_apply_effects` | 20261014001700_hr_letter_effects.sql |  |
| `hr_doc_date` | 20261014001700_hr_letter_effects.sql |  |
| `hr_doc_draft_marker` | 20261014001700_hr_letter_effects.sql |  |
| `hr_doc_notify_approvers` | 20261014001400_hr_documents_rpc.sql |  |
| `hr_doc_num` | 20261014001700_hr_letter_effects.sql |  |
| `hr_doc_text` | 20261014001700_hr_letter_effects.sql |  |
| `hr_doc_validate` | 20261014001700_hr_letter_effects.sql |  |
| `hr_doc_void_effects` | 20261014001700_hr_letter_effects.sql |  |
| `hr_document_templates_guard` | 20261014001200_hr_documents.sql |  |
| `hr_document_types_guard` | 20261014001200_hr_documents.sql |  |
| `hr_documents_guard` | 20261016000000_hr_documents_export_not_stored.sql (+4 earlier) |  |
| `hr_documents_notify_portal` | 20261015000100_hr_portal_letter_approval.sql |  |
| `hr_employee_is_inactive` | 20261015000000_hr_inactive_frozen_and_delete.sql |  |
| `hr_employee_name` | 20261014001700_hr_letter_effects.sql |  |
| `hr_end_employment` | 20261014001700_hr_letter_effects.sql |  |
| `hr_go_live_year` | 20261014002000_hr_imports.sql | **rpc** |
| `hr_notifications_only_read` | 20261014000900_hr_notifications.sql |  |
| `hr_refuse_if_employee_inactive` | 20261015000000_hr_inactive_frozen_and_delete.sql |  |
| `hr_system_change` | 20261015000000_hr_inactive_frozen_and_delete.sql |  |
| `hr_today` | 20261014001700_hr_letter_effects.sql |  |
| `import_legacy_contracts` | 20261014002000_hr_imports.sql | **rpc** |
| `import_opening_leave` | 20261014002000_hr_imports.sql | **rpc** |
| `is_active_portal_user` | 20260901000000_add_portal_users_and_rfqs.sql |  |
| `is_active_staff` | 20260901100000_fix_is_active_staff_uuid_cast.sql (+1 earlier) |  |
| `is_admin` | 20260901100000_fix_is_active_staff_uuid_cast.sql (+1 earlier) |  |
| `is_marketing_manager` | 20260726000000_fix_rls_gaps.sql |  |
| `is_marketing_user` | 20260714000200_tighten_marketing_rls.sql (+1 earlier) |  |
| `is_portal_admin` | 20260901000000_add_portal_users_and_rfqs.sql |  |
| `is_portal_hr_approver` | 20261015000100_hr_portal_letter_approval.sql |  |
| `is_uat_candidate` | 20261014002100_uat_cleanup.sql |  |
| `is_uat_employee` | 20261014002100_uat_cleanup.sql |  |
| `issue_hr_document` | 20261016000000_hr_documents_export_not_stored.sql (+2 earlier) | **rpc** |
| `leave_balances_opening_guard` | 20261014002000_hr_imports.sql |  |
| `leave_employee_name` | 20261014000700_leave_rpc.sql |  |
| `leave_notify_requester` | 20261014000700_leave_rpc.sql |  |
| `leave_request_before_insert` | 20261014002000_hr_imports.sql (+1 earlier) |  |
| `leave_request_guard` | 20261014002100_uat_cleanup.sql (+1 earlier) |  |
| `leave_request_notify_hr` | 20261014000900_hr_notifications.sql |  |
| `leave_working_dates` | 20261014000600_leave_management.sql |  |
| `leave_working_days` | 20261014000600_leave_management.sql |  |
| `leave_year_of` | 20261014000600_leave_management.sql |  |
| `lift_restriction` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `link_rfq_to_proforma` | 20260901080000_rfq_answer_and_notifications.sql (+1 earlier) | **rpc** |
| `log_audit_event` | 20261014000300_hr_ops_audit_trigger.sql | **rpc** |
| `log_portal_audit_event` | 20260901200000_audit_log.sql |  |
| `log_portal_user_change` | 20260901200000_audit_log.sql |  |
| `log_rfq_created` | 20260901110000_rfq_submit_flow.sql |  |
| `mark_recognition_paid` | 20261014001700_hr_letter_effects.sql | **rpc** |
| `notify_costing_request_change` | 20260901210000_notifications_and_audit_wiring.sql |  |
| `notify_deal_won` | 20260623710000_notifications_update_policy.sql (+1 earlier) |  |
| `notify_hot_lead` | 20260623710000_notifications_update_policy.sql (+1 earlier) |  |
| `notify_hr_roles` | 20261014000900_hr_notifications.sql |  |
| `notify_invoice_request_change` | 20260901210000_notifications_and_audit_wiring.sql |  |
| `notify_user` | 20261014000900_hr_notifications.sql |  |
| `open_leave_year` | 20261014002000_hr_imports.sql (+1 earlier) | **rpc** |
| `pending_cash_rewards` | 20261014001700_hr_letter_effects.sql | **rpc** |
| `pg_temp` | 20260714000200_tighten_marketing_rls.sql |  |
| `portal_approve_hr_document` | 20261015000100_hr_portal_letter_approval.sql | **rpc** |
| `portal_pending_hr_documents` | 20261015000100_hr_portal_letter_approval.sql | **rpc** |
| `portal_return_hr_document` | 20261015000100_hr_portal_letter_approval.sql | **rpc** |
| `portal_uid` | 20260901000000_add_portal_users_and_rfqs.sql |  |
| `record_legacy_contract` | 20261014001700_hr_letter_effects.sql | **rpc** |
| `reinstate_marketer` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `reject_marketer` | 20260621000000_google_auth_onboarding.sql | **rpc** |
| `reject_proforma` | 20260901210000_notifications_and_audit_wiring.sql (+1 earlier) | **rpc** |
| `reserve_hr_document_ref` | 20261014001400_hr_documents_rpc.sql | **rpc** |
| `respond_to_offer` | 20261014001700_hr_letter_effects.sql | **rpc** |
| `restrict_marketer` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `return_hr_document` | 20261014001400_hr_documents_rpc.sql | **rpc** |
| `review_leave_request` | 20261014002000_hr_imports.sql (+1 earlier) | **rpc** |
| `run_contract_expiry_job` | 20261014001700_hr_letter_effects.sql | **rpc** |
| `safe_auth_uid` | 20260901100000_fix_is_active_staff_uuid_cast.sql |  |
| `save_hr_template_version` | 20261014001400_hr_documents_rpc.sql | **rpc** |
| `set_hr_modules` | 20261014001900_hr_go_live_settings.sql | **rpc** |
| `set_opening_leave_taken` | 20261014002000_hr_imports.sql |  |
| `set_updated_by` | 20261014000100_hr_ops_audit_columns.sql |  |
| `submit_hr_document` | 20261014001700_hr_letter_effects.sql (+1 earlier) | **rpc** |
| `submit_rfq` | 20260901110000_rfq_submit_flow.sql | **rpc** |
| `suspend_marketer` | 20260621100000_marketer_account_authority.sql | **rpc** |
| `sync_training_applicants` | 20261014000200_hr_ops_rls.sql |  |
| `uat_cleanup_on` | 20261014002100_uat_cleanup.sql |  |
| `update_updated_at_column` | supabase/base_schema.sql |  |
| `validate_hr_document` | 20261014001700_hr_letter_effects.sql | **rpc** |
| `validate_nida` | 20260621000000_google_auth_onboarding.sql |  |
| `validate_tin` | 20260621000000_google_auth_onboarding.sql |  |
| `void_hr_document` | 20261014001700_hr_letter_effects.sql (+1 earlier) | **rpc** |
| `void_proforma` | 20260901070000_void_proforma.sql | **rpc** |
