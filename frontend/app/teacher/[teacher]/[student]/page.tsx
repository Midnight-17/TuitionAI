import TeacherStudentView from "@/app/components/teacher/TeacherStudentView"

export default async function TeacherStudentPage({
  params,
}: {
  params: Promise<{ teacher: string; student: string }>
}) {
  const { student } = await params
  return <TeacherStudentView slug={student} />
}
