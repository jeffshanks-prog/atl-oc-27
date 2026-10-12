-- =====================================================================
-- ATL OC 27 — Supabase schema
-- Run in Supabase SQL editor (or `supabase db push`) BEFORE 002_seed.sql
-- =====================================================================
-- gen_random_uuid() is built into Postgres 13+ (Supabase runs 15+)

-- ---------------------------------------------------------------------
-- USERS: profiles + subscriptions
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin     boolean not null default false,
  created_at   timestamptz not null default now()
);

create table if not exists public.subscriptions (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  status                 text not null default 'none',   -- none|trialing|active|past_due|canceled|unpaid|incomplete
  price_id               text,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  updated_at             timestamptz not null default now()
);

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

-- App-wide switches. billing_enabled = false → every signed-in user gets full access (build/test phase).
-- Turn subscriptions on later with:
--   update public.app_settings set value = 'true' where key = 'billing_enabled';
create table if not exists public.app_settings (
  key   text primary key,
  value jsonb not null
);
insert into public.app_settings (key, value) values ('billing_enabled', 'false') on conflict (key) do nothing;

create or replace function public.billing_enabled() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select (value)::text::boolean from public.app_settings where key = 'billing_enabled'), false);
$$;

-- Access gate used by every row-level policy below.
-- Billing off: any signed-in user. Billing on: admins + active/trialing/past_due subscribers.
create or replace function public.has_access() returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.is_admin()
    or not public.billing_enabled()
    or exists (
      select 1 from public.subscriptions s
      where s.user_id = auth.uid() and s.status in ('active','trialing','past_due')
    )
  );
$$;

-- ---------------------------------------------------------------------
-- MASTER PLAYBOOK
-- ---------------------------------------------------------------------
create table if not exists public.playbooks (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  game_title text not null default 'Madden 27',
  is_seed    boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.formations (
  id          uuid primary key default gen_random_uuid(),
  playbook_id uuid not null references public.playbooks(id) on delete cascade,
  family      text not null,              -- Gun, Pistol, Singleback, I Form, Strong, Weak, Goal Line, Other
  name        text not null,              -- Bunch, Bunch TE, Trips ...
  sort_order  int not null default 0,
  unique (playbook_id, family, name)
);

create table if not exists public.plays (
  id                    uuid primary key default gen_random_uuid(),
  playbook_id           uuid not null references public.playbooks(id) on delete cascade,
  formation_id          uuid not null references public.formations(id) on delete restrict,
  set_name              text not null default '',
  play_name             text not null,
  play_type             text not null check (play_type in ('Pass','Run','Screen','RPO','Play Action')),
  personnel             text,
  concept               text,
  primary_scheme        text,
  secondary_schemes     text[] not null default '{}',
  screen_type           text,
  run_concept           text,
  pass_concept          text,
  rpo_type              text,
  play_action           boolean not null default false,
  best_vs               text[] not null default '{}',
  weak_vs               text[] not null default '{}',
  blitz_beater          boolean not null default false,
  man_beater            boolean not null default false,
  zone_beater           boolean not null default false,
  short_yardage_rating  smallint not null default 3 check (short_yardage_rating between 0 and 5),
  medium_yardage_rating smallint not null default 3 check (medium_yardage_rating between 0 and 5),
  long_yardage_rating   smallint not null default 3 check (long_yardage_rating between 0 and 5),
  red_zone_rating       smallint not null default 3 check (red_zone_rating between 0 and 5),
  goal_line_rating      smallint not null default 3 check (goal_line_rating between 0 and 5),
  two_minute_rating     smallint not null default 3 check (two_minute_rating between 0 and 5),
  four_minute_rating    smallint not null default 3 check (four_minute_rating between 0 and 5),
  primary_read          text,
  second_read           text,
  third_read            text,
  checkdown             text,
  risk_level            smallint not null default 2 check (risk_level between 1 and 5),
  explosive_potential   smallint not null default 2 check (explosive_potential between 1 and 5),
  notes                 text,
  is_seed               boolean not null default false,
  owner_id              uuid references auth.users(id) on delete cascade, -- null = master playbook; set = a user's custom play
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Duplicate prevention: Playbook + Formation + Set + Play Name
create unique index if not exists plays_master_key
  on public.plays (playbook_id, formation_id, lower(set_name), lower(play_name)) where owner_id is null;
create unique index if not exists plays_owner_key
  on public.plays (owner_id, playbook_id, formation_id, lower(set_name), lower(play_name)) where owner_id is not null;
create index if not exists plays_formation_idx on public.plays(formation_id);

create table if not exists public.tags (
  id   uuid primary key default gen_random_uuid(),
  name text not null
);
create unique index if not exists tags_name_key on public.tags (lower(name));

create table if not exists public.play_tags (
  play_id uuid not null references public.plays(id) on delete cascade,
  tag_id  uuid not null references public.tags(id) on delete cascade,
  primary key (play_id, tag_id)
);

-- ---------------------------------------------------------------------
-- USER DATA
-- ---------------------------------------------------------------------
create table if not exists public.schemes (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  name                text not null,
  description         text not null default '',
  primary_concept     text,
  secondary_concepts  text[] not null default '{}',
  run_philosophy      text not null default '',
  screen_philosophy   text not null default '',
  preferred_formations text[] not null default '{}',
  preferred_personnel text[] not null default '{}',
  weights             jsonb not null default '{}'::jsonb,
  is_default          boolean not null default false,
  is_active           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.scheme_plays (
  scheme_id uuid not null references public.schemes(id) on delete cascade,
  play_id   uuid not null references public.plays(id) on delete cascade,
  primary key (scheme_id, play_id)
);

create table if not exists public.favorites (
  user_id    uuid not null references auth.users(id) on delete cascade,
  play_id    uuid not null references public.plays(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, play_id)
);

create table if not exists public.favorite_roles (
  user_id uuid not null,
  play_id uuid not null,
  role    text not null,
  primary key (user_id, play_id, role),
  foreign key (user_id, play_id) references public.favorites(user_id, play_id) on delete cascade
);

create table if not exists public.game_plans (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  opponent      text not null default '',
  plan_date     date,
  scheme_id     uuid references public.schemes(id) on delete set null,
  notes         text not null default '',
  script_length int not null default 10,
  created_at    timestamptz not null default now()
);

create table if not exists public.game_plan_plays (
  id           uuid primary key default gen_random_uuid(),
  game_plan_id uuid not null references public.game_plans(id) on delete cascade,
  package      text not null,
  play_id      uuid not null references public.plays(id) on delete cascade,
  position     int not null default 0,
  completed    boolean not null default false
);
create index if not exists gpp_plan_idx on public.game_plan_plays(game_plan_id);

create table if not exists public.games (
  id           uuid primary key,                    -- client-generated (offline-safe)
  user_id      uuid not null references auth.users(id) on delete cascade,
  opponent     text not null default '',
  game_plan_id uuid references public.game_plans(id) on delete set null,
  scheme_id    uuid references public.schemes(id) on delete set null,
  started_at   timestamptz not null default now(),
  ended_at     timestamptz,
  my_score     int not null default 0,
  opp_score    int not null default 0,
  status       text not null default 'active' check (status in ('active','final')),
  adaptive     boolean not null default true
);

create table if not exists public.play_calls (
  id          uuid primary key,                     -- client-generated (offline-safe)
  user_id     uuid not null references auth.users(id) on delete cascade,
  game_id     uuid not null references public.games(id) on delete cascade,
  play_id     uuid not null references public.plays(id) on delete cascade,
  sequence    int not null,
  down        smallint not null check (down between 1 and 4),
  distance    numeric(4,1) not null,
  yard_line   smallint not null check (yard_line between 1 and 99),
  field_zone  text not null,
  quarter     smallint not null check (quarter between 1 and 5),
  clock       text not null default '15:00',
  my_score    int not null default 0,
  opp_score   int not null default 0,
  coverage    text not null default 'Unknown',
  pressure    text not null default 'Unknown',
  alignment   text[] not null default '{}',
  match_score smallint,
  created_at  timestamptz not null default now()
);
create index if not exists play_calls_game_idx on public.play_calls(game_id);
create index if not exists play_calls_user_idx on public.play_calls(user_id);

create table if not exists public.play_results (
  play_call_id uuid primary key references public.play_calls(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  outcome      text not null,
  yards        int not null default 0,
  success      boolean not null default false,
  is_pass      boolean not null default true,
  completed    boolean not null default false,
  touchdown    boolean not null default false,
  turnover     boolean not null default false,
  sack         boolean not null default false,
  defense_seen text not null default 'Unknown',
  observations text[] not null default '{}',
  created_at   timestamptz not null default now()
);

-- Opponent tendencies (derived — never stored twice)
create or replace view public.opponent_tendencies with (security_invoker = true) as
select g.user_id, g.id as game_id, g.opponent, r.defense_seen, count(*)::int as snaps
from public.games g
join public.play_calls c on c.game_id = g.id
join public.play_results r on r.play_call_id = c.id
group by g.user_id, g.id, g.opponent, r.defense_seen;

-- Per-user play statistics (derived)
create or replace view public.user_play_stats with (security_invoker = true) as
select c.user_id, c.play_id,
  count(*)::int                                   as times_called,
  count(*) filter (where r.is_pass)::int          as attempts,
  count(*) filter (where r.completed)::int        as completions,
  coalesce(sum(r.yards),0)::int                   as yards,
  round(avg(r.yards)::numeric, 1)                 as average_yards,
  count(*) filter (where r.touchdown)::int        as touchdowns,
  count(*) filter (where r.turnover)::int         as turnovers,
  count(*) filter (where r.sack)::int             as sacks,
  round(100.0 * avg(case when r.success then 1 else 0 end), 1) as success_rate
from public.play_calls c
join public.play_results r on r.play_call_id = c.id
group by c.user_id, c.play_id;

-- ---------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists plays_touch on public.plays;
create trigger plays_touch before update on public.plays for each row execute function public.touch_updated_at();
drop trigger if exists schemes_touch on public.schemes;
create trigger schemes_touch before update on public.schemes for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- New user: profile + default scheme (JEFF'S ATL SPACING OFFENSE)
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;

  insert into public.subscriptions (user_id, status) values (new.id, 'none') on conflict do nothing;

  insert into public.schemes (user_id, name, description, primary_concept, secondary_concepts,
    run_philosophy, screen_philosophy, preferred_formations, weights, is_default, is_active)
  values (new.id, 'JEFF''S ATL SPACING OFFENSE',
    'Spacing + Screen identity. Horizontal stretch first, screens to punish pressure, runs to keep the box honest.',
    'Spacing', array['Screens','Run','Mesh','RPO','Play Action','Shot Plays'],
    'Inside zone and base runs to stay on schedule; run more vs light boxes.',
    'Screens are a primary family — call them early vs pressure and as counters to spacing.',
    array['Gun Bunch','Gun Bunch TE'],
    '{"spacing":30,"screen":20,"run":20,"mesh":10,"rpo":8,"playAction":7,"shot":5}'::jsonb,
    true, true);
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.app_settings    enable row level security;
alter table public.profiles        enable row level security;
alter table public.subscriptions   enable row level security;
alter table public.playbooks       enable row level security;
alter table public.formations      enable row level security;
alter table public.plays           enable row level security;
alter table public.tags            enable row level security;
alter table public.play_tags       enable row level security;
alter table public.schemes         enable row level security;
alter table public.scheme_plays    enable row level security;
alter table public.favorites       enable row level security;
alter table public.favorite_roles  enable row level security;
alter table public.game_plans      enable row level security;
alter table public.game_plan_plays enable row level security;
alter table public.games           enable row level security;
alter table public.play_calls      enable row level security;
alter table public.play_results    enable row level security;

-- profiles: read own; update display_name only (is_admin can't be self-granted)
create policy profiles_read on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- app settings: anyone signed in can read; only the SQL editor (service role) changes them
create policy app_settings_read on public.app_settings for select using (auth.uid() is not null);

-- subscriptions: read own; only the Stripe webhook (service role) writes
create policy subs_read on public.subscriptions for select using (user_id = auth.uid());

-- master playbook: subscribers read; admins write
create policy playbooks_read on public.playbooks for select using (public.has_access());
create policy playbooks_admin on public.playbooks for all using (public.is_admin()) with check (public.is_admin());
create policy formations_read on public.formations for select using (public.has_access());
create policy formations_admin on public.formations for all using (public.is_admin()) with check (public.is_admin());
create policy tags_read on public.tags for select using (public.has_access());
create policy tags_write on public.tags for insert with check (public.has_access());

create policy plays_read on public.plays for select
  using (public.has_access() and (owner_id is null or owner_id = auth.uid()));
create policy plays_insert on public.plays for insert
  with check ((owner_id is null and public.is_admin()) or (owner_id = auth.uid() and public.has_access()));
create policy plays_update on public.plays for update
  using ((owner_id is null and public.is_admin()) or (owner_id = auth.uid() and public.has_access()))
  with check ((owner_id is null and public.is_admin()) or (owner_id = auth.uid() and public.has_access()));
create policy plays_delete on public.plays for delete
  using ((owner_id is null and public.is_admin()) or owner_id = auth.uid());

create policy play_tags_read on public.play_tags for select using (public.has_access());
create policy play_tags_write on public.play_tags for all
  using (exists (select 1 from public.plays p where p.id = play_id and
    ((p.owner_id is null and public.is_admin()) or p.owner_id = auth.uid())))
  with check (exists (select 1 from public.plays p where p.id = play_id and
    ((p.owner_id is null and public.is_admin()) or (p.owner_id = auth.uid() and public.has_access()))));

-- user-owned tables: read own always; write requires active access
do $$
declare t text;
begin
  foreach t in array array['schemes','favorites','favorite_roles','game_plans','games','play_calls','play_results'] loop
    execute format('create policy %1$s_read on public.%1$s for select using (user_id = auth.uid())', t);
    execute format('create policy %1$s_ins on public.%1$s for insert with check (user_id = auth.uid() and public.has_access())', t);
    execute format('create policy %1$s_upd on public.%1$s for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.has_access())', t);
    execute format('create policy %1$s_del on public.%1$s for delete using (user_id = auth.uid())', t);
  end loop;
end $$;

create policy scheme_plays_all on public.scheme_plays for all
  using (exists (select 1 from public.schemes s where s.id = scheme_id and s.user_id = auth.uid()))
  with check (exists (select 1 from public.schemes s where s.id = scheme_id and s.user_id = auth.uid()) and public.has_access());

create policy game_plan_plays_all on public.game_plan_plays for all
  using (exists (select 1 from public.game_plans g where g.id = game_plan_id and g.user_id = auth.uid()))
  with check (exists (select 1 from public.game_plans g where g.id = game_plan_id and g.user_id = auth.uid()) and public.has_access());


-- ATL OC 27 — table permissions for signed-in users.
-- Newer Supabase projects don't automatically let the app's signed-in role use tables
-- created in the SQL Editor, so the app sees "0 plays". Row-level security (the policies
-- in 001_schema.sql) still decides WHICH rows each user can see or change.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- Keep profiles locked: users may only change their own display name, never is_admin.
revoke insert, update, delete on public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;

-- Server-side functions (Stripe webhook) use the service role.
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

