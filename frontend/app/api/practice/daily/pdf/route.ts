import { NextResponse } from "next/server"
import { connectDB } from "@/lib/mongodb"
import Assignment from "@/app/models/Assignment"
import Question from "@/app/models/Questions"
import FileModel from "@/app/models/Files"
import { createQuestionPDF } from "@/lib/createQuestionPDF"

export async function POST(request: Request) {
  try {
    await connectDB()

    const { assignment_id } = await request.json()

    if (!assignment_id) {
      return NextResponse.json(
        { message: "assignment_id is required" },
        { status: 400 },
      )
    }

    const assignment = await Assignment.findById(assignment_id)

    if (
      !assignment ||
      assignment.type !== "practice" ||
      !assignment.practice_date
    ) {
      return NextResponse.json(
        { message: "Daily practice assignment not found" },
        { status: 404 },
      )
    }

    if (assignment.questions.length !== 1) {
      return NextResponse.json(
        {
          message: "Daily practice assignment must contain one question",
        },
        { status: 409 },
      )
    }

    const question = await Question.findById(assignment.questions[0])

    if (!question) {
      return NextResponse.json(
        { message: "Question not found" },
        { status: 404 },
      )
    }

    const sourceFile = await FileModel.findById(question.file)

    if (!sourceFile) {
      return NextResponse.json(
        { message: "Question source PDF not found" },
        { status: 404 },
      )
    }

    const pdf = await createQuestionPDF([
      {
        pdf_id: sourceFile.pdf_id,
        page: question.page,
      },
    ])

    return new NextResponse(pdf as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="daily-practice-${assignment_id}.pdf"`,
      },
    })
  } catch (error) {
    console.error("Error creating daily practice PDF:", error)

    return NextResponse.json(
      { message: "Failed to create daily practice PDF" },
      { status: 500 },
    )
  }
}
