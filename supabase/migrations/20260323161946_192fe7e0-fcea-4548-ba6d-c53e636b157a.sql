
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create member_role enum
CREATE TYPE public.member_role AS ENUM ('Host', 'Member');

-- Create trips table
CREATE TABLE public.trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  start_destination TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cover_emoji TEXT NOT NULL DEFAULT '✈️',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;

-- Create trip_members table
CREATE TABLE public.trip_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'Member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (trip_id, user_id)
);

ALTER TABLE public.trip_members ENABLE ROW LEVEL SECURITY;

-- Trips RLS: members can view their trips
CREATE POLICY "Members can view trips" ON public.trips FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trip_members WHERE trip_members.trip_id = trips.id AND trip_members.user_id = auth.uid())
  );

CREATE POLICY "Authenticated users can create trips" ON public.trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Trip creator can update" ON public.trips FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Trip creator can delete" ON public.trips FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Trip members RLS
CREATE POLICY "Members can view trip members" ON public.trip_members FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trip_members tm WHERE tm.trip_id = trip_members.trip_id AND tm.user_id = auth.uid())
  );

CREATE POLICY "Users can join or creator can add" ON public.trip_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_members.trip_id AND trips.created_by = auth.uid())
  );

CREATE POLICY "Trip creator can remove members" ON public.trip_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trips WHERE trips.id = trip_members.trip_id AND trips.created_by = auth.uid())
  );

-- Create idea_cards table
CREATE TABLE public.idea_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Other',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_cost NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_mandatory BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'idea',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.idea_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view idea cards" ON public.idea_cards FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trip_members WHERE trip_members.trip_id = idea_cards.trip_id AND trip_members.user_id = auth.uid())
  );

CREATE POLICY "Trip members can create idea cards" ON public.idea_cards FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (SELECT 1 FROM public.trip_members WHERE trip_members.trip_id = idea_cards.trip_id AND trip_members.user_id = auth.uid())
  );

CREATE POLICY "Idea creator can update" ON public.idea_cards FOR UPDATE TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Idea creator can delete" ON public.idea_cards FOR DELETE TO authenticated
  USING (auth.uid() = created_by);

-- Create expenses table (for later)
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  idea_card_id UUID REFERENCES public.idea_cards(id) ON DELETE SET NULL,
  paid_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view expenses" ON public.expenses FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.trip_members WHERE trip_members.trip_id = expenses.trip_id AND trip_members.user_id = auth.uid())
  );

CREATE POLICY "Trip members can create expenses" ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = paid_by AND
    EXISTS (SELECT 1 FROM public.trip_members WHERE trip_members.trip_id = expenses.trip_id AND trip_members.user_id = auth.uid())
  );

-- Create expense_splits table (for later)
CREATE TABLE public.expense_splits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_owed NUMERIC(10,2) NOT NULL,
  UNIQUE (expense_id, user_id)
);

ALTER TABLE public.expense_splits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trip members can view splits" ON public.expense_splits FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.expenses e
      JOIN public.trip_members tm ON tm.trip_id = e.trip_id
      WHERE e.id = expense_splits.expense_id AND tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Expense payer can manage splits" ON public.expense_splits FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.expenses e WHERE e.id = expense_splits.expense_id AND e.paid_by = auth.uid()
    )
  );

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_trips_updated_at BEFORE UPDATE ON public.trips FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_idea_cards_updated_at BEFORE UPDATE ON public.idea_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
