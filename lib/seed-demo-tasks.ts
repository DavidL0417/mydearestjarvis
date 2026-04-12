import { readFile } from "node:fs/promises"
import path from "node:path"

export interface SeedDemoTask {
  title: string
  description: string | null
  deadline: string | null
  priority: "low" | "medium" | "high"
  status: "todo" | "scheduled" | "completed" | "missed"
  tags: string[]
}

function extractTaskInsertValues(sql: string) {
  const marker = "insert into public.tasks"
  const insertStart = sql.indexOf(marker)

  if (insertStart === -1) {
    return null
  }

  const valuesStart = sql.indexOf("values", insertStart)
  const endMarker = "\n\ncommit;"
  const insertEnd = sql.indexOf(endMarker, valuesStart)

  if (valuesStart === -1 || insertEnd === -1) {
    return null
  }

  return sql.slice(valuesStart + "values".length, insertEnd).trim()
}

function splitRows(valuesBlock: string) {
  const rows: string[] = []
  let current = ""
  let depth = 0
  let inString = false

  for (let index = 0; index < valuesBlock.length; index += 1) {
    const char = valuesBlock[index]
    const next = valuesBlock[index + 1]

    if (char === "'") {
      current += char

      if (inString && next === "'") {
        current += next
        index += 1
        continue
      }

      inString = !inString
      continue
    }

    if (!inString && char === "(") {
      depth += 1
    }

    if (depth > 0) {
      current += char
    }

    if (!inString && char === ")") {
      depth -= 1

      if (depth === 0 && current.trim()) {
        rows.push(current.trim().slice(1, -1))
        current = ""
      }
    }
  }

  return rows
}

function splitColumns(row: string) {
  const columns: string[] = []
  let current = ""
  let depthParen = 0
  let depthBracket = 0
  let inString = false

  for (let index = 0; index < row.length; index += 1) {
    const char = row[index]
    const next = row[index + 1]

    if (char === "'") {
      current += char

      if (inString && next === "'") {
        current += next
        index += 1
        continue
      }

      inString = !inString
      continue
    }

    if (!inString) {
      if (char === "(") {
        depthParen += 1
      } else if (char === ")") {
        depthParen -= 1
      } else if (char === "[") {
        depthBracket += 1
      } else if (char === "]") {
        depthBracket -= 1
      } else if (char === "," && depthParen === 0 && depthBracket === 0) {
        columns.push(current.trim())
        current = ""
        continue
      }
    }

    current += char
  }

  if (current.trim()) {
    columns.push(current.trim())
  }

  return columns
}

function parseSqlString(value: string) {
  if (value === "null") {
    return null
  }

  if (!value.startsWith("'") || !value.endsWith("'")) {
    return value
  }

  return value.slice(1, -1).replace(/''/g, "'")
}

function parseSqlArray(value: string) {
  if (!value.startsWith("array[")) {
    return []
  }

  const inner = value.slice("array[".length, -1)
  const entries: string[] = []
  let current = ""
  let inString = false

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index]
    const next = inner[index + 1]

    if (char === "'") {
      current += char

      if (inString && next === "'") {
        current += next
        index += 1
        continue
      }

      inString = !inString
      continue
    }

    if (!inString && char === ",") {
      const parsed = parseSqlString(current.trim())
      if (parsed) {
        entries.push(parsed)
      }
      current = ""
      continue
    }

    current += char
  }

  const parsed = parseSqlString(current.trim())
  if (parsed) {
    entries.push(parsed)
  }

  return entries
}

export async function getSeedDemoTasks() {
  const sqlPath = path.join(process.cwd(), "sql", "seed_demo_data.sql")
  const sql = await readFile(sqlPath, "utf8")
  const valuesBlock = extractTaskInsertValues(sql)

  if (!valuesBlock) {
    return []
  }

  return splitRows(valuesBlock)
    .map(splitColumns)
    .filter((columns) => columns.length >= 11)
    .map<SeedDemoTask>((columns) => ({
      title: parseSqlString(columns[1]) ?? "Untitled task",
      description: parseSqlString(columns[2]),
      deadline: parseSqlString(columns[3]),
      priority: (parseSqlString(columns[5]) as SeedDemoTask["priority"] | null) ?? "medium",
      status: (parseSqlString(columns[6]) as SeedDemoTask["status"] | null) ?? "todo",
      tags: parseSqlArray(columns[9]),
    }))
}
