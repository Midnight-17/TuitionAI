import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Assignment from "@/app/models/Assignment";
import Question from "@/app/models/Questions";
import FileModel from "@/app/models/Files";
import { createQuestionPDF } from "@/lib/createQuestionPDF";

export async function POST(request: Request) {
    try {
        await connectDB();
        const { assignment_id } = await request.json();

        if (!assignment_id) {
            return NextResponse.json(
                { message: "assignment_id is required" },
                { status: 400 }
            );
        }

        const assignment = await Assignment.findById(assignment_id);
        if (!assignment || assignment.type !== "diagnostic") {
            return NextResponse.json(
                { message: "Diagnostic assignment not found" },
                { status: 404 }
            );
        }

        const questions = await Question.find({
            _id: { $in: assignment.questions },
        });
        const files = await FileModel.find({
            _id: { $in: questions.map((question) => question.file) },
        });
        const filesById = new Map(
            files.map((file) => [file._id.toString(), file])
        );

        const pdf = await createQuestionPDF(
            questions.map((question) => {
                const file = filesById.get(question.file.toString());
                if (!file) throw new Error("Question file not found");
                return { pdf_id: file.pdf_id, page: question.page };
            })
        );

        return new NextResponse(pdf as BodyInit, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="diagnostic-${assignment_id}.pdf"`,
            },
        });
    } catch (error) {
        console.error("Error creating diagnostic PDF:", error);
        return NextResponse.json(
            { message: "Failed to create diagnostic PDF" },
            { status: 500 }
        );
    }
}
