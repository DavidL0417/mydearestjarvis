import { describe, expect, it } from "vitest"

import { buildLocalDialogueFallback } from "../lib/assistant/dialogue"
import type { AssistantRuntimeContext } from "../lib/assistant/context"

const runtime = {
  tasks: [],
  events: [],
  sourceSnapshots: [],
} satisfies Pick<AssistantRuntimeContext, "tasks" | "events" | "sourceSnapshots">

describe("secretary dialogue fallback", () => {
  it("responds to lightweight dialogue instead of returning a generic receipt", () => {
    const reply = buildLocalDialogueFallback("How are you?", runtime)

    expect(reply).toBeTruthy()
    expect(reply).not.toBe("I captured that, but I did not make a data change.")
    expect(reply).toContain("day in view")
  })

  it("does not fake substantive planning when the dialogue model is unavailable", () => {
    expect(buildLocalDialogueFallback("What should I do with my whole afternoon?", runtime)).toBeNull()
  })
})
