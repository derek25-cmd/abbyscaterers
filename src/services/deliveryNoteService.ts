
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
  details: { vehicleRegNo?: string; deliveredBy: string; location: string }
): Promise<DeliveryNote | null> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("User not authenticated.");
    if (!order || !order.clientEvents || order.clientEvents.length === 0) {
      throw new Error("Order details are incomplete.");
    }

    // Fetch the latest delivery note ID to manually increment it
    const { data: latestNote, error: latestNoteError } = await supabase
      .from('delivery_notes')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .single();

    if (latestNoteError && latestNoteError.code !== 'PGRST116') { // PGRST116 means no rows found, which is fine
        throw new Error(`Could not fetch latest delivery note ID: ${latestNoteError.message}`);
    }

    let nextIdNumber = 8892; // Default starting number if no notes exist
    if (latestNote) {
        const currentIdNumber = parseInt(latestNote.id, 10);
        if (!isNaN(currentIdNumber)) {
            nextIdNumber = currentIdNumber + 1;
        }
    }
    
    const deliveryNoteId = String(nextIdNumber).padStart(6, '0');
    
    const recipeIds = order.clientEvents.flatMap(event => event.recipes?.map(r => r.recipeId) || []);
    const uniqueRecipeIds = [...new Set(recipeIds)];
    
    let recipes = [];
    if(uniqueRecipeIds.length > 0) {
      const { data: recipeData, error: recipesError } = await supabase
        .from('recipes')
        .select('recipeNumber, recipeName')
        .in('recipeNumber', uniqueRecipeIds);

      if (recipesError) throw new Error(`Failed to fetch recipes: ${recipesError.message}`);
      recipes = recipeData;
    }
    const recipeMap = new Map(recipes.map(r => [r.recipeNumber, r.recipeName]));

    const firstEvent = order.clientEvents[0];
    const clientId = firstEvent.client_id || firstEvent.clientId;
    if (!clientId) throw new Error("Client ID is missing from this order event.");

    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('companyName')
      .eq('id', clientId)
      .single();

    if (clientError) throw new Error(`Failed to fetch client details: ${clientError.message}`);

    const deliveryItems = order.clientEvents.flatMap(event => 
        (event.recipes || []).map(recipe => ({
            qty: event.numberOfPeople,
            itemCode: recipe.recipeId,
            description: recipeMap.get(recipe.recipeId) || 'Unknown Recipe',
        }))
    );
    
    const newDeliveryNote: Omit<DeliveryNote, 'created_at' | 'updated_at'> = {
      id: deliveryNoteId,
      order_id: order.id,
      client_id: clientId,
      client_name: client?.companyName || 'N/A',
      delivery_date: new Date().toISOString(),
      delivery_location: details.location,
      vehicle_reg_no: details.vehicleRegNo,
      delivered_by: details.deliveredBy,
      user_id: user.id,
      items: deliveryItems,
    };

    const { data: savedNote, error: insertError } = await supabase
      .from('delivery_notes')
      .insert(newDeliveryNote)
      .select()
      .single();

    if (insertError) throw new Error(`Failed to save delivery note: ${insertError.message}`);

    return savedNote as DeliveryNote;

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
