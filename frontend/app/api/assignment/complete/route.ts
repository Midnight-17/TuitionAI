import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Assignment from "@/app/models/Assignment";
import Attempt from "@/app/models/Attempt";
import Submission from "@/app/models/Submissions";
import { updateMasteryFromAssignment } from "@/lib/mastery";

export async function POST(request: Request) {
    try {
        await connectDB();
        const { assignment_id, submission_id } = await request.json();
        if (!assignment_id || !submission_id) {
            return NextResponse.json({ message: "assignment_id and submission_id are required" }, { status: 400 });
        }

        const assignment = await Assignment.findById(assignment_id);
        const submission = await Submission.findById(submission_id);
        if (!assignment || !submission || submission.assignment.toString() !== assignment._id.toString()) {
            return NextResponse.json({ message: "Assignment or submission not found" }, { status: 404 });
        }

        const attemptCount = await Attempt.countDocuments({ assignment: assignment._id });
        if (attemptCount < assignment.questions.length) {
            return NextResponse.json({ message: "Assignment is not fully marked", completed: attemptCount, total: assignment.questions.length }, { status: 409 });
        }

        assignment.status = "completed";
        assignment.completed_at = assignment.completed_at ?? new Date();
        submission.status = "completed";
        submission.completed_at = submission.completed_at ?? new Date();
        await Promise.all([assignment.save(), submission.save()]);
        await updateMasteryFromAssignment(assignment._id.toString(), assignment.student.toString());

        return NextResponse.json({ message: "Assignment finalized successfully", assignment, submission });
    } catch (error) {
        console.error("Error finalizing assignment:", error);
        return NextResponse.json({ message: "Failed to finalize assignment" }, { status: 500 });
    }
}
