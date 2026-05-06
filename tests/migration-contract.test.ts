import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260505031630_production_reset.sql", "utf8")
const accessBoundaryMigration = readFileSync(
  "supabase/migrations/20260506031946_restrict_public_data_api_grants.sql",
  "utf8",
)
const googleTokenRpcMigration = readFileSync(
  "supabase/migrations/20260506042431_service_role_google_token_rpc.sql",
  "utf8",
)

describe("production Supabase migration", () => {
  it("keeps OAuth tokens outside public tables", () => {
    expect(migration).toContain("create schema if not exists app_private")
    expect(migration).toContain("create table app_private.integration_tokens")
    expect(migration).toContain("revoke all on schema app_private from anon, authenticated")
  })

  it("enables RLS on every public production table", () => {
    for (const table of [
      "profiles",
      "preferences",
      "calendars",
      "tasks",
      "schedule_events",
      "checkins",
      "integrations",
      "assistant_threads",
      "assistant_messages",
      "assistant_tool_runs",
      "memory_items",
      "source_snapshots",
      "change_logs",
    ]) {
      expect(migration).toContain(`alter table public.${table} enable row level security;`)
    }
  })

  it("keeps browser clients behind backend routes instead of direct table grants", () => {
    expect(accessBoundaryMigration).toContain("revoke all privileges on all tables in schema public from anon;")
    expect(accessBoundaryMigration).toContain("revoke all privileges on all tables in schema public from authenticated;")
  })

  it("keeps private Google tokens behind service-role-only RPC wrappers", () => {
    expect(googleTokenRpcMigration).toContain("app_private.integration_tokens")
    expect(googleTokenRpcMigration).not.toContain("security definer")
    expect(googleTokenRpcMigration).toContain(
      "revoke all on function public.get_google_integration_token(uuid) from public, anon, authenticated;",
    )
    expect(googleTokenRpcMigration).toContain(
      "grant execute on function public.upsert_google_integration_token(uuid, text, text, timestamptz, text) to service_role;",
    )
  })
})
