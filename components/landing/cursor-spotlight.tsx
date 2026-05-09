"use client"

import { useEffect, useRef } from "react"

const DOT_SPACING = 34
const DOT_RADIUS = 1.05
const POINTER_RADIUS = 128
const POINTER_STRENGTH = 6
const DRIFT_STRENGTH = 4.2
const POINTER_EASE = 0.038
const RETURN_EASE = 0.032
const WAVE_FREQ_X = 0.0042
const WAVE_FREQ_Y = 0.0036
const WAVE_SPEED_A = 0.74
const WAVE_SPEED_B = 0.48
const FIELD_PADDING = POINTER_RADIUS + DOT_SPACING
const CAMERA_EASE = 0.065
const SCROLL_VELOCITY_DAMP = 0.82
const SCROLL_DRAG_STRENGTH = 0.24
const SCROLL_DRAG_MAX = 34
const CURRENT_COUNT = 6
const CURRENT_SEGMENTS = 10
const CURRENT_LENGTH = 560
const CURRENT_WRAP_PADDING = 360
const FRAME_INTERVAL = 1000 / 36

type Dot = {
  x: number
  y: number
  phase: number
  speed: number
  weight: number
  depth: number
  tint: number
  ox: number
  oy: number
}

type Current = {
  x: number
  y: number
  phase: number
  speed: number
  depth: number
  width: number
  amplitude: number
  slant: number
  alpha: number
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const wrap = (value: number, min: number, max: number) => {
  const range = max - min
  return ((((value - min) % range) + range) % range) + min
}

export function CursorSpotlight() {
  const ref = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    if (typeof window === "undefined") return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const context = canvas.getContext("2d", { alpha: true })
    if (!context) return

    const reducedPointer = window.matchMedia("(pointer: coarse)").matches
    const dots: Dot[] = []
    const currents: Current[] = []
    const pointer = {
      x: -10000,
      y: -10000,
      tx: -10000,
      ty: -10000,
      active: false,
    }

    let raf = 0
    let width = 0
    let height = 0
    let dpr = 1
    let lastScrollY = typeof window !== "undefined" ? window.scrollY : 0
    let cameraY = lastScrollY
    let scrollVelocity = 0
    let scrollDrag = 0
    let lastDrawTime = 0

    const rebuildField = () => {
      dots.length = 0
      currents.length = 0
      width = window.innerWidth
      height = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 1.35)

      canvas.width = Math.ceil(width * dpr)
      canvas.height = Math.ceil(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      context.lineCap = "round"

      const columns = Math.ceil((width + FIELD_PADDING * 2) / DOT_SPACING) + 1
      const rows = Math.ceil((height + FIELD_PADDING * 2) / DOT_SPACING)

      for (let row = 0; row <= rows; row += 1) {
        for (let col = 0; col <= columns; col += 1) {
          const stagger = row % 2 === 0 ? 0 : DOT_SPACING * 0.5
          const pattern = (row * 11 + col * 17) % 13
          const dot: Dot = {
            x: col * DOT_SPACING - FIELD_PADDING + stagger + (pattern - 6) * 0.42,
            y: row * DOT_SPACING - FIELD_PADDING + ((row * 7 + col * 5) % 9) * 0.36,
            phase: (row * 0.73 + col * 0.37) % (Math.PI * 2),
            speed: 0.5 + ((row + col) % 7) * 0.05,
            weight: 0.72 + ((row * 3 + col * 5) % 9) * 0.026,
            depth: 0.16 + ((row * 5 + col * 7) % 11) * 0.018,
            tint: ((row * 13 + col * 3) % 10) / 10,
            ox: 0,
            oy: 0,
          }
          dots.push(dot)
        }
      }

      for (let i = 0; i < CURRENT_COUNT; i += 1) {
        const fraction = (i + 0.5) / CURRENT_COUNT
        currents.push({
          x: width * fraction + (((i * 29) % 17) - 8) * 10,
          y: -CURRENT_WRAP_PADDING + ((height + CURRENT_WRAP_PADDING * 2) / CURRENT_COUNT) * i,
          phase: i * 1.83,
          speed: 0.5 + (i % 4) * 0.1,
          depth: 0.1 + (i % 5) * 0.032,
          width: 0.72 + (i % 3) * 0.24,
          amplitude: 24 + (i % 4) * 9,
          slant: i % 2 === 0 ? 160 : -130,
          alpha: 0.055 + (i % 4) * 0.018,
        })
      }
    }

    const drawCurrent = (current: Current, y: number, t: number, drag: number) => {
      const startY = y - CURRENT_LENGTH * 0.5
      const gradient = context.createLinearGradient(0, startY, 0, startY + CURRENT_LENGTH)
      const alpha = current.alpha + Math.min(0.05, Math.abs(drag) * 0.0016)
      gradient.addColorStop(0, "rgba(232, 168, 110, 0)")
      gradient.addColorStop(0.28, `rgba(214, 158, 110, ${alpha * 0.58})`)
      gradient.addColorStop(0.54, `rgba(245, 178, 104, ${alpha})`)
      gradient.addColorStop(0.82, `rgba(186, 144, 110, ${alpha * 0.48})`)
      gradient.addColorStop(1, "rgba(232, 168, 110, 0)")

      context.beginPath()
      for (let segment = 0; segment <= CURRENT_SEGMENTS; segment += 1) {
        const progress = segment / CURRENT_SEGMENTS
        const py = startY + progress * CURRENT_LENGTH
        const drift =
          Math.sin(t * 1.12 + current.phase + py * 0.008) * current.amplitude +
          Math.sin(t * 0.62 + current.phase * 1.8 + py * 0.014) * (current.amplitude * 0.32)
        const px = current.x + drift + (progress - 0.5) * current.slant + drag * current.depth * 0.2
        if (segment === 0) {
          context.moveTo(px, py)
        } else {
          context.lineTo(px, py)
        }
      }

      context.lineWidth = current.width
      context.strokeStyle = gradient
      context.stroke()
    }

    const tick = (time: number) => {
      if (time - lastDrawTime < FRAME_INTERVAL) {
        raf = window.requestAnimationFrame(tick)
        return
      }
      lastDrawTime = time

      const t = time * 0.001
      pointer.x += (pointer.tx - pointer.x) * 0.09
      pointer.y += (pointer.ty - pointer.y) * 0.09

      const currentScrollY = window.scrollY
      const rawDelta = currentScrollY - lastScrollY
      lastScrollY = currentScrollY
      cameraY += (currentScrollY - cameraY) * CAMERA_EASE
      scrollVelocity = scrollVelocity * SCROLL_VELOCITY_DAMP + rawDelta * (1 - SCROLL_VELOCITY_DAMP)
      const targetDrag = clamp(scrollVelocity * SCROLL_DRAG_STRENGTH, -SCROLL_DRAG_MAX, SCROLL_DRAG_MAX)
      scrollDrag += (targetDrag - scrollDrag) * 0.16

      context.clearRect(0, 0, width, height)
      context.globalCompositeOperation = "lighter"

      const currentSpan = height + CURRENT_WRAP_PADDING * 2
      for (const current of currents) {
        const baseY = wrap(
          current.y + t * current.speed * 96 - cameraY * current.depth,
          -CURRENT_WRAP_PADDING,
          height + CURRENT_WRAP_PADDING,
        )
        drawCurrent(current, baseY, t, scrollDrag)
        if (baseY < CURRENT_LENGTH * 0.6) {
          drawCurrent(current, baseY + currentSpan, t, scrollDrag)
        }
        if (baseY > height - CURRENT_LENGTH * 0.6) {
          drawCurrent(current, baseY - currentSpan, t, scrollDrag)
        }
      }

      for (let i = 0; i < dots.length; i += 1) {
        const dot = dots[i]
        const scrollDepth = cameraY * dot.depth
        const yParallax = wrap(dot.y - scrollDepth, -FIELD_PADDING, height + FIELD_PADDING)
        const xParallax =
          dot.x +
          Math.sin(cameraY * 0.0021 + dot.phase) * (10 * dot.depth) +
          scrollDrag * dot.depth * 0.28
        const driftX =
          Math.sin(t * dot.speed + dot.phase + yParallax * 0.012) * DRIFT_STRENGTH +
          Math.sin(t * 0.38 + dot.phase * 1.7) * 1.8
        const driftY =
          Math.cos(t * (dot.speed * 0.84) + dot.phase * 1.4) * (DRIFT_STRENGTH * 0.72) +
          Math.sin(t * 0.72 + xParallax * 0.008) * 1.6
        const baseX = xParallax + driftX
        const baseY = yParallax + driftY + scrollDrag * dot.depth
        let proximity = 0
        let targetOx = 0
        let targetOy = 0

        if (pointer.active) {
          const dx = baseX + dot.ox - pointer.x
          const dy = baseY + dot.oy - pointer.y
          const distance = Math.hypot(dx, dy)

          if (distance < POINTER_RADIUS) {
            proximity = 1 - distance / POINTER_RADIUS
            const force = proximity * proximity * POINTER_STRENGTH
            const angle = Math.atan2(dy, dx)
            targetOx = Math.cos(angle) * force
            targetOy = Math.sin(angle) * force
          }
        }

        const ease = proximity > 0 ? POINTER_EASE : RETURN_EASE
        dot.ox += (targetOx - dot.ox) * ease
        dot.oy += (targetOy - dot.oy) * ease

        const x = baseX + dot.ox
        const y = baseY + dot.oy

        const wave =
          Math.sin(x * WAVE_FREQ_X + y * WAVE_FREQ_Y + t * WAVE_SPEED_A) *
            0.5 +
          Math.sin(x * WAVE_FREQ_Y - y * WAVE_FREQ_X + t * WAVE_SPEED_B + 1.7) *
            0.5
        const waveNorm = (wave + 2) * 0.25
        const pulse = (Math.sin(t * 0.92 + dot.phase * 1.8 + cameraY * 0.001) + 1) * 0.5
        const currentLift = (Math.sin(y * 0.018 + t * 1.4 + dot.phase) + 1) * 0.5
        const baseAlpha = 0.22 + pulse * 0.08 + waveNorm * 0.18 + currentLift * 0.08
        const alpha = Math.min(0.82, baseAlpha * dot.weight + proximity * 0.16)
        const radius = DOT_RADIUS + proximity * 0.18 + pulse * 0.12 + waveNorm * 0.22

        const warm = waveNorm + dot.tint * 0.24 > 0.66
        context.beginPath()
        context.arc(x, y, radius, 0, Math.PI * 2)
        context.fillStyle =
          proximity > 0
            ? `rgba(245, 178, 104, ${alpha * 0.92})`
            : warm
              ? `rgba(214, 158, 110, ${alpha})`
              : `rgba(186, 144, 110, ${alpha})`
        context.fill()
      }

      context.globalCompositeOperation = "source-over"
      raf = window.requestAnimationFrame(tick)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return
      pointer.tx = event.clientX
      pointer.ty = event.clientY
      pointer.active = true
      canvas.dataset.active = "true"
    }

    const onLeave = () => {
      pointer.tx = -10000
      pointer.ty = -10000
      pointer.active = false
      canvas.dataset.active = "false"
    }

    rebuildField()
    raf = window.requestAnimationFrame(tick)

    if (!reducedPointer) {
      window.addEventListener("pointermove", onMove)
    }
    window.addEventListener("resize", rebuildField)
    document.addEventListener("pointerleave", onLeave)

    return () => {
      window.removeEventListener("pointermove", onMove)
      window.removeEventListener("resize", rebuildField)
      document.removeEventListener("pointerleave", onLeave)
      window.cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      data-active="false"
      className="cursor-dot-field pointer-events-none fixed inset-0 z-[2]"
    />
  )
}
