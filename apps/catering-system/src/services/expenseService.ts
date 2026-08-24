import { supabase } from '@/lib/supabase-client';
import { Expense } from '@/types';

const EXPENSES_LOCAL_KEY = 'cater_expenses_local';

const getLocalExpenses = (): Expense[] => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(EXPENSES_LOCAL_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        console.error('Error reading local expenses:', e);
        return [];
    }
};

const saveLocalExpenses = (expenses: Expense[]) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(EXPENSES_LOCAL_KEY, JSON.stringify(expenses));
    } catch (e) {
        console.error('Error writing local expenses:', e);
    }
};

export const getExpenses = async (): Promise<Expense[]> => {
    const PAGE = 1000;
    const raw: any[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from('expenses')
            .select('*')
            .order('date', { ascending: false })
            .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) {
            console.warn('Supabase fetch failed for expenses, falling back to localStorage:', error.message);
            return getLocalExpenses();
        }
        if (!data || data.length === 0) break;
        raw.push(...data);
        if (data.length < PAGE) break;
        page++;
    }
    const data = raw;

    const mappedExpenses = data.map(e => ({
        id: e.id,
        event_id: e.event_id || e.eventid || '',
        date: e.date,
        payee: e.payee,
        ref_number: e.ref_number || e.refnumber,
        category: e.category,
        description: e.description,
        amount: Number(e.amount),
        vat_amount: Number(e.vat_amount || e.vatamount || 0),
        payment_md: e.payment_md || e.paymentmd || 'cash',
        created_at: e.created_at,
        updated_at: e.updated_at
    })) as Expense[];

    saveLocalExpenses(mappedExpenses);
    return mappedExpenses;
};

export const addExpense = async (expense: Omit<Expense, 'id' | 'created_at' | 'updated_at'>): Promise<Expense | null> => {
    const expenseId = typeof crypto !== 'undefined' ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const now = new Date().toISOString();

    const dbExpense = {
        event_id: expense.event_id,
        date: expense.date,
        payee: expense.payee,
        ref_number: expense.ref_number,
        category: expense.category,
        description: expense.description,
        amount: Number(expense.amount),
        vat_amount: Number(expense.vat_amount || 0),
        payment_md: expense.payment_md
    };

    const { data, error } = await supabase.from('expenses').insert([dbExpense]).select().single();
    
    if (error) {
        console.warn('Supabase expense insert failed. Saving locally:', error.message);
        const localExp: Expense = {
            ...expense,
            id: expenseId,
            created_at: now,
            updated_at: now
        };
        const localExpenses = getLocalExpenses();
        localExpenses.push(localExp);
        saveLocalExpenses(localExpenses);
        return localExp;
    }

    const createdExpense: Expense = {
        ...expense,
        id: data.id,
        created_at: data.created_at || now,
        updated_at: data.updated_at || now
    };

    const localExpenses = getLocalExpenses();
    localExpenses.push(createdExpense);
    saveLocalExpenses(localExpenses);

    return createdExpense;
};

export const updateExpense = async (id: string, updated: Partial<Omit<Expense, 'id' | 'created_at' | 'updated_at'>>): Promise<boolean> => {
    const dbUpdate: any = {};
    if (updated.event_id !== undefined) dbUpdate.event_id = updated.event_id;
    if (updated.date !== undefined) dbUpdate.date = updated.date;
    if (updated.payee !== undefined) dbUpdate.payee = updated.payee;
    if (updated.ref_number !== undefined) dbUpdate.ref_number = updated.ref_number;
    if (updated.category !== undefined) dbUpdate.category = updated.category;
    if (updated.description !== undefined) dbUpdate.description = updated.description;
    if (updated.amount !== undefined) dbUpdate.amount = Number(updated.amount);
    if (updated.vat_amount !== undefined) dbUpdate.vat_amount = Number(updated.vat_amount);
    if (updated.payment_md !== undefined) dbUpdate.payment_md = updated.payment_md;

    const { error } = await supabase.from('expenses').update({ ...dbUpdate, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.warn('Supabase expense update failed, updating locally:', error.message);
    }

    const localExpenses = getLocalExpenses();
    const idx = localExpenses.findIndex(e => e.id === id);
    if (idx !== -1) {
        localExpenses[idx] = { ...localExpenses[idx], ...updated, updated_at: new Date().toISOString() };
        saveLocalExpenses(localExpenses);
    }
    return true;
};

export const deleteExpense = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) {
        console.warn('Supabase expense delete failed, deleting locally:', error.message);
    }

    const localExpenses = getLocalExpenses();
    const filtered = localExpenses.filter(e => e.id !== id);
    saveLocalExpenses(filtered);
    return true;
};
