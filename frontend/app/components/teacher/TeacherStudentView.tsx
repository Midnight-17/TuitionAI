"use client"

import Link from "next/link"
import DropBox from "@/app/components/Dropbox"
import { useTeacherWorkspace } from "./TeacherWorkspace"

export default function TeacherStudentView({ slug }: { slug: string }) {
  const { data, loading, error, refresh, homeHref } = useTeacherWorkspace()
  const student = data?.students.find((candidate) => candidate.slug === slug)

  if (loading) return <div className="dashboard-shell teacher-page-state" role="status">Loading student dashboard…</div>

  if (!data || !student) return (
    <main className="dashboard-shell teacher-page-state">
      <p className="eyebrow">Teacher workspace</p>
      <h1>{!data ? "Class unavailable" : "Student not found"}</h1>
      <p role={!data ? "alert" : undefined}>{!data ? error : "This student is not in your class, or their link has changed."}</p>
      {!data && <button className="secondary-button" type="button" onClick={() => void refresh()}>Try again</button>}
      <Link className="teacher-text-link" href={homeHref}>← Back to Home</Link>
    </main>
  )

  return <DropBox key={student.student_id} studentId={student.student_id} teacherId={data.teacher.teacher_id} readOnly />
}
