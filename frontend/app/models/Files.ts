import mongoose, { Schema } from "mongoose";

const FileSchema = new Schema(
    {
        filename: {
            type: String,
            required: true,
        },

         subject: {
            type: String,
            required: true,
        },

        paper_id: {
            type: String,
            required: true,
            index: true,
        },

        file_type: {
            type: String,
            enum: ["question", "answer"],
            required: true,
            default: "question",
        },

        paired_file: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "File",
            default: null,
        },

        questions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Question",
            },
        ],

        pdf_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const File =
    mongoose.models.File ||
    mongoose.model("File", FileSchema);

export default File;
