import { GoogleGenAI } from "@google/genai";
import { connectDB } from "@/lib/mongodb";
import FileModel from "@/app/models/Files";
import Question from "@/app/models/Questions";
import { uploadPDF } from "@/lib/gridfs";
import { h2PhysicsTopics } from "@/app/data/h2PhysicsTopics";

const validTopicNames = new Set(
    h2PhysicsTopics.map((topic) => topic.topic),
);

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(request: Request) {
    try {
        await connectDB();

        // --------------------------------
        // 1. Get uploaded PDF
        // --------------------------------

        const formData = await request.formData();

        const file = formData.get("file") as File | null;

        if (!file) {
            return Response.json(
                { message: "No file uploaded" },
                { status: 400 }
            );
        };

        console.log("File received:", file.name);

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const pdfId = await uploadPDF(
                buffer,
                file.name,
            );

        // --------------------------------
        // 2. Ask Gemini to analyse paper
        // --------------------------------

        const interaction = await ai.interactions.create({
            model: "gemini-3.6-flash",

            input: [
                {
                    type: "text",
                    text: `
You are an experienced Singapore Junior College A-Level Physics teacher.

You are analysing an A-Level Physics examination paper or practice paper.

The paper may contain:
- Multiple sections
- Multiple questions
- Sub-questions such as (a), (b), (c)
- Questions spanning multiple pages
- Multiple questions on the same page
- An answer key / marking scheme attached after the question paper

Your job is to analyse EVERY question in the question paper.

IMPORTANT:
The most important part of your analysis is the DIFFICULTY rating.

Judge difficulty as an experienced Singapore A-Level Physics teacher would.

Difficulty should NOT simply be based on:
- Number of equations used
- Number of marks
- Length of the question

Instead consider:
- How difficult the underlying physics concept is
- Whether the concept is commonly tested or unusual
- How many reasoning steps are required
- Whether the student must combine multiple concepts
- Whether the question requires interpretation rather than direct substitution
- Whether there are common traps or misconceptions
- How difficult it would be for a typical Singapore JC A-Level Physics student
- Whether the question requires significant mathematical manipulation
- Whether the question contains unfamiliar or non-standard applications of familiar concepts

Use this 1–5 difficulty scale:

1 = Very easy
2 = Easy
3 = Moderate
4 = Difficult
5 = Very difficult

TOPIC:
Identify the main Physics topic being tested.

PAGES:
For each question, identify ALL pages on which the question appears.

ANSWER KEY PAGE:
Identify the page(s) where the answer or marking scheme for that question appears.

TOTAL MARKS:
Determine the total marks awarded for the question.

QUESTION NUMBER:
Use the actual question number from the paper.

SUBTOPICS:
Identify ALL specific subtopics within the main Physics topic being tested.
A question may test more than one subtopic.
Return every relevant subtopic in a "subtopics" array.

For example:
Topic: Motion and Forces
Subtopics: ["Kinematics", "Laws of motion"]

Topic: Motion and Forces
Subtopics: ["Forces and moments"]

Topic: Superposition
Subtopics: ["Superposition"]

Topic: Electric Fields
Subtopics: ["Coulomb's law", "Electric field strength"]

IMPORTANT JSON RULES:

Return ONLY valid JSON.

Do NOT use markdown.
Do NOT use code fences.
Do NOT include explanations outside the JSON.
Do NOT include comments.

Return exactly this structure:

[
    {
    "question_number": 1,
    "page": [1],
    "topic": "Motion and Forces",
    "subtopics": ["Kinematics", "Uniformly accelerated linear motion"],
    "answer_key_page": [15],
    "difficulty": 2,
    "total_marks": 5
    }
]

Every question MUST contain:
- question_number
- page
- topic
- subtopics
- answer_key_page
- difficulty
- total_marks

"page" MUST always be an array of numbers.

"answer_key_page" MUST always be an array of numbers.

"difficulty" MUST always be an integer from 1 to 5.

"total_marks" MUST always be a number.

Analyse EVERY question in the paper.
`,
                },
                {
                    type: "document",
                    data: buffer.toString("base64"),
                    mime_type: "application/pdf",
                },
            ],
        });

        // --------------------------------
        // 3. Get Gemini output
        // --------------------------------

        const output = interaction.output_text;

        console.log("Gemini output:");
        console.log(output);

        // --------------------------------
        // 4. Convert Gemini JSON string
        //    into an actual JavaScript array
        // --------------------------------

        let questions;

        try {
            questions = JSON.parse(output!);
        } catch (error) {
            console.error("Gemini returned invalid JSON:", output);

            return Response.json(
                {
                    message: "Gemini returned invalid JSON",
                    result: output,
                },
                { status: 500 }
            );
        }

        if (
            !Array.isArray(questions) ||
            questions.some(
                (question) =>
                    typeof question.topic !== "string" ||
                    !validTopicNames.has(question.topic) ||
                    !Array.isArray(question.subtopics) ||
                    question.subtopics.length === 0 ||
                    question.subtopics.some(
                        (subtopic: unknown) =>
                            typeof subtopic !== "string" ||
                            subtopic.trim() === "",
                    ),
            )
        ) {
            return Response.json(
                {
                    message:
                        "Each question must have a valid H2 Physics topic and at least one subtopic",
                },
                { status: 400 },
            );
        }

        // --------------------------------
        // 6. Create the File document
        // --------------------------------

        const newFile = await FileModel.create({
            filename: file.name,
            subject: "Physics",
            pdf_id: pdfId,
            questions: [],
        });

        // --------------------------------
        // 7. Create Question documents
        // --------------------------------

        const questionDocuments = [];

        for (const question of questions) {
            const newQuestion = await Question.create({
                question_number: question.question_number,
                page: question.page,
                topic: question.topic,
                subtopics: [...new Set(question.subtopics)],
                answer_key_page: question.answer_key_page,
                difficulty: question.difficulty,
                total_marks: question.total_marks,

                // Link question → file
                file: newFile._id,
            });

            questionDocuments.push(newQuestion._id);
        }

        // --------------------------------
        // 8. Link all questions back to File
        // --------------------------------

        newFile.questions = questionDocuments;

        await newFile.save();

        // --------------------------------
        // 9. Return result
        // --------------------------------

        return Response.json({
            message: "PDF analysed and saved successfully",

            file: newFile,

            questions: questionDocuments,

            result: questions,
        });

    } catch (error) {
        console.error("Error analysing PDF:", error);

        return Response.json(
            {
                message: "Failed to analyse PDF",
                error: String(error),
            },
            { status: 500 }
        );
    }
}
