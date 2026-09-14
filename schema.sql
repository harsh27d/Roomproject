-- =========================================================
-- RoomMate Database Schema for Supabase
-- Copy and paste this into your Supabase Dashboard -> SQL Editor -> Run
-- =========================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Rooms Table
create table if not exists public.rooms (
  id uuid primary key default uuid_generate_v4(),
  room_code text unique not null,
  room_name text not null,
  room_status text default '🎧 Chill Vibe',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Room Members Table
create table if not exists public.room_members (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  avatar text default '😎',
  role text default 'Member',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Expenses Table
create table if not exists public.expenses (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  name text not null,
  amount numeric(10, 2) not null,
  paid_by text not null,
  emoji text default '🛒',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Chores / Tasks Table
create table if not exists public.chores (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  name text not null,
  priority text default 'med',
  assignee text,
  done boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Supplies / Wishlist Table
create table if not exists public.supplies (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  name text not null,
  cost numeric(10, 2) default 0,
  added_by text,
  bought boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Polls Table
create table if not exists public.polls (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  question text not null,
  created_by text default 'Roommate',
  opt1 text not null,
  votes1 integer default 0,
  opt2 text not null,
  votes2 integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Announcements Table
create table if not exists public.announcements (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  message text not null,
  type text default 'info',
  posted_by text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Activity Logs Table
create table if not exists public.activity_logs (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references public.rooms(id) on delete cascade not null,
  icon text default '📌',
  text text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- =========================================================
-- Enable Row Level Security (RLS) & Public Access Policies
-- (Allows easy client-side demo and multi-user room sync)
-- =========================================================
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.expenses enable row level security;
alter table public.chores enable row level security;
alter table public.supplies enable row level security;
alter table public.polls enable row level security;
alter table public.announcements enable row level security;
alter table public.activity_logs enable row level security;

-- Create Open Read/Write Policies for Demo
create policy "Allow all actions on rooms" on public.rooms for all using (true) with check (true);
create policy "Allow all actions on room_members" on public.room_members for all using (true) with check (true);
create policy "Allow all actions on expenses" on public.expenses for all using (true) with check (true);
create policy "Allow all actions on chores" on public.chores for all using (true) with check (true);
create policy "Allow all actions on supplies" on public.supplies for all using (true) with check (true);
create policy "Allow all actions on polls" on public.polls for all using (true) with check (true);
create policy "Allow all actions on announcements" on public.announcements for all using (true) with check (true);
create policy "Allow all actions on activity_logs" on public.activity_logs for all using (true) with check (true);
