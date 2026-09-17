import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import Assignment from "@/app/models/Assignment";
import Attempt from "@/app/models/Attempt";
import Submission from "@/app/models/Submissions";
import Student from "@/app/models/Student";
import { updateMasteryFromAssignment } from "@/lib/mastery";
import { getStudyDay } from "@/lib/studyDate";

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

        const student = await Student.findById(assignment.student);

        if (student) {
            const completionDate = getStudyDay();

            if (student.streak_year !== completionDate.year) {
                student.year_streak = [];
                student.monthly_streak = [];
                student.streak_year = completionDate.year;
                student.streak_month = completionDate.month;
            } else if (student.streak_month !== completionDate.month) {
                student.monthly_streak = [];
                student.streak_month = completionDate.month;
            }

            if (!student.year_streak.includes(completionDate.dayOfYear)) {
                student.year_streak.push(completionDate.dayOfYear);
            }

            if (!student.monthly_streak.includes(completionDate.dayOfMonth)) {
                student.monthly_streak.push(completionDate.dayOfMonth);
            }

            await student.save();
        }

        return NextResponse.json({ message: "Assignment finalized successfully", assignment, submission });
    } catch (error) {
        console.error("Error finalizing assignment:", error);
        return NextResponse.json({ message: "Failed to finalize assignment" }, { status: 500 });
    }
}
