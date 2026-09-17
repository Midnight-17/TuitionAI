import { notFound, redirect } from "next/navigation"
import { loadTeacherDashboard } from "@/lib/teacherDashboard"
import { getTeacherSlug, teacherHref } from "@/lib/teacherDashboardShared"

export const dynamic = "force-dynamic"

export default async function TeacherPage() {
  // Development entry point only; sign-in will supply the teacher before launch.
  const dashboard = await loadTeacherDashboard("T001")
  if (!dashboard) notFound()
  redirect(teacherHref(getTeacherSlug(dashboard.teacher.name, dashboard.teacher.teacher_id)))
}
