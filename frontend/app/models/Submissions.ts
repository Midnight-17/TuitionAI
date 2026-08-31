import mongoose, { Schema } from "mongoose";

const SubmissionSchema = new Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
        },

        assignment: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Assignment",
            required: true,
        },

        submitted_pdf_id: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
        },

        marked_pdf_id: {
            type: mongoose.Schema.Types.ObjectId,
            default: null,
        },

        status: {
            type: String,
            enum: ["submitted", "processing", "completed", "failed"],
            default: "submitted",
        },

        submitted_at: {
            type: Date,
            default: Date.now,
        },

        completed_at: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Submission =
    mongoose.models.Submission ||
    mongoose.model("Submission", SubmissionSchema);

export default Submission;