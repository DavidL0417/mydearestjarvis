revoke all privileges on all tables in schema public from anon;
revoke all privileges on all tables in schema public from authenticated;

revoke all privileges on all sequences in schema public from anon;
revoke all privileges on all sequences in schema public from authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on tables from authenticated;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke all on sequences from authenticated;

grant usage on schema public to anon, authenticated;
