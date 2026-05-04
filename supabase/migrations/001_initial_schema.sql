-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (linked to Supabase Auth)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name varchar(50) not null,
  avatar_url text
);

-- Movies cache table
create table if not exists movies (
  id int primary key,
  title varchar(255) not null,
  overview text,
  poster_path text,
  genres jsonb,
  release_date date
);

-- Reviews table
create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  movie_id int references movies(id) on delete cascade,
  user_id uuid references profiles(id) on delete cascade,
  rating int check (rating >= 1 and rating <= 10),
  review_text text,
  watched_at timestamp with time zone default now(),
  unique(movie_id, user_id)
);

-- Watchlist table
create table if not exists watchlist (
  id uuid primary key default uuid_generate_v4(),
  movie_id int not null,
  status varchar(20) default 'pending' check (status in ('pending', 'accepted', 'rejected', 'watched')),
  added_by uuid references profiles(id) on delete set null,
  created_at timestamp with time zone default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security
alter table profiles enable row level security;
alter table movies enable row level security;
alter table reviews enable row level security;
alter table watchlist enable row level security;

-- Profiles policies
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (true);

create policy "Users can update own profile"
  on profiles for update
  to authenticated
  using (auth.uid() = id);

-- Movies policies (public read, authenticated write)
create policy "Movies are viewable by authenticated users"
  on movies for select
  to authenticated
  using (true);

create policy "Authenticated users can insert movies"
  on movies for insert
  to authenticated
  with check (true);

-- Reviews policies
create policy "Reviews are viewable by authenticated users"
  on reviews for select
  to authenticated
  using (true);

create policy "Users can insert own reviews"
  on reviews for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update own reviews"
  on reviews for update
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can delete own reviews"
  on reviews for delete
  to authenticated
  using (auth.uid() = user_id);

-- Watchlist policies
create policy "Watchlist viewable by authenticated users"
  on watchlist for select
  to authenticated
  using (true);

create policy "Authenticated users can insert to watchlist"
  on watchlist for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update watchlist"
  on watchlist for update
  to authenticated
  using (true);
