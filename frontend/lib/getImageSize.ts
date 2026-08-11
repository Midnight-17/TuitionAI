import sharp from "sharp"

export async function getImageInfo(imagePath: string){
    const metadata = await sharp(imagePath).metadata()

    return {
        width: metadata.width!,
        height: metadata.height!

    }
}