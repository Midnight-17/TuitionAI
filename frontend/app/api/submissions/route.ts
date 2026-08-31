import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";

import Student from "@/app/models/Student";
import Assignment from "@/app/models/Assignment";
import Submission from "@/app/models/Submissions";

import { uploadPDF } from "@/lib/gridfs";

export async function POST(request: Request) {
    try {
        await connectDB();

        // --------------------------------
        // 1. Get submitted PDF
        // --------------------------------

        const formData = await request.formData();

        const student_id =
            formData.get("student_id") as string | null;

        const assignment_id =
            formData.get("assignment_id") as string | null;

        const file =
            formData.get("file") as File | null;

        // --------------------------------
        // 2. Validate input
        // --------------------------------

        if (!student_id || !assignment_id || !file) {
            return NextResponse.json(
                {
                    message:
                        "student_id, assignment_id and file are required",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 3. Make sure uploaded file is PDF
        // --------------------------------

        if (file.type !== "application/pdf") {
            return NextResponse.json(
                {
                    message: "Only PDF files are allowed",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 4. Find student
        // --------------------------------

        const student = await Student.findOne({
            student_id,
        });

        if (!student) {
            return NextResponse.json(
                {
                    message: "Student not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 5. Find assignment
        // --------------------------------

        const assignment =
            await Assignment.findById(assignment_id);

        if (!assignment) {
            return NextResponse.json(
                {
                    message: "Assignment not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 6. Make sure assignment belongs
        //    to this student
        // --------------------------------

        if (
            assignment.student.toString() !==
            student._id.toString()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Assignment does not belong to this student",
                },
                { status: 403 }
            );
        }

        // --------------------------------
        // 7. Convert PDF to Buffer
        // --------------------------------

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // --------------------------------
        // 8. Upload student's PDF
        //    to GridFS
        // --------------------------------

        const submittedPdfId =
            await uploadPDF(
                buffer,
                `submission-${assignment_id}-${file.name}`
            );

        // --------------------------------
        // 9. Create Submission
        // --------------------------------

        const submission =
            await Submission.create({
                student: student._id,
                assignment: assignment._id,
                submitted_pdf_id: submittedPdfId,
                status: "submitted",
            });

        // --------------------------------
        // 10. Return submission
        // --------------------------------

        return NextResponse.json(
            {
                message:
                    "Submission uploaded successfully",

                submission,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Error creating submission:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Failed to upload submission",
                error: String(error),
            },
            { status: 500 }
        );
    }
}