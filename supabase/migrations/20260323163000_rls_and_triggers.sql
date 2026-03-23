-- 1. Create a trigger to automatically create a profile when a new user signs up via Google/Email
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', 'User'),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists to avoid errors, then recreate
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Enable Row Level Security (RLS)
alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.idea_cards enable row level security;

-- 3. Safety Policies (Allow authenticated users to read/write their own data)
create policy "Public profiles are viewable by everyone." on profiles for select using (true);
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

create policy "Users can view trips they created." on trips for select using (auth.uid() = created_by);
create policy "Users can create trips." on trips for insert with check (auth.uid() = created_by);

create policy "Users can view ideas for their trips." on idea_cards for select using (true);
create policy "Users can insert ideas." on idea_cards for insert with check (auth.uid() = created_by);
