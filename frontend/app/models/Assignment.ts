import mongoose, { Schema } from "mongoose";

const AssignmentSchema = new Schema(
    {
        student: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Student",
            required: true,
        },

        teacher: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Teacher",
            required: true,
        },

        subject: {
            type: String,
            required: true,
        },

        name: {
            type: String,
            required: true,
        },

        questions: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Question",
                required: true,
            },
        ],

        type: {
            type: String,
            enum: ["diagnostic", "practice"],
            default: "practice",
            required: true,
        },

        status: {
            type: String,
            enum: ["assigned", "in_progress", "completed"],
            default: "assigned",
        },

        assigned_at: {
            type: Date,
            default: Date.now,
        },

        completed_at: {
            type: Date,
            default: null,
        },

        practice_date: {
            type: Date,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

const Assignment =
    mongoose.models.Assignment ||
    mongoose.model("Assignment", AssignmentSchema);

export default Assignment;
