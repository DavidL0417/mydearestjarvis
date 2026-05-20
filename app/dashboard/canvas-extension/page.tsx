"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, type ReactNode } from "react"
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Folder,
  KeyRound,
  Loader2,
  Play,
  RefreshCw,
  Square,
  Wifi,
  WifiOff,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  CanvasExtensionCommand,
  CanvasExtensionCommandEvent,
  CanvasExtensionNode,
  CanvasExtensionPairingCodeResponse,
  CanvasExtensionSession,
  CanvasExtensionStateResponse,
} from "@/schemas/canvas-extension"

type PairingState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; code: string; expiresAt: string }
  | { status: "error"; message: string }

type TreeNode = CanvasExtensionNode & { children: TreeNode[] }
type ChromeRuntime = {
  runtime?: {
    lastError?: { message?: string }
    sendMessage?: (extensionId: string, message: unknown, callback: (response: unknown) => void) => void
  }
}
type StateError = {
  code: string
  message: string
  details: string
}

const KNOWN_CANVAS_EXTENSION_IDS = ["aogoejlpbjmfmmdelknoebibkbhlmplc"]
const COMMAND_SETTLE_REFRESH_DELAY_MS = 1200
const COMMAND_LIVE_REFRESH_MS = 1500

async function readJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload) {
    const message =
      payload && typeof payload === "object" && "details" in payload && typeof payload.details === "string"
        ? payload.details
        : payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : fallback
    throw new Error(message)
  }

  return payload as T
}

async function readStateResponse(response: Response): Promise<CanvasExtensionStateResponse> {
  const payload = await response.json().catch(() => null)

  if (!response.ok || !payload || payload.success !== true) {
    const error = new Error(
      payload && typeof payload === "object" && typeof payload.details === "string"
        ? payload.details
        : "Failed to load Canvas extension state.",
    ) as Error & { stateError?: StateError }
    error.stateError = {
      code: payload && typeof payload === "object" && typeof payload.errorCode === "string"
        ? payload.errorCode
        : "backend_error",
      message: payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : "Failed to load Canvas extension state.",
      details: error.message,
    }
    throw error
  }

  return payload as CanvasExtensionStateResponse
}

function isActiveCommand(command: CanvasExtensionCommand | null) {
  return Boolean(command && ["pending", "running", "cancel_requested"].includes(command.status))
}

function commandTone(command: CanvasExtensionCommand | null) {
  if (!command) return "idle"
  if (command.status === "failed") return "failed"
  if (command.status === "cancel_requested") return "warning"
  if (command.status === "succeeded") return "success"
  if (command.status === "cancelled") return "warning"
  return "running"
}

function commandLabel(command: CanvasExtensionCommand | null) {
  if (!command) return "Idle"
  if (command.type === "discover") return "Discover All Courses"
  if (command.type === "expand_node") return "Expand Canvas Node"
  return "Import Selection"
}

function buildTree(nodes: CanvasExtensionNode[]) {
  const byId = new Map<string, TreeNode>()
  const roots: TreeNode[] = []

  for (const node of nodes) byId.set(node.id, { ...node, children: [] })

  for (const node of byId.values()) {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId)?.children.push(node)
    } else {
      roots.push(node)
    }
  }

  const sortTree = (items: TreeNode[]) => {
    items.sort((left, right) => left.title.localeCompare(right.title))
    for (const item of items) sortTree(item.children)
  }

  sortTree(roots)
  return roots
}

function formatTime(value: string | null | undefined, clientReady: boolean) {
  if (!clientReady) return "..."
  if (!value) return "never"
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })
}

function nodeLevel(node: CanvasExtensionNode) {
  const level = node.metadata.level
  if (level === "course" || level === "tab" || level === "item") return level
  if (node.kind === "course") return "course"
  return node.parentId ? "item" : "tab"
}

function displayUrl(node: CanvasExtensionNode) {
  return typeof node.metadata.actualUrl === "string" ? node.metadata.actualUrl : node.url
}

function nodePathLabel(node: CanvasExtensionNode) {
  try {
    const url = new URL(displayUrl(node))
    const courseTrimmed = url.pathname.replace(/^\/courses\/[^/]+\/?/, "")
    const path = courseTrimmed || "home"
    return path.replace(/^\/+/, "").replace(/[-_]/g, " ") || url.hostname
  } catch {
    return node.kind
  }
}

function selectedByParent(node: CanvasExtensionNode) {
  return node.metadata.selectedByParent === true
}

function ancestorByLevel(node: TreeNode | null, nodesById: Map<string, TreeNode>, level: "course" | "tab" | "item") {
  let current = node

  while (current) {
    if (nodeLevel(current) === level) return current
    current = current.parentId ? nodesById.get(current.parentId) ?? null : null
  }

  return null
}

function nodeIcon(node: CanvasExtensionNode) {
  if (node.kind === "course" || nodeLevel(node) === "tab") return Folder
  return FileText
}

function statusCopy(input: {
  session: CanvasExtensionSession | null
  activeCommand: CanvasExtensionCommand | null
  lastEvent: CanvasExtensionCommandEvent | null
  error: StateError | null
  loaded: boolean
  clientReady: boolean
}) {
  if (!input.loaded && !input.error) {
    return {
      tone: "idle",
      label: "Loading state",
      detail: "Reading Canvas connector state.",
    }
  }

  if (input.error) {
    if (input.error.code === "extension_offline") {
      return {
        tone: "warning",
        label: "Canvas Reader did not respond",
        detail: input.error.details || input.error.message,
      }
    }

    return {
      tone: input.error.code === "auth_required" ? "warning" : "failed",
      label: input.error.code === "auth_required" ? "Signed out" : "Backend issue",
      detail: input.error.details || input.error.message,
    }
  }

  if (input.activeCommand) {
    const commandDetail =
      input.activeCommand.status === "pending"
        ? "Command queued. Waiting for the Chrome extension to wake up or poll Canvas."
        : input.lastEvent?.message || commandLabel(input.activeCommand)

    return {
      tone: commandTone(input.activeCommand),
      label: input.activeCommand.status === "pending"
        ? "Waiting for Canvas Reader"
        : input.activeCommand.status === "cancel_requested"
          ? "Stopping"
          : input.activeCommand.status === "running"
            ? "Running"
            : input.activeCommand.status,
      detail: commandDetail,
    }
  }

  if (!input.session) {
    return {
      tone: "warning",
      label: "Extension offline",
      detail: "No Canvas Reader heartbeat yet.",
    }
  }

  const recentEvent = input.lastEvent && input.clientReady && Date.now() - new Date(input.lastEvent.createdAt).getTime() < 10 * 60_000
    ? input.lastEvent
    : null
  const stale = input.clientReady && Date.now() - new Date(input.session.lastSeenAt).getTime() >= 90_000
  return {
    tone: stale ? "warning" : "success",
    label: stale ? "Extension stale" : "Extension live",
    detail: recentEvent?.message || input.session.activeTitle || input.session.activeUrl || input.session.canvasOrigin || "Ready",
  }
}

function IconButton(props: {
  label: string
  children: ReactNode
  disabled?: boolean
  onClick?: () => void
  variant?: "default" | "outline" | "ghost"
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant={props.variant ?? "outline"}
          className="h-9 w-9 rounded-sm"
          disabled={props.disabled}
          onClick={props.onClick}
          aria-label={props.label}
        >
          {props.children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-[11px]">{props.label}</TooltipContent>
    </Tooltip>
  )
}

function StatusDot({ tone }: { tone: string }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        tone === "success" && "bg-green-500",
        tone === "running" && "bg-primary",
        tone === "warning" && "bg-yellow-500",
        tone === "failed" && "bg-destructive",
        tone === "idle" && "bg-muted-foreground",
      )}
    />
  )
}

function NodeRow(props: {
  node: TreeNode
  active: boolean
  onSelect: (node: CanvasExtensionNode) => void
  onToggle: (node: CanvasExtensionNode) => void
}) {
  const { node, active, onSelect, onToggle } = props
  const Icon = nodeIcon(node)
  const inherited = selectedByParent(node)

  return (
    <div
      className={cn(
        "grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-rule/60 px-2.5 py-2 text-sm",
        active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary/25 hover:text-foreground",
      )}
    >
      <Checkbox
        checked={node.selected}
        onCheckedChange={() => onToggle(node)}
        className="h-4 w-4 rounded-[4px] border-rule bg-background"
        aria-label={`Select ${node.title}`}
      />
      <button type="button" className="grid min-w-0 grid-cols-[auto_1fr] items-center gap-2 text-left" onClick={() => onSelect(node)}>
        <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden="true" />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-medium">{node.title}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{node.kind} · {nodePathLabel(node)}</span>
        </span>
      </button>
      <div className="flex items-center gap-1">
        {inherited ? <Badge variant="outline" className="rounded-sm border-primary/35 px-1.5 text-[10px] text-primary">parent</Badge> : null}
        {node.importedAt ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" aria-label="Imported" /> : null}
        {node.children.length > 0 ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" /> : null}
      </div>
    </div>
  )
}

function Column(props: {
  title: string
  count: number
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="grid min-h-0 grid-rows-[auto_1fr] border-r border-rule bg-secondary/10">
      <div className="flex h-10 items-center justify-between border-b border-rule px-3">
        <h2 className="text-xs font-medium text-foreground">{props.title}</h2>
        <div className="flex items-center gap-1.5">
          {props.action}
          <span className="text-[11px] text-muted-foreground">{props.count}</span>
        </div>
      </div>
      <div className="min-h-0 overflow-auto">{props.children}</div>
    </section>
  )
}

function EmptyColumn({ children }: { children: ReactNode }) {
  return <p className="px-3 py-4 text-xs leading-5 text-muted-foreground">{children}</p>
}

function ExpandPrompt(props: {
  title: string
  disabled: boolean
  busy: boolean
  onExpand: () => void
}) {
  return (
    <div className="grid gap-3 px-3 py-4">
      <p className="text-xs leading-5 text-muted-foreground">{props.title}</p>
      <Button
        type="button"
        size="sm"
        className="h-8 w-fit rounded-sm border border-orange-500/45 bg-orange-500/15 px-2.5 text-xs text-orange-500 hover:bg-orange-500/25 hover:text-orange-400"
        disabled={props.disabled}
        onClick={props.onExpand}
      >
        {props.busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
        Expand
      </Button>
    </div>
  )
}

function EventRail({ events, clientReady }: { events: CanvasExtensionCommandEvent[]; clientReady: boolean }) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium text-foreground">Events</h3>
        <span className="text-[11px] text-muted-foreground">{events.length}</span>
      </div>
      <div className="grid max-h-48 gap-1 overflow-auto">
        {events.length > 0 ? events.slice(0, 12).map((event) => (
          <div key={event.id} className="grid gap-0.5 border border-rule bg-background px-2.5 py-2">
            <div className="flex min-w-0 items-center gap-2">
              <StatusDot tone={event.level === "error" ? "failed" : event.level === "warning" ? "warning" : event.level === "success" ? "success" : "idle"} />
              <span className="truncate text-[12px] text-foreground">{event.message}</span>
            </div>
            <p className="truncate pl-4 text-[10px] text-muted-foreground">{event.phase} · {formatTime(event.createdAt, clientReady)}</p>
          </div>
        )) : (
          <p className="border border-rule bg-background px-2.5 py-2 text-[12px] text-muted-foreground">No events recorded.</p>
        )}
      </div>
    </div>
  )
}

function DetailPane(props: {
  node: TreeNode | null
  selectedCourse: TreeNode | null
  selectedTab: TreeNode | null
  commands: CanvasExtensionCommand[]
  events: CanvasExtensionCommandEvent[]
  clientReady: boolean
}) {
  const node = props.node || props.selectedTab || props.selectedCourse

  if (!node) {
    return (
      <section className="grid min-h-0 grid-rows-[auto_1fr] bg-background">
        <div className="flex h-10 items-center border-b border-rule px-3">
          <h2 className="text-xs font-medium text-foreground">Detail</h2>
        </div>
        <EmptyColumn>Select a course to inspect Canvas content.</EmptyColumn>
      </section>
    )
  }

  const commandsById = new Map(props.commands.map((command) => [command.id, command]))
  const relevantEvents = props.events.filter((event) => {
    if (event.nodeId) return event.nodeId === node.id
    if (!event.commandId) return false

    const command = commandsById.get(event.commandId)
    if (!command) return false
    if (command.targetNodeId === node.id) return true

    const nodeIds = command.payload.nodeIds
    return Array.isArray(nodeIds) && nodeIds.includes(node.id)
  })
  const metadata = [
    nodeLevel(node),
    node.importedAt ? `imported ${formatTime(node.importedAt, props.clientReady)}` : "not imported",
    node.expanded ? "expanded" : "not expanded",
  ]

  return (
    <section className="grid min-h-0 grid-rows-[auto_1fr] bg-background">
      <div className="flex h-10 items-center justify-between border-b border-rule px-3">
        <h2 className="text-xs font-medium text-foreground">Detail</h2>
        <a
          href={displayUrl(node)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center justify-center rounded-sm border border-rule px-2 text-muted-foreground hover:bg-secondary/30 hover:text-foreground"
          aria-label="Open in Canvas"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      <div className="grid min-h-0 content-start gap-4 overflow-auto p-4">
        <div className="grid gap-1">
          <p className="break-words text-lg font-semibold leading-tight text-foreground">{node.title}</p>
          <p className="break-all text-[11px] leading-5 text-muted-foreground">{displayUrl(node)}</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {metadata.map((item) => (
            <Badge key={item} variant="outline" className="rounded-sm border-rule text-[10px] text-muted-foreground">{item}</Badge>
          ))}
        </div>
        {node.textPreview ? (
          <div className="grid gap-2">
            <h3 className="text-xs font-medium text-foreground">Preview</h3>
            <p className="max-h-40 overflow-auto border border-rule bg-secondary/10 px-3 py-2 text-xs leading-5 text-muted-foreground">
              {node.textPreview}
            </p>
          </div>
        ) : null}
        {node.sourceSnapshotId || node.sourceFileId ? (
          <div className="grid gap-2">
            <h3 className="text-xs font-medium text-foreground">Source</h3>
            <div className="grid gap-1 border border-rule bg-secondary/10 px-3 py-2 text-[11px] text-muted-foreground">
              {node.sourceSnapshotId ? <p className="truncate">Snapshot {node.sourceSnapshotId}</p> : null}
              {node.sourceFileId ? <p className="truncate">File {node.sourceFileId}</p> : null}
            </div>
          </div>
        ) : null}
        <EventRail events={relevantEvents} clientReady={props.clientReady} />
      </div>
    </section>
  )
}

export default function CanvasExtensionSetupPage() {
  const [clientReady, setClientReady] = useState(false)
  const [pairing, setPairing] = useState<PairingState>({ status: "idle" })
  const [appOrigin, setAppOrigin] = useState("")
  const [state, setState] = useState<CanvasExtensionStateResponse | null>(null)
  const [selectedNode, setSelectedNode] = useState<CanvasExtensionNode | null>(null)
  const [busyAction, setBusyAction] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [wakingExtension, setWakingExtension] = useState(false)
  const [error, setError] = useState<StateError | null>(null)
  const [wakeWarning, setWakeWarning] = useState<string | null>(null)

  const activeCommand = state?.health.activeCommand ?? state?.commands.find((command) => isActiveCommand(command)) ?? null
  const visibleNodes = useMemo(
    () => (state?.nodes || []).filter((node) => node.kind === "course" || Boolean(node.parentId)),
    [state?.nodes],
  )
  const tree = useMemo(() => buildTree(visibleNodes), [visibleNodes])
  const treeNodesById = useMemo(() => {
    const nodes = new Map<string, TreeNode>()
    const visit = (node: TreeNode) => {
      nodes.set(node.id, node)
      for (const child of node.children) visit(child)
    }

    for (const node of tree) visit(node)
    return nodes
  }, [tree])
  const courses = useMemo(() => tree.filter((node) => node.kind === "course"), [tree])
  const selectedTreeNode = selectedNode ? treeNodesById.get(selectedNode.id) ?? null : null
  const selectedCourse = ancestorByLevel(selectedTreeNode, treeNodesById, "course")
  const selectedTab = ancestorByLevel(selectedTreeNode, treeNodesById, "tab")
  const selectedItem = selectedTreeNode && nodeLevel(selectedTreeNode) === "item" ? selectedTreeNode : null
  const tabs = selectedCourse?.children ?? []
  const items = selectedTab?.children ?? []
  const selectedCount = visibleNodes.filter((node) => node.selected && !node.importedAt).length
  const commandBusy = Boolean(busyAction || isActiveCommand(activeCommand))
  const status = statusCopy({
    session: state?.session ?? null,
    activeCommand,
    lastEvent: state?.health.lastEvent ?? state?.events[0] ?? null,
    error,
    loaded: Boolean(state),
    clientReady,
  })

  async function refreshState(options: { quiet?: boolean } = {}) {
    if (!options.quiet) setRefreshing(true)
    try {
      const payload = await readStateResponse(
        await fetch("/api/integrations/canvas/extension/state", { cache: "no-store" }),
      )
      setState(payload)
      setSelectedNode((current) => current ? payload.nodes.find((node) => node.id === current.id) ?? null : current)
      setError(null)
    } catch (refreshError) {
      const shaped = refreshError as Error & { stateError?: StateError }
      setError(shaped.stateError ?? {
        code: "backend_error",
        message: "Failed to load Canvas extension state.",
        details: refreshError instanceof Error ? refreshError.message : "Unknown state error.",
      })
    } finally {
      if (!options.quiet) setRefreshing(false)
    }
  }

  async function refreshAfterCommandWake() {
    await new Promise((resolve) => window.setTimeout(resolve, COMMAND_SETTLE_REFRESH_DELAY_MS))
    await refreshState()
  }

  useEffect(() => {
    setClientReady(true)
    setAppOrigin(window.location.origin)
    refreshState()
  }, [])

  useEffect(() => {
    if (!isActiveCommand(activeCommand)) return

    const intervalId = window.setInterval(() => {
      refreshState({ quiet: true }).catch((refreshError) => {
        const shaped = refreshError as Error & { stateError?: StateError }
        setError(shaped.stateError ?? {
          code: "backend_error",
          message: "Failed to stream Canvas extension state.",
          details: refreshError instanceof Error ? refreshError.message : "Unknown state error.",
        })
      })
    }, COMMAND_LIVE_REFRESH_MS)

    return () => window.clearInterval(intervalId)
  }, [activeCommand?.id, activeCommand?.status])

  async function createPairingCode() {
    setPairing({ status: "loading" })

    try {
      const payload = await readJson<CanvasExtensionPairingCodeResponse>(
        await fetch("/api/integrations/canvas/extension/pairing-code", { method: "POST" }),
        "Failed to create pairing code.",
      )

      setPairing({ status: "ready", code: payload.code, expiresAt: payload.expiresAt })
    } catch (pairingError) {
      setPairing({
        status: "error",
        message: pairingError instanceof Error ? pairingError.message : "Failed to create pairing code.",
      })
    }
  }

  async function runCommand(type: "discover" | "expand_node" | "import_selected" | "stop" | "resume", targetNodeId?: string) {
    setBusyAction(`${type}:${targetNodeId ?? ""}`)
    setError(null)
    setWakeWarning(null)

    try {
      await readJson(
        await fetch("/api/integrations/canvas/extension/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type, targetNodeId }),
        }),
        "Failed to create Canvas extension command.",
      )
      await refreshState()
      if (type !== "stop") {
        try {
          await requestExtensionPollNow()
          await refreshAfterCommandWake()
        } catch (wakeError) {
          setWakeWarning(wakeError instanceof Error ? wakeError.message : "Canvas Reader wake failed.")
        }
      }
    } catch (commandError) {
      setError({
        code: "command_failed",
        message: "Canvas command failed.",
        details: commandError instanceof Error ? commandError.message : "Canvas extension command failed.",
      })
    } finally {
      setBusyAction(null)
    }
  }

  async function toggleNode(node: CanvasExtensionNode) {
    setError(null)
    try {
      await readJson(
        await fetch("/api/integrations/canvas/extension/nodes", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId: node.id, selected: !node.selected }),
        }),
        "Failed to update Canvas node selection.",
      )
      await refreshState()
    } catch (selectionError) {
      setError({
        code: "selection_failed",
        message: "Selection failed.",
        details: selectionError instanceof Error ? selectionError.message : "Failed to update selection.",
      })
    }
  }

  async function copyCode() {
    if (pairing.status === "ready") await navigator.clipboard.writeText(pairing.code)
  }

  async function copyAppOrigin() {
    if (appOrigin) await navigator.clipboard.writeText(appOrigin)
  }

  async function requestExtensionViaContentScript() {
    const requestId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        window.removeEventListener("message", handleMessage)
        reject(new Error("Could not reach the Canvas Reader from this page. Reload the unpacked extension, refresh this page, then try again."))
      }, 5000)

      function handleMessage(event: MessageEvent) {
        if (event.source !== window || event.origin !== window.location.origin) return
        const message = event.data
        if (!message || message.type !== "JARVIS_CANVAS_EXTENSION_RESPONSE" || message.id !== requestId) return

        window.clearTimeout(timeout)
        window.removeEventListener("message", handleMessage)

        if (message.ok) {
          resolve(message.result)
        } else {
          reject(new Error(typeof message.error === "string" ? message.error : "Canvas Reader wake failed."))
        }
      }

      window.addEventListener("message", handleMessage)
      window.postMessage({
        type: "JARVIS_CANVAS_EXTENSION_REQUEST",
        id: requestId,
        action: "POLL_NOW",
      }, window.location.origin)
    })
  }

  async function requestExtensionDirectly() {
    const chromeRuntime = (window as Window & { chrome?: ChromeRuntime }).chrome?.runtime

    if (!chromeRuntime?.sendMessage) {
      throw new Error("Chrome external extension messaging is not available on this page.")
    }

    const failures: string[] = []

    for (const extensionId of KNOWN_CANVAS_EXTENSION_IDS) {
      const result = await new Promise<unknown>((resolve, reject) => {
        chromeRuntime.sendMessage?.(extensionId, { type: "POLL_NOW" }, (response) => {
          const runtimeError = chromeRuntime.lastError?.message
          if (runtimeError) {
            reject(new Error(runtimeError))
            return
          }

          resolve(response)
        })
      }).catch((directError) => {
        failures.push(directError instanceof Error ? directError.message : "Unknown extension messaging failure.")
        return null
      })

      if (result && typeof result === "object" && "success" in result && result.success === true) return result
    }

    throw new Error(failures[0] || "Could not reach the Canvas Reader through Chrome messaging.")
  }

  async function requestExtensionPollNow() {
    try {
      return await requestExtensionDirectly()
    } catch {
      return requestExtensionViaContentScript()
    }
  }

  async function wakeExtension() {
    setWakingExtension(true)
    setError(null)
    setWakeWarning(null)

    try {
      await requestExtensionPollNow()
      await refreshAfterCommandWake()
    } catch (wakeError) {
      setError({
        code: "extension_offline",
        message: "Canvas Reader did not respond.",
        details: wakeError instanceof Error ? wakeError.message : "Canvas Reader wake failed.",
      })
    } finally {
      setWakingExtension(false)
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid h-screen grid-rows-[auto_1fr]">
        <header className="grid gap-3 border-b border-rule bg-background px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/dashboard" className="inline-flex h-8 w-8 items-center justify-center rounded-sm text-muted-foreground hover:bg-secondary/30 hover:text-foreground" aria-label="Dashboard">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-semibold tracking-normal">Canvas Reader</h1>
                <p className="truncate text-xs text-muted-foreground">
                  {state?.session?.canvasOrigin || "No Canvas origin yet"} · last seen {formatTime(state?.session?.lastSeenAt, clientReady)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IconButton label="Reload state" disabled={refreshing} onClick={refreshState}>
                {refreshing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
              </IconButton>
              <IconButton label="Wake extension" disabled={wakingExtension} onClick={wakeExtension}>
                {wakingExtension ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Wifi className="h-4 w-4" aria-hidden="true" />}
              </IconButton>
            </div>
          </div>
          <div
            className={cn(
              "grid min-h-10 grid-cols-[auto_1fr_auto] items-center gap-3 border px-3 py-2",
              status.tone === "success" && "border-green-500/30 bg-green-500/10",
              status.tone === "running" && "border-primary/35 bg-primary/10",
              status.tone === "warning" && "border-yellow-500/30 bg-yellow-500/10",
              status.tone === "failed" && "border-destructive/35 bg-destructive/10",
              status.tone === "idle" && "border-rule bg-secondary/10",
            )}
          >
            {status.tone === "failed" ? <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" /> : status.tone === "warning" ? <WifiOff className="h-4 w-4 text-yellow-500" aria-hidden="true" /> : <StatusDot tone={status.tone} />}
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-sm font-medium">{status.label}</span>
                {activeCommand ? <Badge variant="outline" className="rounded-sm border-rule text-[10px] text-muted-foreground">{commandLabel(activeCommand)}</Badge> : null}
              </div>
              <p className="truncate text-xs text-muted-foreground">{status.detail}</p>
              {wakeWarning ? <p className="truncate text-xs text-yellow-500">{wakeWarning}</p> : null}
            </div>
            <div className="flex items-center gap-2">
              {activeCommand?.status === "pending" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 rounded-sm px-2 text-[11px]"
                  disabled={wakingExtension}
                  onClick={wakeExtension}
                >
                  {wakingExtension ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Wifi className="h-3.5 w-3.5" aria-hidden="true" />}
                  Wake
                </Button>
              ) : null}
              <span className="text-[11px] text-muted-foreground">{state?.health.authStatus ?? error?.code ?? "loading"}</span>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-[240px_minmax(0,1fr)]">
          <aside className="grid min-h-0 grid-rows-[auto_auto_1fr] gap-4 border-r border-rule bg-secondary/10 p-3">
            <section className="grid gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-foreground">Setup</h2>
                <a href="/downloads/jarvis-canvas-reader.zip" className="inline-flex h-7 w-7 items-center justify-center rounded-sm border border-rule text-muted-foreground hover:bg-secondary/30 hover:text-foreground" aria-label="Download extension ZIP">
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </div>
              <div className="grid gap-1.5">
                <div className="grid grid-cols-[1fr_auto] items-center gap-2 border border-rule bg-background px-2 py-1.5">
                  <span className="truncate font-mono text-[11px] text-muted-foreground">{appOrigin || "Loading..."}</span>
                  <button type="button" className="text-muted-foreground hover:text-foreground" onClick={copyAppOrigin} aria-label="Copy app URL">
                    <Clipboard className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
                <Button type="button" variant="outline" className="h-8 rounded-sm text-xs" disabled={pairing.status === "loading"} onClick={createPairingCode}>
                  {pairing.status === "loading" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />}
                  Pairing code
                </Button>
                {pairing.status === "ready" ? (
                  <button type="button" className="grid gap-0.5 border border-primary/35 bg-primary/10 px-2 py-2 text-left" onClick={copyCode}>
                    <span className="font-mono text-sm tracking-[0.12em] text-foreground">{pairing.code}</span>
                    <span className="text-[10px] text-muted-foreground">expires {formatTime(pairing.expiresAt, clientReady)}</span>
                  </button>
                ) : pairing.status === "error" ? (
                  <p className="border border-destructive/35 bg-destructive/10 px-2 py-1.5 text-[11px] text-destructive">{pairing.message}</p>
                ) : null}
              </div>
            </section>

            <section className="grid gap-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-medium text-foreground">Controls</h2>
                <Badge variant="outline" className="rounded-sm border-rule text-[10px] text-muted-foreground">{selectedCount} selected</Badge>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <IconButton label="Discover All Courses" disabled={commandBusy} onClick={() => runCommand("discover")}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <IconButton label="Import selected" disabled={selectedCount === 0 || commandBusy} onClick={() => runCommand("import_selected")}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <IconButton label="Stop command" disabled={!activeCommand || activeCommand.status === "cancel_requested"} onClick={() => runCommand("stop")}>
                  <Square className="h-4 w-4" aria-hidden="true" />
                </IconButton>
                <IconButton label="Resume import" disabled={commandBusy || selectedCount === 0} onClick={() => runCommand("resume")}>
                  <Clock3 className="h-4 w-4" aria-hidden="true" />
                </IconButton>
              </div>
            </section>

            <section className="min-h-0">
              <EventRail events={state?.events ?? []} clientReady={clientReady} />
            </section>
          </aside>

          <section className="grid min-h-0 grid-cols-[minmax(180px,0.8fr)_minmax(180px,0.8fr)_minmax(220px,1fr)_minmax(300px,1.1fr)]">
            <Column title="Courses" count={courses.length}>
              {courses.length > 0 ? courses.map((node) => (
                <NodeRow
                  key={node.id}
                  node={node}
                  active={selectedCourse?.id === node.id}
                  onSelect={setSelectedNode}
                  onToggle={toggleNode}
                />
              )) : <EmptyColumn>Discover All Courses after opening Canvas.</EmptyColumn>}
            </Column>

            <Column title="Tabs" count={tabs.length}>
              {selectedCourse ? (
                tabs.length > 0 ? tabs.map((node) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    active={selectedTab?.id === node.id}
                    onSelect={setSelectedNode}
                    onToggle={toggleNode}
                  />
                )) : (
                  <ExpandPrompt
                    title="No tabs yet."
                    disabled={commandBusy}
                    busy={busyAction === `expand_node:${selectedCourse.id}` || activeCommand?.targetNodeId === selectedCourse.id}
                    onExpand={() => runCommand("expand_node", selectedCourse.id)}
                  />
                )
              ) : <EmptyColumn>Select a course.</EmptyColumn>}
            </Column>

            <Column title="Items" count={items.length}>
              {selectedTab ? (
                items.length > 0 ? items.map((node) => (
                  <NodeRow
                    key={node.id}
                    node={node}
                    active={selectedItem?.id === node.id}
                    onSelect={setSelectedNode}
                    onToggle={toggleNode}
                  />
                )) : (
                  <ExpandPrompt
                    title="No items yet."
                    disabled={commandBusy}
                    busy={busyAction === `expand_node:${selectedTab.id}` || activeCommand?.targetNodeId === selectedTab.id}
                    onExpand={() => runCommand("expand_node", selectedTab.id)}
                  />
                )
              ) : <EmptyColumn>Select a tab.</EmptyColumn>}
            </Column>

            <DetailPane
              node={selectedItem}
              selectedCourse={selectedCourse}
              selectedTab={selectedTab}
              commands={state?.commands ?? []}
              events={state?.events ?? []}
              clientReady={clientReady}
            />
          </section>
        </div>
      </div>
    </main>
  )
}
