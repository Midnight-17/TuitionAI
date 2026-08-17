import { connectDB } from "../../../lib/mongodb";
import File from "../../models/Files";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        await connectDB();

        const newFile = await File.create({
            filename: "physics_test.pdf",
            questions: [1, 2, 3, 4, 5],
        });

        return NextResponse.json(newFile);

    } catch (error) {
        console.error(error);

        return NextResponse.json(
            { error: "Something went wrong" },
            { status: 500 }
        );
    }
}