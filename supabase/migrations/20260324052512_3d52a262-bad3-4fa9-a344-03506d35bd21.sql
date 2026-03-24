
-- Create trip_invites table for shareable invite links
CREATE TABLE public.trip_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
  code text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  expires_at timestamp with time zone,
  max_uses integer,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_invites ENABLE ROW LEVEL SECURITY;

-- Trip members can view invites for their trips
CREATE POLICY "Trip members can view invites"
ON public.trip_invites FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM trip_members WHERE trip_members.trip_id = trip_invites.trip_id AND trip_members.user_id = auth.uid()
));

-- Trip creator (host) can create invites
CREATE POLICY "Host can create invites"
ON public.trip_invites FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_invites.trip_id AND trips.created_by = auth.uid()
  )
);

-- Host can delete invites
CREATE POLICY "Host can delete invites"
ON public.trip_invites FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM trips WHERE trips.id = trip_invites.trip_id AND trips.created_by = auth.uid()
  )
);

-- Allow anyone authenticated to read an invite by code (for the join flow)
CREATE POLICY "Anyone can read invite by code"
ON public.trip_invites FOR SELECT TO authenticated
USING (true);
