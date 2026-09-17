import type { Types } from "mongoose"
import { connectDB } from "@/lib/mongodb"
import Teacher from "@/app/models/Teacher"
import Student from "@/app/models/Student"
import Assignment from "@/app/models/Assignment"
import Submission from "@/app/models/Submissions"
import { getStudyDay } from "@/lib/studyDate"
import {
  getTeacherStudentSlug,
  TEACHER_TIME_ZONE,
  type TeacherDashboard,
  type TeacherSubmissionStatus,
} from "@/lib/teacherDashboardShared"

type TeacherRecord = {
  _id: Types.ObjectId
  teacher_id: string
  name: string
  students?: { student?: Types.ObjectId | null }[]
}

type StudentRecord = {
  _id: Types.ObjectId
  student_id: string
  name: string
}

type AssignmentRecord = {
  _id: Types.ObjectId
  student: Types.ObjectId
}

type SubmissionRecord = {
  _id: Types.ObjectId
  student: Types.ObjectId
  assignment: Types.ObjectId
  submitted_at: Date
  status: TeacherSubmissionStatus
}

export function getSingaporeDay(now = new Date()) {
  const { date, start, end } = getStudyDay(now)
  return { date, start, end }
}

export function getTeacherRosterFilter(teacher: TeacherRecord) {
  const studentIds = (teacher.students ?? [])
    .map((entry) => entry.student)
    .filter((student): student is Types.ObjectId => Boolean(student))

  // Either side of the existing relationship is enough. An empty relationship
  // still produces a scoped query; it must never fall back to the entire class DB.
  return {
    $or: [
      { _id: { $in: studentIds } },
      { "teachers.teacher": teacher._id },
    ],
  }
}

export async function loadTeacherDashboard(
  teacherId: string,
  now = new Date(),
): Promise<TeacherDashboard | null> {
  await connectDB()

  const teacher = await Teacher.findOne({ teacher_id: teacherId })
    .select("_id teacher_id name students.student")
    .lean<TeacherRecord>()

  if (!teacher) return null

  const { date, start, end } = getSingaporeDay(now)
  const students = await Student.find(getTeacherRosterFilter(teacher))
    .select("_id student_id name")
    .sort({ name: 1, student_id: 1 })
    .lean<StudentRecord[]>()

  const latestByStudent = new Map<string, SubmissionRecord>()

  if (students.length > 0) {
    const studentIds = students.map((student) => student._id)
    const assignments = await Assignment.find({
      teacher: teacher._id,
      student: { $in: studentIds },
    })
      .select("_id student")
      .lean<AssignmentRecord[]>()

    if (assignments.length > 0) {
      const assignmentStudents = new Map(
        assignments.map((assignment) => [
          String(assignment._id),
          String(assignment.student),
        ]),
      )
      const submissions = await Submission.find({
        student: { $in: studentIds },
        assignment: { $in: assignments.map((assignment) => assignment._id) },
        submitted_at: { $gte: start, $lt: end },
      })
        .select("_id student assignment submitted_at status")
        .sort({ submitted_at: -1, _id: -1 })
        .lean<SubmissionRecord[]>()

      for (const submission of submissions) {
        const studentId = String(submission.student)
        if (
          assignmentStudents.get(String(submission.assignment)) === studentId &&
          !latestByStudent.has(studentId)
        ) {
          latestByStudent.set(studentId, submission)
        }
      }
    }
  }

  const dashboardStudents = students.map((student) => {
    const submission = latestByStudent.get(String(student._id))

    return {
      student_id: student.student_id,
      name: student.name,
      slug: getTeacherStudentSlug(student.name, student.student_id),
      submittedToday: Boolean(submission),
      submittedAt: submission?.submitted_at.toISOString() ?? null,
      submissionStatus: submission?.status ?? null,
    }
  })
  const submitted = dashboardStudents.filter((student) => student.submittedToday).length

  return {
    teacher: { teacher_id: teacher.teacher_id, name: teacher.name },
    date,
    timeZone: TEACHER_TIME_ZONE,
    students: dashboardStudents,
    counts: {
      total: students.length,
      submitted,
      pending: students.length - submitted,
    },
  }
}
