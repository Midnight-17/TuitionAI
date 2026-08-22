 "use client"

import { useState } from "react"

 
 
 
 export default function DropBox(){
    const [file, setFile] = useState<File | null>(null)
    const [fileUrl, setFileUrl] = useState<string | null>(null)
    const [msg, setMsg] = useState("")
    const[result, setResult]= useState<string | null>(null)


  async function analysePDF() {
    if(!file){
      return
    }
    const formData = new FormData()
    formData.append("file",file)

    const response = await fetch('/api/analyse',{
      method: "POST",
      body: formData
    })


    const data = await response.json()
    console.log(data)
    setMsg(data.message)
    setResult(data.result)

    
  }


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
        <button onClick={analysePDF}>
          Analyse PDF
        </button>
        <p>{result}</p>

    </div>
  )}
  
  
  </div>
)}