import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Assignment from "@/app/models/Assignment";
import Submission from "@/app/models/Submissions";
import Question from "@/app/models/Questions";
import FileModel from "@/app/models/Files";
import { createQuestionPDF } from "@/lib/createQuestionPDF";
import { appendPDF } from "@/lib/pdf";
import { downloadPDF, uploadPDF } from "@/lib/gridfs";

type QuestionId = { toString(): string };

export async function POST(request: Request) {
    try {
        await connectDB();
        const { submission_id } = await request.json();
        if (!submission_id) return NextResponse.json({ message: "submission_id is required" }, { status: 400 });

        const submission = await Submission.findById(submission_id);
        if (!submission) return NextResponse.json({ message: "Submission not found" }, { status: 404 });
        const assignment = await Assignment.findById(submission.assignment);
        if (!assignment || assignment.status !== "completed") return NextResponse.json({ message: "Assignment is not completed" }, { status: 409 });

        const questionDocuments = await Question.find({ _id: { $in: assignment.questions } });
        const questionsById = new Map(questionDocuments.map((question) => [question._id.toString(), question]));
        const questions = (assignment.questions as QuestionId[])
            .map((questionId) => questionsById.get(questionId.toString()))
            .filter((question) => Boolean(question));
        const files = await FileModel.find({ _id: { $in: questions.map((question) => question.file) } });
        const filesById = new Map(files.map((file) => [file._id.toString(), file]));
        const answerKeyPDF = await createQuestionPDF(questions.map((question) => {
            const file = filesById.get(question.file.toString());
            if (!file) throw new Error("Question file not found");
            return { pdf_id: file.pdf_id, page: question.answer_key_page };
        }));
        const studentPDF = await downloadPDF(submission.submitted_pdf_id);
        const markedPDF = await appendPDF(studentPDF, answerKeyPDF);
        const markedPdfId = await uploadPDF(markedPDF, `marked-${submission_id}.pdf`);
        submission.marked_pdf_id = markedPdfId;
        await submission.save();

        return new NextResponse(markedPDF as BodyInit, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="marked-${assignment.name}.pdf"`,
            },
        });
    } catch (error) {
        console.error("Error creating marked PDF:", error);
        return NextResponse.json({ message: "Failed to create marked PDF" }, { status: 500 });
    }
}
