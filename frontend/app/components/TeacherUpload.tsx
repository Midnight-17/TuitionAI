"use client"

import { useEffect, useRef, useState } from "react"
import {
  buildPaperPairs,
  type PaperFilePair,
  type PaperPairingManifest,
  type UnmatchedPaperFile,
} from "@/lib/paperFiles"

export default function TeacherUpload() {
  const [teacherFiles, setTeacherFiles] = useState<File[]>([])
  const [teacherPairingManifest, setTeacherPairingManifest] =
    useState<PaperPairingManifest | null>(null)
  const [teacherFilePreview, setTeacherFilePreview] = useState<{
    pairs: PaperFilePair[]
    unmatched: UnmatchedPaperFile[]
  }>({ pairs: [], unmatched: [] })
  const [teacherPairing, setTeacherPairing] = useState(false)
  const [teacherPairingFailed, setTeacherPairingFailed] = useState(false)
  const [pairingElapsedSeconds, setPairingElapsedSeconds] = useState(0)
  const [teacherUploadStatus, setTeacherUploadStatus] = useState("")
  const [teacherUploading, setTeacherUploading] = useState(false)
  const pairingRequestRef = useRef(0)
  const pairingControllerRef = useRef<AbortController | null>(null)
  const pairingStartedAtRef = useRef(0)
  const pdfInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    pairingRequestRef.current += 1
    pairingControllerRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!teacherPairing) return

    const timer = window.setInterval(() => {
      setPairingElapsedSeconds(
        Math.floor((Date.now() - pairingStartedAtRef.current) / 1000),
      )
    }, 1000)

    return () => window.clearInterval(timer)
  }, [teacherPairing])

  async function prepareTeacherFiles(selectedFiles: File[]) {
    if (teacherUploading) return

    const pdfFiles = selectedFiles.filter(
      (selectedFile) =>
        selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf"),
    )
    const requestId = pairingRequestRef.current + 1
    pairingRequestRef.current = requestId
    pairingControllerRef.current?.abort()
    pairingControllerRef.current = null

    setTeacherFiles(pdfFiles)
    setTeacherPairingManifest(null)
    setTeacherFilePreview({ pairs: [], unmatched: [] })
    setTeacherPairingFailed(false)
    setPairingElapsedSeconds(0)

    if (pdfFiles.length === 0) {
      setTeacherPairing(false)
      setTeacherUploadStatus("Select at least one PDF file.")
      return
    }

    setTeacherPairing(true)
    pairingStartedAtRef.current = Date.now()
    setTeacherUploadStatus(
      "Matching filenames only. Your PDFs have not been uploaded yet.",
    )
    const controller = new AbortController()
    pairingControllerRef.current = controller
    const timeoutId = window.setTimeout(() => controller.abort(), 15000)

    try {
      const response = await fetch("/api/analyse/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          files: pdfFiles.map((selectedFile, id) => ({
            id,
            name: selectedFile.name,
            relativePath: selectedFile.webkitRelativePath || selectedFile.name,
            size: selectedFile.size,
          })),
        }),
      })
      const data = (await response.json()) as {
        message?: string
        manifest?: PaperPairingManifest
      }

      if (requestId !== pairingRequestRef.current) return

      if (data.manifest) {
        setTeacherPairingManifest(data.manifest)
        setTeacherFilePreview(buildPaperPairs(pdfFiles, data.manifest))
      }

      if (!response.ok || !data.manifest) {
        setTeacherPairingFailed(true)
        setTeacherUploadStatus(
          data.message ?? "AI could not recognize the selected filenames.",
        )
        return
      }

      setTeacherUploadStatus(
        `${data.message ?? "Files recognized."} Review the matches before analysing.`,
      )
    } catch {
      if (requestId === pairingRequestRef.current) {
        setTeacherPairingFailed(true)
        setTeacherUploadStatus(
          controller.signal.aborted
            ? "Filename matching timed out after 15 seconds. Your PDFs have not been uploaded. Retry matching."
            : "Could not reach the filename-matching service. Your files are still selected. Retry matching.",
        )
      }
    } finally {
      window.clearTimeout(timeoutId)

      if (requestId === pairingRequestRef.current) {
        pairingControllerRef.current = null
        setTeacherPairing(false)
      }
    }
  }

  function clearTeacherFiles() {
    pairingRequestRef.current += 1
    pairingControllerRef.current?.abort()
    pairingControllerRef.current = null
    setTeacherFiles([])
    setTeacherPairingManifest(null)
    setTeacherFilePreview({ pairs: [], unmatched: [] })
    setTeacherPairing(false)
    setTeacherPairingFailed(false)
    setPairingElapsedSeconds(0)
    setTeacherUploadStatus("")
  }

  async function analyseTeacherFiles() {
    if (!teacherPairingManifest || teacherFilePreview.pairs.length === 0) {
      setTeacherUploadStatus("Wait for AI filename matching before analysing.")
      return
    }

    setTeacherUploading(true)
    setTeacherUploadStatus("Uploading and analysing papers. This may take a while...")

    const formData = new FormData()
    teacherFiles.forEach((selectedFile) => formData.append("files", selectedFile))
    formData.append("pairing_manifest", JSON.stringify(teacherPairingManifest))

    try {
      const response = await fetch("/api/analyse", {
        method: "POST",
        body: formData,
      })
      const data = (await response.json()) as {
        message?: string
        unmatched?: UnmatchedPaperFile[]
      }

      if (!response.ok) {
        setTeacherUploadStatus(data.message ?? "Paper analysis failed.")
        return
      }

      const warning = data.unmatched?.length
        ? ` ${data.unmatched.length} file${data.unmatched.length === 1 ? " was" : "s were"} not processed.`
        : ""
      setTeacherUploadStatus(`${data.message ?? "Papers analysed successfully."}${warning}`)
      setTeacherFiles([])
      setTeacherPairingManifest(null)
      setTeacherFilePreview({ pairs: [], unmatched: [] })
    } catch {
      setTeacherUploadStatus("Could not reach the analysis service. Try again.")
    } finally {
      setTeacherUploading(false)
    }
  }

  return (
    <section className="teacher-upload-panel" aria-labelledby="teacher-upload-title">
      <div className="teacher-upload-heading">
        <div>
          <p className="eyebrow">Teacher tools · JC H2 Physics</p>
          <h2 id="teacher-upload-title">Add question papers</h2>
        </div>
        <p>
          Upload one paper, several PDFs, or a complete folder. AI recognizes the
          filenames before any PDF is uploaded.
        </p>
      </div>

      <div
        className="teacher-upload-dropzone"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault()
          void prepareTeacherFiles(Array.from(event.dataTransfer.files))
        }}
      >
        <span className="teacher-upload-icon" aria-hidden="true">＋</span>
        <strong>Drop your question papers here</strong>
        <span>Choose PDFs or a folder containing question papers and answer keys.</span>
        <div className="teacher-upload-actions">
          <button
            className="primary-button"
            type="button"
            disabled={teacherUploading}
            onClick={() => pdfInputRef.current?.click()}
          >
            Choose PDFs
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={teacherUploading}
            onClick={() => folderInputRef.current?.click()}
          >
            Choose folder
          </button>
        </div>
        <input
          ref={pdfInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          aria-label="Choose question paper PDFs"
          disabled={teacherUploading}
          onChange={(event) => {
            void prepareTeacherFiles(Array.from(event.target.files ?? []))
            event.currentTarget.value = ""
          }}
        />
        <input
          ref={folderInputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          aria-label="Choose question paper folder"
          disabled={teacherUploading}
          // @ts-expect-error webkitdirectory is supported by Chromium, Safari, and iPadOS browsers.
          webkitdirectory=""
          onChange={(event) => {
            void prepareTeacherFiles(Array.from(event.target.files ?? []))
            event.currentTarget.value = ""
          }}
        />
      </div>

      {teacherFiles.length > 0 && (
        <div className="teacher-upload-review" aria-busy={teacherPairing}>
          <div className="teacher-upload-summary">
            <strong>
              {teacherPairing
                ? "AI is matching files..."
                : teacherPairingFailed
                  ? "Matching failed — files kept"
                  : `${teacherFilePreview.pairs.length} paper${teacherFilePreview.pairs.length === 1 ? "" : "s"} ready`}
            </strong>
            <span>
              {teacherFiles.length} file{teacherFiles.length === 1 ? "" : "s"} selected
            </span>
          </div>

          {teacherPairing && (
            <p className="status">
              {pairingElapsedSeconds}s elapsed · Checking filenames, not PDF contents.
            </p>
          )}
          {teacherPairingFailed && (
            <div className="upload-warning" role="alert">
              <strong>{teacherUploadStatus}</strong>
              <span>You can retry without selecting the files again.</span>
            </div>
          )}
          {!teacherPairingManifest && (
            <details className="selected-paper-files">
              <summary>View selected filenames</summary>
              <ul>
                {teacherFiles.map((selectedFile, index) => (
                  <li key={index}>
                    {selectedFile.webkitRelativePath || selectedFile.name}
                  </li>
                ))}
              </ul>
            </details>
          )}

          <div className="paper-pair-list">
            {teacherFilePreview.pairs.map((pair) => {
              const group = teacherPairingManifest?.groups.find(
                (candidate) =>
                  teacherFiles[candidate.questionFileId] === pair.questionFile,
              )

              return (
                <div className="paper-pair" key={pair.paperId}>
                  <strong>{pair.paperId}</strong>
                  <span>Question paper · {pair.questionFile.name}</span>
                  <span className={pair.answerFile ? "pair-answer" : "pair-warning"}>
                    {pair.answerFile
                      ? `Answer key · ${pair.answerFile.name}`
                      : "No answer key matched · question-only import"}
                  </span>
                  {group && (
                    <span className="pair-confidence">
                      AI confidence · {Math.round(group.confidence * 100)}%
                      {group.note ? ` · ${group.note}` : ""}
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          {teacherFilePreview.unmatched.length > 0 && (
            <div className="upload-warning" role="status">
              <strong>Files needing attention</strong>
              {teacherFilePreview.unmatched.map((item) => (
                <span key={`${item.filename}-${item.reason}`}>
                  {item.filename} · {item.reason}
                </span>
              ))}
            </div>
          )}

          <div className="teacher-upload-actions">
            {teacherPairingFailed ? (
              <button
                className="primary-button"
                type="button"
                disabled={teacherUploading}
                onClick={() => void prepareTeacherFiles(teacherFiles)}
              >
                Retry matching
              </button>
            ) : (
              <button
                className="primary-button"
                type="button"
                disabled={
                  teacherUploading ||
                  teacherPairing ||
                  !teacherPairingManifest ||
                  teacherFilePreview.pairs.length === 0
                }
                onClick={() => void analyseTeacherFiles()}
              >
                {teacherPairing
                  ? "Matching filenames..."
                  : teacherUploading
                    ? "Analysing..."
                    : "Analyse selected papers"}
              </button>
            )}
            <button
              className="secondary-button"
              type="button"
              disabled={teacherUploading}
              onClick={clearTeacherFiles}
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {teacherUploadStatus && !teacherPairingFailed && (
        <p className="status" role="status">{teacherUploadStatus}</p>
      )}
    </section>
  )
}
