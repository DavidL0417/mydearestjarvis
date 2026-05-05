# Product Principles

JARVIS is a secretary-second-brain scheduler. It should not merely place blocks on a calendar; it should preserve context, explain tradeoffs, and help David recover when plans change.

## Core Behavior

- Use real user data only. Empty states are acceptable; fake state is not.
- Treat priorities as relative weights, not absolute overrides.
- Prefer zero-tradeoff schedules first: preserve due work, routines, commitments, sleep, and preparation when feasible.
- When a tradeoff is unavoidable, name what is compressed, deferred, or at risk.
- Destructive actions need explicit approval unless the user has clearly requested that exact change.

## Integration Direction

- Google Calendar is implemented as a DB mirror.
- Notion, Gmail, and CalDAV-style sources are modeled through source snapshots for future ingestion.
- Source read failures must be surfaced clearly and must not be replaced with guessed content.
