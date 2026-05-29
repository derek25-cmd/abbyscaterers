const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking Sales event_id...");
  const { data: sales, error: sError } = await supabase.from('sales').select('event_id').limit(1);
  if (sError) {
    console.error("Sales event_id Error:", sError.message);
  } else {
    console.log("Sales event_id exists!");
  }

  console.log("\nChecking Purchases event_id...");
  const { data: purchases, error: pError } = await supabase.from('purchases').select('event_id').limit(1);
  if (pError) {
    console.error("Purchases event_id Error:", pError.message);
  } else {
    console.log("Purchases event_id exists!");
  }

  console.log("\nChecking Purchases supplier_tin and efd_receipt...");
  const { data: pTax, error: pTaxError } = await supabase.from('purchases').select('supplier_tin, efd_receipt').limit(1);
  if (pTaxError) {
    console.error("Purchases tax columns Error:", pTaxError.message);
  } else {
    console.log("Purchases tax columns exist!");
  }
}

check();
