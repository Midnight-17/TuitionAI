import sharp from "sharp";
import path from "path";
import { mkdir } from "fs/promises"
import { getImageInfo } from "./getImageSize"



export type QuestionSection = {
    page: number;
    top_percentage: number;
    bottom_percentage: number;
};

export type Question = {
    question_number: number;
    sections: QuestionSection[]
};

export async function cropQuestion(
    questions: Question[],
    imagePaths: string[]
){
    const outputDir = path.join(process.cwd(),"cropped");

    await mkdir(outputDir, {recursive: true});

    const croppedPaths: string[] = [];

    for (let qIndex = 0; qIndex < questions.length; qIndex++){
        const question = questions[qIndex]

        for (let sIndex = 0; sIndex < question.sections.length; sIndex++){
            const section = question.sections[sIndex]

            const imagePath = imagePaths[section.page -1 ]

            const metadata = await sharp(imagePath).metadata()

            const height = metadata.height!;

            const width = metadata.width!;


            const top = Math.round(
                (section.top_percentage/100)*height
            )
            const bottom = Math.round(
                (section.bottom_percentage/100)* height
            )

            const cropHeight = bottom - top
            
            const outputPath = path.join(
                outputDir,
                `Question${qIndex + 1}_section${sIndex + 1}.png`
            );

            await sharp(imagePath)
                .extract({
                left: 0,
                top,
                width,
                height: cropHeight,
            }).toFile(outputPath);


            croppedPaths.push(outputPath)

        };
    };
    return croppedPaths;
}


