import { supabase } from '@/lib/supabase-client';
import { Payroll } from '@/types';

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
    const data = raw;

    const mapped = data.map(p => ({
        id: p.id,
        employeeId: p.employeeId || p.employee_id || '',
        employeeName: p.employeeName || p.employee_name || '',
        event_id: p.event_id || p.eventid || getLocalPayrolls().find(lp => lp.id === p.id)?.event_id || 'MONTHLY_CORE',
        staff_type: p.staff_type || p.stafftype || getLocalPayrolls().find(lp => lp.id === p.id)?.staff_type || 'permanent',
        days_worked: p.days_worked !== null && p.days_worked !== undefined ? Number(p.days_worked) : undefined,
        daily_rate: p.daily_rate !== null && p.daily_rate !== undefined ? Number(p.daily_rate) : undefined,
        payPeriodStart: p.payPeriodStart || p.pay_period_start || p.payperiodstart,
        payPeriodEnd: p.payPeriodEnd || p.pay_period_end || p.payperiodend,
        basicSalary: Number(p.basicSalary || p.basic_salary || p.basicsalary || 0),
        allowances: Number(p.allowances || p.allowance || 0),
        deductions: Number(p.deductions || p.deduction || 0),
        grossSalary: Number(p.grossSalary || p.gross_salary || p.grosssalary || 0),
        netSalary: Number(p.netSalary || p.net_salary || p.netsalary || 0),
        wcf_contrib: p.wcf_contrib !== null && p.wcf_contrib !== undefined ? Number(p.wcf_contrib) : 0,
        status: p.status || 'Pending',
        paymentDate: p.paymentDate || p.payment_date || p.paymentdate || null,
        createdAt: p.createdAt || p.created_at || p.createdat,
        updatedAt: p.updatedAt || p.updated_at || p.updatedat
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

export const addPayroll = async (payroll: Omit<Payroll, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
    const payrollId = `PAY-${Date.now()}`;
    const now = new Date().toISOString();

    const dbPayroll = {
        id: payrollId,
        employeeId: payroll.employeeId,
        employeeName: payroll.employeeName,
        payPeriodStart: payroll.payPeriodStart,
        payPeriodEnd: payroll.payPeriodEnd,
        basicSalary: Number(payroll.basicSalary),
        allowances: Number(payroll.allowances),
        deductions: Number(payroll.deductions),
        grossSalary: Number(payroll.grossSalary),
        netSalary: Number(payroll.netSalary),
        status: payroll.status,
        paymentDate: payroll.paymentDate,
        event_id: payroll.event_id || 'MONTHLY_CORE',
        staff_type: payroll.staff_type || 'permanent',
        days_worked: payroll.days_worked !== undefined ? Number(payroll.days_worked) : null,
        daily_rate: payroll.daily_rate !== undefined ? Number(payroll.daily_rate) : null,
        wcf_contrib: payroll.wcf_contrib !== undefined ? Number(payroll.wcf_contrib) : 0
    };

    const { data, error } = await supabase.from('payroll').insert([dbPayroll]).select();
    
    if (error) {
        console.warn('Could not insert payroll into Supabase. Creating in localStorage fallback:', error.message);
        
        // Strip out columns if database errors on new columns
        if (error.message.includes('event_id') || error.message.includes('staff_type') || error.message.includes('wcf_contrib')) {
            const stripped = { ...dbPayroll };
            delete (stripped as any).event_id;
            delete (stripped as any).staff_type;
            delete (stripped as any).days_worked;
            delete (stripped as any).daily_rate;
            delete (stripped as any).wcf_contrib;

            const { data: strippedData, error: strippedError } = await supabase.from('payroll').insert([stripped]).select();
            if (!strippedError && strippedData?.[0]) {
                const completed: Payroll = {
                    ...payroll,
                    id: strippedData[0].id,
                    createdAt: strippedData[0].created_at || now,
                    updatedAt: strippedData[0].updated_at || now
                };
                const local = getLocalPayrolls();
                local.push(completed);
                saveLocalPayrolls(local);
                return completed.id;
            }
        }

        // Entirely local fallback
        const localPay: Payroll = {
            ...payroll,
            id: payrollId,
            createdAt: now,
            updatedAt: now
        };
        const local = getLocalPayrolls();
        local.push(localPay);
        saveLocalPayrolls(local);
        return payrollId;
    }

    const created = data?.[0] || dbPayroll;
    const completedRecord: Payroll = {
        ...payroll,
        id: created.id,
        createdAt: created.created_at || now,
        updatedAt: created.updated_at || now
    };

    const local = getLocalPayrolls();
    local.push(completedRecord);
    saveLocalPayrolls(local);

    return completedRecord.id;
};

export const updatePayroll = async (id: string, updatedPayroll: Partial<Payroll>): Promise<boolean> => {
    const dbUpdate: any = {};
    if (updatedPayroll.basicSalary !== undefined) dbUpdate.basicSalary = Number(updatedPayroll.basicSalary);
    if (updatedPayroll.allowances !== undefined) dbUpdate.allowances = Number(updatedPayroll.allowances);
    if (updatedPayroll.deductions !== undefined) dbUpdate.deductions = Number(updatedPayroll.deductions);
    if (updatedPayroll.grossSalary !== undefined) dbUpdate.grossSalary = Number(updatedPayroll.grossSalary);
    if (updatedPayroll.netSalary !== undefined) dbUpdate.netSalary = Number(updatedPayroll.netSalary);
    if (updatedPayroll.status !== undefined) dbUpdate.status = updatedPayroll.status;
    if (updatedPayroll.paymentDate !== undefined) dbUpdate.paymentDate = updatedPayroll.paymentDate;
    if (updatedPayroll.event_id !== undefined) dbUpdate.event_id = updatedPayroll.event_id;
    if (updatedPayroll.staff_type !== undefined) dbUpdate.staff_type = updatedPayroll.staff_type;
    if (updatedPayroll.days_worked !== undefined) dbUpdate.days_worked = Number(updatedPayroll.days_worked);
    if (updatedPayroll.daily_rate !== undefined) dbUpdate.daily_rate = Number(updatedPayroll.daily_rate);
    if (updatedPayroll.wcf_contrib !== undefined) dbUpdate.wcf_contrib = Number(updatedPayroll.wcf_contrib);

    const { error } = await supabase.from('payroll').update({ ...dbUpdate, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.warn('Supabase payroll update failed, updating locally:', error.message);
        
        // Strip custom columns
        if (error.message.includes('event_id') || error.message.includes('staff_type') || error.message.includes('wcf_contrib')) {
            const stripped = { ...dbUpdate };
            delete stripped.event_id;
            delete stripped.staff_type;
            delete stripped.days_worked;
            delete stripped.daily_rate;
            delete stripped.wcf_contrib;
            await supabase.from('payroll').update(stripped).eq('id', id);
        }
    }

    const local = getLocalPayrolls();
    const idx = local.findIndex(p => p.id === id);
    if (idx !== -1) {
        local[idx] = { ...local[idx], ...updatedPayroll, updatedAt: new Date().toISOString() };
        saveLocalPayrolls(local);
    }
    return true;
};
