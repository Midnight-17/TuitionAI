import { PDFDocument } from "pdf-lib";

export async function extractPDFPages(
    pdfBuffer: Buffer,
    pages: number[]
): Promise<Buffer> {
    const sourcePDF = await PDFDocument.load(pdfBuffer);
    const newPDF = await PDFDocument.create();

    for (const pageNumber of pages) {
        const pageIndex = pageNumber - 1;

        if (
            pageIndex < 0 ||
            pageIndex >= sourcePDF.getPageCount()
        ) {
            throw new Error(
                `PDF page ${pageNumber} does not exist`
            );
        }

        const [page] = await newPDF.copyPages(
            sourcePDF,
            [pageIndex]
        );

        newPDF.addPage(page);
    }

    const pdfBytes = await newPDF.save();

    return Buffer.from(pdfBytes);
}

export async function appendPDF(
    originalPDFBuffer: Buffer,
    pagesPDFBuffer: Buffer
): Promise<Buffer> {
    const originalPDF =
        await PDFDocument.load(originalPDFBuffer);

    const pagesPDF =
        await PDFDocument.load(pagesPDFBuffer);

    const copiedPages = await originalPDF.copyPages(
        pagesPDF,
        pagesPDF.getPageIndices()
    );

    for (const page of copiedPages) {
        originalPDF.addPage(page);
    }

    const pdfBytes = await originalPDF.save();

    return Buffer.from(pdfBytes);
}