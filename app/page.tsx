"use client"

import { useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { DashboardHeader } from "@/components/dashboard/dashboard-header"
import { WorkspaceSnapshot } from "@/components/dashboard/workspace-snapshot"
import { PanelTabs } from "@/components/dashboard/panel-tabs"
import { MasterInput } from "@/components/dashboard/master-input"
import { WhatToDoNow } from "@/components/dashboard/what-to-do-now"
import { StatusPanel } from "@/components/dashboard/status-panel"
import { CalendarsSidebar, initialCalendars, type Calendar } from "@/components/dashboard/calendars-sidebar"
import { TaskManager, initialTasks, type Task } from "@/components/dashboard/task-manager"
import { X, Book } from "lucide-react"
// ##### BACKEND API #####
// DO NOT MODIFY UNLESS BACKEND OWNER
import { getDashboardData } from "@/lib/data/dashboard"
import type { DashboardResponse, ScheduleEvent, ScheduleEventInput, ScheduleResponse } from "@/types"
// ##### END BACKEND #####

type MobileSection = "command" | "schedule" | "status"
type PlannerUiStatus = "Not scheduled" | "Scheduling..." | "Ready" | "Error"

const ScheduleView = dynamic(
  () => import("@/components/dashboard/schedule-view").then((module) => module.ScheduleView),
  { ssr: false },
)

const CALENDAR_DEFAULTS: Record<string, { name: string; color: string; source: Calendar["source"] }> = {
  "cal-tasks": { name: "Tasks", color: "#ef4444", source: "local" },
  "calendar-main": { name: "Main", color: "#3b82f6", source: "local" },
  "calendar-projects": { name: "Projects", color: "#fb923c", source: "local" },
  "calendar-academics": { name: "Academics", color: "#fde047", source: "local" },
  "calendar-research": { name: "Research", color: "#c084fc", source: "local" },
  "calendar-career": { name: "Career", color: "#22d3ee", source: "local" },
  "calendar-personal": { name: "Personal", color: "#34d399", source: "local" },
}

const DEFAULT_BACKEND_CALENDAR_ID = "calendar-main"

function getDisplayCalendarId(calendarId: string | null | undefined) {
  return calendarId || DEFAULT_BACKEND_CALENDAR_ID
}

function createCalendarFromId(calendarId: string): Calendar {
  const preset = CALENDAR_DEFAULTS[calendarId]

  if (preset) {
    return {
      id: calendarId,
      name: preset.name,
      color: preset.color,
      isVisible: true,
      source: preset.source,
    }
  }

  return {
    id: calendarId,
    name: calendarId.replace(/[-_]/g, " "),
    color: "#a78bfa",
    isVisible: true,
    source: "local",
  }
}

function mergeScheduleEvents(baseEvents: ScheduleEvent[], overlayEvents: ScheduleEvent[]) {
  if (overlayEvents.length === 0) {
    return baseEvents
  }

  const filteredBaseEvents = baseEvents.filter((baseEvent) => {
    return !overlayEvents.some((overlayEvent) => {
      if (overlayEvent.id === baseEvent.id) {
        return true
      }

      if (overlayEvent.taskId && baseEvent.taskId) {
        return overlayEvent.taskId === baseEvent.taskId
      }

      return false
    })
  })

  return [...filteredBaseEvents, ...overlayEvents].sort(
    (left, right) => new Date(left.start).getTime() - new Date(right.start).getTime(),
  )
}

function toScheduleEventInput(event: ScheduleEvent): ScheduleEventInput {
  return {
    id: event.id,
    title: event.title,
    start: event.start,
    end: event.end,
    source: event.source,
    taskId: event.taskId,
    status: event.status,
    location: event.location,
    externalEventId: event.externalEventId,
    isImmutable: event.isImmutable,
    calendarId: event.calendarId,
  }
}

function getScheduleErrorMessage(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const details = "details" in payload && typeof payload.details === "string" ? payload.details : null
    const error = "error" in payload && typeof payload.error === "string" ? payload.error : null

    if (details) {
      return details
    }

    if (error) {
      return error
    }
  }

  return fallback
}

export default function DashboardPage() {
  const [panelsHidden, setPanelsHidden] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [mobileSection, setMobileSection] = useState<MobileSection>("schedule")
  const [isDarkMode, setIsDarkMode] = useState(true)
  
  // Calendar management state
  const [calendarsSidebarOpen, setCalendarsSidebarOpen] = useState(false)
  const [calendars, setCalendars] = useState<Calendar[]>(initialCalendars)
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(null)
  
  // Task management state
  const [tasks, setTasks] = useState<Task[]>(initialTasks)

  // ##### BACKEND API #####
  // DO NOT MODIFY UNLESS BACKEND OWNER
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null)
  const [scheduledOverlayEvents, setScheduledOverlayEvents] = useState<ScheduleEvent[]>([])
  const [plannerStatus, setPlannerStatus] = useState<PlannerUiStatus>("Not scheduled")
  const [plannerSummary, setPlannerSummary] = useState("")
  const [isScheduling, setIsScheduling] = useState(false)
  // ##### END BACKEND #####

  // Get visible calendar IDs for filtering events
  const visibleCalendarIds = calendars.filter(cal => cal.isVisible).map(cal => cal.id)
  const mergedScheduleEvents = useMemo(
    () => mergeScheduleEvents(dashboardData?.events || [], scheduledOverlayEvents),
    [dashboardData?.events, scheduledOverlayEvents],
  )
  
  // Get the active calendar object
  const activeCalendar = activeCalendarId 
    ? calendars.find(cal => cal.id === activeCalendarId) || null 
    : null

  // Toggle dark/light mode
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [isDarkMode])

  const handleToggleTheme = () => {
    setIsDarkMode(!isDarkMode)
  }

  // API Hook: Replace with actual Google Calendar sync
  const handleSyncWithGoogle = () => {
    console.log("Syncing with Google Calendar...")
  }

  const handleOpenCalendarsSidebar = () => {
    setCalendarsSidebarOpen(true)
  }
  
  // ##### BACKEND API #####
  // DO NOT MODIFY UNLESS BACKEND OWNER
  useEffect(() => {
    let isActive = true

    async function loadDashboard() {
      const data = await getDashboardData()

      if (!isActive || !data) {
        return
      }

      console.log("Loaded dashboard data", data)
      setDashboardData(data)
    }

    loadDashboard()

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    setCalendars((currentCalendars) => {
      const knownCalendarIds = new Set(currentCalendars.map((calendar) => calendar.id))
      const nextCalendars = [...currentCalendars]

      for (const event of mergedScheduleEvents) {
        const displayCalendarId = getDisplayCalendarId(event.calendarId)

        if (knownCalendarIds.has(displayCalendarId)) {
          continue
        }

        nextCalendars.push(createCalendarFromId(displayCalendarId))
        knownCalendarIds.add(displayCalendarId)
      }

      return nextCalendars.length === currentCalendars.length ? currentCalendars : nextCalendars
    })
  }, [mergedScheduleEvents])

  const handleSchedule = async () => {
    if (isScheduling || !dashboardData) {
      return
    }

    setIsScheduling(true)
    setPlannerStatus("Scheduling...")
    setPlannerSummary("")

    try {
      const visibleHardEvents = dashboardData.events
        .filter((event) => !event.calendarId || visibleCalendarIds.includes(event.calendarId))
        .map(toScheduleEventInput)

      const response = await fetch("/api/schedule", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskIds: [],
          hardEvents: visibleHardEvents,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok || !payload) {
        throw new Error(getScheduleErrorMessage(payload, "Scheduling failed."))
      }

      const scheduleResponse = payload as ScheduleResponse

      setScheduledOverlayEvents(scheduleResponse.schedule.proposedEvents)
      setPlannerStatus(scheduleResponse.schedule.plannerStatus === "ready" ? "Ready" : "Not scheduled")
      setPlannerSummary(scheduleResponse.schedule.summary)
    } catch (error) {
      setPlannerStatus("Error")
      setPlannerSummary(error instanceof Error ? error.message : "Scheduling failed.")
    } finally {
      setIsScheduling(false)
    }
  }
  // ##### END BACKEND #####

  return (
    <div className={`h-screen overflow-hidden text-foreground p-3 md:p-4 ${isDarkMode ? "bg-[#0a0a0a]" : "bg-gray-50"}`}>
      <div className="max-w-[1600px] mx-auto h-full flex flex-col">
        {/* Header */}
        <DashboardHeader 
          onTogglePanels={() => setPanelsHidden(!panelsHidden)} 
          onToggleMobileMenu={() => setMobileMenuOpen(!mobileMenuOpen)}
          onToggleTheme={handleToggleTheme}
          onOpenCalendars={handleOpenCalendarsSidebar}
          panelsHidden={panelsHidden}
          isDarkMode={isDarkMode}
        />

        {/* Calendars Sidebar - Slide-in from left */}
        <CalendarsSidebar
          isOpen={calendarsSidebarOpen}
          onClose={() => setCalendarsSidebarOpen(false)}
          calendars={calendars}
          onCalendarsChange={setCalendars}
          onSelectCalendar={setActiveCalendarId}
          activeCalendarId={activeCalendarId}
        />
        
        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className={`fixed inset-0 z-50 ${isDarkMode ? "bg-[#0a0a0a]" : "bg-gray-50"} md:hidden`}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="text-base font-bold text-foreground">Navigation</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(false)}
                className="text-muted-foreground hover:text-foreground p-2"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 space-y-2">
              {[
                { id: "command" as const, label: "Command Center" },
                { id: "schedule" as const, label: "Schedule" },
                { id: "status" as const, label: "Status" },
              ].map((section) => (
                <Button
                  key={section.id}
                  variant={mobileSection === section.id ? "default" : "ghost"}
                  className={`w-full justify-start text-sm font-semibold ${
                    mobileSection === section.id
                      ? "bg-[#3b82f6] text-white"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                  }`}
                  onClick={() => {
                    setMobileSection(section.id)
                    setMobileMenuOpen(false)
                  }}
                >
                  {section.label}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Hide Panels Toggle - Desktop only */}
        <div className="hidden md:flex mb-3 items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setPanelsHidden(!panelsHidden)}
            className="text-muted-foreground hover:text-foreground hover:bg-secondary text-xs h-7 font-semibold"
          >
            {panelsHidden ? "Show Panels" : "Hide Panels"}
          </Button>
          <span className="text-xs text-muted-foreground font-medium">
            Focus panel open. Hide panels for a full-screen calendar view.
          </span>
        </div>

        {/* Mobile Section Navigation */}
        <div className="flex md:hidden gap-1 mb-3 bg-secondary/50 rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpenCalendarsSidebar}
            className="text-muted-foreground hover:text-foreground h-7 w-9 p-0"
          >
            <Book className="w-4 h-4" />
          </Button>
          {[
            { id: "command" as const, label: "Command" },
            { id: "schedule" as const, label: "Schedule" },
            { id: "status" as const, label: "Status" },
          ].map((section) => (
            <Button
              key={section.id}
              variant={mobileSection === section.id ? "default" : "ghost"}
              size="sm"
              onClick={() => setMobileSection(section.id)}
              className={`flex-1 text-sm font-semibold ${
                mobileSection === section.id
                  ? "bg-[#3b82f6] text-white text-xs h-7 font-semibold"
                  : "text-muted-foreground hover:text-foreground text-xs h-7 font-semibold"
              }`}
            >
              {section.label}
            </Button>
          ))}
        </div>

        {/* Mobile Content */}
        <div className="md:hidden flex-1 overflow-auto">
          {mobileSection === "command" && (
            <div className="flex flex-col gap-3 h-full overflow-auto">
              <WorkspaceSnapshot stats={dashboardData?.stats} />
              <PanelTabs />
              <MasterInput />
              <WhatToDoNow currentTask={dashboardData?.currentTask} />
            </div>
          )}
          {mobileSection === "schedule" && (
            <div className="h-full">
              <ScheduleView 
                onSyncWithGoogle={handleSyncWithGoogle}
                visibleCalendarIds={visibleCalendarIds}
                calendars={calendars}
                events={mergedScheduleEvents}
                plannerStatus={plannerStatus}
                plannerSummary={plannerSummary}
                onSchedule={handleSchedule}
                isScheduling={isScheduling}
              />
            </div>
          )}
          {mobileSection === "status" && (
            <div>
              {activeCalendar ? (
                <TaskManager 
                  calendar={activeCalendar}
                  tasks={tasks}
                  onTasksChange={setTasks}
                />
              ) : (
                <StatusPanel stats={dashboardData?.stats} />
              )}
            </div>
          )}
        </div>

        {/* Desktop Main Content Grid - iCal compact style, fit to screen */}
        <div className={`hidden md:grid gap-3 flex-1 overflow-hidden ${panelsHidden ? "grid-cols-1" : "grid-cols-[280px_1fr_220px]"}`}>
          {/* Left Column - Command Center */}
          {!panelsHidden && (
            <div className="flex flex-col gap-3 overflow-auto">
              <WorkspaceSnapshot stats={dashboardData?.stats} />
              <PanelTabs />
              <MasterInput />
              <WhatToDoNow currentTask={dashboardData?.currentTask} />
            </div>
          )}

          {/* Center Column - Schedule View */}
          <div className={`${panelsHidden ? "col-span-1" : ""} overflow-hidden`}>
            <ScheduleView 
              onSyncWithGoogle={handleSyncWithGoogle}
              visibleCalendarIds={visibleCalendarIds}
              calendars={calendars}
              events={mergedScheduleEvents}
              plannerStatus={plannerStatus}
              plannerSummary={plannerSummary}
              onSchedule={handleSchedule}
              isScheduling={isScheduling}
            />
          </div>

          {/* Right Column - Status Panel or Task Manager */}
          {!panelsHidden && (
            <div className="overflow-auto">
              {activeCalendar ? (
                <TaskManager 
                  calendar={activeCalendar}
                  tasks={tasks}
                  onTasksChange={setTasks}
                />
              ) : (
                <StatusPanel stats={dashboardData?.stats} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
