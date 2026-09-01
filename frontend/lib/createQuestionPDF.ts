import { PDFDocument } from "pdf-lib";
import mongoose from "mongoose";
import { downloadPDF } from "@/lib/gridfs";

type QuestionForPDF = {
    pdf_id: mongoose.Types.ObjectId;
    page: number[];
};

export async function createQuestionPDF(
    questions: QuestionForPDF[]
): Promise<Buffer> {
    const outputPDF = await PDFDocument.create();

    // Cache PDFs so that if multiple questions
    // come from the same file, we only download it once.
    const pdfCache = new Map<string, Buffer>();

    for (const question of questions) {
        const fileId = question.pdf_id.toString();

        let sourceBuffer = pdfCache.get(fileId);

        if (!sourceBuffer) {
            sourceBuffer = await downloadPDF(
                question.pdf_id
            );

            pdfCache.set(fileId, sourceBuffer);
        }

        const sourcePDF = await PDFDocument.load(
            sourceBuffer
        );

        for (const pageNumber of question.page) {
            const pageIndex = pageNumber - 1;

            if (
                pageIndex < 0 ||
                pageIndex >= sourcePDF.getPageCount()
            ) {
                throw new Error(
                    `Page ${pageNumber} does not exist in PDF for question`
                );
            }

            const [page] = await outputPDF.copyPages(
                sourcePDF,
                [pageIndex]
            );

            outputPDF.addPage(page);
        }
    }

    const pdfBytes = await outputPDF.save();

    return Buffer.from(pdfBytes);
}
