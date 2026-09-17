"use client"

import Link from "next/link"
import { useState } from "react"
import TeacherUpload from "@/app/components/TeacherUpload"
import type { TeacherDashboardStudent } from "@/lib/teacherDashboardShared"
import { initials, useTeacherWorkspace } from "./TeacherWorkspace"

type Filter = "all" | "submitted" | "pending"

function submissionDetail(student: TeacherDashboardStudent, timeZone: string) {
  if (!student.submittedToday || !student.submittedAt) return "No work submitted today"
  const time = new Intl.DateTimeFormat("en-SG", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(student.submittedAt))
  const marking = student.submissionStatus === "completed" ? "Marked" : student.submissionStatus === "processing" ? "Being marked" : student.submissionStatus === "failed" ? "Marking needs attention" : "Ready for marking"
  return `${time} · ${marking}`
}

export default function TeacherHome() {
  const { data, loading, refreshing, error, refresh, studentHref } = useTeacherWorkspace()
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const total = data?.counts.total ?? 0
  const submitted = data?.counts.submitted ?? 0
  const pending = data?.counts.pending ?? 0
  const percent = total ? Math.round(submitted / total * 100) : 0
  const students = data?.students.filter((student) =>
    (filter === "all" || (filter === "submitted" ? student.submittedToday : !student.submittedToday)) &&
    `${student.name} ${student.student_id}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  ) ?? []
  const dateLabel = data ? new Intl.DateTimeFormat("en-SG", {
    weekday: "long", day: "numeric", month: "long", timeZone: data.timeZone,
  }).format(new Date(`${data.date}T12:00:00+08:00`)) : "Today"

  return (
    <main className="dashboard-shell teacher-home">
      <header className="topbar">
        <div className="brand"><span className="brand-mark" />TuitionAI</div>
        <div className="teacher-profile"><span className="teacher-profile-copy"><strong>{data?.teacher.name ?? "Teacher workspace"}</strong><span>H2 Physics</span></span><span className="teacher-profile-avatar" aria-hidden="true">{data ? initials(data.teacher.name) : "T"}</span></div>
      </header>

      <section className="teacher-home-intro">
        <div><p className="eyebrow">Teacher home · Daily practice</p><h1>Your class,<br />at a glance<span>.</span></h1><p className="teacher-intro-description">See who’s checked in. Know who needs a nudge.</p></div>
        <div className="teacher-today"><span className="teacher-live-label"><i aria-hidden="true" />Today’s overview</span><time dateTime={data?.date}>{dateLabel}</time><span>Singapore time</span></div>
      </section>

      {error && <div className="teacher-error" role="alert"><p>{error}{data ? " Showing the last loaded update." : ""}</p><button type="button" className="secondary-button" onClick={() => void refresh()} disabled={refreshing}>{refreshing ? "Retrying…" : "Try again"}</button></div>}

      <section className="teacher-daily-overview" aria-label="Today’s submission summary" aria-busy={loading}>
        <div className="teacher-stat"><span className="eyebrow">Your students</span><strong>{loading || !data ? "—" : total.toString().padStart(2, "0")}</strong><span>Learning a little, every day</span></div>
        <div className="teacher-stat submitted"><span className="eyebrow"><i className="teacher-status-dot submitted" aria-hidden="true" />Submitted today</span><strong>{loading || !data ? "—" : submitted.toString().padStart(2, "0")}</strong><span>Work is in for the day</span></div>
        <div className="teacher-stat pending"><span className="eyebrow"><i className="teacher-status-dot pending" aria-hidden="true" />Awaiting submission</span><strong>{loading || !data ? "—" : pending.toString().padStart(2, "0")}</strong><span>Still time to keep the rhythm</span></div>
      </section>

      {data && total > 0 && <div className="teacher-completion"><div><span>Today’s participation</span><strong>{submitted} of {total} students <span>· {percent}%</span></strong></div><div className="teacher-completion-track" role="progressbar" aria-label="Students who submitted today" aria-valuemin={0} aria-valuemax={total} aria-valuenow={submitted}><span style={{ width: `${percent}%` }} /></div></div>}

      <section className="teacher-roster" aria-labelledby="teacher-roster-title">
        <div className="teacher-section-heading"><div><p className="eyebrow">Small steps. Real progress.</p><h2 id="teacher-roster-title">Your students</h2></div><button type="button" className="teacher-refresh" onClick={() => void refresh()} disabled={refreshing}><span aria-hidden="true">↻</span>{refreshing ? "Refreshing…" : "Refresh"}</button></div>
        <div className="teacher-roster-toolbar">
          <div className="teacher-filters" role="group" aria-label="Filter students by submission status">
            {([{ value: "all", label: "All students", count: total }, { value: "submitted", label: "Submitted", count: submitted }, { value: "pending", label: "Awaiting", count: pending }] as const).map((item) => <button key={item.value} type="button" className={filter === item.value ? "active" : ""} aria-pressed={filter === item.value} onClick={() => setFilter(item.value)}>{item.label}<span>{data ? item.count : "—"}</span></button>)}
          </div>
          <label className="teacher-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4 4" /></svg><input type="search" aria-label="Search students" placeholder="Find a student…" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        </div>
        {loading ? <div className="teacher-roster-loading" role="status"><span className="teacher-loading-line" /><p>Loading your students…</p></div> : !data ? <div className="teacher-empty"><h3>Let’s get your class back.</h3><p>Use Try again above to reload your students.</p></div> : total === 0 ? <div className="teacher-empty"><span className="teacher-empty-icon" aria-hidden="true">＋</span><h3>Your class starts here.</h3><p>No students are linked to your teacher profile yet. Once linked, their daily submissions and progress will appear here.</p></div> : students.length === 0 ? <div className="teacher-empty"><h3>{search ? "No matching students" : filter === "pending" ? "Everyone has submitted." : "No submissions yet."}</h3><p>{search ? "Try another name or student ID." : filter === "pending" ? "A good day for your class. Open a student to see their progress." : "Today’s submissions will appear as your students upload their work."}</p><button className="secondary-button" type="button" onClick={() => { setSearch(""); setFilter("all") }}>Show all students</button></div> : <ul className="teacher-student-grid" aria-label="Students and today’s submissions">
          {students.map((student) => <li key={student.student_id}><Link href={studentHref(student.slug)} className={`teacher-student-card ${student.submittedToday ? "has-submitted" : "awaiting"}`}><div className="teacher-student-card-top"><span className="teacher-student-avatar" aria-hidden="true">{initials(student.name)}</span><span className={`teacher-submission-badge ${student.submittedToday ? "submitted" : "pending"}`}><i className={`teacher-status-dot ${student.submittedToday ? "submitted" : "pending"}`} aria-hidden="true" />{student.submittedToday ? "Submitted" : "Awaiting"}</span></div><h3>{student.name}</h3><p className="teacher-student-id">{student.student_id} · H2 Physics</p><div className="teacher-student-card-bottom"><span>{submissionDetail(student, data.timeZone)}</span><span className="teacher-card-arrow" aria-hidden="true">↗</span></div><span className="teacher-card-link-label">View {student.name}’s progress</span></Link></li>)}
        </ul>}
        {data && total > 0 && <p className="teacher-roster-note">Select a student to view their streaks and topic progress. Updates automatically every minute.</p>}
      </section>

      <TeacherUpload />
      <footer className="footer">TuitionAI <span>•</span> A little progress, every day.</footer>
    </main>
  )
}
