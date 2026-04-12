// ##### BACKEND API #####
// DO NOT MODIFY UNLESS BACKEND OWNER

const DEFAULT_TIMEZONE = "America/Chicago"

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "long",
  })
}

function parseNow(now?: string | null) {
  if (!now) {
    return new Date()
  }

  const parsed = new Date(now)

  if (!Number.isFinite(parsed.getTime())) {
    return new Date()
  }

  return parsed
}

export function getCurrentDayContext(input?: {
  now?: string | null
  timezone?: string | null
}) {
  const timeZone = input?.timezone?.trim() || DEFAULT_TIMEZONE
  const now = parseNow(input?.now)
  const formatter = getFormatter(timeZone)
  const parts = formatter.formatToParts(now)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  const weekday = parts.find((part) => part.type === "weekday")?.value

  if (!year || !month || !day || !weekday) {
    throw new Error(`Failed to derive current day context for timezone ${timeZone}.`)
  }

  return {
    nowIso: now.toISOString(),
    timezone: timeZone,
    currentDay: `${year}-${month}-${day}`,
    weekday,
  }
}

// ##### END BACKEND #####
