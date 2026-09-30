-- Meniru role & default privileges Supabase di Postgres lokal, supaya migration
-- (REVOKE, policy) bisa dijalankan dan diuji. Hanya untuk container lokal.

CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;

-- Seperti PostgREST: login sebagai authenticator lalu SET ROLE anon/authenticated.
CREATE ROLE authenticator LOGIN NOINHERIT PASSWORD 'authenticator';
GRANT anon, authenticated TO authenticator;

-- Supabase memberi anon/authenticated hak penuh di schema public secara default.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated;
