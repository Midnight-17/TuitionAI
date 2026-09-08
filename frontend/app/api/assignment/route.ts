import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Teacher from "@/app/models/Teacher";
import Student from "@/app/models/Student";
import Question from "@/app/models/Questions";
import Assignment from "@/app/models/Assignment";
import Attempt from "@/app/models/Attempt";

export async function GET(request: Request) {
    try {
        await connectDB();
        const assignmentId = new URL(request.url).searchParams.get("assignment_id");
        if (!assignmentId) {
            return NextResponse.json({ message: "assignment_id is required" }, { status: 400 });
        }
        const assignment = await Assignment.findById(assignmentId)
            .select("_id student teacher subject name questions type status assigned_at completed_at")
            .lean();
        if (!assignment) return NextResponse.json({ message: "Assignment not found" }, { status: 404 });
        const attempts = await Attempt.find({ assignment: assignmentId })
            .select("question marks_awarded is_correct misconception ai_feedback attempted_at")
            .lean();
        return NextResponse.json({
            assignment,
            progress: { completed: attempts.length, total: assignment.questions.length },
            attempts,
        });
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
            number_of_questions = 1,
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

        if (!Number.isInteger(number_of_questions) || number_of_questions !== 1) {
            return NextResponse.json({ message: "Daily practice assignments contain exactly one OEQ" }, { status: 400 });
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

        const previousAssignment = await Assignment.findOne({
            student: student._id,
            subject,
            type: "practice",
        }).sort({ createdAt: -1 }).lean();
        const previousQuestion = previousAssignment?.questions.at(-1);
        const previousQuestionData = previousQuestion
            ? await Question.findById(previousQuestion).select("topic").lean()
            : null;

        // --------------------------------
        // 4. Find questions for weak areas
        // --------------------------------

        const selectedQuestions: Array<{
            _id: { toString(): string };
            difficulty: number;
            topic: string;
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

                if (!alreadySelected && question._id.toString() !== previousQuestion?.toString() && question.topic !== previousQuestionData?.topic) {
                    selectedQuestions.push(question);
                }
            }
        }

        if (selectedQuestions.length === 0 && previousQuestionData) {
            const fallback = await Question.findOne({
                topic: { $in: subjectData.topics.map((topic: any) => topic.name) },
                _id: { $ne: previousQuestion },
            }).sort({ difficulty: 1 });
            if (fallback) selectedQuestions.push(fallback);
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

        const practiceAssignments = await Assignment.find({ student: student._id, type: "practice", subject }).select("questions").lean();
        const practiceQuestionIds = practiceAssignments.flatMap((item) => item.questions);
        const practiceQuestions = await Question.find({ _id: { $in: practiceQuestionIds } }).select("topic").lean();
        const topicCount = practiceQuestions.filter((question) => question.topic === selectedQuestions[0].topic).length;

        const assignment = await Assignment.create({
            student: student._id,
            teacher: teacher._id,
            subject,
            name: `${student.name}_${selectedQuestions[0].topic.replace(/\s+/g, "_")}_${topicCount + 1}`,
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
