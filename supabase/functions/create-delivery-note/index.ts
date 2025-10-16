// supabase/functions/create-delivery-note/index.ts

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// Main function to handle requests
Deno.serve(async (req) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create a Supabase client with the Auth context of the user that called the function.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user from the auth context
    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { orderId, vehicleRegNo, deliveredBy } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: "Order ID is required" }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Fetch the order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to fetch order: ${orderError?.message || 'Order not found'}`);
    }

    // 2. Fetch recipe details for the items in the order
    const recipeIds = order.clientEvents.flatMap((event: any) => event.recipes.map((r: any) => r.recipeId));
    const { data: recipes, error: recipesError } = await supabaseClient
      .from('recipes')
      .select('recipeNumber, recipeName')
      .in('recipeNumber', recipeIds);

    if (recipesError) {
      throw new Error(`Failed to fetch recipes: ${recipesError.message}`);
    }

    // Create a map for easy lookup
    const recipeMap = new Map(recipes.map(r => [r.recipeNumber, r.recipeName]));

    // 3. Generate the next delivery note number
    const { data: sequenceData, error: sequenceError } = await supabaseClient.rpc('nextval', { sequencename: 'delivery_note_serial_sequence' });

    if (sequenceError) {
        throw new Error('Could not get next value from sequence: ' + sequenceError.message);
    }
    const nextSerial = sequenceData;
    const deliveryNoteId = `DN-${String(nextSerial).padStart(4, '0')}`;

    // 4. Construct the new delivery note object
    const newDeliveryNote = {
      id: deliveryNoteId,
      order_id: order.id,
      client_id: order.clientEvents[0].clientId,
      client_name: order.clientEvents[0].clientName || 'N/A', // Assuming clientName is on the event
      delivery_date: new Date().toISOString(),
      delivery_location: order.clientEvents[0].location || 'N/A',
      vehicle_reg_no: vehicleRegNo,
      delivered_by: deliveredBy,
      user_id: user.id,
      items: order.clientEvents.flatMap((event: any) =>
        event.recipes.map((recipe: any) => ({
          qty: event.numberOfPeople,
          itemCode: recipe.recipeId,
          description: recipeMap.get(recipe.recipeId) || 'Unknown Recipe',
        }))
      ),
    };

    // 5. Save the new delivery note to the database
    const { data: savedNote, error: insertError } = await supabaseClient
      .from('delivery_notes')
      .insert(newDeliveryNote)
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to save delivery note: ${insertError.message}`);
    }

    // 6. Return the newly created delivery note
    return new Response(JSON.stringify(savedNote), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
