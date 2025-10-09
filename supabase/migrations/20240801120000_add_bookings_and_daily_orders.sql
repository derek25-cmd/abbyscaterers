
-- Enable Row Level Security
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_orders ENABLE ROW LEVEL SECURITY;

-- Policies for bookings table
CREATE POLICY "Allow authenticated users to manage their own bookings"
ON bookings
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policies for daily_orders table
CREATE POLICY "Allow authenticated users to manage daily orders for their bookings"
ON daily_orders
FOR ALL
USING (
  auth.uid() = (SELECT user_id FROM bookings WHERE id = booking_id)
)
WITH CHECK (
  auth.uid() = (SELECT user_id FROM bookings WHERE id = booking_id)
);
