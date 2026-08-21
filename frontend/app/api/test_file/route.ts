import { connectDB } from "../../../lib/mongodb";
import Student from "../../models/Student";
import Teacher from "../../models/Teacher";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        await connectDB();

        // Create teacher
        const newTeacher = await Teacher.create({
            teacher_id: "T001",
            name: "Mr Tan",
            students: [],
        });

        // Create student
        const newStudent = await Student.create({
            student_id: "S001",
            name: "John",
            teachers: [
                {
                    teacher_id: newTeacher._id,
                    name: newTeacher.name,
                    subject: "Physics",
                },
            ],
            subjects: [
                {
                    name: "Physics",
                    topic_mastery: 75,
                },
            ],
        });

        // Add student to teacher
        newTeacher.students.push({
            student_id: newStudent._id,
            name: newStudent.name,
            subject: "Physics",
        });

        await newTeacher.save();

        return NextResponse.json({
            teacher: newTeacher,
            student: newStudent,
        });
        

    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        );
    }
}