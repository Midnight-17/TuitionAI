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