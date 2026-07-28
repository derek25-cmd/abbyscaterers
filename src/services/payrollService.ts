import { supabase } from '@/lib/supabase-client';
import { Payroll } from '@/types';
import { logAuditEvent } from '@/lib/audit-log';
import { calculatePayroll, type PayrollBreakdown } from '@/lib/payrollEngine';
import { getActiveTaxRates } from '@/services/taxRatesService';
import { getEmployees } from '@/services/employeeService';

const PAYROLL_LOCAL_KEY = 'cater_payroll_local';

const getLocalPayrolls = (): Payroll[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(PAYROLL_LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Error reading local payroll:', e);
        return [];
    }
};

const saveLocalPayrolls = (records: Payroll[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(PAYROLL_LOCAL_KEY, JSON.stringify(records));
    } catch (e) {
        console.error('Error writing local payroll:', e);
    }
};

export const getPayrolls = async (): Promise<Payroll[]> => {
    const PAGE = 1000;
    const raw: any[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from('payroll')
            .select('*')
            .order('payPeriodStart', { ascending: false })
            .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) {
            console.warn('Supabase fetch failed for payroll, falling back to localStorage:', error.message);
            return getLocalPayrolls();
        }
        if (!data || data.length === 0) break;
        raw.push(...data);
        if (data.length < PAGE) break;
        page++;
    }

    const mapped = raw.map(p => ({
        id: p.id,
        employeeId: p.employeeId,
        employeeName: p.employeeName,
        event_id: p.event_id || 'MONTHLY_CORE',
        staff_type: p.staff_type || 'permanent',
        days_worked: p.days_worked !== null && p.days_worked !== undefined ? Number(p.days_worked) : undefined,
        daily_rate: p.daily_rate !== null && p.daily_rate !== undefined ? Number(p.daily_rate) : undefined,
        payPeriodStart: p.payPeriodStart,
        payPeriodEnd: p.payPeriodEnd,
        basicSalary: Number(p.basicSalary || 0),
        allowances: Number(p.allowances || 0),
        deductions: Number(p.deductions || 0),
        grossSalary: Number(p.grossSalary || 0),
        netSalary: Number(p.netSalary || 0),
        paye_amount: Number(p.paye_amount || 0),
        nssf_employee: Number(p.nssf_employee || 0),
        nssf_employer: Number(p.nssf_employer || 0),
        sdl_amount: Number(p.sdl_amount || 0),
        other_deductions: Number(p.other_deductions || 0),
        tax_rate_version_id: p.tax_rate_version_id ?? null,
        wcf_contrib: Number(p.wcf_contrib || 0),
        status: p.status || 'Pending',
        paymentDate: p.paymentDate || null,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
    })) as Payroll[];

    // Sync remote and local
    const local = getLocalPayrolls();
    const merged = [...local];
    mapped.forEach(m => {
        const idx = merged.findIndex(l => l.id === m.id);
        if (idx === -1) {
            merged.push(m);
        } else {
            merged[idx] = { ...merged[idx], ...m };
        }
    });
    saveLocalPayrolls(merged);

    return mapped;
};

export interface AddPayrollInput {
    employeeId: string;
    employeeName: string;
    staffType: 'permanent' | 'casual';
    monthlySalary?: number;
    daysWorked?: number;
    dailyRate?: number;
    allowances: number;
    otherDeductions: number;
    payPeriodStart: string;
    payPeriodEnd: string;
    event_id?: string;
    status: 'Paid' | 'Pending';
    paymentDate?: string | null;
}

/** Runs the calculation engine against the currently-active tax rates. Throws if none are configured — payroll should never silently compute against a missing/zeroed rate set. */
async function computeBreakdown(input: {
    staffType: 'permanent' | 'casual';
    monthlySalary?: number;
    daysWorked?: number;
    dailyRate?: number;
    allowances: number;
    otherDeductions: number;
}): Promise<{ breakdown: PayrollBreakdown; taxRateVersionId: string }> {
    const rates = await getActiveTaxRates();
    if (!rates) {
        throw new Error('No active tax rates are configured. Set up tax rates in HR > Payroll > Tax Rates before generating payroll.');
    }
    const breakdown = calculatePayroll(input, rates);
    return { breakdown, taxRateVersionId: rates.id };
}

export const addPayroll = async (input: AddPayrollInput): Promise<string> => {
    const { breakdown, taxRateVersionId } = await computeBreakdown(input);

    const payrollId = `PAY-${Date.now()}`;
    const now = new Date().toISOString();

    const dbPayroll = {
        id: payrollId,
        employeeId: input.employeeId,
        employeeName: input.employeeName,
        payPeriodStart: input.payPeriodStart,
        payPeriodEnd: input.payPeriodEnd,
        basicSalary: breakdown.basicSalary,
        allowances: input.allowances,
        deductions: breakdown.deductions,
        grossSalary: breakdown.grossSalary,
        netSalary: breakdown.netSalary,
        paye_amount: breakdown.payeAmount,
        nssf_employee: breakdown.nssfEmployee,
        nssf_employer: breakdown.nssfEmployer,
        sdl_amount: breakdown.sdlAmount,
        other_deductions: breakdown.otherDeductions,
        wcf_contrib: breakdown.wcfContrib,
        tax_rate_version_id: taxRateVersionId,
        status: input.status,
        paymentDate: input.paymentDate ?? null,
        event_id: input.event_id || 'MONTHLY_CORE',
        staff_type: input.staffType,
        days_worked: input.daysWorked ?? null,
        daily_rate: input.dailyRate ?? null,
    };

    const { data, error } = await supabase.from('payroll').insert([dbPayroll]).select().single();

    if (error) {
        console.warn('Could not insert payroll into Supabase. Creating in localStorage fallback:', error.message);
        const localPay: Payroll = {
            employeeId: input.employeeId,
            employeeName: input.employeeName,
            payPeriodStart: input.payPeriodStart,
            payPeriodEnd: input.payPeriodEnd,
            basicSalary: breakdown.basicSalary,
            allowances: input.allowances,
            deductions: breakdown.deductions,
            grossSalary: breakdown.grossSalary,
            netSalary: breakdown.netSalary,
            paye_amount: breakdown.payeAmount,
            nssf_employee: breakdown.nssfEmployee,
            nssf_employer: breakdown.nssfEmployer,
            sdl_amount: breakdown.sdlAmount,
            other_deductions: breakdown.otherDeductions,
            wcf_contrib: breakdown.wcfContrib,
            tax_rate_version_id: taxRateVersionId,
            status: input.status,
            paymentDate: input.paymentDate ?? null,
            event_id: input.event_id || 'MONTHLY_CORE',
            staff_type: input.staffType,
            days_worked: input.daysWorked,
            daily_rate: input.dailyRate,
            id: payrollId,
            createdAt: now,
            updatedAt: now,
        };
        const local = getLocalPayrolls();
        local.push(localPay);
        saveLocalPayrolls(local);
        return payrollId;
    }

    const local = getLocalPayrolls();
    local.push({ ...data, id: data.id } as Payroll);
    saveLocalPayrolls(local);

    void logAuditEvent('payroll.create', 'payroll', data.id, {
        employeeId: input.employeeId,
        netSalary: breakdown.netSalary,
        grossSalary: breakdown.grossSalary,
    });

    return data.id;
};

export const updatePayroll = async (id: string, updatedPayroll: Partial<Payroll>): Promise<boolean> => {
    const dbUpdate: any = {};
    if (updatedPayroll.basicSalary !== undefined) dbUpdate.basicSalary = Number(updatedPayroll.basicSalary);
    if (updatedPayroll.allowances !== undefined) dbUpdate.allowances = Number(updatedPayroll.allowances);
    if (updatedPayroll.deductions !== undefined) dbUpdate.deductions = Number(updatedPayroll.deductions);
    if (updatedPayroll.grossSalary !== undefined) dbUpdate.grossSalary = Number(updatedPayroll.grossSalary);
    if (updatedPayroll.netSalary !== undefined) dbUpdate.netSalary = Number(updatedPayroll.netSalary);
    if (updatedPayroll.paye_amount !== undefined) dbUpdate.paye_amount = Number(updatedPayroll.paye_amount);
    if (updatedPayroll.nssf_employee !== undefined) dbUpdate.nssf_employee = Number(updatedPayroll.nssf_employee);
    if (updatedPayroll.nssf_employer !== undefined) dbUpdate.nssf_employer = Number(updatedPayroll.nssf_employer);
    if (updatedPayroll.sdl_amount !== undefined) dbUpdate.sdl_amount = Number(updatedPayroll.sdl_amount);
    if (updatedPayroll.other_deductions !== undefined) dbUpdate.other_deductions = Number(updatedPayroll.other_deductions);
    if (updatedPayroll.wcf_contrib !== undefined) dbUpdate.wcf_contrib = Number(updatedPayroll.wcf_contrib);
    if (updatedPayroll.tax_rate_version_id !== undefined) dbUpdate.tax_rate_version_id = updatedPayroll.tax_rate_version_id;
    if (updatedPayroll.status !== undefined) dbUpdate.status = updatedPayroll.status;
    if (updatedPayroll.paymentDate !== undefined) dbUpdate.paymentDate = updatedPayroll.paymentDate;
    if (updatedPayroll.event_id !== undefined) dbUpdate.event_id = updatedPayroll.event_id;
    if (updatedPayroll.staff_type !== undefined) dbUpdate.staff_type = updatedPayroll.staff_type;
    if (updatedPayroll.days_worked !== undefined) dbUpdate.days_worked = Number(updatedPayroll.days_worked);
    if (updatedPayroll.daily_rate !== undefined) dbUpdate.daily_rate = Number(updatedPayroll.daily_rate);

    const { error } = await supabase.from('payroll').update({ ...dbUpdate, updatedAt: new Date().toISOString() }).eq('id', id);
    const dbUpdateSucceeded = !error;
    if (error) {
        console.warn('Supabase payroll update failed, updating locally:', error.message);
    }

    const local = getLocalPayrolls();
    const idx = local.findIndex(p => p.id === id);
    if (idx !== -1) {
        local[idx] = { ...local[idx], ...updatedPayroll, updatedAt: new Date().toISOString() };
        saveLocalPayrolls(local);
    }

    // Only log the audit event if the database write actually succeeded —
    // an audit log entry claiming an update happened when it didn't (the
    // change only landed in localStorage, which never syncs anywhere) would
    // be worse than no entry at all.
    if (dbUpdateSucceeded) {
        void logAuditEvent('payroll.update', 'payroll', id, { fields: Object.keys(dbUpdate) });
    }

    // Report the real outcome — callers (e.g. "Mark as Paid") need to know
    // if the change actually reached the shared database, not just that a
    // localStorage copy was updated.
    return dbUpdateSucceeded;
};

export interface MonthlyPayrollRunResult {
    created: Payroll[];
    skipped: { employeeId: string; employeeName: string; reason: string }[];
}

/**
 * Batch-generates payslips for every active, permanent employee for a pay
 * period. Casual staff are not included — their days_worked/daily_rate is
 * per-event/manual and doesn't fit a uniform monthly run.
 */
export const runMonthlyPayroll = async (
    payPeriodStart: string,
    payPeriodEnd: string
): Promise<MonthlyPayrollRunResult> => {
    const [employees, rates] = await Promise.all([getEmployees(), getActiveTaxRates()]);

    if (!rates) {
        throw new Error('No active tax rates are configured. Set up tax rates in HR > Payroll > Tax Rates before running payroll.');
    }

    const created: Payroll[] = [];
    const skipped: MonthlyPayrollRunResult['skipped'] = [];

    for (const employee of employees) {
        if (employee.status !== 'Active') continue;
        // yyyy-MM-dd strings compare lexicographically the same as chronologically.
        if (employee.employmentStartDate && employee.employmentStartDate > payPeriodEnd) {
            skipped.push({
                employeeId: employee.id,
                employeeName: `${employee.firstName} ${employee.lastName}`,
                reason: `Not yet employed during this pay period (starts ${employee.employmentStartDate})`,
            });
            continue;
        }
        if (!employee.monthlySalary || employee.monthlySalary <= 0) {
            skipped.push({ employeeId: employee.id, employeeName: `${employee.firstName} ${employee.lastName}`, reason: 'No monthly salary set' });
            continue;
        }

        const breakdown = calculatePayroll(
            { staffType: 'permanent', monthlySalary: employee.monthlySalary, allowances: 0, otherDeductions: 0 },
            rates
        );

        const id = await addPayroll({
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            staffType: 'permanent',
            monthlySalary: employee.monthlySalary,
            allowances: 0,
            otherDeductions: 0,
            payPeriodStart,
            payPeriodEnd,
            status: 'Pending',
        });

        created.push({
            id,
            employeeId: employee.id,
            employeeName: `${employee.firstName} ${employee.lastName}`,
            payPeriodStart,
            payPeriodEnd,
            allowances: 0,
            ...breakdown,
            paye_amount: breakdown.payeAmount,
            nssf_employee: breakdown.nssfEmployee,
            nssf_employer: breakdown.nssfEmployer,
            sdl_amount: breakdown.sdlAmount,
            other_deductions: breakdown.otherDeductions,
            wcf_contrib: breakdown.wcfContrib,
            status: 'Pending',
            paymentDate: null,
            staff_type: 'permanent',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        } as Payroll);
    }

    return { created, skipped };
};
