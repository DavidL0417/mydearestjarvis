import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const migration = readFileSync("supabase/migrations/20260505031630_production_reset.sql", "utf8")

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
})
