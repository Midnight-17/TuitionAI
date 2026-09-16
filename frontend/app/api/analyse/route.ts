import { GoogleGenAI } from "@google/genai";
import type { Types } from "mongoose";
import { PDFDocument } from "pdf-lib";
import { connectDB } from "@/lib/mongodb";
import FileModel from "@/app/models/Files";
import Question from "@/app/models/Questions";
import { uploadPDF } from "@/lib/gridfs";
import {
    getAnalysisPrompt,
    paperAnalysisSchema,
    parsePaperAnalysis,
    PaperAnalysisError,
    type AnalysedQuestion,
} from "@/lib/paperAnalysis";
import {
    buildPaperPairs,
    type PaperFilePair,
    type PaperPairingManifest,
} from "@/lib/paperFiles";

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY!,
});

type CreatedQuestion = { _id: Types.ObjectId };

async function analysePaper(pair: PaperFilePair) {
    const questionBuffer = Buffer.from(await pair.questionFile.arrayBuffer());
    const answerBuffer = pair.answerFile
        ? Buffer.from(await pair.answerFile.arrayBuffer())
        : null;
    const pages = {
        question: (await PDFDocument.load(questionBuffer)).getPageCount(),
        answer: answerBuffer ? (await PDFDocument.load(answerBuffer)).getPageCount() : null,
    };

    const input = [
        {
            type: "text" as const,
            text: getAnalysisPrompt(pages),
        },
        {
            type: "document" as const,
            data: questionBuffer.toString("base64"),
            mime_type: "application/pdf",
        },
    ];

    if (answerBuffer) {
        input.push({
            type: "document" as const,
            data: answerBuffer.toString("base64"),
            mime_type: "application/pdf",
        });
    }

    // One bounded retry for an invalid model response; no uploads or database writes yet.
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        const interaction = await ai.interactions.create({
            model: "gemini-3.6-flash",
            input,
            response_format: {
                type: "text",
                mime_type: "application/json",
                schema: paperAnalysisSchema,
            },
            generation_config: { max_output_tokens: 20000 },
        });

        try {
            if (interaction.status !== "completed") {
                throw new PaperAnalysisError(pair.questionFile.name, [
                    `The analysis did not finish (status: ${interaction.status})`,
                ]);
            }
            const questions = parsePaperAnalysis(interaction.output_text ?? "", pair.questionFile.name, pages);
            return { pair, questionBuffer, answerBuffer, questions };
        } catch (error) {
            if (!(error instanceof PaperAnalysisError)) throw error;
            console.warn("Paper analysis validation failed", {
                filename: pair.questionFile.name,
                interactionId: interaction.id,
                attempt,
                issues: error.issues,
            });
            if (attempt === 2) throw error;
            input.push({
                type: "text",
                text: `The previous analysis failed validation:\n${error.issues.join("\n")}\nReanalyse the documents and return the complete corrected question array, including all valid questions.`,
            });
        }
    }
    throw new Error("Paper analysis attempts exhausted");
}

async function savePaper({ pair, questionBuffer, answerBuffer, questions }: {
    pair: PaperFilePair;
    questionBuffer: Buffer;
    answerBuffer: Buffer | null;
    questions: AnalysedQuestion[];
}) {
    const questionPdfId = await uploadPDF(questionBuffer, pair.questionFile.name);
    const answerPdfId = answerBuffer && pair.answerFile
        ? await uploadPDF(answerBuffer, pair.answerFile.name)
        : null;

    const questionFile = await FileModel.create({
        filename: pair.questionFile.name,
        subject: "Physics",
        paper_id: pair.paperId,
        file_type: "question",
        pdf_id: questionPdfId,
        questions: [],
    });

    const answerFile = pair.answerFile && answerPdfId
        ? await FileModel.create({
            filename: pair.answerFile.name,
            subject: "Physics",
            paper_id: pair.paperId,
            file_type: "answer",
            pdf_id: answerPdfId,
            questions: [],
        })
        : null;

    if (answerFile) {
        questionFile.paired_file = answerFile._id;
        answerFile.paired_file = questionFile._id;
        await Promise.all([questionFile.save(), answerFile.save()]);
    }

    const questionDocuments = await Question.create(
        questions.map((question) => ({
            question_number: question.question_number,
            page: question.page,
            topic: question.topic,
            subtopics: [...new Set(question.subtopics)],
            answer_key_page: question.answer_key_page,
            difficulty: question.difficulty,
            total_marks: question.total_marks,
            file: questionFile._id,
            answer_key_file: answerFile?._id ?? null,
        })),
    ) as CreatedQuestion[];

    questionFile.questions = questionDocuments.map((question) => question._id);
    await questionFile.save();

    return {
        paper_id: pair.paperId,
        question_file: questionFile,
        answer_file: answerFile,
        questions: questionDocuments,
    };
}

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const uploadedFiles = formData
            .getAll("files")
            .filter((value): value is File => value instanceof File);
        const legacyFile = formData.get("file");
        const files = uploadedFiles.length > 0
            ? uploadedFiles
            : legacyFile instanceof File
                ? [legacyFile]
                : [];

        if (files.length === 0) {
            return Response.json({ message: "No PDF files uploaded" }, { status: 400 });
        }

        const rawManifest = formData.get("pairing_manifest");
        if (typeof rawManifest !== "string") {
            return Response.json(
                { message: "Confirm the AI filename matches before analysing" },
                { status: 400 },
            );
        }

        let manifest: PaperPairingManifest;
        try {
            manifest = JSON.parse(rawManifest) as PaperPairingManifest;
        } catch {
            return Response.json({ message: "Invalid file-pairing manifest" }, { status: 400 });
        }

        if (!manifest || !Array.isArray(manifest.groups) || !Array.isArray(manifest.unmatched)) {
            return Response.json({ message: "Invalid file-pairing manifest" }, { status: 400 });
        }

        const { pairs, unmatched } = buildPaperPairs(files, manifest);
        if (pairs.length === 0) {
            return Response.json(
                { message: "No validated question-paper pairs were provided", unmatched },
                { status: 400 },
            );
        }

        // Validate the entire batch before persisting. A later analysis failure must
        // not leave earlier papers saved and duplicate them when the batch is retried.
        const analyses = [];
        for (const pair of pairs) {
            analyses.push(await analysePaper(pair));
        }

        await connectDB();
        const results = [];
        for (const analysis of analyses) {
            results.push(await savePaper(analysis));
        }

        return Response.json({
            message: `${results.length} paper${results.length === 1 ? "" : "s"} analysed and saved successfully`,
            results,
            unmatched,
        });
    } catch (error) {
        if (error instanceof PaperAnalysisError) {
            return Response.json({
                message: `${error.message}. No papers from this batch were saved. Please retry analysis.`,
                filename: error.filename,
                issues: error.issues,
            }, { status: 502 });
        }
        console.error("Error analysing uploaded papers:", error);
        return Response.json(
            { message: "Failed to analyse uploaded papers", error: String(error) },
            { status: 500 },
        );
    }
}
