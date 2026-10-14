# HR & Operations — UAT checklist

User acceptance testing happens on the live system with **test data only**. Everything you create during UAT must be clearly marked, so it can be removed before go-live:

- Use the UAT logins you were invited with (`…+uat-hr-manager@…`, `…+uat-staff@…` and so on). Do **not** test with your real login.
- Only use the UAT employees (`UAT-001` … `UAT-010`, names starting "UAT") and the candidate "UAT Candidate".
- If you add a new employee or candidate during testing, start the first name with **"UAT "** (for example "UAT Peter").
- **Do not run monthly payroll during UAT.** If payroll must run, exclude every `UAT-…` employee from it.
- Contract reminders for the UAT contracts will arrive during UAT. That is expected and part of the test.

How to fill in each table: tick **Pass** or **Fail**, write your name and the date, and add a note for anything unexpected (a screenshot helps). Report every Fail to the developer with the test number.

UAT logins and the employees they are linked to:

| Role | Login | Linked employee |
|---|---|---|
| Admin | `…+uat-admin@…` | UAT-001 UAT Asha Admin |
| General Manager | `…+uat-general-manager@…` | UAT-002 UAT Gabriel Manager |
| HR Manager | `…+uat-hr-manager@…` | UAT-003 UAT Halima Resources |
| Finance | `…+uat-finance@…` | UAT-004 UAT Faraji Accounts |
| Staff | `…+uat-staff@…` | UAT-005 UAT Saida Staffer |

Other test people: UAT-006 (contract ends within 30 days), UAT-007 (contract already overdue), UAT-008 (permanent contract), UAT-009 and UAT-010 (no contract).

---

## 1. Staff (log in as `+uat-staff`)

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| S1 | Apply for leave | Leave → Apply for leave → Annual, 2 working days next month → Send request | Request shows as "Pending"; days counted automatically | | | | |
| S2 | Cannot edit after submitting | Open the pending request | No way to change dates or type; only "Cancel" | | | | |
| S3 | Cancel own pending request | Cancel the request from S1 | Status "Cancelled"; balance unchanged | | | | |
| S4 | Sick leave needs a document | Apply for Sick leave without attaching a file | Refused with a clear message | | | | |
| S5 | Cannot apply for someone else | Apply for leave and look for another employee | Only yourself can be chosen | | | | |
| S6 | No HR areas | Look at the menu | No Candidates, HR Documents, Audit Trail; no Contracts/Disciplinary/Recognition tabs | | | | |
| S7 | Cannot see salaries or warnings | Employee Records → open any employee | No salary, bank, ID or warning details | | | | |
| S8 | Cannot end employment or approve | Look for End Employment, Approve | Not offered | | | | |

## 2. Finance (log in as `+uat-finance`)

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| F1 | Pending cash rewards visible | Payroll page, after test R4 below | "Pending cash rewards" lists UAT employee, amount, date, category | | | | |
| F2 | Mark reward paid | "Mark paid in payroll…" → choose a payslip → Mark as paid | Reward leaves the list (only if a UAT payslip exists — do not create one by running payroll) | | | | |
| F3 | No HR letters or warnings | Look for HR Documents, Candidates, Disciplinary | Not visible | | | | |
| F4 | Cannot approve leave | Leave page | No approval actions | | | | |
| F5 | Payroll still works for real staff (view only) | Payroll page | Payslip history loads as before. **Do not run payroll.** | | | | |

## 3. HR Manager (log in as `+uat-hr-manager`)

### 3a. Leave

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| H1 | Approve leave | Leave → Waiting for approval → approve the staff request (re-file one as staff first) | Approved; balance goes down; attendance shows "Leave" on those days | | | | |
| H2 | Reject needs a reason | Reject a request without a reason | Refused; with a reason it is rejected and staff is notified | | | | |
| H3 | Cancel approved leave | Cancel an approved request | Balance restored; the leave days disappear from attendance | | | | |
| H4 | Cannot approve own leave | File leave for UAT-003 (yourself) and try to approve | Refused; GM or Admin must approve it | | | | |
| H5 | Balances | Leave → Balances | Every UAT employee has balances for this year | | | | |
| H6 | Import opening balances | Leave → Import opening balances → download template → enter 2 UAT rows (one with a wrong leave type) → upload | Preview marks the bad row with a reason; Import imports the good row; the employee's balance shows "taken before go-live" | | | | |
| H7 | Importer is all-or-nothing | Upload a file whose rows all look fine but where one has more days than the person has | Nothing imported; the message names the row | | | | |

### 3b. Letters (one row per letter type)

Before starting: Documents → Templates. Each letter type starts on **DRAFT** wording, which can never be issued. Save test wording for each type first (it will be replaced with the final wording before go-live, step 11 of the runbook).

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| L0 | DRAFT wording blocked | Prepare any letter on a DRAFT template and send for approval | Refused: "written from a DRAFT template"; after saving wording, "Update to latest" on the letter fixes it | | | | |
| L1 | General letter | HR Documents → New → General letter → UAT-009 → send → approve (GM) → issue → download | Reference `ALC/HR/GEN/<year>/<nnnn>`; PDF opens | | | | |
| L2 | Offer | Candidates → UAT Candidate → Prepare offer → approve → issue | Candidate shows "Offer sent"; PDF filed under the candidate | | | | |
| L3 | Offer → employee | Record response "Accepted" → Convert to employee (first name must start "UAT ") | Employee form pre-filled from the offer; candidate linked | | | | |
| L4 | Contract | UAT-009 → Generate letter → Employment contract → approve → issue | Contracts tab shows an active contract from the letter | | | | |
| L5 | Second contract refused | Try another contract for UAT-009 | Refused: already has an active contract | | | | |
| L6 | Extension chain | UAT-006 → Extend (from the dashboard card) → approve → issue | Old contract "Extended", new one starts the next day; chain visible on the Contracts tab | | | | |
| L7 | Void and reissue | Void the extension from L6 with a reason, then issue a corrected one | Void keeps its number and reason; the old contract is active again; the new letter gets the next number | | | | |
| L8 | Warning — self-approval refused | Prepare a warning for UAT-010, send it, try to approve it yourself | Refused; GM approves; issue → Disciplinary tab shows it | | | | |
| L9 | Recognition with cash | UAT-010 → Letter of recognition, cash 50,000 → approve → issue | Recognition tab shows it; Finance sees it as pending (F1) | | | | |
| L10 | Termination — self-approval refused | UAT-008 → Fire / End Employment → Prepare termination letter, last day in 2 weeks; approve it yourself | Refused; employee stays Active until GM approves and you issue | | | | |
| L11 | Termination ends leave | Before L10 is issued, give UAT-008 approved leave after the last day; then issue | Employee Inactive; contract terminated; that leave cancelled (or shortened) and listed in the HR notification | | | | |
| L12 | Certificate of service | UAT-008 (now left) → Generate Certificate of Service → issue | Dates and positions come from the records | | | | |
| L13 | End employment without a letter | UAT-010 → Fire / End Employment → End employment without a letter, give a reason | Inactive immediately, reason kept; recorded in the Audit Trail | | | | |
| L14 | Inactive only by those two ways | Edit an Active UAT employee | No "Inactive" option. An Inactive one can be reactivated (end date cleared) | | | | |

### 3c. Contracts, reminders, importer

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| C1 | Expiring contracts card | Dashboard | UAT-006 listed (ends within 30 days), soonest first, with "Extend" | | | | |
| C2 | Reminder arrives | Next morning after the daily job (or when the developer runs it) | Notification "Contract ends in … days: UAT Juma Expiring" (only once) | | | | |
| C3 | Overdue contract | Next morning | One "Contract overdue" notice for UAT-007; its contract shows Expired | | | | |
| C4 | Import existing contracts | Employee Records → Import existing contracts → template → 3 rows for UAT-009/UAT-010 (one fixed-term without end date) | Bad row shown with reason; others imported (current = active, ended = expired) | | | | |
| C5 | Importer refuses a second active contract | Import an active contract for UAT-005 | Row refused: already has an active contract | | | | |

### 3d. Audit Trail

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| A1 | Changes are recorded | Audit Trail → filter by today | Entries for leave approvals, letters issued/voided, end of employment, imports | | | | |
| A2 | Salaries hidden in the log | Open an entry for an employee or contract | Salary values are not shown, only "changed" | | | | |

## 4. General Manager (log in as `+uat-general-manager`)

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| G1 | Approve HR's warning and termination | Approve the letters from L8 and L10 | Approved; HR can then issue | | | | |
| G2 | Approve HR Manager's own leave | Approve the request from H4 | Approved | | | | |
| G3 | Same HR access as HR Manager | Open Candidates, HR Documents, Audit Trail | All available | | | | |

## 5. Admin (log in as `+uat-admin`)

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| D1 | Users & Access | Settings → Users & Access | UAT logins listed with their roles | | | | |
| D2 | Company details | Settings → General → Company details | Editable by Admin only; shown on letters | | | | |
| D3 | HR module switch | Settings → HR modules: switch "Leave" off, reload | Leave menu item and tab gone; /hr/leave says "Not available yet". Switch it back on | | | | |
| D4 | Switch never hides end-of-employment | Switch "Letter types" off; open Fire / End Employment | "End employment without a letter" still offered. Switch back on | | | | |

## 6. Admin portal (anyone with access)

| # | Test | Steps | Expected result | Pass/Fail | Tester | Date | Notes |
|---|---|---|---|---|---|---|---|
| P1 | Payroll report | Admin portal → payroll report for last month | Loads as before | | | | |
| P2 | Attendance report | Admin portal → attendance report | Loads as before | | | | |

---

## Sign-off

UAT is complete when every row is Pass (or a Fail has been fixed and re-tested).

| | Name | Signature | Date |
|---|---|---|---|
| HR Manager | | | |
| General Manager | | | |

Comments / conditions:

&nbsp;
