# Data readiness 04: test and demo orders (for confirmation)

`orders.is_test` (migration `20261018150000_orders_is_test.sql`) marks an
order as a test, so analytics, the ML exports and the Data Quality page
leave it out. **Nothing has been flagged.** Confirm the list below, then flag
each order in **Orders → edit → "Exclude from analytics (test order)"**
(admins only), or with the SQL at the end.

## 1. From the UAT files

The brief asked for the UAT and demo order IDs in `scripts/setup-uat.js` and
`supabase/migrations/*uat_cleanup*.sql`. **There are none.** Both files cover
the HR & Operations UAT only: employees `UAT-001` … `UAT-010`, one login per
role (`+uat-<role>` e-mails) and a candidate "UAT Candidate". They create and
remove no orders, events, clients or menus. The same is true of
`docs/hr-ops/cleanup-uat.sql` and `scripts/cleanup-uat.js`.

## 2. Candidates found in the data (staging = production copy, 2026-10-18)

No order name or description mentions test, demo, UAT, sample or dummy. The
orders below have **no client**, which is the only sign of test data found.
They are listed by ID only.

| Order | Created | Events | Price × pax | Invoiced | Menus | Looks like |
| --- | --- | --- | --- | --- | --- | --- |
| ORD-00704 … ORD-00718 (15 orders) | 2026-04-14 | 1 each | 18,000 × 40, all identical | no | none | **Likely test or bulk-entry data**: 15 identical orders on one day, no client, never invoiced, no menu |
| ORD-00529 | 2026-02-05 | 1 | 4,800 × 50 | no | none | unclear |
| ORD-00548 | 2026-02-05 | 1 | 29,998 × 7 | no | none | unclear (odd price) |
| ORD-00636 | 2026-04-04 | 1 | 0 × 5 | no | 1 | unclear (zero price) |
| ORD-00882 | 2026-05-05 | 2 | 8,000 × 15; 12,000 × 15 | yes | 2 | real (invoiced), client missing |
| ORD-02742 | 2026-09-22 | 1 | 17,000 × 15 | yes | none | real (invoiced), client missing |
| ORD-02975, ORD-02976, ORD-02977 | 2026-10-09 | 1 each | 20,000 × 5 | yes | none | real (invoiced), client missing |

"Invoiced" = the order id appears in an invoice. Orders that were invoiced
are real sales even without a client; fix their client rather than flag
them.

**To confirm:** ORD-00704 … ORD-00718, and whether ORD-00529, ORD-00548 and
ORD-00636 are real.

## 3. Flagging (after confirmation, production)

```sql
UPDATE public.orders SET is_test = true
WHERE id IN ('ORD-00704', 'ORD-00705', 'ORD-00706', 'ORD-00707', 'ORD-00708',
             'ORD-00709', 'ORD-00710', 'ORD-00711', 'ORD-00712', 'ORD-00713',
             'ORD-00714', 'ORD-00715', 'ORD-00716', 'ORD-00717', 'ORD-00718');
-- edit the list to the confirmed IDs before running
```
