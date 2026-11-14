-- Minimal stand-in for what a Supabase project provides (roles, auth schema,
-- auth.uid(), default grants) so migrations can run on plain local Postgres.
-- Used only by scripts/db-test.sh — never applied to the real database.
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
-- Column types as on Supabase: most of auth.users' text columns are varchar(255) there, and a plpgsql
-- "return query" must match its declared types exactly (cast: u.email::text).
create table auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              varchar(255) unique,
  raw_user_meta_data jsonb not null default '{}'::jsonb,  -- sign-up data (display_name, role...)
  created_at         timestamptz not null default now(),
  -- columns create_player_login() fills (parent-made username logins)
  instance_id            uuid,
  aud                    varchar(255),
  role                   varchar(255),
  encrypted_password     varchar(255),
  email_confirmed_at     timestamptz,
  confirmation_token     varchar(255),
  recovery_token         varchar(255),
  email_change_token_new varchar(255),
  email_change           varchar(255),
  raw_app_meta_data      jsonb,
  updated_at             timestamptz
);
create table auth.identities (
  id              uuid primary key default gen_random_uuid(),
  provider_id     text not null,
  user_id         uuid not null references auth.users (id) on delete cascade,
  identity_data   jsonb not null,
  provider        text not null,
  last_sign_in_at timestamptz,
  created_at      timestamptz,
  updated_at      timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- Supabase grants the API roles broad table privileges; RLS does the restricting.
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- Minimal Supabase Storage tables (buckets + objects) so storage migrations and policies can be tested.
create schema storage;
create table storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text,
  owner     uuid default auth.uid()
);
alter table storage.objects enable row level security;
grant usage on schema storage to anon, authenticated, service_role;
grant all on storage.objects to anon, authenticated, service_role;
grant select on storage.buckets to anon, authenticated, service_role;

-- Supabase Vault: just the view the job worker's functions read (migration 20261113124214)
create schema vault;
create table vault.decrypted_secrets (name text not null, decrypted_secret text, created_at timestamptz not null default now());
