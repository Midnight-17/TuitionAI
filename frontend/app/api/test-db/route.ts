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

        return NextResponse.json({
            success: true,
            message: "MongoDB connected and all models loaded successfully.",
            models: Object.keys(collections),
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
