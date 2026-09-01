import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Teacher from "@/app/models/Teacher";
import Student from "@/app/models/Student";
import Question from "@/app/models/Questions";
import Assignment from "@/app/models/Assignment";

export async function GET(request: Request) {
    try {
        await connectDB();
        const assignmentId = new URL(request.url).searchParams.get("assignment_id");
        if (!assignmentId) {
            return NextResponse.json({ message: "assignment_id is required" }, { status: 400 });
        }
        const assignment = await Assignment.findById(assignmentId).select("_id questions").lean();
        if (!assignment) return NextResponse.json({ message: "Assignment not found" }, { status: 404 });
        return NextResponse.json({ assignment });
    } catch (error) {
        return NextResponse.json({ message: "Failed to find assignment" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        await connectDB();

        const body = await request.json();

        const {
            student_id,
            teacher_id,
            subject,
            number_of_questions = 10,
        } = body;

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
        // 1. Find student
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
        // 2. Find the student's subject
        // --------------------------------

        const subjectData = student.subjects.find(
            (item: any) => item.name === subject
        );

        if (!subjectData) {
            return NextResponse.json(
                {
                    message: "Student has no mastery data for this subject",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 3. Find the weakest subtopics
        // --------------------------------

        const subtopics: {
            name: string;
            mastery: number;
        }[] = [];

        for (const topic of subjectData.topics) {
            for (const subtopic of topic.subtopics) {
                subtopics.push({
                    name: subtopic.name,
                    mastery: subtopic.mastery,
                });
            }
        }

        if (subtopics.length === 0) {
            return NextResponse.json(
                {
                    message: "Student has no subtopic mastery data",
                },
                { status: 400 }
            );
        }

        subtopics.sort((a, b) => a.mastery - b.mastery);

        // --------------------------------
        // 4. Find questions for weak areas
        // --------------------------------

        const selectedQuestions: Array<{
            _id: { toString(): string };
            difficulty: number;
        }> = [];

        for (const subtopic of subtopics) {
            if (selectedQuestions.length >= number_of_questions) {
                break;
            }

            const questions = await Question.find({
                topic: {
                    $in: subjectData.topics.map(
                        (topic: any) => topic.name
                    ),
                },
                subtopic: subtopic.name,
            });

            // --------------------------------
            // 5. Choose difficulty based on mastery
            // --------------------------------

            let targetDifficulty = 3;

            if (subtopic.mastery < 40) {
                targetDifficulty = 1;
            } else if (subtopic.mastery < 60) {
                targetDifficulty = 2;
            } else if (subtopic.mastery < 75) {
                targetDifficulty = 3;
            } else if (subtopic.mastery < 90) {
                targetDifficulty = 4;
            } else {
                targetDifficulty = 5;
            }

            // Sort questions by distance from target difficulty
            questions.sort(
                (a: any, b: any) =>
                    Math.abs(a.difficulty - targetDifficulty) -
                    Math.abs(b.difficulty - targetDifficulty)
            );

            for (const question of questions) {
                if (selectedQuestions.length >= number_of_questions) {
                    break;
                }

                const alreadySelected = selectedQuestions.some(
                    (selected) =>
                        selected._id.toString() ===
                        question._id.toString()
                );

                if (!alreadySelected) {
                    selectedQuestions.push(question);
                }
            }
        }

        // --------------------------------
        // 6. Make sure we found questions
        // --------------------------------

        if (selectedQuestions.length === 0) {
            return NextResponse.json(
                {
                    message:
                        "No suitable questions found for this student",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 7. Create Assignment
        // --------------------------------

        const assignment = await Assignment.create({
            student: student._id,
            teacher: teacher._id,
            subject,
            questions: selectedQuestions.map(
                (question) => question._id
            ),
        });

        // --------------------------------
        // 8. Return assignment
        // --------------------------------

        return NextResponse.json({
            message: "Adaptive assignment created successfully",
            assignment,
            questions: selectedQuestions,
        });
    } catch (error) {
        console.error("Error creating assignment:", error);

        return NextResponse.json(
            {
                message: "Failed to create assignment",
                error: String(error),
            },
            { status: 500 }
        );
    }
}
