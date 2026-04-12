"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import type {
  AssistantMessageResponse,
  ParsedAssistantInput,
} from "@/lib/ai/parser-schema"

type SubmitStatus = "idle" | "submitting" | "success" | "error"

function getIntentLabel(intent: ParsedAssistantInput["primary_intent"]) {
  switch (intent) {
    case "create_task":
      return "Task"
    case "create_fixed_event":
      return "Fixed Event"
    case "replan":
      return "Replan"
    case "edit_task":
      return "Edit Task"
    case "remember_preference":
      return "Remember"
    case "forget_memory":
      return "Forget"
    default:
      return "Unknown"
  }
}

export function MasterInput() {
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<SubmitStatus>("idle")
  const [parsedRequest, setParsedRequest] = useState<ParsedAssistantInput | null>(null)
  const [lastRequest, setLastRequest] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [debugInfo, setDebugInfo] = useState<AssistantMessageResponse["debug"] | null>(null)

  async function submitMessage(rawMessage: string) {
    const trimmedMessage = rawMessage.trim()

    if (!trimmedMessage) {
      return
    }

    setStatus("submitting")
    setStatusMessage("Parsing your request...")
    setDebugInfo(null)

    try {
      const response = await fetch("/api/assistant/message", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmedMessage,
          now: new Date().toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      })

      const result = (await response.json().catch(() => null)) as AssistantMessageResponse | null

      if (!result) {
        throw new Error("The assistant parser returned an invalid response.")
      }

      setParsedRequest(result.parsed)
      setLastRequest(trimmedMessage)
      setDebugInfo(result.debug ?? null)

      if (!response.ok || !result.ok) {
        setStatus("error")
        setStatusMessage(result.error || "Failed to parse assistant input.")
        return
      }

      window.dispatchEvent(new CustomEvent("jarvis-dashboard-refresh"))
      setStatus("success")
      setStatusMessage("Request parsed successfully.")
      setMessage("")
    } catch (error) {
      console.error("Failed to submit master input", error)
      setStatus("error")
      setStatusMessage("Something went wrong while parsing the request. Please try again.")
    }
  }

  const handleSubmit = async () => {
    await submitMessage(message)
  }

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      await submitMessage(message)
    }
  }

  return (
    <Card className="bg-card border-border flex-1">
      <CardHeader className="p-3 pb-1">
        <CardTitle className="text-sm font-bold text-foreground">Master Input</CardTitle>
        <CardDescription className="text-xs text-muted-foreground leading-tight font-medium">
          Ask in plain language. I can edit tasks, replan, and save/remove assistant memory.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3 pt-2 flex flex-col">
        <div className="bg-secondary/50 rounded-md p-2 mb-2 min-h-[70px]">
          <p className="text-xs text-muted-foreground leading-relaxed font-medium">
            Tell me what changed and I&apos;ll update the plan. I can schedule, replan, edit tasks, and remember long-term preferences.
          </p>
        </div>
        {(status !== "idle" || lastRequest) && (
          <div className="bg-secondary/30 rounded-md p-2 mb-2 space-y-1">
            <p
              className={`text-[11px] font-semibold ${
                status === "error"
                  ? "text-red-400"
                  : status === "submitting"
                  ? "text-[#93c5fd]"
                  : "text-foreground"
              }`}
            >
              {status === "submitting"
                ? "Submitting..."
                : status === "success"
                ? statusMessage
                : status === "error"
                ? statusMessage
                : "Ready for your next request."}
            </p>
            {parsedRequest && (
              <p className="text-[11px] text-muted-foreground font-medium">
                <span className="text-foreground">{getIntentLabel(parsedRequest.primary_intent)}</span>
                {" • "}
                {parsedRequest.user_facing_summary}
              </p>
            )}
            {parsedRequest && (
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Clarification needed:{" "}
                <span className="text-foreground">
                  {parsedRequest.needs_clarification ? "Yes" : "No"}
                </span>
                {parsedRequest.needs_clarification && parsedRequest.clarification_reason && (
                  <>
                    {" • "}
                    {parsedRequest.clarification_reason}
                  </>
                )}
              </p>
            )}
            {lastRequest && (
              <p className="text-[11px] text-muted-foreground leading-relaxed break-words">
                Last request: <span className="text-foreground">{lastRequest}</span>
              </p>
            )}
            {debugInfo && (
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Debug: {debugInfo.parserStage}
                {debugInfo.errorCode ? ` • ${debugInfo.errorCode}` : ""}
              </p>
            )}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Textarea
            placeholder="Type a request..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            aria-label="Master input request"
            className="flex-1 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground resize-none min-h-[32px] h-8 text-xs py-2"
          />
          <Button 
            onClick={handleSubmit}
            disabled={status === "submitting"}
            aria-label="Send master input request"
            className="bg-[#3b82f6] hover:bg-[#2563eb] text-white px-4 h-8 text-xs font-semibold"
          >
            {status === "submitting" ? "Sending..." : "Send"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
