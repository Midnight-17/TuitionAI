"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import type { ReactNode } from "react"
import { h2PhysicsTopics } from "@/app/data/h2PhysicsTopics"
import { getStudyDay } from "@/lib/studyDate"

type Subtopic = { name: string; mastery: number }
type Topic = { name: string; mastery?: number; subtopics?: Subtopic[] }
type Subject = { name: string; topics?: Topic[] }
type TeachingScope = {
  subject: string
  level: string
  selected_topics: number[]
}
type Teacher = { teaching_scopes?: TeachingScope[] }
type Student = {
  name: string
  exam_date?: string | null
  subjects?: Subject[]
  year_streak?: number[]
  monthly_streak?: number[]
  streak_year?: number
  streak_month?: number
}

type DropBoxProps = {
  studentId?: string
  teacherId?: string
  readOnly?: boolean
}


type ProgressRow = {
  name: string
  subject: string
  mastery: number
  latest: "Good" | "Medium" | "Needs work"
  tone: "good" | "medium" | "needs"
  attempts: string[]
}

// Daily practice and streaks share the same Singapore calendar date.
function getTodayIso() {
  return getStudyDay().date
}

type CalendarDay = {
  day: number
  isCurrentMonth: boolean
  isToday: boolean
}

function getCalendarDays(date: Date): CalendarDay[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const today = new Date(`${getTodayIso()}T12:00:00`)
  const firstDayOffset = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPreviousMonth = new Date(year, month, 0).getDate()
  const totalCells = Math.ceil((firstDayOffset + daysInMonth) / 7) * 7

  return Array.from({ length: totalCells }, (_, index) => {
    if (index < firstDayOffset) {
      return {
        day: daysInPreviousMonth - firstDayOffset + index + 1,
        isCurrentMonth: false,
        isToday: false,
      }
    }

    if (index >= firstDayOffset + daysInMonth) {
      return {
        day: index - firstDayOffset - daysInMonth + 1,
        isCurrentMonth: false,
        isToday: false,
      }
    }

    const day = index - firstDayOffset + 1

    return {
      day,
      isCurrentMonth: true,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day,
    }
  })
}

export default function DropBox({
  studentId = "S001",
  teacherId = "T001",
  readOnly = false,
}: DropBoxProps = {}) {
  // Reset dashboard state immediately when the selected student changes.
  return (
    <StudentDashboard
      key={`${studentId}:${teacherId}:${readOnly}`}
      studentId={studentId}
      teacherId={teacherId}
      readOnly={readOnly}
    />
  )
}

function StudentDashboard({
  studentId,
  teacherId,
  readOnly,
}: Required<DropBoxProps>) {
  const [tab, setTab] = useState<"streaks" | "progress">("streaks")
  const [student, setStudent] = useState<Student | null>(null)
  const [selectedTopicNumbers, setSelectedTopicNumbers] = useState<number[]>([])
  const subject = "Physics"
  const [studentLoading, setStudentLoading] = useState(true)
  const [studentError, setStudentError] = useState("")
  const [reloadCount, setReloadCount] = useState(0)
  const [examDate, setExamDate] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [assignmentId, setAssignmentId] = useState<string | null>(null)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [questionIds, setQuestionIds] = useState<string[]>([])
  const [results, setResults] = useState<
    Array<{ question: number; marks: string; feedback: string }>
  >([])
  const [assignmentComplete, setAssignmentComplete] = useState(false)
  const [status, setStatus] = useState("")
  const [showPractice, setShowPractice] = useState(false)
  const [dailyQuestionReady, setDailyQuestionReady] = useState(false)
  const [todayIso, setTodayIso] = useState(getTodayIso)

  useEffect(() => {
    const timer = window.setInterval(() => setTodayIso(getTodayIso()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (readOnly) return

    const frameId = window.requestAnimationFrame(() => {
      const savedAssignmentId =
        localStorage.getItem("dailyAssignmentId") ||
        localStorage.getItem("diagnosticAssignmentId")
      const savedSubmissionId =
        localStorage.getItem("dailySubmissionId") ||
        localStorage.getItem("diagnosticSubmissionId")

      setAssignmentId(savedAssignmentId)
      setSubmissionId(savedSubmissionId)
      setShowPractice(Boolean(savedAssignmentId))
      setDailyQuestionReady(Boolean(savedAssignmentId))

      try {
        const savedQuestionIds = JSON.parse(
          localStorage.getItem("dailyQuestionIds") ||
            localStorage.getItem("diagnosticQuestionIds") ||
            "[]",
        )
        setQuestionIds(Array.isArray(savedQuestionIds) ? savedQuestionIds : [])
      } catch {
        setQuestionIds([])
      }
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [readOnly])

  useEffect(() => {
    if (readOnly || !assignmentId) return

    const controller = new AbortController()

    const loadAssignmentProgress = async () => {
      try {
        const response = await fetch(
          `/api/assignment?assignment_id=${encodeURIComponent(assignmentId)}`,
          { signal: controller.signal },
        )
        if (!response.ok) return

        const data = (await response.json()) as {
          assignment: { status: string; questions: string[] }
          attempts: Array<{
            question: string
            marks_awarded: number
            ai_feedback: string | null
          }>
        }
        if (controller.signal.aborted) return

        setAssignmentComplete(data.assignment.status === "completed")
        setQuestionIds((currentQuestionIds) =>
          currentQuestionIds.length > 0
            ? currentQuestionIds
            : data.assignment.questions,
        )

        if (data.attempts.length > 0) {
          setResults(
            data.attempts.map((attempt) => ({
              question:
                data.assignment.questions.indexOf(attempt.question) + 1,
              marks: String(attempt.marks_awarded),
              feedback: attempt.ai_feedback ?? "No feedback was provided.",
            })),
          )
        }
      } catch {
        if (!controller.signal.aborted) {
          setStatus("Could not load your saved assignment. Refresh to try again.")
        }
      }
    }

    void loadAssignmentProgress()
    return () => controller.abort()
  }, [assignmentId, readOnly])

  useEffect(() => {
    const controller = new AbortController()

    const loadStudent = async () => {
      try {
        const [response, teacherResponse] = await Promise.all([
          fetch(`/api/student?student_id=${encodeURIComponent(studentId)}`, {
            signal: controller.signal,
          }),
          fetch(`/api/teacher?teacher_id=${encodeURIComponent(teacherId)}`, {
            signal: controller.signal,
          }),
        ])
        const data = (await response.json()) as {
          student?: Student
          message?: string
        }
        if (!response.ok || !data.student) {
          throw new Error(data.message ?? "Could not load this student's progress.")
        }
        if (!teacherResponse.ok) {
          throw new Error("Could not load the teacher's selected topics.")
        }

        const teacherData = (await teacherResponse.json()) as {
          teacher: Teacher
        }
        if (controller.signal.aborted) return

        const physicsScope = teacherData.teacher.teaching_scopes?.find(
          (scope) => scope.subject === "Physics" && scope.level === "H2",
        )
        setStudent(data.student)
        setExamDate(data.student.exam_date?.slice(0, 10) ?? "")
        setSelectedTopicNumbers(physicsScope?.selected_topics ?? [])
      } catch (error) {
        if (!controller.signal.aborted) {
          setStudentError(
            error instanceof Error
              ? error.message
              : "Could not load this student's progress.",
          )
        }
      } finally {
        if (!controller.signal.aborted) setStudentLoading(false)
      }
    }

    void loadStudent()
    return () => controller.abort()
  }, [studentId, teacherId, reloadCount])

  const progressRows = useMemo<ProgressRow[]>(() => {
    const studentTopics =
      student?.subjects?.find((item) => item.name === subject)?.topics ?? []

    return h2PhysicsTopics
      .filter((topic) => selectedTopicNumbers.includes(topic.topicNumber))
      .map((officialTopic) => {
        const topic = studentTopics.find(
          (studentTopic) => studentTopic.name === officialTopic.topic,
        )
        const values = topic?.subtopics?.map((item) => item.mastery) ?? []
        const mastery =
          topic?.mastery ??
          (values.length
            ? Math.round(
                values.reduce((sum, value) => sum + value, 0) / values.length,
              )
            : 0)
        const tone = mastery >= 80 ? "good" : mastery >= 60 ? "medium" : "needs"

        return {
          name: `${String(officialTopic.topicNumber).padStart(2, "0")} · ${officialTopic.topic}`,
          subject: `H2 Physics · ${officialTopic.subtopics.length} subtopics`,
          mastery,
          latest:
            tone === "good" ? "Good" : tone === "medium" ? "Medium" : "Needs work",
          tone,
          attempts: [],
        }
      })
  }, [selectedTopicNumbers, student, subject])

  const currentDate = getStudyDay(new Date(`${todayIso}T12:00:00+08:00`))
  const isCurrentStreakYear = student?.streak_year === currentDate.year
  const completedDays = isCurrentStreakYear &&
    student?.streak_month === currentDate.month
    ? [...new Set(student.monthly_streak ?? [])]
    : []
  const monthlyStreak = completedDays.length
  const yearlyStreak = isCurrentStreakYear
    ? new Set(student?.year_streak ?? []).size
    : 0

  const daysToExam = useMemo(() => {
    if (!examDate) return 0

    const today = new Date(`${todayIso}T00:00:00Z`)
    const exam = new Date(`${examDate}T00:00:00Z`)
    return Math.max(
      0,
      Math.ceil((exam.getTime() - today.getTime()) / 86400000),
    )
  }, [examDate, todayIso])

  async function updateExamDate(value: string) {
    if (readOnly) return
    setExamDate(value)

    const response = await fetch("/api/student", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        student_id: studentId,
        exam_date: value,
      }),
    })

    if (!response.ok) {
      setStatus("Could not save exam date.")
      return
    }

    const data = (await response.json()) as { student: Student }
    setStudent(data.student)
  }

  async function downloadDailyQuestion() {
    if (readOnly) return
    setStatus("Preparing today's question...")

    const assignmentResponse = await fetch(
      "/api/practice/daily",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          student_id: studentId,
          teacher_id: teacherId,
        }),
      },
    )

    const assignmentData = await assignmentResponse.json()

    if (!assignmentResponse.ok) {
      return setStatus(
        assignmentData.message ||
          "Could not prepare today's question",
      )
    }

    const dailyQuestionIds = assignmentData.question?._id
      ? [assignmentData.question._id]
      : assignmentData.assignment.questions

    setAssignmentId(assignmentData.assignment._id)
    setAssignmentComplete(false)
    setResults([])
    setQuestionIds(dailyQuestionIds)
    localStorage.setItem(
      "dailyAssignmentId",
      assignmentData.assignment._id,
    )
    localStorage.setItem(
      "dailyQuestionIds",
      JSON.stringify(dailyQuestionIds),
    )

    const pdfResponse = await fetch(
      "/api/practice/daily/pdf",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignment_id: assignmentData.assignment._id,
        }),
      },
    )

    if (!pdfResponse.ok) {
      return setStatus("Could not download today's question")
    }

    const url = URL.createObjectURL(
      await pdfResponse.blob(),
    )
    const link = document.createElement("a")

    link.href = url
    link.download = "daily-physics-question.pdf"
    link.click()

    URL.revokeObjectURL(url)
    setDailyQuestionReady(true)
    setShowPractice(true)
    setStatus("Today's Physics question downloaded.")
  }

  async function uploadSubmission(selectedFile: File | null = file) {
    if (readOnly) return
    if (!selectedFile || !assignmentId) {
      return setStatus("Download today's question before uploading your PDF.")
    }

    setFile(selectedFile)
    setStatus("Uploading answers...")
    const formData = new FormData()
    formData.append("student_id", studentId)
    formData.append("assignment_id", assignmentId)
    formData.append("file", selectedFile)

    const response = await fetch("/api/submissions", {
      method: "POST",
      body: formData,
    })
    const data = await response.json()

    if (!response.ok) return setStatus(data.message || "Upload failed")

    setSubmissionId(data.submission._id)
    localStorage.setItem("dailySubmissionId", data.submission._id)
    setStatus("Answers uploaded. You can now mark them.")
  }

  async function markAnswers() {
    if (readOnly) return
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

    const completeResponse = await fetch(
      "/api/assignment/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignment_id: assignmentId,
          submission_id: submissionId,
        }),
      },
    )
    const completeData = await completeResponse.json()

    if (!completeResponse.ok) {
      return setStatus(
        completeData.message ||
          "Answers marked, but the assignment could not be finalized.",
      )
    }

    const studentResponse = await fetch(
      `/api/student?student_id=${encodeURIComponent(studentId)}`,
    )
    if (studentResponse.ok) {
      const studentData = (await studentResponse.json()) as {
        student: Student
      }
      setStudent(studentData.student)
    }

    setStatus("All answers marked and finalized successfully.")
    setAssignmentComplete(true)
  }

  async function downloadMarkedSubmission() {
    if (readOnly) return
    if (!submissionId) {
      setStatus("Submit your answers before downloading the marked PDF.")
      return
    }

    setStatus("Preparing your marked PDF...")
    const response = await fetch("/api/submissions/marked-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ submission_id: submissionId }),
    })

    if (!response.ok) {
      const data = (await response.json()) as { message?: string }
      setStatus(data.message ?? "Could not prepare the marked PDF.")
      return
    }

    const url = URL.createObjectURL(await response.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = "marked-physics-submission.pdf"
    link.click()
    URL.revokeObjectURL(url)
    setStatus("Marked PDF downloaded.")
  }

  return (
    <main className="dashboard-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          TuitionAI
        </div>
        {readOnly ? (
          <span className="eyebrow">Teacher view</span>
        ) : (
          <button className="logout-button" type="button">
            Logout
          </button>
        )}
      </header>

      <section className="dashboard-intro">
        <p className="eyebrow">
          Student dashboard{student ? ` · ${student.name}` : ""}
        </p>
        <h1>
          {readOnly ? (student?.name ?? "Student progress") : "Build your rhythm"}<span>.</span>
        </h1>
        <div className="tabs" role="tablist" aria-label="Dashboard views">
          <button
            className={tab === "streaks" ? "tab active" : "tab"}
            role="tab"
            aria-selected={tab === "streaks"}
            onClick={() => setTab("streaks")}
            type="button"
          >
            Streaks
          </button>
          <button
            className={tab === "progress" ? "tab active" : "tab"}
            role="tab"
            aria-selected={tab === "progress"}
            onClick={() => setTab("progress")}
            type="button"
          >
            Progress
          </button>
          <span className={`tab-indicator ${tab}`} />
        </div>
      </section>

      {studentLoading ? (
        <section className="content-area" aria-busy="true" aria-live="polite">
          <p className="status">Loading student progress...</p>
        </section>
      ) : studentError ? (
        <section className="content-area">
          <p className="status" role="alert">{studentError}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setStudentLoading(true)
              setStudentError("")
              setReloadCount((count) => count + 1)
            }}
          >
            Try again
          </button>
        </section>
      ) : tab === "streaks" ? (
        <StreaksView
          daysToExam={daysToExam}
          examDate={examDate}
          onExamDateChange={updateExamDate}
          monthlyStreak={monthlyStreak}
          yearlyStreak={yearlyStreak}
          completedDays={completedDays}
          todayIso={todayIso}
          readOnly={readOnly}
          onTrackProgress={() => {
            if (readOnly) setTab("progress")
            else void downloadDailyQuestion()
          }}
        />
      ) : (
        <ProgressView
          rows={progressRows}
          studentName={student?.name ?? "Student"}
        />
      )}

      {!readOnly && status && !(showPractice && dailyQuestionReady) && (
        <p className="status" role="status">{status}</p>
      )}

      {!readOnly && !studentLoading && !studentError && showPractice && dailyQuestionReady && (
        <section className="practice-panel">
          <div className="practice-actions">
            {!submissionId && (
              <label className="primary-button upload-button">
                Upload completed PDF
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(event) =>
                    void uploadSubmission(event.target.files?.[0] ?? null)
                  }
                />
              </label>
            )}
            {submissionId && !assignmentComplete && (
              <button type="button" onClick={markAnswers}>
                Mark answers
              </button>
            )}
            {(results.length > 0 || assignmentComplete) && (
              <button type="button" onClick={() => void downloadMarkedSubmission()}>
                Download marked PDF
              </button>
            )}
          </div>
          {assignmentId && (
            <p className="status">Daily question ready · {assignmentId}</p>
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
  onExamDateChange,
  monthlyStreak,
  yearlyStreak,
  completedDays,
  todayIso,
  readOnly,
  onTrackProgress,
}: {
  daysToExam: number
  examDate: string
  onExamDateChange: (value: string) => void
  monthlyStreak: number
  yearlyStreak: number
  completedDays: number[]
  todayIso: string
  readOnly: boolean
  onTrackProgress: () => void
}) {
  const examDateRef = useRef<HTMLInputElement>(null)
  const calendarDate = useMemo(() => new Date(`${todayIso}T12:00:00`), [todayIso])
  const calendarDays = useMemo(
    () => getCalendarDays(calendarDate),
    [calendarDate],
  )
  const currentMonthName = calendarDate.toLocaleString("en-US", {
    month: "long",
  })
  const currentYear = calendarDate.getFullYear()

  return (
    <section className="content-area">
      <div className="stat-row">
        <Stat
          label="Days to exam"
          value={examDate ? String(daysToExam) : "—"}
          action={
            !readOnly ? <div className="change-date">
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
                aria-label="Exam date"
                min={getTodayIso()}
                value={examDate}
                onChange={(event) =>
                  onExamDateChange(event.target.value)
                }
              />
            </div> : <span className="status">
              {examDate
                ? new Date(`${examDate}T00:00:00`).toLocaleDateString("en-SG", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "No exam date set"}
            </span>
          }
        />
        <Stat
          label="Month's streak"
          value={String(monthlyStreak)}
        />
        <Stat
          label="Year's streak"
          value={String(yearlyStreak)}
        />
      </div>

      <div className="calendar-heading">
        <div>
          <p className="eyebrow">Streaks</p>
          <h2>{currentMonthName}</h2>
        </div>
        <span>{currentYear}</span>
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
              className={`day ${day.isCurrentMonth ? "" : "muted"}`}
              key={`${day.day}-${index}`}
            >
              <span
                className={[
                  day.isToday ? "today-marker" : "",
                  day.isCurrentMonth && completedDays.includes(day.day)
                    ? "completed-marker"
                    : "",
                ].filter(Boolean).join(" ")}
                aria-label={day.isCurrentMonth && completedDays.includes(day.day)
                  ? `${day.day} ${currentMonthName}: completed`
                  : undefined}
              >
                {day.day}
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
      <button
        className="primary-button"
        type="button"
        onClick={onTrackProgress}
      >
        {readOnly ? "Track progress" : "Track my progress"} <span>↗</span>
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
          <p className="eyebrow">Singapore-Cambridge GCE A-Level · H2 Physics</p>
          <h2>Student progress</h2>
        </div>
        <div className="student-summary">
          <strong>{studentName}</strong>
          <span>{rows.length} topics · Mastery overview</span>
        </div>
      </div>

      <div className="progress-table">
        <div className="progress-header">
          <span>Topic</span>
          <span>Mastery</span>
          <span>Latest</span>
          <span>Attempts</span>
        </div>
        {rows.length === 0 && (
          <p className="status">No H2 Physics topics have been selected yet.</p>
        )}
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
        {rows.some((row) => row.attempts.length > 0) && <span>Click an attempt to inspect</span>}
      </div>
    </section>
  )
}
