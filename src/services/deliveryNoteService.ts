
import { supabase } from '@/lib/supabase-client';
import type { DeliveryNote, Order } from '@/types';

export const getDeliveryNotes = async (): Promise<DeliveryNote[]> => {
    const { data, error } = await supabase.from('delivery_notes').select('*').order('created_at', { ascending: false });
    if (error) {
        console.error('Error fetching delivery notes:', error);
        return [];
    }
    return data as DeliveryNote[];
};

export const createDeliveryNoteFromOrder = async (
  order: Order, 
  details: { 
    vehicleRegNo?: string; 
    deliveredBy: string; 
    location: string;
    eventIndex: number;
    items: { qty: number; itemCode: string; description: string; }[];
    is_narration?: boolean;
    narration_text?: string;
  }
): Promise<DeliveryNote[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");
    if (!order || !order.clientEvents || order.clientEvents.length === 0) {
      throw new Error("Order details are incomplete.");
    }

    // Claim the next delivery note ID from the monotonic counter — never reuses
    // a number even if previous delivery notes were deleted.
    const { data: claimedId, error: claimError } = await supabase.rpc('claim_ids', {
        counter_name: 'delivery_note_id',
        count: 1,
    });
    if (claimError) throw new Error(`Could not claim delivery note ID: ${claimError.message}`);
    const nextIdNumber = Number(claimedId);
    
    // Fetch recipes for mapping names
    const recipeIds = order.clientEvents.flatMap(event => event.recipes?.map(r => r.recipeId) || []);
    const uniqueRecipeIds = [...new Set(recipeIds)];
    
    let recipes: any[] = [];
    if(uniqueRecipeIds.length > 0) {
      const { data: recipeData, error: recipesError } = await supabase
        .from('recipes')
        .select('recipeNumber, recipeName')
        .in('recipeNumber', uniqueRecipeIds);

      if (recipesError) throw new Error(`Failed to fetch recipes: ${recipesError.message}`);
      recipes = recipeData || [];
    }
    const recipeMap = new Map(recipes.map((r: any) => [r.recipeNumber, r.recipeName]));

    const firstEvent = order.clientEvents?.[0] || {};
    const clientId = order.clientId || firstEvent.clientId;
    if (!clientId) throw new Error("Client ID is missing from this order.");

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('companyName')
      .eq('id', clientId)
      .single();

    if (clientError) throw new Error(`Failed to fetch client details: ${clientError.message}`);

    const event = order.clientEvents[details.eventIndex];
    if (!event) throw new Error("Selected event not found.");

    const deliveryNoteId = String(nextIdNumber).padStart(6, '0');

    const newDeliveryNote: Omit<DeliveryNote, 'created_at' | 'updated_at'> = {
        id: deliveryNoteId,
        order_id: order.id,
        client_id: clientId,
        client_name: client?.companyName || 'N/A',
        delivery_date: event.date ? new Date(event.date).toISOString() : new Date().toISOString(),
        delivery_location: details.location,
        vehicle_reg_no: details.vehicleRegNo,
        delivered_by: details.deliveredBy,
        user_id: user.id,
        items: details.items,
        event_id: event.id,
        is_narration: details.is_narration,
        narration_text: details.narration_text
    };

    const { data: savedNote, error: insertError } = await supabase
        .from('delivery_notes')
        .insert(newDeliveryNote)
        .select()
        .single();

    if (insertError) throw new Error(`Failed to save delivery note: ${insertError.message}`);
    
    return [savedNote as DeliveryNote];

  } catch (err: any) {
    console.error('Error creating delivery note:', err);
    throw err; // Re-throw to be caught in the UI
  }
};


export const deleteDeliveryNote = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
    if (error) {
        console.error('Error deleting delivery note:', error);
    }
    return !error;
};

export const getDeliveryNoteById = async (id: string): Promise<DeliveryNote | null> => {
    const { data, error } = await supabase.from('delivery_notes').select('*').eq('id', id).single();
     if (error) {
        console.error('Error fetching delivery note:', error);
        return null;
    }
    return data as DeliveryNote;
}

export const getDeliveryNotesByDate = async (date: string): Promise<DeliveryNote[]> => {
    // We assume delivery_date is stored as ISO string, so we filter by prefix or start/end
    const { data, error } = await supabase
        .from('delivery_notes')
        .select('*')
        .gte('delivery_date', `${date}T00:00:00`)
        .lte('delivery_date', `${date}T23:59:59`)
        .order('created_at', { ascending: true });

    if (error) {
        console.error('Error fetching delivery notes by date:', error);
        return [];
    }
    return data as DeliveryNote[];
};
