import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import Student from "@/app/models/Student";
import Teacher from "@/app/models/Teacher";
import File from "@/app/models/Files";
import Question from "@/app/models/Questions";
import Assignment from "@/app/models/Assignment";
import Attempt from "@/app/models/Attempt";

export async function GET() {
    try {
        await connectDB();

        const collections = {
            students: Student,
            teachers: Teacher,
            files: File,
            questions: Question,
            assignments: Assignment,
            attempts: Attempt,
        };

        const [students, teachers, files, questions, assignments, attempts] =
            await Promise.all([
                Student.find().select("_id student_id name subjects").lean(),
                Teacher.find().select("_id teacher_id name").lean(),
                File.find().select("_id filename subject paper_id file_type paired_file").lean(),
                Question.find()
                    .select(
                        "_id question_number topic subtopic subtopics difficulty total_marks file answer_key_file"
                    )
                    .lean(),
                Assignment.find()
                    .select("_id student teacher subject questions type status")
                    .lean(),
                Attempt.find()
                    .select(
                        "_id student assignment submission question marks_awarded is_correct"
                    )
                    .lean(),
            ]);

        return NextResponse.json({
            success: true,
            message: "MongoDB connected and all models loaded successfully.",
            models: Object.keys(collections),
            data: {
                students,
                teachers,
                files,
                questions,
                assignments,
                attempts,
            },
        });
    } catch (error) {
        console.error("Database test failed:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Database test failed.",
            },
            { status: 500 }
        );
    }
}
