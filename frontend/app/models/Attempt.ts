import mongoose, { Schema } from "mongoose";

const AttemptSchema = new Schema(
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

        submission: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Submission",
            required: true,
        },

        question: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Question",
            required: true,
        },

        type: {
            type: String,
            enum: ["diagnostic", "practice"],
            default: "practice",
            required: true,
        },

        is_correct: {
            type: Boolean,
            required: true,
        },

        marks_awarded: {
            type: Number,
            required: true,
            min: 0,
        },

        misconception: {
            type: String,
            default: null,
        },

        ai_feedback: {
            type: String,
            default: null,
        },

        attempted_at: {
            type: Date,
            default: Date.now,
        },
    },
    {
        timestamps: true,
    }
);

const Attempt =
    mongoose.models.Attempt ||
    mongoose.model("Attempt", AttemptSchema);

export default Attempt;