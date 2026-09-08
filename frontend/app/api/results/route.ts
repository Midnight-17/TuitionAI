import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Assignment from "@/app/models/Assignment";
import Attempt from "@/app/models/Attempt";
import Submission from "@/app/models/Submissions";
import Student from "@/app/models/Student";

export async function GET(request: Request) {
    try {
        await connectDB();
        const params = new URL(request.url).searchParams;
        const assignmentId = params.get("assignment_id");
        const studentId = params.get("student_id");

        if (!assignmentId && !studentId) {
            return NextResponse.json({ message: "assignment_id or student_id is required" }, { status: 400 });
        }

        let assignmentFilter = {};
        if (assignmentId) assignmentFilter = { _id: assignmentId };
        else {
            const student = await Student.findOne({ student_id: studentId }).select("_id").lean();
            if (!student) return NextResponse.json({ message: "Student not found" }, { status: 404 });
            assignmentFilter = { student: student._id };
        }

        const assignments = await Assignment.find(assignmentFilter)
            .select("_id subject type status questions assigned_at completed_at")
            .sort({ createdAt: -1 })
            .lean();
        const assignmentIds = assignments.map((assignment) => assignment._id);
        const [attempts, submissions] = await Promise.all([
            Attempt.find({ assignment: { $in: assignmentIds } })
                .select("assignment question type is_correct marks_awarded misconception ai_feedback attempted_at")
                .lean(),
            Submission.find({ assignment: { $in: assignmentIds } })
                .select("assignment status submitted_at completed_at")
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        return NextResponse.json({ assignments, attempts, submissions });
    } catch (error) {
        console.error("Error retrieving results:", error);
        return NextResponse.json({ message: "Failed to retrieve results" }, { status: 500 });
    }
}
