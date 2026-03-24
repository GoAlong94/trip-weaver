
-- Allow authenticated users to update use_count on invites (for the join flow)
CREATE POLICY "Authenticated can increment use_count"
ON public.trip_invites FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);
