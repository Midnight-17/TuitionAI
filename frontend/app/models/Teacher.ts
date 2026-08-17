import mogoose, {Schema} from "mongoose"
import Student from "./Student"
import mongoose from "mongoose"

const TeacherSchema = new Schema({
    teacher_id:{
        type:String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
    },

    students:[{
        Student_id:{
            type: mongoose.Schema.Types.ObjectId,
            ref:"Student"
        },

        name: {
            type: String,
            required:true,
        },

        subject:{
            type: String,
            required: true
        }
    }],
})

const Teacher = 
mongoose.models.Teacher || mongoose.model("Teacher",TeacherSchema)

export default Teacher