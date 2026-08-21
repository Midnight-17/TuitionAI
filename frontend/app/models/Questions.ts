import mongoose , {Schema} from "mongoose";

const QuestionsSchema = new Schema({
    question_number: {
        type: Number, 
        required: true, 
    },

    page: {
        type:[Number],
        default:{},

    },

    Topic:{
        type: String,
        required: true
    },

    answer_key:{
        type: [Number],
        default: []
    },

    difficulty:{
        type: Number,
        min:1,
        max: 5,
        required: true
    },

    total_marks:{
        type: Number,
        required: true,
    },

    file: {
        type: mongoose.Schema.Types.ObjectId,
        ref:"File",
        required: true
    },

})



const Questions = mongoose.models.Question || mongoose.model("Question", QuestionsSchema)