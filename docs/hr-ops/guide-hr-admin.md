# HR system guide — Admin, HR Manager and General Manager

This guide covers the HR part of the system: leave, letters, candidates, contracts, ending employment, the Audit Trail and the importers. It is for the people who run HR: the **Admin**, the **HR Manager** and the **General Manager**.

## 1. Who can do what

Everyone signs in with their own login. Each login has one role:

| Role | Can do |
|---|---|
| **Admin** | Everything HR can do, plus Settings: users and roles, company details, the HR module switch |
| **HR Manager** | All HR work: employees, leave, letters, candidates, contracts, Audit Trail |
| **General Manager** | The same HR work as the HR Manager |
| **Finance** | Payroll, and the list of cash rewards waiting to be paid. No letters, no warnings |
| **Staff** | Apply for their own leave, record attendance and training. Cannot change anything after submitting it (attendance only on the same day) |

Two rules apply to everyone, including Admin:

- **Nobody approves their own leave.** Another Admin, HR Manager or General Manager must do it.
- **Warning and termination letters need a second person.** The person who wrote the letter cannot approve it.

That is why at least two different people must hold Admin, HR Manager or General Manager.

Users and roles are managed by the Admin in **Settings → Users & Access**.

## 2. Leave

### Approving or rejecting

1. Open **Leave**. The **Waiting for approval** tab lists every pending request.
2. Open a request. You see the dates, the working days counted and the person's balance.
3. Click **Approve**, or **Reject** and give a short reason (the employee sees it).

When you approve, the days come off the balance and appear as "Leave" on the attendance sheet. If attendance is already recorded on some of those days, the system tells you which ones: correct the attendance first. Days marked Absent can be replaced if you choose to.

### Cancelling approved leave

Open the request → **Cancel**. The days go back on the balance and the leave days disappear from the attendance sheet. Attendance entered by hand is never touched.

### Balances

**Leave → Balances** shows the days left for each person and each leave type. Click a figure to change the entitlement or the days carried over from last year. A new year's balances are set up automatically on 1 January. You can also do it yourself with **Set up <year> balances** on the Balances tab, for example for someone hired mid-year.

### Leave types and holidays

**Leave → Leave types & holidays**: change days per year, carry-over limits and which types need a document, and add public holidays (including moving holidays such as Eid). Holidays and Sundays are not counted as leave days.

## 3. Letters

Every HR letter goes through the same steps:

1. **Draft:** you write it. You can change it freely.
2. **Waiting for approval:** you send it. It can no longer be edited, but the approver can **Return for changes** with a note.
3. **Approved:** the approver (Admin, HR Manager or General Manager) approves it. Their name becomes the signatory unless you set one.
4. **Issued:** you click **Issue**. The system gives it a reference number (`ALC/HR/<type>/<year>/<number>`), creates the PDF and stores it. Only then does the letter take effect.

Issued letters can be downloaded from **HR Documents** or from the employee's **Documents** tab at any time.

### The eight letter types

| Letter | Code | When issued, it… |
|---|---|---|
| General letter | GEN | Nothing else changes |
| Offer letter | OFF | Marks the candidate "Offer sent" (see section 5) |
| Employment contract | CON | Creates the employee's current contract |
| Contract extension | EXT | Marks the old contract "Extended" and starts a new one the day after it ends |
| Termination letter | TER | Ends the employment (see section 7). Needs a second person to approve |
| Warning letter | WRN | Adds a warning to the confidential Disciplinary tab. Needs a second person to approve |
| Letter of recognition | REC | Adds it to the Recognition tab; a cash reward waits for payroll |
| Certificate of service | COS | Only for someone who has left. Dates and positions come from the records |

**To write a letter:** HR Documents → **New document**, or from the employee's page → **Generate letter**. Choose the type and the person, fill in the form (the preview on the right shows the letter as it will print), add a subject, then **Save** or **Send for approval**.

### Templates and versions

The wording of each letter type is a **template** (HR Documents → **Templates**). Words in double braces, such as `{{employee.fullName}}`, are filled in automatically. The list beside the editor shows the ones available for that type.

- Saving a template creates a **new version**. Letters already written keep the version they were written with, so an issued letter never changes.
- A draft written on an older version shows **"A newer template exists — Update to latest"**. Click it to use the new wording.
- Each letter type starts with **DRAFT** wording. A letter written from DRAFT wording can never be sent, approved or issued. The HR Manager replaces it with the final wording before go-live.

## 4. Voiding a letter

A wrong letter that has been issued cannot be edited or deleted: it is **voided**, and a correct one is issued.

1. Open the letter → **Void** → give the reason.
2. The letter keeps its number, file and reason, marked VOID. Numbers are never reused.
3. What voiding undoes:
   - contract: the contract is voided;
   - extension: the extension is voided and the previous contract becomes current again;
   - warning or recognition: the record is voided;
   - offer: the candidate goes back to "No offer".
   - **A termination is not undone:** the person stays Inactive. If they should come back, reactivate them by hand (section 7).
4. Write and issue the corrected letter. It gets the next number.

## 5. Candidates and offers

**Candidates** holds people you may hire.

1. **Add candidate:** name, contact, position, proposed salary and start date.
2. **Prepare offer:** writes an offer letter for them. Approve and issue it as usual. The candidate shows "Offer sent".
3. When they answer, use **Record response**: Accepted, Declined or Withdrawn. An offer whose reply date passes without an answer becomes "Expired" automatically.
4. When they have accepted: **Convert to employee**. The new employee form opens filled in from the offer. Check it and save. The candidate is then linked to the new employee.

## 6. Contracts and reminders

Each employee's **Contracts** tab shows their contracts in order, including extensions. Only one contract can be current at a time.

- **Existing paper contracts:** use **Record an existing contract** on the Contracts tab for one person, or the importer for many at once (section 10).
- **Reminders:** every morning the system checks current contracts. HR gets a notification 60, 30 and 7 days before a contract ends, and one more if it passes its end date with no decision, at which point it is marked Expired.
- The **Dashboard** shows **Expiring contracts** for the next 60 days, soonest first. **Extend** opens an extension letter for that person.

## 7. Ending employment

Employee Records → the **⋯** menu on the employee → **Fire / End Employment**. There are two ways:

1. **Prepare termination letter** (recommended). Nothing changes until the letter is approved by someone else and issued. On issue, the person becomes Inactive with the last working day and reason recorded.
2. **End employment without a letter.** Only when there is no letter to send, for example someone who stopped coming. It takes effect immediately and needs a reason.

Either way:
- the current contract is marked "Terminated";
- approved leave after the last working day is cancelled and its days returned;
- leave that runs past the last day is shortened;
- pending requests are cancelled.

HR gets a notification listing what changed. After that you can issue a **Certificate of service**.

You cannot make someone Inactive by editing them. To bring someone back, edit them and choose **Active (reactivate)**: the end date and reason are cleared, and this is recorded.

## 8. Warnings and rewards

- **Warnings** appear on the employee's **Disciplinary** tab. Only Admin, HR Manager and General Manager can see them. A warning stays "in force" until its expiry date (12 months unless you set another). An employee with warnings in force shows a badge on their profile.
- **Rewards** appear on the **Recognition** tab. A **cash** reward appears on the Payroll page under **Pending cash rewards**. Pay it with the payroll, then click **Mark paid in payroll…** and choose the payslip. Payroll figures are not changed automatically.

## 9. Audit Trail

**Audit Trail** lists every change to HR records: who, when and what. This includes leave decisions, letters, contracts, ending employment, imports and settings. Salaries, bank details and letter contents are recorded only as "changed", never as values. Entries can't be edited or removed.

## 10. Importing existing data

Both importers work the same way:

1. Click the import button and **Download template**.
2. Fill it in, one row per line (at most 500 rows), and save it as CSV.
3. **Choose CSV file**. A preview checks every row and shows why any row would be skipped.
4. Click **Import**. The good rows are imported **together**. If the system refuses any of them, none are imported and the message names the row. Fix it and try again.

| Importer | Where | Columns |
|---|---|---|
| **Existing contracts** | Employee Records → Import existing contracts | employee id, contract type (permanent / fixed_term / probation / casual), start date, end date (blank only for permanent), position, salary, notice days |
| **Opening balances** | Leave → Import opening balances | employee id, leave type (e.g. Annual), year, days taken before go-live |

- Dates are written `yyyy-mm-dd`, for example `2026-03-01`.
- A contract whose end date has already passed is recorded as a past contract; any other contract becomes the current one.
- Opening balances are only for the go-live year. They are kept separately from leave taken through the system and reduce what is left.

## 11. If something goes wrong: the HR module switch

The Admin can hide parts of the HR system in **Settings → HR modules**: Audit Trail, Leave, HR Documents, Letter types and Candidates. A hidden module disappears from the menus and its pages say "Not available yet". Nothing is deleted, and the rules about who may do what still apply. "End employment without a letter" and Users & Access are never hidden. Tick it again to bring it back.
