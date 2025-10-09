-- Enable Row Level Security for the bookings table
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all actions for authenticated users on the bookings table
CREATE POLICY "Enable all actions for authenticated users on bookings"
ON public.bookings
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

-- Enable Row Level Security for the daily_orders table
ALTER TABLE public.daily_orders ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all actions for authenticated users on the daily_orders table
CREATE POLICY "Enable all actions for authenticated users on daily_orders"
ON public.daily_orders
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');
