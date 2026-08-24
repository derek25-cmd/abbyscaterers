
import { supabase } from '@/lib/supabase-client';
import type { Client } from '@/types';
import { ClientSchema, type ClientFormData } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';
import { logAuditEvent } from '@/lib/audit-log';

export const getClients = async (): Promise<Client[]> => {
    const PAGE = 1000;
    const all: Client[] = [];
    let page = 0;
    while (true) {
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .range(page * PAGE, (page + 1) * PAGE - 1);
        if (error) { console.error('Error fetching clients:', error); break; }
        if (!data || data.length === 0) break;
        all.push(...(data as Client[]));
        if (data.length < PAGE) break;
        page++;
    }
    return all;
};

export const getClientById = async (id: string): Promise<Client | null> => {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
    if (error) {
        console.error('Error fetching client by id:', error);
        return null;
    }
    return data as Client;
}

export const addClient = async (clientData: ClientFormData): Promise<Client | null> => {
    const validated = validate(ClientSchema, clientData);
    const now = new Date().toISOString();
    const newClientData = { ...validated, createdAt: now, updatedAt: now };
    const { data, error } = await supabase.from('clients').insert([newClientData]).select();
    if (error) throw new Error(error.message);
    return data?.[0] as Client;
};

export const updateClient = async (id: string, updates: Partial<ClientFormData>): Promise<boolean> => {
    const { error } = await supabase.from('clients').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
    return true;
};

export const deleteClient = async (id: string): Promise<boolean> => {
    // Pre-check for a friendlier error than the raw FK-violation message.
    // The database also enforces this as a backstop for proforma_invoices,
    // invoices, and sales via ON DELETE RESTRICT (see
    // supabase/migrations/20260719000000_add_client_foreign_keys.sql) — but
    // NOT for orders: that FK pre-dates this app's changes and is actually
    // ON DELETE SET NULL, not RESTRICT, so a client with only linked orders
    // could otherwise be deleted at the DB level while silently orphaning
    // them. This app-level check is the only thing that catches that case.
    const [ordersCount, proformaCount, invoicesCount, salesCount] = await Promise.all([
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', id),
        supabase.from('proforma_invoices').select('id', { count: 'exact', head: true }).eq('clientId', id),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('clientId', id),
        supabase.from('sales').select('id', { count: 'exact', head: true }).eq('customerid', id),
    ]);

    const totalLinked =
        (ordersCount.count ?? 0) + (proformaCount.count ?? 0) + (invoicesCount.count ?? 0) + (salesCount.count ?? 0);

    if (totalLinked > 0) {
        throw new Error(
            `Cannot delete this client — they have ${totalLinked} linked record(s) (orders, proforma invoices, invoices, or sales). Archive the client instead of deleting.`
        );
    }

    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw new Error(error.message);

    // logAuditEvent never throws (see its own try/catch) — fire and forget.
    void logAuditEvent('client.delete', 'clients', id);

    return true;
};
