import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Student from "@/app/models/Student"
import Teacher from "@/app/models/Teacher"
import Question from "@/app/models/Questions"
import Assignment from "@/app/models/Assignment"
import { h2PhysicsTopics } from "@/app/data/h2PhysicsTopics"
import { getStudyDay } from "@/lib/studyDate"

type TeachingScope = {
  subject: string
  level: string
  selected_topics: number[]
}

type StudentSubtopic = {
  name: string
  mastery?: number
}

type StudentTopic = {
  name: string
  mastery?: number
  subtopics?: StudentSubtopic[]
}

type StudentSubject = {
  name: string
  topics?: StudentTopic[]
}

function getTargetDifficulty(mastery: number) {
  if (mastery < 30) return 1
  if (mastery < 50) return 2
  if (mastery < 65) return 3
  if (mastery < 80) return 4
  return 5
}

export async function POST(request: Request) {
  try {
    await connectDB()

    const { student_id, teacher_id } = await request.json()

    if (!student_id || !teacher_id) {
      return NextResponse.json(
        {
          message: "student_id and teacher_id are required",
        },
        { status: 400 },
      )
    }

    const student = await Student.findOne({ student_id })
    const teacher = await Teacher.findOne({ teacher_id })

    if (!student || !teacher) {
      return NextResponse.json(
        {
          message: "Student or teacher not found",
        },
        { status: 404 },
      )
    }

    const physicsScope = (
      teacher.teaching_scopes as TeachingScope[] | undefined
    )?.find(
      (scope) =>
        scope.subject === "Physics" &&
        scope.level === "H2",
    )

    if (!physicsScope || physicsScope.selected_topics.length === 0) {
      return NextResponse.json(
        {
          message: "The teacher has not selected any Physics topics",
        },
        { status: 409 },
      )
    }

    const { start: practiceDate, end: tomorrow, dayOfYear } = getStudyDay()

    const existingAssignment = await Assignment.findOne({
      student: student._id,
      type: "practice",
      practice_date: {
        $gte: practiceDate,
        $lt: tomorrow,
      },
    }).populate("questions")

    if (existingAssignment) {
      return NextResponse.json(
        {
          message: "Daily Physics question already exists for today",
          assignment: existingAssignment,
          question: existingAssignment.questions[0],
        },
        { status: 200 },
      )
    }

    const selectedTopicNames = h2PhysicsTopics
      .filter((topic) =>
        physicsScope.selected_topics.includes(topic.topicNumber),
      )
      .map((topic) => topic.topic)

    const questions = await Question.find({
      topic: { $in: selectedTopicNames },
    })

    if (questions.length === 0) {
      return NextResponse.json(
        {
          message: "No questions are available for the selected topics",
        },
        { status: 404 },
      )
    }

    const studentPhysicsSubject = (
      student.subjects as unknown as StudentSubject[] | undefined
    )?.find((item) => item.name === "Physics")

    const topicCandidates = selectedTopicNames
      .map((topicName) => {
        const questionsForTopic = questions.filter(
          (question) => question.topic === topicName,
        )

        const studentTopic = studentPhysicsSubject?.topics?.find(
          (topic) => topic.name === topicName,
        )
        const subtopicNames = [
          ...new Set(
            questionsForTopic.flatMap((question) =>
              question.subtopics?.length
                ? question.subtopics
                : question.subtopic
                  ? [question.subtopic]
                  : [],
            ),
          ),
        ]

        const subtopics = subtopicNames.map((subtopicName) => {
          const studentSubtopic = studentTopic?.subtopics?.find(
            (subtopic) => subtopic.name === subtopicName,
          )

          return {
            name: subtopicName,
            mastery: studentSubtopic?.mastery ?? 0,
            questions: questionsForTopic.filter(
              (question) =>
                question.subtopics?.includes(subtopicName) ||
                question.subtopic === subtopicName,
            ),
          }
        })

        return {
          name: topicName,
          subtopics,
          lowestMastery: Math.min(
            ...subtopics.map((subtopic) => subtopic.mastery),
          ),
        }
      })
      .filter((topic) => topic.subtopics.length > 0)

    const isTargetedDay = (dayOfYear - 1) % 3 !== 2

    const topicPool = isTargetedDay
      ? topicCandidates.filter(
          (topic) =>
            topic.lowestMastery ===
            Math.min(
              ...topicCandidates.map(
                (candidate) => candidate.lowestMastery,
              ),
            ),
        )
      : topicCandidates

    const selectedTopic =
      topicPool[Math.floor(Math.random() * topicPool.length)]
    const lowestSubtopicMastery = Math.min(
      ...selectedTopic.subtopics.map(
        (subtopic) => subtopic.mastery,
      ),
    )
    const subtopicPool = selectedTopic.subtopics.filter(
      (subtopic) => subtopic.mastery === lowestSubtopicMastery,
    )
    const selectedSubtopic =
      subtopicPool[Math.floor(Math.random() * subtopicPool.length)]
    const targetDifficulty = getTargetDifficulty(
      selectedSubtopic.mastery,
    )
    const closestDistance = Math.min(
      ...selectedSubtopic.questions.map((candidate) =>
        Math.abs(candidate.difficulty - targetDifficulty),
      ),
    )
    const suitableQuestions = selectedSubtopic.questions.filter(
      (candidate) =>
        Math.abs(candidate.difficulty - targetDifficulty) ===
        closestDistance,
    )
    const question =
      suitableQuestions[
        Math.floor(Math.random() * suitableQuestions.length)
      ]

    const assignment = await Assignment.create({
      student: student._id,
      teacher: teacher._id,
      subject: "Physics",
      name: `Daily Physics OEQ - ${student_id}`,
      type: "practice",
      practice_date: practiceDate,
      questions: [question._id],
    })

    return NextResponse.json(
      {
        message: "Daily Physics question created",
        assignment,
        question,
      },
      { status: 201 },
    )
  } catch (error) {
    console.error("Error creating daily question:", error)

    return NextResponse.json(
      {
        message: "Failed to create daily question",
      },
      { status: 500 },
    )
  }
}
