import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Student from "@/app/models/Student";
import Teacher from "@/app/models/Teacher";
import FileModel from "@/app/models/Files";
import Question from "@/app/models/Questions";
import Assignment from "@/app/models/Assignment";

const DIAGNOSTIC_QUESTION_COUNT = 10;

export async function POST(request: Request) {
    try {
        await connectDB();

        const body = await request.json();

        const {
            student_id,
            teacher_id,
            subject,
        } = body;

        // --------------------------------
        // 1. Validate input
        // --------------------------------

        if (!student_id || !teacher_id || !subject) {
            return NextResponse.json(
                {
                    message:
                        "student_id, teacher_id and subject are required",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 2. Find student
        // --------------------------------

        const student = await Student.findOne({ student_id });

        if (!student) {
            return NextResponse.json(
                {
                    message: "Student not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 3. Find teacher
        // --------------------------------

        const teacher = await Teacher.findOne({ teacher_id });

        if (!teacher) {
            return NextResponse.json(
                {
                    message: "Teacher not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 4. Find files for this subject
        // --------------------------------

        const files = await FileModel.find({
            subject,
        });

        if (files.length === 0) {
            return NextResponse.json(
                {
                    message: `No files found for subject: ${subject}`,
                },
                { status: 404 }
            );
        }

        const fileIds = files.map((file: any) => file._id);

        // --------------------------------
        // 5. Find all questions for subject
        // --------------------------------

        const questions = await Question.find({
            file: { $in: fileIds },
        });

        if (questions.length === 0) {
            return NextResponse.json(
                {
                    message:
                        `No questions found for subject: ${subject}`,
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 6. Group questions by subtopic
        // --------------------------------

        const questionsBySubtopic: {
            [key: string]: any[];
        } = {};

        for (const question of questions) {
            if (!questionsBySubtopic[question.subtopic]) {
                questionsBySubtopic[question.subtopic] = [];
            }

            questionsBySubtopic[question.subtopic].push(question);
        }

        const subtopics = Object.keys(questionsBySubtopic);

        // --------------------------------
        // 7. Shuffle questions within each
        //    subtopic
        // --------------------------------

        for (const subtopic of subtopics) {
            questionsBySubtopic[subtopic].sort(
                () => Math.random() - 0.5
            );
        }

        // --------------------------------
        // 8. Select questions
        // --------------------------------

        const selectedQuestions: any[] = [];

        let index = 0;

        while (
            selectedQuestions.length < DIAGNOSTIC_QUESTION_COUNT &&
            selectedQuestions.length < questions.length
        ) {
            let addedQuestion = false;

            for (const subtopic of subtopics) {
                if (
                    selectedQuestions.length >=
                    DIAGNOSTIC_QUESTION_COUNT
                ) {
                    break;
                }

                const availableQuestions =
                    questionsBySubtopic[subtopic];

                if (index < availableQuestions.length) {
                    selectedQuestions.push(
                        availableQuestions[index]
                    );

                    addedQuestion = true;
                }
            }

            if (!addedQuestion) {
                break;
            }

            index++;
        }

        // --------------------------------
        // 9. Make sure we have enough questions
        // --------------------------------

        if (
            selectedQuestions.length <
            DIAGNOSTIC_QUESTION_COUNT
        ) {
            return NextResponse.json(
                {
                    message:
                        `Not enough questions to create a 10-question diagnostic. Only ${selectedQuestions.length} available.`,
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 10. Create diagnostic assignment
        // --------------------------------

        const assignment = await Assignment.create({
            student: student._id,
            teacher: teacher._id,
            subject,
            type: "diagnostic",
            questions: selectedQuestions.map(
                (question: any) => question._id
            ),
        });

        // --------------------------------
        // 11. Return diagnostic
        // --------------------------------

        return NextResponse.json(
            {
                message:
                    "Diagnostic assessment created successfully",

                assignment,

                questions: selectedQuestions,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Error creating diagnostic:",
            error
        );

        return NextResponse.json(
            {
                message: "Failed to create diagnostic",
                error: String(error),
            },
            { status: 500 }
        );
    }
}