"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { TeacherDashboard } from "@/lib/teacherDashboardShared"
import { teacherHref, teacherStudentHref } from "@/lib/teacherDashboardShared"

type Workspace = {
  data: TeacherDashboard | null
  loading: boolean
  refreshing: boolean
  error: string
  refresh: () => Promise<void>
  homeHref: string
  studentHref: (slug: string) => string
}

const TeacherContext = createContext<Workspace | null>(null)

export function useTeacherWorkspace() {
  const workspace = useContext(TeacherContext)
  if (!workspace) throw new Error("Teacher workspace is missing")
  return workspace
}

export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()
}

export default function TeacherWorkspace({ children, teacherSlug }: { children: ReactNode; teacherSlug: string }) {
  const pathname = usePathname()
  const homeHref = teacherHref(teacherSlug)
  const studentHref = (slug: string) => teacherStudentHref(teacherSlug, slug)
  const homeActive = pathname === homeHref || pathname === `/teacher/${teacherSlug}`
  const [data, setData] = useState<TeacherDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const drawer = useRef<HTMLElement>(null)
  const focusOnOpen = useRef(false)

  const refresh = useCallback(async () => {
    controller.current?.abort()
    const current = new AbortController()
    controller.current = current
    setRefreshing(true)
    try {
      const response = await fetch(`/api/teacher/dashboard?teacher_slug=${encodeURIComponent(teacherSlug)}`, {
        cache: "no-store",
        signal: current.signal,
      })
      if (!response.ok) throw new Error(response.status === 404
        ? "Your teacher profile could not be found."
        : "We couldn’t load your class. Please try again.")
      const result = await response.json() as TeacherDashboard
      if (current.signal.aborted) return
      setData(result)
      setError("")
    } catch (failure) {
      if (current.signal.aborted) return
      setError(failure instanceof Error ? failure.message : "We couldn’t load your class. Please try again.")
    } finally {
      if (!current.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [teacherSlug])

  useEffect(() => {
    const initialLoad = window.requestAnimationFrame(() => void refresh())
    const refreshVisible = () => {
      if (document.visibilityState === "visible") void refresh()
    }
    const timer = window.setInterval(refreshVisible, 60000)
    window.addEventListener("focus", refreshVisible)
    document.addEventListener("visibilitychange", refreshVisible)
    return () => {
      window.cancelAnimationFrame(initialLoad)
      controller.current?.abort()
      window.clearInterval(timer)
      window.removeEventListener("focus", refreshVisible)
      document.removeEventListener("visibilitychange", refreshVisible)
    }
  }, [refresh])

  useEffect(() => {
    if (!open) return
    if (focusOnOpen.current) {
      drawer.current?.querySelector<HTMLAnchorElement>("a")?.focus()
      focusOnOpen.current = false
    }
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    window.addEventListener("keydown", onEscape)
    return () => window.removeEventListener("keydown", onEscape)
  }, [open])

  const closeNavigation = () => {
    setOpen(false)
  }

  return (
    <TeacherContext.Provider value={{ data, loading, refreshing, error, refresh, homeHref, studentHref }}>
      <div className="teacher-workspace">
        <div className="teacher-edge-zone" aria-hidden="true" onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setOpen(true)
        }} />
        <button
          ref={trigger}
          type="button"
          className="teacher-menu-trigger"
          aria-label="Open teacher navigation"
          aria-controls="teacher-navigation"
          aria-expanded={open}
          onPointerEnter={(event) => {
            if (event.pointerType === "mouse") setOpen(true)
          }}
          onClick={() => {
            focusOnOpen.current = true
            setOpen(true)
            if (open) drawer.current?.querySelector<HTMLAnchorElement>("a")?.focus()
          }}
        >
          <span aria-hidden="true">☰</span>
          <span className="teacher-menu-label">Menu</span>
        </button>
        <div className={`teacher-drawer-backdrop ${open ? "is-open" : ""}`} onClick={closeNavigation} aria-hidden="true" />
        <aside
          ref={drawer}
          id="teacher-navigation"
          className={`teacher-drawer ${open ? "is-open" : ""}`}
          aria-label="Teacher navigation"
          aria-hidden={!open}
          inert={!open}
          onPointerLeave={(event) => {
            if (event.pointerType === "mouse" && !event.currentTarget.contains(document.activeElement)) closeNavigation()
          }}
          onBlur={(event) => {
            if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) closeNavigation()
          }}
        >
          <div className="teacher-drawer-heading">
            <div className="brand"><span className="brand-mark" />TuitionAI</div>
            <button type="button" aria-label="Close navigation" className="teacher-close" onClick={() => {
              closeNavigation()
              trigger.current?.focus()
            }}>×</button>
          </div>
          <nav aria-label="Home and students">
            <Link className={`teacher-nav-home ${homeActive ? "active" : ""}`} href={homeHref} aria-current={homeActive ? "page" : undefined} onClick={closeNavigation}>
              <span aria-hidden="true">⌂</span> Home
            </Link>
            <div className="teacher-nav-label">Your students <span>{data?.students.length ?? "—"}</span></div>
            <div className="teacher-nav-students">
              {loading && <p className="status">Loading students…</p>}
              {!loading && !data && <p className="status">Your class is unavailable. Retry on Home.</p>}
              {data?.students.length === 0 && <p className="status">Your linked students will appear here.</p>}
              {data?.students.map((student) => {
                const href = studentHref(student.slug)
                const active = pathname === href || pathname === `/teacher/${teacherSlug}/${student.slug}`
                return <Link key={student.student_id} href={href} className={`teacher-nav-student ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={closeNavigation}>
                  <span className="teacher-nav-avatar" aria-hidden="true">{initials(student.name)}</span>
                  <span>{student.name}</span>
                  <i className={`teacher-status-dot ${student.submittedToday ? "submitted" : "pending"}`} aria-label={student.submittedToday ? "Submitted today" : "Awaiting submission"} />
                </Link>
              })}
            </div>
          </nav>
          <div className="teacher-drawer-footer"><span className="eyebrow">Teacher workspace</span><strong>{data?.teacher.name ?? "Your class"}</strong><span>H2 Physics</span></div>
        </aside>
        {children}
      </div>
    </TeacherContext.Provider>
  )
}
