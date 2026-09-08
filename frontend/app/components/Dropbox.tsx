"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import type { ReactNode } from "react"

type Subtopic = { name: string; mastery: number }
type Topic = { name: string; mastery?: number; subtopics?: Subtopic[] }
type Subject = { name: string; topics?: Topic[] }
type Student = { name: string; subjects?: Subject[] }


type ProgressRow = {
  name: string
  subject: string
  mastery: number
  latest: "Good" | "Medium" | "Needs work"
  tone: "good" | "medium" | "needs"
  attempts: string[]
}

const demoRows: ProgressRow[] = [
  {
    name: "Linear equations",
    subject: "Algebra · 8 questions",
    mastery: 92,
    latest: "Good",
    tone: "good",
    attempts: ["01", "02"],
  },
  {
    name: "Quadratic functions",
    subject: "Algebra · 6 questions",
    mastery: 68,
    latest: "Medium",
    tone: "medium",
    attempts: ["01", "02", "03"],
  },
  {
    name: "Trigonometric ratios",
    subject: "Geometry · 10 questions",
    mastery: 41,
    latest: "Needs work",
    tone: "needs",
    attempts: ["01"],
  },
]

const calendarDays = Array.from({ length: 35 }, (_, index) => index - 5)
const completedDays = new Set([6, 7, 8, 9, 10, 11, 13, 14, 15])

// Use the user's local date so the picker does not shift by a day across timezones.
function getTodayIso() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

export default function DropBox() {
  const [tab, setTab] = useState<"streaks" | "progress">("streaks")
  const [student, setStudent] = useState<Student | null>(null)
  const [studentId, setStudentId] = useState("S001")
  const [teacherId, setTeacherId] = useState("T001")
  const [subject, setSubject] = useState("Physics")
  const [examDate, setExamDate] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [assignmentId, setAssignmentId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem("diagnosticAssignmentId"),
  )
  const [submissionId, setSubmissionId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : localStorage.getItem("diagnosticSubmissionId"),
  )
  const [questionIds, setQuestionIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []

    try {
      const saved = JSON.parse(
        localStorage.getItem("diagnosticQuestionIds") || "[]",
      )
      return Array.isArray(saved) ? (saved as string[]) : []
    } catch {
      return []
    }
  })
  const [results, setResults] = useState<
    Array<{ question: number; marks: string; feedback: string }>
  >([])
  const [status, setStatus] = useState("")
  const [showPractice, setShowPractice] = useState(false)

  useEffect(() => {
    const loadStudent = async () => {
      const response = await fetch(
        `/api/student?student_id=${encodeURIComponent(studentId)}`,
      )
      if (!response.ok) return

      const data = (await response.json()) as { student: Student }
      setStudent(data.student)
    }

    void loadStudent()
  }, [studentId])

  const progressRows = useMemo<ProgressRow[]>(() => {
    const topics =
      student?.subjects?.find((item) => item.name === subject)?.topics ?? []

    if (topics.length === 0) return demoRows

    return topics.map((topic, index) => {
      const values = topic.subtopics?.map((item) => item.mastery) ?? []
      const mastery =
        topic.mastery ??
        (values.length
          ? Math.round(
              values.reduce((sum, value) => sum + value, 0) / values.length,
            )
          : 0)
      const tone = mastery >= 80 ? "good" : mastery >= 60 ? "medium" : "needs"

      return {
        name: topic.name,
        subject: `${subject} · ${values.length || 0} subtopics`,
        mastery,
        latest:
          tone === "good" ? "Good" : tone === "medium" ? "Medium" : "Needs work",
        tone,
        attempts: [String(index + 1).padStart(2, "0")],
      }
    })
  }, [student, subject])

  const daysToExam = useMemo(() => {
    if (!examDate) return 68

    const today = new Date()
    const exam = new Date(`${examDate}T00:00:00`)
    return Math.max(
      0,
      Math.ceil((exam.getTime() - today.getTime()) / 86400000),
    )
  }, [examDate])

  async function downloadDiagnostic() {
    setStatus("Creating diagnostic...")

    const response = await fetch("/api/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        student_id: studentId,
        teacher_id: teacherId,
        subject,
      }),
    })
    const data = await response.json()

    if (!response.ok) {
      return setStatus(data.message || "Could not create diagnostic")
    }

    setAssignmentId(data.assignment._id)
    setQuestionIds(data.assignment.questions)
    localStorage.setItem("diagnosticAssignmentId", data.assignment._id)
    localStorage.setItem(
      "diagnosticQuestionIds",
      JSON.stringify(data.assignment.questions),
    )

    const pdfResponse = await fetch("/api/diagnostics/pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignment_id: data.assignment._id }),
    })

    if (!pdfResponse.ok) return setStatus("Could not download diagnostic")

    const url = URL.createObjectURL(await pdfResponse.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = `diagnostic-${data.assignment._id}.pdf`
    link.click()
    URL.revokeObjectURL(url)
    setStatus("Diagnostic downloaded. Complete it, then upload the answer PDF.")
  }

  async function uploadSubmission() {
    if (!file || !assignmentId) {
      return setStatus(
        "Download a diagnostic first and select your completed PDF.",
      )
    }

    setStatus("Uploading answers...")
    const formData = new FormData()
    formData.append("student_id", studentId)
    formData.append("assignment_id", assignmentId)
    formData.append("file", file)

    const response = await fetch("/api/submissions", {
      method: "POST",
      body: formData,
    })
    const data = await response.json()

    if (!response.ok) return setStatus(data.message || "Upload failed")

    setSubmissionId(data.submission._id)
    localStorage.setItem("diagnosticSubmissionId", data.submission._id)
    setStatus("Answers uploaded. You can now mark them.")
  }

  async function markAnswers() {
    if (!submissionId || !assignmentId) {
      return setStatus("Upload your completed answer PDF first.")
    }

    setStatus("Marking your answers. This may take a while...")
    const markedResults: Array<{
      question: number
      marks: string
      feedback: string
    }> = []

    for (let index = 0; index < questionIds.length; index += 1) {
      const response = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_id: studentId,
          assignment_id: assignmentId,
          question_id: questionIds[index],
          submission_id: submissionId,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        return setStatus(data.message || `Marking failed on question ${index + 1}`)
      }

      markedResults.push({
        question: index + 1,
        marks: `${data.evaluation.marks_awarded}`,
        feedback: data.evaluation.ai_feedback,
      })
      setResults([...markedResults])
    }

    setStatus("All answers marked successfully.")
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          TuitionAI
        </div>
        <button className="logout-button" type="button">
          Logout
        </button>
      </header>

      <section className="dashboard-intro">
        <p className="eyebrow">Student dashboard · Term 02</p>
        <h1>
          Build your rhythm<span>.</span>
        </h1>
        <div className="tabs" role="tablist" aria-label="Dashboard views">
          <button
            className={tab === "streaks" ? "tab active" : "tab"}
            onClick={() => setTab("streaks")}
            type="button"
          >
            Streaks
          </button>
          <button
            className={tab === "progress" ? "tab active" : "tab"}
            onClick={() => setTab("progress")}
            type="button"
          >
            Progress
          </button>
          <span className={`tab-indicator ${tab}`} />
        </div>
      </section>

      {tab === "streaks" ? (
        <StreaksView
          daysToExam={daysToExam}
          examDate={examDate}
          setExamDate={setExamDate}
        />
      ) : (
        <ProgressView
          rows={progressRows}
          studentName={student?.name ?? "Student"}
        />
      )}

      <section className="practice-section">
        <div>
          <p className="eyebrow">Daily practice</p>
          <h2>Keep the momentum going.</h2>
        </div>
        <button
          className="outline-button"
          type="button"
          onClick={() => setShowPractice((visible) => !visible)}
        >
          {showPractice ? "Close practice" : "Open practice"}
          <span>↗</span>
        </button>
      </section>

      {showPractice && (
        <section className="practice-panel">
          <div className="practice-fields">
            <input
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              placeholder="Student ID"
            />
            <input
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              placeholder="Teacher ID"
            />
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Subject"
            />
          </div>
          <div className="practice-actions">
            <button type="button" onClick={downloadDiagnostic}>
              Download diagnostic
            </button>
            <label className="file-drop">
              Upload completed PDF
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <button type="button" onClick={uploadSubmission}>
              Upload answers
            </button>
            <button type="button" onClick={markAnswers}>
              Mark answers
            </button>
          </div>
          {assignmentId && (
            <p className="status">Diagnostic ready · {assignmentId}</p>
          )}
          {file && <p className="status">Selected · {file.name}</p>}
          {status && <p className="status">{status}</p>}
          {results.length > 0 && (
            <div className="result-list">
              {results.map((result) => (
                <article key={result.question}>
                  <strong>
                    Question {result.question} · {result.marks} marks
                  </strong>
                  <p>{result.feedback}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="footer">
        TuitionAI <span>•</span> Designed for students
      </footer>
    </main>
  )
}

function StreaksView({
  daysToExam,
  examDate,
  setExamDate,
}: {
  daysToExam: number
  examDate: string
  setExamDate: (value: string) => void
}) {
  const examDateRef = useRef<HTMLInputElement>(null)

  return (
    <section className="content-area">
      <div className="stat-row">
        <Stat
          label="Days to exam"
          value={String(daysToExam)}
          action={
            <div className="change-date">
              <button
                type="button"
                className="change-date-trigger"
                onClick={() => examDateRef.current?.showPicker?.()}
              >
              Change date
              </button>
              <input
                ref={examDateRef}
                className="date-input"
                type="date"
                min={getTodayIso()}
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
              />
          </div>
          }
        />
        <Stat label="Month's streak" value="12" />
        <Stat label="Year's streak" value="47" />
      </div>

      <div className="calendar-heading">
        <div>
          <p className="eyebrow">Streaks</p>
          <h2>September</h2>
        </div>
        <span>2026</span>
      </div>

      <div className="calendar">
        <div className="weekday-row">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
            (day) => <span key={day}>{day}</span>,
          )}
        </div>
        <div className="calendar-grid">
          {calendarDays.map((day, index) => (
            <div
              className={`day ${day < 1 || day > 30 ? "muted" : ""}`}
              key={`${day}-${index}`}
            >
              <span
                className={
                  completedDays.has(day)
                    ? "completed-marker"
                    : day === 16
                      ? "today-marker"
                      : ""
                }
              >
                {day > 0 ? day : 31}
              </span>
            </div>
          ))}
        </div>
        <div className="calendar-meta">
          <span>
            <i className="bracket-icon" />
            Completed
          </span>
          <span>
            <i className="underline-icon" />
            Today
          </span>
        </div>
      </div>

      <div className="notes">
        <span>Notes</span>
        <p>Keep the rhythm going.</p>
      </div>
      <button className="primary-button" type="button">
        Track my progress <span>↗</span>
      </button>
    </section>
  )
}

function Stat({
  label,
  value,
  action,
}: {
  label: string
  value: string
  action?: ReactNode
}) {
  return (
    <div className="stat stat-exam">
      <p className="eyebrow">{label}</p>
      <strong>{value}</strong>
      {action}
    </div>
  )
}

function ProgressView({
  rows,
  studentName,
}: {
  rows: ProgressRow[]
  studentName: string
}) {
  return (
    <section className="content-area progress-area">
      <div className="progress-heading">
        <div>
          <p className="eyebrow">Learning overview · Term 02</p>
          <h2>Student progress</h2>
        </div>
        <div className="student-summary">
          <strong>{studentName}</strong>
          <span>Updated today · {rows.length} topics</span>
        </div>
      </div>

      <div className="progress-table">
        <div className="progress-header">
          <span>Topic</span>
          <span>Mastery</span>
          <span>Latest</span>
          <span>Attempts</span>
        </div>
        {rows.map((row) => (
          <div className="progress-row" key={row.name}>
            <div className="topic-cell">
              <i className={`topic-dot ${row.tone}`} />
              <div>
                <strong>{row.name}</strong>
                <span>{row.subject}</span>
              </div>
            </div>
            <div className="mastery-cell">
              <strong>{row.mastery}%</strong>
              <span>
                <i style={{ width: `${row.mastery}%` }} />
              </span>
            </div>
            <div className="latest-cell">
              <i className={`topic-dot ${row.tone}`} />
              {row.latest}
            </div>
            <div className="attempt-cell">
              {row.attempts.map((attempt, index) => (
                <button
                  className={
                    row.name === "Quadratic functions" && index === 1
                      ? "attempt selected"
                      : "attempt"
                  }
                  key={attempt}
                  type="button"
                >
                  {attempt}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="selected-detail">
        <span>Selected: Quadratic functions</span>
        <strong>Attempt 2 · 7/10 correct · 5m 31s · Improving</strong>
      </div>

      <div className="legend">
        <span>
          <i className="topic-dot good" />
          Good
        </span>
        <span>
          <i className="topic-dot medium" />
          Medium
        </span>
        <span>
          <i className="topic-dot needs" />
          Needs work
        </span>
        <span>Click an attempt to inspect</span>
      </div>
    </section>
  )
}
