import mongoose, { Schema } from "mongoose";

const StudentSchema = new Schema(
    {
        student_id: {
            type: String,
            required: true,
            unique: true,
        },

        name: {
            type: String,
            required: true,
        },

        teachers: [
            {
                teacher: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Teacher",
                    required: true,
                },

                subject: {
                    type: String,
                    required: true,
                },
            },
        ],

        subjects: [
            {
                name: {
                    type: String,
                    required: true,
                },

                topics: [
                    {
                        name: {
                            type: String,
                            required: true,
                        },

                        subtopics: [
                            {
                                name: {
                                    type: String,
                                    required: true,
                                },

                                mastery: {
                                    type: Number,
                                    min: 0,
                                    max: 100,
                                    default: 0,
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        timestamps: true,
    }
);

const Student =
    mongoose.models.Student ||
    mongoose.model("Student", StudentSchema);

export default Student;