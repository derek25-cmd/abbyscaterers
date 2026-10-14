/**
 * UAT setup for the HR & Operations module, on the main database.
 *
 * Creates clearly marked test data that docs/hr-ops/cleanup-uat.sql (or
 * scripts/cleanup-uat.js) removes before go-live:
 *   - 10 employees UAT-001 ... UAT-010, first names starting "UAT "
 *   - one login per role, emails <you>+uat-<role>@<your domain>, sent an invite
 *     link (never a password), each linked to a UAT employee
 *   - contracts (one ending within 30 days, one already overdue), leave
 *     balances for this year, and a candidate named "UAT Candidate"
 * It never touches or links a real employee, never runs payroll, and is safe to
 * run again: anything that already exists is left as it is.
 *
 * Usage (from the repo root):
 *   node scripts/setup-uat.js --base-email you@example.com [--app-url https://...hosted.app]
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY
 * in the environment or a .env file. Run it only from your own machine.
 */
// Environment: real variables first, then .env and apps/catering-system/.env.local if present (Node 20.12+).
for (const file of ['.env', 'apps/catering-system/.env.local']) {
  try { process.loadEnvFile(file); } catch { /* not there: fine */ }
}
const { createClient } = require('@supabase/supabase-js');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const baseEmail = arg('base-email');
const appUrl = arg('app-url') || 'https://studio--catersmart-client-manager.us-central1.hosted.app';
if (!baseEmail || !/^[^@\s+]+@[^@\s]+\.[^@\s]+$/.test(baseEmail)) {
  console.error('Usage: node scripts/setup-uat.js --base-email you@example.com [--app-url https://...]');
  console.error('The base address must not already contain "+": the script adds +uat-<role>.');
  process.exit(1);
}

const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const [local, domain] = baseEmail.split('@');
const uatEmail = (role) => `${local}+uat-${role.replace('_', '-')}@${domain}`;

// Dar es Salaam dates, as the app uses.
const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Dar_es_Salaam' });
const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const year = Number(today.slice(0, 4));

const EMPLOYEES = [
  // id, first name, last name, department, job title, salary, linked login
  ['UAT-001', 'UAT Asha', 'Admin', 'Management', 'Operations Director', 2500000, 'admin'],
  ['UAT-002', 'UAT Gabriel', 'Manager', 'Management', 'General Manager', 2400000, 'general_manager'],
  ['UAT-003', 'UAT Halima', 'Resources', 'Management', 'HR Manager', 1800000, 'hr_manager'],
  ['UAT-004', 'UAT Faraji', 'Accounts', 'Management', 'Accountant', 1500000, 'finance'],
  ['UAT-005', 'UAT Saida', 'Staffer', 'Kitchen', 'Cook', 700000, 'staff'],
  ['UAT-006', 'UAT Juma', 'Expiring', 'Kitchen', 'Assistant Cook', 600000, null],
  ['UAT-007', 'UAT Neema', 'Overdue', 'Service', 'Waiter', 450000, null],
  ['UAT-008', 'UAT Baraka', 'Permanent', 'Logistics', 'Driver', 550000, null],
  ['UAT-009', 'UAT Zawadi', 'Sales', 'Sales', 'Sales Officer', 900000, null],
  ['UAT-010', 'UAT Musa', 'Service', 'Service', 'Head Waiter', 650000, null],
];

const CONTRACTS = [
  // employee, type, start, end, position, salary
  ['UAT-005', 'fixed_term', addDays(today, -200), addDays(today, 165), 'Cook', 700000],
  ['UAT-006', 'fixed_term', addDays(today, -340), addDays(today, 25), 'Assistant Cook', 600000],   // ends within 30 days
  ['UAT-007', 'fixed_term', addDays(today, -370), addDays(today, -5), 'Waiter', 450000],           // overdue: past its end, still active
  ['UAT-008', 'permanent', addDays(today, -800), null, 'Driver', 550000],
];

const report = { created: [], existing: [], invited: [], problems: [] };

async function upsertEmployees() {
  for (const [id, firstName, lastName, department, role, monthlySalary] of EMPLOYEES) {
    const { data: found } = await db.from('employees').select('id').eq('id', id).maybeSingle();
    if (found) { report.existing.push(`employee ${id}`); continue; }
    const { error } = await db.from('employees').insert({
      id, firstName, lastName, department, role, monthlySalary, status: 'Active',
      employmentStartDate: addDays(today, -400),
    });
    if (error) report.problems.push(`employee ${id}: ${error.message}`);
    else report.created.push(`employee ${id} ${firstName} ${lastName}`);
  }
}

async function findAuthUser(email) {
  for (let page = 1; page < 50; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function upsertLogins() {
  for (const [employeeId, , , , , , role] of EMPLOYEES) {
    if (!role) continue;
    const email = uatEmail(role);
    let user = await findAuthUser(email);
    if (!user) {
      const { data, error } = await db.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl}/login` });
      if (error) { report.problems.push(`invite ${email}: ${error.message}`); continue; }
      user = data.user;
      report.invited.push(`${email} (${role}) → linked to ${employeeId}`);
    } else {
      report.existing.push(`login ${email}`);
    }
    const { error } = await db.from('staff_users')
      .upsert({ id: user.id, email, role, is_active: true, employee_id: employeeId }, { onConflict: 'id' });
    if (error) report.problems.push(`staff_users ${email}: ${error.message}`);
  }
}

async function upsertContracts() {
  for (const [employee_id, contract_type, start_date, end_date, position, salary] of CONTRACTS) {
    const { data: any } = await db.from('employment_contracts').select('id').eq('employee_id', employee_id).limit(1);
    if (any && any.length) { report.existing.push(`contract for ${employee_id}`); continue; }
    const { error } = await db.from('employment_contracts').insert({
      employee_id, contract_type, start_date, end_date, position, salary, notice_days: 30, status: 'active', source: 'legacy',
    });
    if (error) report.problems.push(`contract ${employee_id}: ${error.message}`);
    else report.created.push(`contract ${employee_id} ${contract_type} ${start_date} → ${end_date || 'permanent'}`);
  }
}

async function upsertBalances() {
  const { data: types, error } = await db.from('leave_types').select('id, name, days_per_year').eq('tracks_balance', true).eq('is_active', true);
  if (error) { report.problems.push(`leave types: ${error.message}`); return; }
  const rows = [];
  for (const [employee_id] of EMPLOYEES) for (const t of types) rows.push({ employee_id, leave_type_id: t.id, year, entitled: t.days_per_year });
  const { data, error: e2 } = await db.from('leave_balances')
    .upsert(rows, { onConflict: 'employee_id,leave_type_id,year', ignoreDuplicates: true }).select('id');
  if (e2) report.problems.push(`leave balances: ${e2.message}`);
  else report.created.push(`${(data || []).length} leave balance row(s) for ${year} (others already existed)`);
}

async function upsertCandidate() {
  const { data: found } = await db.from('candidates').select('id').eq('full_name', 'UAT Candidate').maybeSingle();
  if (found) { report.existing.push('candidate UAT Candidate'); return; }
  const { error } = await db.from('candidates').insert({
    full_name: 'UAT Candidate', position: 'Pastry Chef', department: 'Kitchen', proposed_salary: 800000,
    proposed_start_date: addDays(today, 30), address: 'Test address, Dar es Salaam', notes: 'UAT test candidate',
  });
  if (error) report.problems.push(`candidate: ${error.message}`);
  else report.created.push('candidate UAT Candidate');
}

(async () => {
  console.log(`UAT setup on ${url} for ${baseEmail} (today ${today}, Dar es Salaam)\n`);
  await upsertEmployees();
  await upsertLogins();
  await upsertContracts();
  await upsertBalances();
  await upsertCandidate();

  const section = (title, list) => { if (list.length) console.log(`${title}:\n  ${list.join('\n  ')}\n`); };
  section('Created', report.created);
  section('Invited (check the inbox of the base address)', report.invited);
  section('Already there (left unchanged)', report.existing);
  section('PROBLEMS', report.problems);
  console.log('Reminder: do not run monthly payroll during UAT, or exclude the UAT-* employees if it must run.');
  process.exit(report.problems.length ? 1 : 0);
})().catch((err) => { console.error(err); process.exit(1); });
