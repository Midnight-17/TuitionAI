import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Teacher from "@/app/models/Teacher";
import { h2PhysicsTopics } from "@/app/data/h2PhysicsTopics";

const validTopicNumbers = new Set(
    h2PhysicsTopics.map((topic) => topic.topicNumber),
);

export async function GET(request: Request) {
    try {
        await connectDB();

        const teacherId = new URL(request.url).searchParams.get("teacher_id");

        if (!teacherId) {
            return NextResponse.json(
                { message: "teacher_id is required" },
                { status: 400 },
            );
        }

        const teacher = await Teacher.findOne({ teacher_id: teacherId })
            .select("_id teacher_id name teaching_scopes students")
            .lean();

        if (!teacher) {
            return NextResponse.json(
                { message: "Teacher not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({ teacher });
    } catch (error) {
        console.error("Error retrieving teacher:", error);
        return NextResponse.json(
            { message: "Failed to retrieve teacher" },
            { status: 500 },
        );
    }
}

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

export async function PATCH(request: Request) {
    try {
        await connectDB();

        const body = await request.json();
        const {
            teacher_id,
            subject,
            level,
            selected_topics,
        } = body;

        if (
            typeof teacher_id !== "string" ||
            subject !== "Physics" ||
            level !== "H2" ||
            !Array.isArray(selected_topics)
        ) {
            return NextResponse.json(
                {
                    message:
                        "teacher_id, Physics, H2 and selected_topics are required",
                },
                { status: 400 },
            );
        }

        const invalidTopic = selected_topics.find(
            (topicNumber: unknown) =>
                typeof topicNumber !== "number" ||
                !Number.isInteger(topicNumber) ||
                !validTopicNumbers.has(topicNumber),
        );

        if (invalidTopic !== undefined) {
            return NextResponse.json(
                {
                    message: `Invalid H2 Physics topic number: ${invalidTopic}`,
                },
                { status: 400 },
            );
        }

        const uniqueTopics = [...new Set(selected_topics)];
        let teacher = await Teacher.findOneAndUpdate(
            {
                teacher_id,
                teaching_scopes: {
                    $elemMatch: { subject, level },
                },
            },
            {
                $set: {
                    "teaching_scopes.$.selected_topics": uniqueTopics,
                },
            },
            { new: true },
        )
            .select("_id teacher_id name teaching_scopes students")
            .lean();

        if (!teacher) {
            teacher = await Teacher.findOneAndUpdate(
                { teacher_id },
                {
                    $push: {
                        teaching_scopes: {
                            subject,
                            level,
                            selected_topics: uniqueTopics,
                        },
                    },
                },
                { new: true },
            )
                .select("_id teacher_id name teaching_scopes students")
                .lean();
        }

        if (!teacher) {
            return NextResponse.json(
                { message: "Teacher not found" },
                { status: 404 },
            );
        }

        return NextResponse.json({
            message: "Teacher topic scope updated successfully",
            teacher,
        });
    } catch (error) {
        console.error("Error updating teacher topic scope:", error);
        return NextResponse.json(
            { message: "Failed to update teacher topic scope" },
            { status: 500 },
        );
    }
}
