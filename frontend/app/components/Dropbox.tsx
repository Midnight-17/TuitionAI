 "use client"

import { useState } from "react"

 
 
 
 export default function DropBox(){
    const [file, setFile] = useState<File | null>(null)
    const [fileUrl, setFileUrl] = useState<string | null>(null)
  return(
  <div className="DropBox">
    <label className="label">Upload your file</label>
  <input
  type="file"
  accept=".pdf"
  className="fileInput"
  onChange={(e) => {
        const uploadedfile = e.target.files?.[0]
        if (uploadedfile){
        setFileUrl( URL.createObjectURL(uploadedfile))
        setFile(uploadedfile)
        }
}}
  />
  {file && (
    <div>
        <p>Uploaded File:</p>
        <p>{file.name}</p>
        <iframe
            src={fileUrl || ""}
            width ="600"
            height="500"
        />

    </div>
  )}
  
  
  </div>
)}