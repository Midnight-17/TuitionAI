import mongoose, { Schema } from "mongoose"

const StudentScehma = new Schema({
    student_id: {
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String, 
        required: true,
    },
    teachers : [
        {
            teacher_id: {
                type: mongoose.Schema.Types.ObjectId,
                ref:"Teacher"
            },
            name:{
                type: String,
                required: true,
            },
            subject:{
                type: String,
                required: true
            },
        },
    ],
    subjects: [
        {
            name: {
                type: String,
                required: true,
            },
            topic_mastery:{
                type: Number,
                min:0,
                max:100,
                default: 0,
            },
        },
    ],
});


const Student = mongoose.models.Student || mongoose.model("Student", StudentScehma);

export default Student