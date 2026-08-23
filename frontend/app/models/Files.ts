import mongoose, {Schema, Document} from "mongoose";

// define the model for file

const FileSchema = new Schema({
    filename: {
        type: String,
        required: true,

    },

    questions: [
    {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Question",
    }],

    pdf_id:{
        type: mongoose.Schema.Types.ObjectId,
        required: true,
    }


});


const File = mongoose.models.File || mongoose.model("File", FileSchema)
export default File;