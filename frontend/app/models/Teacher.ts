import mongoose, { Schema } from "mongoose";

const TeacherSchema = new Schema(
    {
        teacher_id: {
            type: String,
            required: true,
            unique: true,
        },

        name: {
            type: String,
            required: true,
        },

        students: [
            {
                student: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Student",
                    required: true,
                },

                subject: {
                    type: String,
                    required: true,
                },
            },
        ],
    },
    {
        timestamps: true,
    }
);

const Teacher =
    mongoose.models.Teacher ||
    mongoose.model("Teacher", TeacherSchema);

export default Teacher;

