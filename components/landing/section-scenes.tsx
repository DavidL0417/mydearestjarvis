"use client"

import { useMemo, type CSSProperties } from "react"

import type { LandingMotionState } from "@/components/landing/landing-motion"

interface SectionScenesProps {
  motion: LandingMotionState
}

const CENTER_X = 620
const CENTER_Y = 374

// Everything is scrubbed by scroll — there is no animation clock. Each source
// reads as a moving head with a short trail, then all heads collapse inward and
// fade as they reach the center.
const TRAVEL_START = 0.18
const TRAVEL_SPAN = 2.5
const TRAIL_STEPS = 8
const TRAIL_LENGTH = 0.22
const CONVERGE_START = 1.5
const CONVERGE_RANGE = 1.25

type Point = {
  x: number
  y: number
}

type Traveler = {
  id: string
  tone: string
  baseOpacity: number
  strokeWidth: number
  headRadius: number
  start: Point
  c1: Point
  c2: Point
  end: Point
  delay: number
}

function seededNoise(seed: number) {
  const v = Math.sin(seed * 12.9898) * 43758.5453
  return v - Math.floor(v)
}

// Math.sin is not bit-identical between the Node server and the browser, so any
// value serialized into the DOM must be rounded or React reports a hydration
// mismatch. Path coordinates use toFixed(1), which is coarse enough to be safe.
const round = (value: number, digits = 4) => Number(value.toFixed(digits))

function toneFor(i: number) {
  const r = seededNoise(i * 5.9 + 2.3)
  if (r < 0.58) return "var(--signal-copper)"
  if (r < 0.74) return "var(--signal-teal)"
  if (r < 0.89) return "var(--signal-blue)"
  return "var(--signal-green)"
}

function buildTravelers(): Traveler[] {
  return Array.from({ length: 20 }).map((_, i) => {
    const edge = i % 4
    const start =
      edge === 0
        ? { x: round(60 + seededNoise(i * 3.1 + 1) * 260), y: round(90 + seededNoise(i * 4.7 + 2) * 620) }
        : edge === 1
          ? { x: round(940 + seededNoise(i * 3.1 + 1) * 220), y: round(80 + seededNoise(i * 4.7 + 2) * 640) }
          : edge === 2
            ? { x: round(120 + seededNoise(i * 3.1 + 1) * 960), y: round(66 + seededNoise(i * 4.7 + 2) * 120) }
            : { x: round(110 + seededNoise(i * 3.1 + 1) * 980), y: round(610 + seededNoise(i * 4.7 + 2) * 118) }

    const endAngle = seededNoise(i * 5.3 + 3) * Math.PI * 2
    const endRadius = seededNoise(i * 6.1 + 4) * 22
    const end = {
      x: round(CENTER_X + Math.cos(endAngle) * endRadius),
      y: round(CENTER_Y + Math.sin(endAngle) * endRadius),
    }

    const dx = end.x - start.x
    const dy = end.y - start.y
    const distance = Math.hypot(dx, dy)
    const normal = seededNoise(i * 7.1 + 8) > 0.5 ? 1 : -1
    const bend = (90 + seededNoise(i * 8.9 + 9) * 170) * normal
    const nx = distance > 0 ? -dy / distance : 0
    const ny = distance > 0 ? dx / distance : 0

    return {
      id: `traveler-${i}`,
      tone: toneFor(i),
      baseOpacity: round(0.28 + seededNoise(i * 2.7 + 5) * 0.22),
      strokeWidth: round(0.9 + (i % 4) * 0.18, 2),
      headRadius: round(2.1 + seededNoise(i * 3.9 + 10) * 1.2, 2),
      start,
      c1: {
        x: round(start.x + dx * (0.26 + seededNoise(i * 11.3 + 4) * 0.12) + nx * bend),
        y: round(start.y + dy * (0.24 + seededNoise(i * 12.1 + 6) * 0.12) + ny * bend),
      },
      c2: {
        x: round(start.x + dx * (0.62 + seededNoise(i * 13.7 + 7) * 0.16) - nx * bend * 0.45),
        y: round(start.y + dy * (0.64 + seededNoise(i * 14.9 + 8) * 0.14) - ny * bend * 0.45),
      },
      end,
      delay: round(TRAVEL_START + seededNoise(i * 8.3 + 7) * 0.72),
    }
  })
}

const TRAVELERS = buildTravelers()

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value: number) {
  return value * value * (3 - 2 * value)
}

function cubicPoint(traveler: Traveler, t: number): Point {
  const inv = 1 - t
  return {
    x:
      inv * inv * inv * traveler.start.x +
      3 * inv * inv * t * traveler.c1.x +
      3 * inv * t * t * traveler.c2.x +
      t * t * t * traveler.end.x,
    y:
      inv * inv * inv * traveler.start.y +
      3 * inv * inv * t * traveler.c1.y +
      3 * inv * t * t * traveler.c2.y +
      t * t * t * traveler.end.y,
  }
}

function travelerProgress(traveler: Traveler, progress: number) {
  return smoothstep(clamp01((progress - traveler.delay) / TRAVEL_SPAN))
}

function travelerFade(t: number) {
  return 1 - smoothstep(clamp01((t - 0.76) / 0.24))
}

interface TravelersLayerProps {
  progress: number
}

function TravelersLayer({ progress }: TravelersLayerProps) {
  return (
    <g className="travelers-layer">
      {TRAVELERS.map((traveler) => {
        const headT = travelerProgress(traveler, progress)
        const head = cubicPoint(traveler, headT)
        const fade = travelerFade(headT)
        const visible = clamp01((progress - traveler.delay + 0.08) * 4) * fade

        return (
          <g key={traveler.id} className="traveler" style={{ ["--traveler-visible" as string]: visible.toFixed(4) } as CSSProperties}>
            {Array.from({ length: TRAIL_STEPS }).map((_, step) => {
              const segmentEndT = clamp01(headT - (step / TRAIL_STEPS) * TRAIL_LENGTH)
              const segmentStartT = clamp01(headT - ((step + 1) / TRAIL_STEPS) * TRAIL_LENGTH)
              const segmentStart = cubicPoint(traveler, segmentStartT)
              const segmentEnd = cubicPoint(traveler, segmentEndT)
              const segmentOpacity = traveler.baseOpacity * (1 - step / TRAIL_STEPS)

              return (
                <line
                  key={`${traveler.id}-trail-${step}`}
                  className="traveler-trail"
                  x1={segmentStart.x.toFixed(1)}
                  y1={segmentStart.y.toFixed(1)}
                  x2={segmentEnd.x.toFixed(1)}
                  y2={segmentEnd.y.toFixed(1)}
                  stroke={traveler.tone}
                  strokeWidth={traveler.strokeWidth}
                  strokeOpacity={round(segmentOpacity)}
                />
              )
            })}
            <circle
              className="traveler-head"
              cx={head.x.toFixed(1)}
              cy={head.y.toFixed(1)}
              r={traveler.headRadius}
              fill={traveler.tone}
              opacity={round(visible * 0.92)}
            />
          </g>
        )
      })}
    </g>
  )
}

export function SectionScenes({ motion }: SectionScenesProps) {
  const stage = useMemo(() => {
    const sp = motion.sceneProgress
    const systemOpacity = clamp01((sp - 0.02) * 1.6)
    const travelersConverge = smoothstep(clamp01((sp - CONVERGE_START) / CONVERGE_RANGE))
    return {
      "--scene-progress": sp.toFixed(4),
      "--system-opacity": systemOpacity.toFixed(4),
      "--overall-p": motion.overallProgress.toFixed(4),
      "--travelers-converge": travelersConverge.toFixed(4),
    } as CSSProperties
  }, [motion.sceneProgress, motion.overallProgress])

  return (
    <div
      aria-hidden="true"
      className="section-scenes pointer-events-none fixed inset-0 z-[1] overflow-hidden"
      data-active-scene={motion.activeId}
      data-reduced-motion={motion.reducedMotion ? "true" : "false"}
      style={stage}
    >
      <div className="source-plan-aura" />
      <svg className="source-plan-svg" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id="source-core-gradient">
            <stop offset="0" stopColor="oklch(0.92 0.10 56)" stopOpacity="0.95" />
            <stop offset="0.32" stopColor="oklch(0.78 0.14 46)" stopOpacity="0.4" />
            <stop offset="1" stopColor="oklch(0.74 0.14 42)" stopOpacity="0" />
          </radialGradient>
          <filter id="signal-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="source-plan-grid">
          {Array.from({ length: 9 }).map((_, index) => (
            <line key={`h-${index}`} x1="80" x2="1120" y1={116 + index * 72} y2={116 + index * 72} />
          ))}
          {Array.from({ length: 8 }).map((_, index) => (
            <line key={`v-${index}`} y1="72" y2="728" x1={154 + index * 132} x2={154 + index * 132} />
          ))}
        </g>

        <g filter="url(#signal-glow)">
          <TravelersLayer progress={motion.sceneProgress} />
        </g>

        <g className="convergence-core" transform="translate(620 374)">
          <circle r="140" fill="url(#source-core-gradient)" />
          <circle className="core-ring core-ring-a" r="96" pathLength={1} />
          <circle className="core-ring core-ring-b" r="54" pathLength={1} />
          <circle className="plan-node" r="5.5" />
        </g>
      </svg>
      <div className="source-plan-readability" />
    </div>
  )
}
