import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Student from "@/app/models/Student";

export async function GET(request: Request) {
    try {
        await connectDB();
        const studentId = new URL(request.url).searchParams.get("student_id");

        if (!studentId) {
            return NextResponse.json({ message: "student_id is required" }, { status: 400 });
        }

        const student = await Student.findOne({ student_id: studentId })
            .select(
                "_id student_id name exam_date year_streak monthly_streak subjects teachers",
            )
            .lean();

        if (!student) {
            return NextResponse.json({ message: "Student not found" }, { status: 404 });
        }

        return NextResponse.json({ student });
    } catch (error) {
        console.error("Error retrieving student:", error);
        return NextResponse.json({ message: "Failed to retrieve student" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectDB();

        const body = await request.json();

        const { student_id, name } = body;

        // --------------------------------
        // 1. Validate input
        // --------------------------------

        if (!student_id || !name) {
            return NextResponse.json(
                {
                    message: "student_id and name are required",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 2. Check if student already exists
        // --------------------------------

        const existingStudent = await Student.findOne({
            student_id,
        });

        if (existingStudent) {
            return NextResponse.json(
                {
                    message: "Student already exists",
                },
                { status: 409 }
            );
        }

        // --------------------------------
        // 3. Create student
        // --------------------------------

        const student = await Student.create({
            student_id,
            name,
            exam_date: null,
            year_streak: [],
            monthly_streak: [],
            subjects: [],
            teachers: [],
        });

        // --------------------------------
        // 4. Return student
        // --------------------------------

        return NextResponse.json(
            {
                message: "Student created successfully",
                student,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Error creating student:", error);

        return NextResponse.json(
            {
                message: "Failed to create student",
                error: String(error),
            },
            { status: 500 }
        );
    }
}

export async function PATCH(request: Request) {
    try {
        await connectDB();

        const body = await request.json();
        const { student_id, exam_date } = body;

        if (
            typeof student_id !== "string" ||
            typeof exam_date !== "string"
        ) {
            return NextResponse.json(
                {
                    message: "student_id and exam_date are required",
                },
                { status: 400 },
            );
        }

        const dateParts = exam_date.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (!dateParts) {
            return NextResponse.json(
                { message: "exam_date must use YYYY-MM-DD format" },
                { status: 400 },
            );
        }

        const [, year, month, day] = dateParts;
        const parsedExamDate = new Date(
            Date.UTC(Number(year), Number(month) - 1, Number(day)),
        );
        const normalizedDate = parsedExamDate.toISOString().slice(0, 10);
        const today = new Date();
        const todayIso = new Date(
            Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()),
        )
            .toISOString()
            .slice(0, 10);

        if (normalizedDate !== exam_date) {
            return NextResponse.json(
                { message: "exam_date is not a valid date" },
                { status: 400 },
            );
        }

        if (exam_date < todayIso) {
            return NextResponse.json(
                { message: "exam_date cannot be before today" },
                { status: 400 },
            );
        }

        const student = await Student.findOneAndUpdate(
            { student_id },
            { exam_date: parsedExamDate },
            { new: true, runValidators: true },
        )
            .select(
                "_id student_id name exam_date year_streak monthly_streak subjects teachers",
            )
            .lean();

        if (!student) {
            return NextResponse.json(
                { message: "Student not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({ student });
    } catch (error) {
        console.error("Error updating student:", error);
        return NextResponse.json(
            { message: "Failed to update student" },
            { status: 500 },
        );
    }
}
