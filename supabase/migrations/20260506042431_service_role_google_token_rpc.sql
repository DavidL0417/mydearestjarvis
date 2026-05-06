grant usage on schema app_private to service_role;
grant select, insert, update on app_private.integration_tokens to service_role;

create or replace function public.get_google_integration_token(token_user_id uuid)
returns table (
  id uuid,
  user_id uuid,
  provider text,
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
set search_path = ''
as $$
  select
    integration_tokens.id,
    integration_tokens.user_id,
    integration_tokens.provider,
    integration_tokens.access_token,
    integration_tokens.refresh_token,
    integration_tokens.expires_at,
    integration_tokens.scope,
    integration_tokens.created_at,
    integration_tokens.updated_at
  from app_private.integration_tokens
  where integration_tokens.user_id = token_user_id
    and integration_tokens.provider = 'google'
  limit 1;
$$;

create or replace function public.upsert_google_integration_token(
  token_user_id uuid,
  token_access_token text,
  token_refresh_token text,
  token_expires_at timestamptz,
  token_scope text
)
returns void
language sql
set search_path = ''
as $$
  insert into app_private.integration_tokens (
    user_id,
    provider,
    access_token,
    refresh_token,
    expires_at,
    scope
  )
  values (
    token_user_id,
    'google',
    token_access_token,
    token_refresh_token,
    token_expires_at,
    token_scope
  )
  on conflict (user_id, provider) do update set
    access_token = excluded.access_token,
    refresh_token = excluded.refresh_token,
    expires_at = excluded.expires_at,
    scope = excluded.scope,
    updated_at = now();
$$;

revoke all on function public.get_google_integration_token(uuid) from public, anon, authenticated;
revoke all on function public.upsert_google_integration_token(uuid, text, text, timestamptz, text) from public, anon, authenticated;

grant execute on function public.get_google_integration_token(uuid) to service_role;
grant execute on function public.upsert_google_integration_token(uuid, text, text, timestamptz, text) to service_role;
