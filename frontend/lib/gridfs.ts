import mongoose from "mongoose";

export async function uploadPDF(
    buffer: Buffer,
    filename: string,
) {
    const db = mongoose.connection.db;

    if (!db) {
        throw new Error("Database not connected");
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: "pdfs",
    });

    return new Promise((resolve, reject) => {
        const uploadStream = bucket.openUploadStream(filename);

        uploadStream.on("finish", () => {
            resolve(uploadStream.id);
        });

        uploadStream.on("error", reject);

        uploadStream.end(buffer);
    });
}

export async function downloadPDF(
    pdfId: mongoose.Types.ObjectId
): Promise<Buffer> {
    const db = mongoose.connection.db;

    if (!db) {
        throw new Error("Database not connected");
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: "pdfs",
    });

    return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];

        const downloadStream = bucket.openDownloadStream(pdfId);

        downloadStream.on("data", (chunk) => {
            chunks.push(Buffer.from(chunk));
        });

        downloadStream.on("end", () => {
            resolve(Buffer.concat(chunks));
        });

        downloadStream.on("error", reject);
    });
}