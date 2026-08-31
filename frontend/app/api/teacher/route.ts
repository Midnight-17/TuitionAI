import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Teacher from "@/app/models/Teacher";

export async function POST(request: Request) {
    try {
        await connectDB();

        const body = await request.json();

        const { teacher_id, name } = body;

        // --------------------------------
        // 1. Validate input
        // --------------------------------

        if (!teacher_id || !name) {
            return NextResponse.json(
                {
                    message: "teacher_id and name are required",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 2. Check if teacher already exists
        // --------------------------------

        const existingTeacher = await Teacher.findOne({
            teacher_id,
        });

        if (existingTeacher) {
            return NextResponse.json(
                {
                    message: "Teacher already exists",
                },
                { status: 409 }
            );
        }

        // --------------------------------
        // 3. Create teacher
        // --------------------------------

        const teacher = await Teacher.create({
            teacher_id,
            name,
            students: [],
        });

        // --------------------------------
        // 4. Return teacher
        // --------------------------------

        return NextResponse.json(
            {
                message: "Teacher created successfully",
                teacher,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating teacher:", error);

        return NextResponse.json(
            {
                message: "Failed to create teacher",
                error: String(error),
            },
            { status: 500 }
        );
    }
}