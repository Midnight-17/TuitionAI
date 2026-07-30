import DropBox from "./components/Dropbox"
import "./globals.css"


export default function Home() {
  return (
    <main className="container">
      <MainHeading/>
      <DropBox />
    </main>
  )
}

function MainHeading(){
  return(
  <>
  <h1 
  className="heading"
  >Nishanths Page </h1>
</>
)}

