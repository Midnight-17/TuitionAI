import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Student from "@/app/models/Student";

export async function POST(request: Request) {
    try {
        await connectDB();

        const body = await request.json();

        const {
            student_id,
            subject,
            topic,
            subtopic,
            mastery,
        } = body;

        if (
            !student_id ||
            !subject ||
            !topic ||
            !subtopic ||
            mastery === undefined
        ) {
            return NextResponse.json(
                {
                    message:
                        "student_id, subject, topic, subtopic and mastery are required",
                },
                { status: 400 }
            );
        }

        if (mastery < 0 || mastery > 100) {
            return NextResponse.json(
                {
                    message: "Mastery must be between 0 and 100",
                },
                { status: 400 }
            );
        }

        const student = await Student.findOne({ student_id });

        if (!student) {
            return NextResponse.json(
                {
                    message: "Student not found",
                },
                { status: 404 }
            );
        }

        let subjectData = student.subjects.find(
            (item: any) => item.name === subject
        );

        if (!subjectData) {
            student.subjects.push({
                name: subject,
                topics: [],
            });

            subjectData =
                student.subjects[student.subjects.length - 1];
        }

        let topicData = subjectData.topics.find(
            (item: any) => item.name === topic
        );

        if (!topicData) {
            subjectData.topics.push({
                name: topic,
                subtopics: [],
            });

            topicData =
                subjectData.topics[subjectData.topics.length - 1];
        }

        let subtopicData = topicData.subtopics.find(
            (item: any) => item.name === subtopic
        );

        if (!subtopicData) {
            topicData.subtopics.push({
                name: subtopic,
                mastery,
            });
        } else {
            subtopicData.mastery = mastery;
        }

        await student.save();

        return NextResponse.json({
            message: "Mastery updated successfully",
            student: student,
        });
    } catch (error) {
        console.error("Error updating mastery:", error);

        return NextResponse.json(
            {
                message: "Failed to update mastery",
                error: String(error),
            },
            { status: 500 }
        );
    }
}

