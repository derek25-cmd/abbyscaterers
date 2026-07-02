
import { supabase } from '@/lib/supabase-client';
import type { Client } from '@/types';
import { ClientSchema, type ClientFormData } from '@/lib/schemas';
import { validate } from '@/lib/service-validation';

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
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw new Error(error.message);
    return true;
};
