
import { supabase } from '@/lib/supabase-client';
import type { Client } from '@/types';
import type { ClientFormData } from '@/lib/schemas';

export const getClients = async (): Promise<Client[]> => {
    const { data, error } = await supabase.from('clients').select('*');
    if (error) {
        console.error('Error fetching clients:', error);
        return [];
    }
    return data as Client[];
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
    const now = new Date().toISOString();
    const newClientData = { ...clientData, createdAt: now, updatedAt: now };
    const { data, error } = await supabase.from('clients').insert([newClientData]).select();
    if (error) {
        console.error('Error adding client:', error);
        return null;
    }
    return data?.[0] as Client;
};

export const updateClient = async (id: string, updates: Partial<ClientFormData>): Promise<boolean> => {
    const { error } = await supabase.from('clients').update({ ...updates, updatedAt: new Date().toISOString() }).eq('id', id);
    if (error) {
        console.error('Error updating client:', error);
    }
    return !error;
};

export const deleteClient = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) {
        console.error('Error deleting client:', error);
    }
    return !error;
};
