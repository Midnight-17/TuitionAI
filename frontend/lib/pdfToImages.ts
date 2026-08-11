import {mkdir} from "fs/promises"
import path from "path"
import { fromPath } from "pdf2pic"

export async function pdfToImages(pdfPath: string){
    const outputDir = path.join(process.cwd(),"pages")

    await mkdir(outputDir, {recursive:true});

    const converter = fromPath(pdfPath, {
        density: 300,

        saveFilename:"page",

        savePath: outputDir,

        format: "png",

    });
    let page = 1;

    const imagePaths: string[]= []
    while(true){
        try {
            console.log("Converting Page", page)
           
            const result = await converter(page);

            console.log("converted", result.page)
            

            imagePaths.push(result.path!);

            page++;

        }catch(error){
            console.error("PDF conversion failed", error);
            break;
        }

        
    };
 return imagePaths;

}