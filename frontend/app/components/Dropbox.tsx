"use client"

import { useEffect, useMemo, useState, useRef } from "react"
import type { ReactNode } from "react"
import { h2PhysicsTopics } from "@/app/data/h2PhysicsTopics"
import {
  buildPaperPairs,
  type PaperFilePair,
  type PaperPairingManifest,
  type UnmatchedPaperFile,
} from "@/lib/paperFiles"

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
}


type ProgressRow = {
  name: string
  subject: string
  mastery: number
  latest: "Good" | "Medium" | "Needs work"
  tone: "good" | "medium" | "needs"
  attempts: string[]
}

// Use the user's local date so the picker does not shift by a day across timezones.
function getTodayIso() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, "0")
  const day = String(today.getDate()).padStart(2, "0")

  return `${year}-${month}-${day}`
}

type CalendarDay = {
  day: number
  isCurrentMonth: boolean
  isToday: boolean
}

function getCalendarDays(date: Date): CalendarDay[] {
  const year = date.getFullYear()
  const month = date.getMonth()
  const today = new Date()
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

export default function DropBox() {
  const [tab, setTab] = useState<"streaks" | "progress">("streaks")
  const [student, setStudent] = useState<Student | null>(null)
  const [selectedTopicNumbers, setSelectedTopicNumbers] = useState<number[]>([])
  const [studentId, setStudentId] = useState("S001")
  const [teacherId, setTeacherId] = useState("T001")
  const [subject, setSubject] = useState("Physics")
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
  const [teacherFiles, setTeacherFiles] = useState<File[]>([])
  const [teacherPairingManifest, setTeacherPairingManifest] =
    useState<PaperPairingManifest | null>(null)
  const [teacherFilePreview, setTeacherFilePreview] = useState<{
    pairs: PaperFilePair[]
    unmatched: UnmatchedPaperFile[]
  }>({ pairs: [], unmatched: [] })
  const [teacherPairing, setTeacherPairing] = useState(false)
  const [teacherPairingFailed, setTeacherPairingFailed] = useState(false)
  const [pairingElapsedSeconds, setPairingElapsedSeconds] = useState(0)
  const [teacherUploadStatus, setTeacherUploadStatus] = useState("")
  const [teacherUploading, setTeacherUploading] = useState(false)
  const pairingRequestRef = useRef(0)
  const pairingControllerRef = useRef<AbortController | null>(null)
  const pairingStartedAtRef = useRef(0)

  useEffect(() => () => {
    pairingRequestRef.current += 1
    pairingControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!teacherPairing) return
    const timer = window.setInterval(() => {
      setPairingElapsedSeconds(Math.floor((Date.now() - pairingStartedAtRef.current) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [teacherPairing])

  useEffect(() => {
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
  }, [])

  async function prepareTeacherFiles(selectedFiles: File[]) {
    if (teacherUploading) return
    const pdfFiles = selectedFiles.filter(
      (selectedFile) =>
        selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf"),
    )
    const requestId = pairingRequestRef.current + 1
    pairingRequestRef.current = requestId
    pairingControllerRef.current?.abort()
    pairingControllerRef.current = null

    setTeacherFiles(pdfFiles)
    setTeacherPairingManifest(null)
    setTeacherFilePreview({ pairs: [], unmatched: [] })
    setTeacherPairingFailed(false)
    setPairingElapsedSeconds(0)

    if (pdfFiles.length === 0) {
      setTeacherPairing(false)
      setTeacherUploadStatus("Select at least one PDF file.")
      return
    }

    setTeacherPairing(true)
    pairingStartedAtRef.current = Date.now()
    setTeacherUploadStatus("Matching filenames only. Your PDFs have not been uploaded yet.")
    const controller = new AbortController()
    pairingControllerRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch("/api/analyse/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          files: pdfFiles.map((selectedFile, id) => ({
            id,
            name: selectedFile.name,
            relativePath:
              (selectedFile as File & { webkitRelativePath?: string })
                .webkitRelativePath || selectedFile.name,
            size: selectedFile.size,
          })),
        }),
      })
      const data = (await response.json()) as {
        message?: string
        manifest?: PaperPairingManifest
      }

      if (requestId !== pairingRequestRef.current) return

      if (data.manifest) {
        setTeacherPairingManifest(data.manifest)
        setTeacherFilePreview(buildPaperPairs(pdfFiles, data.manifest))
      }

      if (!response.ok || !data.manifest) {
        setTeacherPairingFailed(true)
        setTeacherUploadStatus(
          data.message ?? "AI could not recognize the selected filenames.",
        )
        return
      }

      setTeacherUploadStatus(
        `${data.message ?? "Files recognized."} Review the matches before analysing.`,
      )
    } catch {
      if (requestId === pairingRequestRef.current) {
        setTeacherPairingFailed(true)
        setTeacherUploadStatus(
          controller.signal.aborted
            ? "Filename matching timed out after 15 seconds. Your PDFs have not been uploaded. Retry matching."
            : "Could not reach the filename-matching service. Your files are still selected. Retry matching.",
        )
      }
    } finally {
      window.clearTimeout(timeoutId)
      if (requestId === pairingRequestRef.current) {
        pairingControllerRef.current = null
        setTeacherPairing(false)
      }
    }
  }

  function clearTeacherFiles() {
    pairingRequestRef.current += 1
    pairingControllerRef.current?.abort()
    pairingControllerRef.current = null
    setTeacherFiles([])
    setTeacherPairingManifest(null)
    setTeacherFilePreview({ pairs: [], unmatched: [] })
    setTeacherPairing(false)
    setTeacherPairingFailed(false)
    setPairingElapsedSeconds(0)
    setTeacherUploadStatus("")
  }

  useEffect(() => {
    if (!assignmentId) return

    const loadAssignmentProgress = async () => {
      const response = await fetch(
        `/api/assignment?assignment_id=${encodeURIComponent(assignmentId)}`,
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
    }

    void loadAssignmentProgress()
  }, [assignmentId])

  useEffect(() => {
    const loadStudent = async () => {
      setExamDate("")

      const response = await fetch(
        `/api/student?student_id=${encodeURIComponent(studentId)}`,
      )
      if (!response.ok) return

      const data = (await response.json()) as { student: Student }
      setStudent(data.student)
      setExamDate(data.student.exam_date?.slice(0, 10) ?? "")

      const teacherResponse = await fetch(
        `/api/teacher?teacher_id=${encodeURIComponent(teacherId)}`,
      )
      if (!teacherResponse.ok) {
        setSelectedTopicNumbers([])
        return
      }

      const teacherData = (await teacherResponse.json()) as {
        teacher: Teacher
      }
      const physicsScope = teacherData.teacher.teaching_scopes?.find(
        (scope) => scope.subject === "Physics" && scope.level === "H2",
      )
      setSelectedTopicNumbers(physicsScope?.selected_topics ?? [])
    }

    void loadStudent()
  }, [studentId, teacherId])

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

  const monthlyStreak = student?.monthly_streak?.length ?? 0
  const yearlyStreak = student?.year_streak?.length ?? 0

  const daysToExam = useMemo(() => {
    if (!examDate) return 0

    const today = new Date()
    const exam = new Date(`${examDate}T00:00:00`)
    return Math.max(
      0,
      Math.ceil((exam.getTime() - today.getTime()) / 86400000),
    )
  }, [examDate])

  async function updateExamDate(value: string) {
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

  async function uploadSubmission(selectedFile: File | null = file) {
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

  async function analyseTeacherFiles() {
    if (!teacherPairingManifest || teacherFilePreview.pairs.length === 0) {
      setTeacherUploadStatus("Wait for AI filename matching before analysing.")
      return
    }

    setTeacherUploading(true)
    setTeacherUploadStatus("Uploading and analysing papers. This may take a while...")

    const formData = new FormData()
    teacherFiles.forEach((selectedFile) => formData.append("files", selectedFile))
    formData.append("pairing_manifest", JSON.stringify(teacherPairingManifest))

    try {
      const response = await fetch("/api/analyse", {
        method: "POST",
        body: formData,
      })
      const data = (await response.json()) as {
        message?: string
        unmatched?: UnmatchedPaperFile[]
      }

      if (!response.ok) {
        setTeacherUploadStatus(data.message ?? "Paper analysis failed.")
        return
      }

      const warning = data.unmatched?.length
        ? ` ${data.unmatched.length} file${data.unmatched.length === 1 ? " was" : "s were"} not processed.`
        : ""
      setTeacherUploadStatus(`${data.message ?? "Papers analysed successfully."}${warning}`)
      setTeacherFiles([])
      setTeacherPairingManifest(null)
      setTeacherFilePreview({ pairs: [], unmatched: [] })
    } catch {
      setTeacherUploadStatus("Could not reach the analysis service. Try again.")
    } finally {
      setTeacherUploading(false)
    }
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
          onExamDateChange={updateExamDate}
          monthlyStreak={monthlyStreak}
          yearlyStreak={yearlyStreak}
          onTrackProgress={() => void downloadDailyQuestion()}
        />
      ) : (
        <ProgressView
          rows={progressRows}
          studentName={student?.name ?? "Student"}
        />
      )}

      {showPractice && dailyQuestionReady && (
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

      <section className="teacher-upload-panel" aria-labelledby="teacher-upload-title">
        <div className="teacher-upload-heading">
          <div>
            <p className="eyebrow">Teacher tools · JC H2 Physics</p>
            <h2 id="teacher-upload-title">Add question papers</h2>
          </div>
          <p>Upload one paper, several PDFs, or a complete folder. AI recognizes the filenames before any PDF is uploaded.</p>
        </div>

        <label
          className="teacher-upload-dropzone"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            void prepareTeacherFiles(Array.from(event.dataTransfer.files))
          }}
        >
          <span className="teacher-upload-icon">＋</span>
          <strong>Select question papers</strong>
          <span>Choose PDFs or select a folder containing question and answer-key files.</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            multiple
            disabled={teacherUploading}
            // @ts-expect-error webkitdirectory is supported by Chromium, Safari, and iPadOS browsers.
            webkitdirectory=""
            onChange={(event) => {
              void prepareTeacherFiles(Array.from(event.target.files ?? []))
              event.currentTarget.value = ""
            }}
          />
        </label>

        {teacherFiles.length > 0 && (
          <div className="teacher-upload-review" aria-busy={teacherPairing}>
            <div className="teacher-upload-summary">
              <strong>
                {teacherPairing
                  ? "AI is matching files..."
                  : teacherPairingFailed
                    ? "Matching failed — files kept"
                    : `${teacherFilePreview.pairs.length} paper${teacherFilePreview.pairs.length === 1 ? "" : "s"} ready`}
              </strong>
              <span>{teacherFiles.length} file{teacherFiles.length === 1 ? "" : "s"} selected</span>
            </div>

            {teacherPairing && (
              <p className="status">
                {pairingElapsedSeconds}s elapsed · Checking filenames, not PDF contents.
              </p>
            )}
            {teacherPairingFailed && (
              <div className="upload-warning" role="alert">
                <strong>{teacherUploadStatus}</strong>
                <span>You can retry without selecting the files again.</span>
              </div>
            )}
            {!teacherPairingManifest && (
              <details className="selected-paper-files">
                <summary>View selected filenames</summary>
                <ul>
                  {teacherFiles.map((selectedFile, index) => (
                    <li key={index}>{selectedFile.webkitRelativePath || selectedFile.name}</li>
                  ))}
                </ul>
              </details>
            )}

            <div className="paper-pair-list">
              {teacherFilePreview.pairs.map((pair: PaperFilePair) => {
                const group = teacherPairingManifest?.groups.find(
                  (candidate) =>
                    teacherFiles[candidate.questionFileId] === pair.questionFile,
                )

                return (
                  <div className="paper-pair" key={pair.paperId}>
                    <strong>{pair.paperId}</strong>
                    <span>Question paper · {pair.questionFile.name}</span>
                    <span className={pair.answerFile ? "pair-answer" : "pair-warning"}>
                      {pair.answerFile ? `Answer key · ${pair.answerFile.name}` : "No answer key matched · question-only import"}
                    </span>
                    {group && (
                      <span className="pair-confidence">
                        AI confidence · {Math.round(group.confidence * 100)}%
                        {group.note ? ` · ${group.note}` : ""}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>

            {teacherFilePreview.unmatched.length > 0 && (
              <div className="upload-warning" role="status">
                <strong>Files needing attention</strong>
                {teacherFilePreview.unmatched.map((item: UnmatchedPaperFile) => (
                  <span key={`${item.filename}-${item.reason}`}>{item.filename} · {item.reason}</span>
                ))}
              </div>
            )}

            <div className="teacher-upload-actions">
              {teacherPairingFailed ? (
                <button
                  className="primary-button"
                  type="button"
                  disabled={teacherUploading}
                  onClick={() => void prepareTeacherFiles(teacherFiles)}
                >
                  Retry matching
                </button>
              ) : <button
                className="primary-button"
                type="button"
                disabled={
                  teacherUploading ||
                  teacherPairing ||
                  !teacherPairingManifest ||
                  teacherFilePreview.pairs.length === 0
                }
                onClick={() => void analyseTeacherFiles()}
              >
                {teacherPairing
                  ? "Matching filenames..."
                  : teacherUploading
                    ? "Analysing..."
                    : "Analyse selected papers"}
              </button>}
              <button
                className="secondary-button"
                type="button"
                disabled={teacherUploading}
                onClick={clearTeacherFiles}
              >
                Clear selection
              </button>
            </div>
          </div>
        )}

        {teacherUploadStatus && !teacherPairingFailed && <p className="status" role="status">{teacherUploadStatus}</p>}
      </section>

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
  onTrackProgress,
}: {
  daysToExam: number
  examDate: string
  onExamDateChange: (value: string) => void
  monthlyStreak: number
  yearlyStreak: number
  onTrackProgress: () => void
}) {
  const examDateRef = useRef<HTMLInputElement>(null)
  const calendarDate = useMemo(() => new Date(), [])
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
                onChange={(event) =>
                  onExamDateChange(event.target.value)
                }
              />
            </div>
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
              <span className={day.isToday ? "today-marker" : ""}>
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
          <p className="eyebrow">Singapore-Cambridge GCE A-Level · H2 Physics</p>
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
        <span>Click an attempt to inspect</span>
      </div>
    </section>
  )
}
