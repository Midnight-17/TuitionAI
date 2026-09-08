import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { connectDB } from "@/lib/mongodb";

import Student from "@/app/models/Student";
import Assignment from "@/app/models/Assignment";
import Question from "@/app/models/Questions";
import Attempt from "@/app/models/Attempt";
import Submission from "@/app/models/Submissions";
import FileModel from "@/app/models/Files";

import { downloadPDF } from "@/lib/gridfs";
import { extractPDFPages } from "@/lib/pdf";
import { updateMasteryFromAssignment } from "@/lib/mastery";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(request: Request) {
    try {
        await connectDB();

        const body = await request.json();

        const {
            student_id,
            assignment_id,
            question_id,
            submission_id,
        } = body;

        // --------------------------------
        // 1. Validate input
        // --------------------------------

        if (
            !student_id ||
            !assignment_id ||
            !question_id ||
            !submission_id
        ) {
            return NextResponse.json(
                {
                    message:
                        "student_id, assignment_id, question_id and submission_id are required",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 2. Find student
        // --------------------------------

        const student = await Student.findOne({
            student_id,
        });

        if (!student) {
            return NextResponse.json(
                {
                    message: "Student not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 3. Find assignment
        // --------------------------------

        const assignment = await Assignment.findById(
            assignment_id
        );

        if (!assignment) {
            return NextResponse.json(
                {
                    message: "Assignment not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 4. Make sure assignment belongs
        //    to this student
        // --------------------------------

        if (
            assignment.student.toString() !==
            student._id.toString()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Assignment does not belong to this student",
                },
                { status: 403 }
            );
        }

        const submission = await Submission.findById(
            submission_id
        );

        if (!submission) {
            return NextResponse.json(
                { message: "Submission not found" },
                { status: 404 }
            );
        }

        if (
            submission.assignment.toString() !==
                assignment._id.toString() ||
            submission.student.toString() !== student._id.toString()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Submission does not belong to this student and assignment",
                },
                { status: 403 }
            );
        }

        // --------------------------------
        // 5. Make sure question belongs
        //    to assignment
        // --------------------------------

        const questionBelongsToAssignment =
            assignment.questions.some(
                (id: any) =>
                    id.toString() === question_id
            );

        if (!questionBelongsToAssignment) {
            return NextResponse.json(
                {
                    message:
                        "Question does not belong to this assignment",
                },
                { status: 400 }
            );
        }

        const existingAttempt = await Attempt.findOne({
            student: student._id,
            assignment: assignment._id,
            submission: submission._id,
            question: question_id,
        });
        if (existingAttempt) {
            return NextResponse.json(
                { message: "This question has already been marked", attempt: existingAttempt },
                { status: 409 },
            );
        }

        // --------------------------------
        // 6. Find question
        // --------------------------------

        const question = await Question.findById(
            question_id
        );

        if (!question) {
            return NextResponse.json(
                {
                    message: "Question not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 7. Find the File
        // --------------------------------

        const file = await FileModel.findById(
            question.file
        );

        if (!file) {
            return NextResponse.json(
                {
                    message: "File for question not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 8. Download original PDF
        // --------------------------------

        const pdfBuffer = await downloadPDF(
            file.pdf_id
        );

        // --------------------------------
        // 9. Extract question pages
        // --------------------------------

        const questionPDF = await extractPDFPages(
            pdfBuffer,
            question.page
        );

        // --------------------------------
        // 10. Extract answer key pages
        // --------------------------------

        const answerKeyPDF = await extractPDFPages(
            pdfBuffer,
            question.answer_key_page
        );

        const submittedPDF = await downloadPDF(
            submission.submitted_pdf_id
        );

        // --------------------------------
        // 11. Ask Gemini to evaluate
        // --------------------------------

        const interaction = await ai.interactions.create({
            model: "gemini-3.6-flash",

            input: [
                {
                    type: "text",
                    text: `
You are an experienced Singapore Junior College A-Level Physics teacher.

You are grading a student's answer to a Physics question.

You have been given:
1. The original question.
2. The official answer key / marking scheme.
3. The student's handwritten submitted PDF.

Your job is to grade the student's answer according to the marking scheme.

IMPORTANT:

Do not simply compare the student's wording to the official answer.

Determine whether the student's physics reasoning is correct.

Consider:
- Correct physics concepts
- Correct equations
- Correct reasoning
- Correct units where relevant
- Correct calculations
- Whether the final answer is correct
- Whether the student has demonstrated the required understanding
- Common Physics misconceptions

Award marks fairly according to the available marks.

The question is worth ${question.total_marks} marks.

Return ONLY valid JSON.

Do not use markdown.
Do not use code fences.
Do not include explanations outside the JSON.

Return exactly:

{
    "is_correct": true,
    "marks_awarded": 5,
    "misconception": null,
    "ai_feedback": "Your explanation correctly applies..."
}

Rules:

"is_correct":
true if the student's answer is fully correct.
false if the student's answer contains any meaningful error or is incomplete.

"marks_awarded":
Must be between 0 and ${question.total_marks}.

"misconception":
If the student demonstrates a Physics misconception, briefly describe it.
Otherwise return null.

"ai_feedback":
Give concise feedback explaining what the student did well and/or what they need to improve.
`,
                },

                {
                    type: "document",
                    data: questionPDF.toString("base64"),
                    mime_type: "application/pdf",
                },

                {
                    type: "document",
                    data: answerKeyPDF.toString("base64"),
                    mime_type: "application/pdf",
                },

                {
                    type: "text",
                    text: `
The third document is the student's handwritten submission. Locate the answer corresponding to the supplied question and grade only that answer.
`,
                },

                {
                    type: "document",
                    data: submittedPDF.toString("base64"),
                    mime_type: "application/pdf",
                },
            ],
        });

        // --------------------------------
        // 12. Parse Gemini response
        // --------------------------------

        const output = interaction.output_text;

        console.log("Gemini grading output:");
        console.log(output);

        let evaluation;

        try {
            evaluation = JSON.parse(output!);
        } catch (error) {
            console.error(
                "Gemini returned invalid grading JSON:",
                output
            );

            return NextResponse.json(
                {
                    message:
                        "Gemini returned invalid grading JSON",
                    result: output,
                },
                { status: 500 }
            );
        }

        // --------------------------------
        // 13. Validate marks
        // --------------------------------

        if (
            typeof evaluation.marks_awarded !==
                "number" ||
            evaluation.marks_awarded < 0 ||
            evaluation.marks_awarded >
                question.total_marks
        ) {
            return NextResponse.json(
                {
                    message:
                        "Gemini returned invalid marks",
                    result: evaluation,
                },
                { status: 500 }
            );
        }

        // --------------------------------
        // 14. Create Attempt
        // --------------------------------

        const attempt = await Attempt.create({
            student: student._id,
            assignment: assignment._id,
            submission: submission._id,
            question: question._id,

            type:
                assignment.type === "diagnostic"
                    ? "diagnostic"
                    : "practice",

            is_correct: evaluation.is_correct,

            marks_awarded:
                evaluation.marks_awarded,

            misconception:
                evaluation.misconception ?? null,

            ai_feedback:
                evaluation.ai_feedback ?? null,
        });

        const completedAttempts = await Attempt.countDocuments({
            assignment: assignment._id,
        });

        if (completedAttempts >= assignment.questions.length) {
            assignment.status = "completed";
            assignment.completed_at = new Date();
            submission.status = "completed";
            submission.completed_at = new Date();
            await updateMasteryFromAssignment(assignment._id.toString(), student._id.toString());
        } else {
            assignment.status = "in_progress";
            submission.status = "processing";
        }

        await assignment.save();
        await submission.save();

        // --------------------------------
        // 15. Return result
        // --------------------------------

        return NextResponse.json(
            {
                message:
                    "Answer evaluated successfully",

                evaluation,

                attempt,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Error evaluating answer:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Failed to evaluate answer",
                error: String(error),
            },
            { status: 500 }
        );
    }
}
