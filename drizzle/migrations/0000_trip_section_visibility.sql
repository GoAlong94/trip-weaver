ALTER TABLE public.trips
ADD COLUMN section_visibility jsonb NOT NULL DEFAULT '{
  "host": {"overview": true, "dates": true, "ideas": true, "timeline": true, "map": true, "budget": true, "ledger": true},
  "members": {"overview": true, "dates": true, "ideas": true, "timeline": true, "map": true, "budget": true, "ledger": true}
}'::jsonb;