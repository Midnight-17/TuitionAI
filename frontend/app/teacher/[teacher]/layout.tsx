import TeacherWorkspace from "@/app/components/teacher/TeacherWorkspace"

export default async function TeacherWorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ teacher: string }>
}) {
  const { teacher } = await params
  return <TeacherWorkspace key={teacher} teacherSlug={teacher}>{children}</TeacherWorkspace>
}
