"use client"

import { useState } from "react"

export default function DropBox() {
  const [file, setFile] = useState<File | null>(null)
  const [studentId, setStudentId] = useState("S001")
  const [teacherId, setTeacherId] = useState("T001")
  const [subject, setSubject] = useState("Physics")
  const [assignmentId, setAssignmentId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("diagnosticAssignmentId")
  )
  const [submissionId, setSubmissionId] = useState<string | null>(() =>
    typeof window === "undefined" ? null : localStorage.getItem("diagnosticSubmissionId")
  )
  const [questionIds, setQuestionIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    return JSON.parse(localStorage.getItem("diagnosticQuestionIds") || "[]")
  })
  const [results, setResults] = useState<Array<{ question: number; marks: string; feedback: string; misconception: string | null }>>([])
  const [status, setStatus] = useState("")

  async function downloadDiagnostic() {
    setStatus("Creating diagnostic...")
    const response = await fetch("/api/diagnostics", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ student_id: studentId, teacher_id: teacherId, subject }) })
    const data = await response.json()
    if (!response.ok) return setStatus(data.message || "Could not create diagnostic")
    setAssignmentId(data.assignment._id)
    localStorage.setItem("diagnosticAssignmentId", data.assignment._id)
    setQuestionIds(data.assignment.questions)
    localStorage.setItem("diagnosticQuestionIds", JSON.stringify(data.assignment.questions))
    const pdfResponse = await fetch("/api/diagnostics/pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assignment_id: data.assignment._id }) })
    if (!pdfResponse.ok) { const error = await pdfResponse.json(); return setStatus(error.message || "Could not download diagnostic") }
    const url = URL.createObjectURL(await pdfResponse.blob())
    const link = document.createElement("a")
    link.href = url
    link.download = `diagnostic-${data.assignment._id}.pdf`
    link.click()
    URL.revokeObjectURL(url)
    setStatus("Diagnostic downloaded. Complete it, then select the answer PDF.")
  }

  async function uploadSubmission() {
    if (!file || !assignmentId) return setStatus("Download a diagnostic first and select your completed PDF.")
    setStatus("Uploading answers...")
    const formData = new FormData()
    formData.append("student_id", studentId)
    formData.append("assignment_id", assignmentId)
    formData.append("file", file)
    const response = await fetch("/api/submissions", { method: "POST", body: formData })
    const data = await response.json()
    if (response.ok) {
      setSubmissionId(data.submission._id)
      localStorage.setItem("diagnosticSubmissionId", data.submission._id)
      setStatus("Answers uploaded. Click Mark Answers to receive your results.")
    } else {
      setStatus(data.message || "Upload failed")
    }
  }

  async function markAnswers() {
    if (!submissionId || !assignmentId) {
      return setStatus("Upload your completed answer PDF first.")
    }

    let ids = questionIds
    if (ids.length === 0) {
      const assignmentResponse = await fetch(`/api/assignment?assignment_id=${assignmentId}`)
      const assignmentData = await assignmentResponse.json()
      if (!assignmentResponse.ok) return setStatus(assignmentData.message || "Could not find diagnostic questions")
      ids = assignmentData.assignment.questions
      setQuestionIds(ids)
      localStorage.setItem("diagnosticQuestionIds", JSON.stringify(ids))
    }

    setStatus("Gemini is marking your answers. This may take a while...")
    const markedResults = []
    for (let index = 0; index < ids.length; index++) {
      const response = await fetch("/api/attempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ student_id: studentId, assignment_id: assignmentId, question_id: ids[index], submission_id: submissionId }),
      })
      const data = await response.json()
      if (!response.ok) return setStatus(data.message || `Marking failed on question ${index + 1}`)
      markedResults.push({ question: index + 1, marks: `${data.evaluation.marks_awarded}`, feedback: data.evaluation.ai_feedback, misconception: data.evaluation.misconception })
      setResults([...markedResults])
    }
    setStatus("All answers marked successfully.")
  }

  return (
    <div className="DropBox">
      <div className="formFields">
        <input value={studentId} onChange={(e) => setStudentId(e.target.value)} placeholder="Student ID" />
        <input value={teacherId} onChange={(e) => setTeacherId(e.target.value)} placeholder="Teacher ID" />
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
      </div>
      <button onClick={downloadDiagnostic}>Download Diagnostic</button>
      {assignmentId && <p>Current diagnostic: {assignmentId}</p>}
      <label className="label">Upload completed answer PDF</label>
      <input type="file" accept="application/pdf" className="fileInput" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      {file && <p>{file.name}</p>}
      <button onClick={uploadSubmission}>Upload Answer PDF</button>
      <button onClick={markAnswers}>Mark Answers</button>
      {status && <p>{status}</p>}
      {results.length > 0 && <div className="results">
        <h2>Results</h2>
        {results.map((result) => <article key={result.question}>
          <h3>Question {result.question}: {result.marks} marks</h3>
          <p>{result.feedback}</p>
          {result.misconception && <p><strong>Misconception:</strong> {result.misconception}</p>}
        </article>)}
      </div>}
    </div>
  )
}
