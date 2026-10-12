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

select 'permissions fixed' as status;
