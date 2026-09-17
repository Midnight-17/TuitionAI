import { loadTeacherDashboard } from "@/lib/teacherDashboard"
import { getTeacherIdFromSlug, getTeacherSlug } from "@/lib/teacherDashboardShared"

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const teacherSlug = searchParams.get("teacher_slug")?.trim()
  const teacherId = teacherSlug === undefined
    ? searchParams.get("teacher_id")?.trim()
    : getTeacherIdFromSlug(teacherSlug)

  if (!teacherId) {
    return Response.json({ message: "A valid teacher_slug or teacher_id is required" }, { status: 400 })
  }

  try {
    const dashboard = await loadTeacherDashboard(teacherId)

    if (!dashboard || (teacherSlug !== undefined &&
      getTeacherSlug(dashboard.teacher.name, dashboard.teacher.teacher_id) !== teacherSlug)) {
      return Response.json({ message: "Teacher not found" }, { status: 404 })
    }

    return Response.json(dashboard, {
      headers: { "Cache-Control": "private, no-store" },
    })
  } catch {
    return Response.json(
      { message: "We couldn't load your students. Please try again." },
      { status: 500 },
    )
  }
}
