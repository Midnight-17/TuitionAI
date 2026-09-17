import { STUDY_TIME_ZONE } from "@/lib/studyDate"

export const TEACHER_TIME_ZONE = STUDY_TIME_ZONE

export type TeacherSubmissionStatus =
  | "submitted"
  | "processing"
  | "completed"
  | "failed"

export type TeacherDashboardStudent = {
  student_id: string
  name: string
  slug: string
  submittedToday: boolean
  submittedAt: string | null
  submissionStatus: TeacherSubmissionStatus | null
}

export type TeacherDashboard = {
  teacher: { teacher_id: string; name: string }
  date: string
  timeZone: typeof TEACHER_TIME_ZONE
  students: TeacherDashboardStudent[]
  counts: { total: number; submitted: number; pending: number }
}

// Readable names plus stable IDs keep duplicate names from sharing a route.
function nameSlug(name: string, fallback: string) {
  const nameSlug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")

  return nameSlug || fallback
}

export function getTeacherStudentSlug(name: string, studentId: string) {
  return `${nameSlug(name, "student")}--${studentId}`
}

export function getTeacherSlug(name: string, teacherId: string) {
  return `${nameSlug(name, "teacher")}--${teacherId}`
}

export function getTeacherIdFromSlug(slug: string) {
  const separator = slug.lastIndexOf("--")
  return separator > 0 && separator < slug.length - 2
    ? slug.slice(separator + 2)
    : null
}

export function teacherHref(teacherSlug: string) {
  return `/teacher/${encodeURIComponent(teacherSlug)}`
}

export function teacherStudentHref(teacherSlug: string, studentSlug: string) {
  return `${teacherHref(teacherSlug)}/${encodeURIComponent(studentSlug)}`
}
