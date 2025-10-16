
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

export const getDeliveryNoteById = async (id: string): Promise<DeliveryNote | null> => {
    const { data, error } = await supabase.from('delivery_notes').select('*').eq('id', id).single();
     if (error) {
        console.error('Error fetching delivery note:', error);
        return null;
    }
    return data as DeliveryNote;
}

export const createDeliveryNoteFromOrder = async (
    order: Order, 
    details: { vehicleRegNo?: string; deliveredBy: string }
): Promise<DeliveryNote | null> => {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("User not authenticated.");
        if (!order || !order.clientEvents || order.clientEvents.length === 0) {
            throw new Error("Order details are incomplete.");
        }

        // 1. Get the latest delivery note to determine the next number
        const { data: latestNote, error: latestNoteError } = await supabase
            .from('delivery_notes')
            .select('id')
            .order('id', { ascending: false })
            .limit(1)
            .single();

        if (latestNoteError && latestNoteError.code !== 'PGRST116') { // PGRST116: No rows found
            throw new Error('Could not query for the latest delivery note: ' + latestNoteError.message);
        }

        let nextSerial = 1;
        if (latestNote) {
            const lastIdNumber = parseInt(latestNote.id.replace('DN-', ''), 10);
            nextSerial = lastIdNumber + 1;
        }
        
        const deliveryNoteId = `DN-${String(nextSerial).padStart(4, '0')}`;

        // 2. Fetch recipe details to get names
        const recipeIds = order.clientEvents.flatMap((event) => event.recipes.map((r) => r.recipeId));
        const { data: recipes, error: recipesError } = await supabase
            .from('recipes')
            .select('recipeNumber, recipeName')
            .in('recipeNumber', recipeIds);

        if (recipesError) {
            throw new Error(`Failed to fetch recipes: ${recipesError.message}`);
        }
        const recipeMap = new Map(recipes.map(r => [r.recipeNumber, r.recipeName]));

        // 3. Get client details from the first event
        const firstEvent = order.clientEvents[0];
        const { data: client, error: clientError } = await supabase.from('clients').select('companyName, primaryLocation').eq('id', firstEvent.clientId).single();
        if(clientError) throw new Error(`Failed to fetch client details: ${clientError.message}`);

        // 4. Construct the new delivery note object
        const newDeliveryNote: Omit<DeliveryNote, 'created_at' | 'updated_at'> = {
          id: deliveryNoteId,
          order_id: order.id,
          client_id: firstEvent.clientId,
          client_name: client?.companyName || 'N/A',
          delivery_date: new Date().toISOString(),
          delivery_location: client?.primaryLocation || 'N/A',
          vehicle_reg_no: details.vehicleRegNo,
          delivered_by: details.deliveredBy,
          user_id: user.id,
          items: order.clientEvents.map(event => ({
            qty: event.numberOfPeople,
            itemCode: event.recipes[0]?.recipeId || 'N/A', // Assuming one recipe per event for simplicity, adjust as needed
            description: recipeMap.get(event.recipes[0]?.recipeId) || 'Unknown Recipe',
          })),
        };

        // 5. Save the new delivery note to the database
        const { data: savedNote, error: insertError } = await supabase
          .from('delivery_notes')
          .insert(newDeliveryNote)
          .select()
          .single();

        if (insertError) {
          throw new Error(`Failed to save delivery note: ${insertError.message}`);
        }

        return savedNote;

    } catch (err: any) {
        console.error('Error creating delivery note:', err);
        return null;
    }
}


export const deleteDeliveryNote = async (id: string): Promise<boolean> => {
    const { error } = await supabase.from('delivery_notes').delete().eq('id', id);
    if (error) {
        console.error('Error deleting delivery note:', error);
    }
    return !error;
};
