import { supabase } from '@/lib/supabase-client';
import { Supplier } from '@/types';

const LOCAL_KEY = 'cater_suppliers_local';

const getLocal = (): Supplier[] => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'); } catch { return []; }
};

const saveLocal = (items: Supplier[]) => {
    if (typeof window === 'undefined') return;
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(items)); } catch { /* ignore */ }
};

const mapRow = (r: any): Supplier => ({
    id: r.id,
    name: r.name,
    contactPerson: r.contact_person || r.contactperson || '',
    email: r.email || '',
    phone: r.phone || '',
    address: r.address || '',
    tin: r.tin || '',
    notes: r.notes || '',
    createdAt: r.created_at || r.createdat || new Date().toISOString(),
    updatedAt: r.updated_at || r.updatedat || new Date().toISOString(),
});

export const getSuppliers = async (): Promise<Supplier[]> => {
    const PAGE = 1000;
    const raw: any[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .order('name', { ascending: true })
            .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) {
            console.warn('Supabase suppliers fetch failed, using local:', error.message);
            return getLocal();
        }
        if (!data || data.length === 0) break;
        raw.push(...data);
        if (data.length < PAGE) break;
        page++;
    }

    const mapped = raw.map(mapRow);

    const local = getLocal();
    const merged = [...local];
    mapped.forEach(s => {
        const idx = merged.findIndex(l => l.id === s.id);
        if (idx === -1) merged.push(s); else merged[idx] = { ...merged[idx], ...s };
    });
    saveLocal(merged);

    return mapped.length > 0 ? mapped : local;
};

export const addSupplier = async (
    supplier: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>
): Promise<Supplier | null> => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const dbRow = {
        name: supplier.name,
        contact_person: supplier.contactPerson || null,
        email: supplier.email || null,
        phone: supplier.phone || null,
        address: supplier.address || null,
        tin: supplier.tin || null,
        notes: supplier.notes || null,
    };

    const { data, error } = await supabase.from('suppliers').insert([dbRow]).select().single();

    if (error) {
        console.warn('Supabase insert supplier failed, saving locally:', error.message);
        const local: Supplier = { ...supplier, id, createdAt: now, updatedAt: now };
        const list = getLocal();
        list.push(local);
        saveLocal(list);
        return local;
    }

    const created = mapRow(data);
    const list = getLocal();
    list.push(created);
    saveLocal(list);
    return created;
};

export const updateSupplier = async (
    id: string,
    updates: Partial<Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<boolean> => {
    const dbUpdate: any = {};
    if (updates.name !== undefined) dbUpdate.name = updates.name;
    if (updates.contactPerson !== undefined) dbUpdate.contact_person = updates.contactPerson;
    if (updates.email !== undefined) dbUpdate.email = updates.email;
    if (updates.phone !== undefined) dbUpdate.phone = updates.phone;
    if (updates.address !== undefined) dbUpdate.address = updates.address;
    if (updates.tin !== undefined) dbUpdate.tin = updates.tin;
    if (updates.notes !== undefined) dbUpdate.notes = updates.notes;

    await supabase.from('suppliers').update({ ...dbUpdate, updated_at: new Date().toISOString() }).eq('id', id);

    const list = getLocal();
    const idx = list.findIndex(s => s.id === id);
    if (idx !== -1) {
        list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
        saveLocal(list);
    }
    return true;
};

export const deleteSupplier = async (id: string): Promise<boolean> => {
    await supabase.from('suppliers').delete().eq('id', id);
    saveLocal(getLocal().filter(s => s.id !== id));
    return true;
};
