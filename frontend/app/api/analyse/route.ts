import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(request: Request){
    

    const formData = await request.formData()
    const file = formData.get("file") as File

    console.log("File received", file.name)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)


    const interaction = await ai.interactions.create({

        model: "gemini-3.6-flash",

        input: [
          {
            type:"text",
            text: 
            `
            You are an Experienced Singpaore JC teacher. With thorough 
            and update knowledge of the Singapore A level and Marking

            Analyse every question in this paper

            For EACH question in the paper return:

            -question number 
            -topic 
            -difficulty
            -reason 

            Difficulty MUST be one of the 3:
            -easy 
            -Medium 
            -Hard

            Return ONLY VALID JSON

            Example:

            [{
            "question_number": 1,
            "topic": "kinematics",
            "difficulty":"Medium",
            "reason":"requires multiple SUAT equations"
            }]
            
            
            `
          },
          {
            type:"document",
            data: buffer.toString("base64"),
            mime_type:"application/pdf"


          }
        ]

        });



    console.log(interaction.output_text);

    return Response.json({
       message: "Success",
       result: interaction.output_text
    })
}