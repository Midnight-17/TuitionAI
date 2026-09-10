import mongoose, { Schema } from "mongoose";

const QuestionsSchema = new Schema(
    {
        question_number: {
            type: Number,
            required: true,
        },

        page: {
            type: [Number],
            default: [],
        },

        topic: {
            type: String,
            required: true,
        },

        // Kept temporarily for questions imported before subtopics became an array.
        subtopic: {
            type: String,
            required: false,
        },

        subtopics: {
            type: [String],
            default: [],
        },

        answer_key_page: {
            type: [Number],
            default: [],
        },

        difficulty: {
            type: Number,
            min: 1,
            max: 5,
            required: true,
        },

        total_marks: {
            type: Number,
            required: true,
        },

        file: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "File",
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

const Question =
    mongoose.models.Question ||
    mongoose.model("Question", QuestionsSchema);

export default Question;
