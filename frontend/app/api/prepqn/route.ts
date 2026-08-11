import { GoogleGenAI } from "@google/genai";
import { pdfToImages } from "../../../lib/pdfToImages";
import { cropQuestion } from "../../../lib/cropQuestions";
import path from "path"
import { Recursive } from "next/font/google";
import { mkdir, writeFile } from "fs/promises";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

export async function POST(request: Request){
    

    const formData = await request.formData()
    const file = formData.get("file") as File

    console.log("File received", file.name)

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadssDir = path.join(process.cwd(), "uploads")
    await mkdir(uploadssDir, {
      recursive: true
    })

    const pdfPath = path.join(
      uploadssDir,
      file.name
    )

    await writeFile(pdfPath, buffer)
    const imagePaths = await pdfToImages(pdfPath);
    console.log("images`:", imagePaths)


    const interaction = await ai.interactions.create({

        model: "gemini-3.6-flash",

        input: [
          {
            type:"text",
            text: 
            `
                        You are analysing an exam paper PDF.

            Your task:
            Identify the location of every question.

            Important:
            - A question may span multiple pages.
            - Do NOT force every question into one page.
            - If a question continues onto another page, create another section.
            - Preserve the order of questions.

            Return ONLY valid JSON.

            Format:

            [
            {
            "question":"Question 1",

            "sections":[

                {
                    "page":1,
                    "top_percentage":10,
                    "bottom_percentage":80
                }

            ]
            },


            {
            "question":"Question 2",

            "sections":[

                {
                    "page":1,
                    "top_percentage":85,
                    "bottom_percentage":100
                },

                {
                    "page":2,
                    "top_percentage":0,
                    "bottom_percentage":40
                }

            ]
            }
            ]


            Rules:

            - Page top is 0%.
            - Page bottom is 100%.
            - Keep full page width.
            - Only estimate vertical position.
            - If a question begins on one page and ends on another, split it into multiple sections.
            - Do not include explanations.
                        
            `
          },
          {
            type:"document",
            data: buffer.toString("base64"),
            mime_type:"application/pdf"


          }
        ]

        });

    const output = interaction.output_text!
    .replace(/^```json\s*/, "")
    .replace(/\s*```$/, "");

    console.log(output);
    const questions = JSON.parse(
      output
    );

    const croppedPaths = await cropQuestion(
      questions, 
      imagePaths
    )

    console.log("Cropped", croppedPaths)

    return Response.json({
       message: "Success",
       result: croppedPaths
    }
) 

} 