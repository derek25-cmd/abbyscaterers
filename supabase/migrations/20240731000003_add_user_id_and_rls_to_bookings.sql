
-- Add user_id column to bookings table
ALTER TABLE public.bookings ADD COLUMN user_id UUID REFERENCES auth.users(id);

-- Disable the old broad policies first if they exist
DROP POLICY IF EXISTS "Enable all actions for authenticated users on bookings" ON public.bookings;
DROP POLICY IF EXISTS "Enable all actions for authenticated users on daily_orders" ON public.daily_orders;

-- Create new RLS policies for the 'bookings' table
CREATE POLICY "Allow users to read their own bookings"
ON public.bookings
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert their own bookings"
ON public.bookings
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update their own bookings"
ON public.bookings
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to delete their own bookings"
ON public.bookings
FOR DELETE
USING (auth.uid() = user_id);


-- Create new RLS policies for the 'daily_orders' table
-- This allows a user to access daily orders if they own the parent booking.
CREATE POLICY "Allow users to manage daily orders for their bookings"
ON public.daily_orders
FOR ALL
USING (
  auth.uid() = (
    SELECT user_id FROM public.bookings WHERE id = daily_orders.booking_id
  )
)
WITH CHECK (
  auth.uid() = (
    SELECT user_id FROM public.bookings WHERE id = daily_orders.booking_id
  )
);
