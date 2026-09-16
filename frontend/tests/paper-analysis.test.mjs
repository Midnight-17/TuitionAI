// Run with: node --test tests/paper-analysis.test.mjs
// Real route, parser, catalogue and PDFs; only Gemini and persistence are mocked.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"
import { PDFDocument } from "pdf-lib"

function compile(path) {
  return ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}
const codes = new Map([
  ["@/app/data/h2PhysicsTopics", compile("../app/data/h2PhysicsTopics.ts")],
  ["@/lib/paperAnalysis", compile("../lib/paperAnalysis.ts")],
  ["@/lib/paperFiles", compile("../lib/paperFiles.ts")],
  ["route", compile("../app/api/analyse/route.ts")],
])
function load(name, mocks = {}, cache = new Map()) {
  if (Object.hasOwn(mocks, name)) return mocks[name]
  if (cache.has(name)) return cache.get(name)
  assert.ok(codes.has(name), `Unexpected import: ${name}`)
  const context = {
    exports: {}, Buffer, File, Response, Error,
    process: { env: {} }, console: { error() {}, warn() {} },
    require: dependency => load(dependency, mocks, cache),
  }
  vm.runInNewContext(codes.get(name), context)
  cache.set(name, context.exports)
  return context.exports
}
const analysis = load("@/lib/paperAnalysis")
const { h2PhysicsTopics } = load("@/app/data/h2PhysicsTopics")
const pages = { question: 3, answer: 1 }
const question = (overrides = {}) => ({
  question_number: 1, page: [2], topic: "Motion and Forces",
  subtopics: ["Kinematics"], answer_key_page: [1], difficulty: 2, total_marks: 1,
  ...overrides,
})
const result = (questions = [question()], status = "completed") => ({
  id: "test-interaction", status, output_text: JSON.stringify(questions),
})

async function pdf(pageCount) {
  const document = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) document.addPage()
  return Buffer.from(await document.save())
}
const questionPDF = await pdf(3)
const answerPDF = await pdf(1)

function setup(generate) {
  const calls = []
  const writes = []
  const events = []
  let connections = 0
  const route = load("route", {
    "pdf-lib": { PDFDocument },
    "@google/genai": { GoogleGenAI: class {
      interactions = { create: async config => {
        calls.push(structuredClone(config))
        events.push("analyse")
        return generate(config, calls.length)
      } }
    } },
    "@/lib/mongodb": { connectDB: async () => { connections++ } },
    "@/lib/gridfs": { uploadPDF: async (bytes, filename) => {
      events.push("save")
      writes.push({ type: "pdf", filename, bytes })
      return `pdf-${writes.length}`
    } },
    "@/app/models/Files": { default: { create: async data => {
      const file = { ...data, _id: `file-${writes.length}`, save: async () => {} }
      writes.push({ type: "file", file })
      return file
    } } },
    "@/app/models/Questions": { default: { create: async data => {
      writes.push({ type: "questions", data })
      return data.map((item, index) => ({ ...item, _id: `question-${writes.length}-${index}` }))
    } } },
  })
  return {
    calls, writes, events,
    get connections() { return connections },
    async post({ count = 1, separateAnswer = true, rawManifest } = {}) {
      const form = new FormData()
      const groups = []
      let fileId = 0
      for (let i = 0; i < count; i++) {
        form.append("files", new File([questionPDF], `ACJC/ACJC 2025 P${i + 1}.pdf`, { type: "application/pdf" }))
        const questionFileId = fileId++
        const answerFileId = separateAnswer ? fileId++ : null
        if (separateAnswer) form.append("files", new File([answerPDF], `P${i + 1} Answers.pdf`, { type: "application/pdf" }))
        groups.push({ paperId: `acjc-p${i + 1}`, questionFileId, answerFileId, confidence: 1, note: "" })
      }
      form.append("pairing_manifest", rawManifest ?? JSON.stringify({ groups, unmatched: [] }))
      const response = await route.POST(new Request("http://localhost/api/analyse", { method: "POST", body: form }))
      return { status: response.status, ...await response.json() }
    },
  }
}

test("normalizes harmless formatting without guessing topic classifications", () => {
  const parsed = analysis.parsePaperAnalysis("```json\n" + JSON.stringify([question({
    topic: " motion and forces ", subtopics: [" Kinematics ", "Kinematics"], page: [2, 2],
  })]) + "\n```", "paper.pdf", pages)
  assert.equal(parsed[0].topic, "Motion and Forces")
  assert.deepEqual(Array.from(parsed[0].subtopics), ["Kinematics"])
  assert.deepEqual(Array.from(parsed[0].page), [2])
})

test("invalid fields identify the question and field, never pass partial data", () => {
  for (const [field, value] of [
    ["question_number", 0], ["question_number", "1"], ["topic", "Kinematics"],
    ["subtopics", []], ["subtopics", [" "]], ["page", []], ["page", [0]],
    ["page", [4]], ["answer_key_page", [2]], ["answer_key_page", null],
    ["difficulty", 6], ["difficulty", 1.5], ["total_marks", null], ["total_marks", -1],
  ]) {
    assert.throws(
      () => analysis.parsePaperAnalysis(JSON.stringify([question({ [field]: value })]), "paper.pdf", pages),
      error => error instanceof analysis.PaperAnalysisError && error.issues[0].includes(field),
      field,
    )
  }
  for (const output of ["{bad", "null", "[]", "[null]", "{}", JSON.stringify([question(), question()])]) {
    assert.throws(() => analysis.parsePaperAnalysis(output, "paper.pdf", pages), analysis.PaperAnalysisError)
  }
})

test("a 40-question MCQ paper uses the complete catalogue and required schema, then saves both PDFs", async () => {
  const api = setup(async config => {
    const prompt = config.input[0].text
    for (const topic of h2PhysicsTopics) {
      assert.ok(prompt.includes(topic.topic))
      for (const subtopic of topic.subtopics) assert.ok(prompt.includes(subtopic))
    }
    assert.match(prompt, /multiple-choice/)
    assert.match(prompt, /including covers and blank pages/)
    assert.match(prompt, /Document B.*1 PDF pages/)
    assert.equal(config.response_format.type, "text")
    assert.equal(config.response_format.mime_type, "application/json")
    assert.deepEqual(Array.from(config.response_format.schema.items.properties.topic.enum), Array.from(h2PhysicsTopics, t => t.topic))
    assert.deepEqual(Array.from(config.response_format.schema.items.required).sort(), Object.keys(question()).sort())
    assert.equal(config.input[1].data, questionPDF.toString("base64"))
    assert.equal(config.input[2].data, answerPDF.toString("base64"))
    return result(Array.from({ length: 40 }, (_, i) => question({ question_number: i + 1 })))
  })
  const response = await api.post()
  assert.equal(response.status, 200)
  assert.equal(response.results[0].questions.length, 40)
  assert.equal(api.calls.length, 1)
  assert.equal(api.writes.filter(w => w.type === "pdf").length, 2)
  const saved = api.writes.find(w => w.type === "questions").data
  assert.equal(saved.length, 40)
  assert.equal(saved[0].total_marks, 1)
  assert.equal(saved[0].answer_key_file, response.results[0].answer_file._id)
  assert.equal(response.results[0].question_file.paired_file, response.results[0].answer_file._id)
})

test("an invalid topic gets one corrective retry with field feedback, before any writes", async () => {
  const api = setup(async (config, attempt) => {
    assert.equal(api.writes.length, 0)
    if (attempt === 1) return result([question({ topic: "Kinematics" })])
    assert.match(config.input.at(-1).text, /Question 1: topic.*Kinematics/)
    return result()
  })
  assert.equal((await api.post()).status, 200)
  assert.equal(api.calls.length, 2)
})

test("persistent model errors return useful 502 responses and never save anything", async () => {
  for (const modelResult of [result([question({ total_marks: null })]), result([], "incomplete"), result([null]), { status: "completed", output_text: "{bad" }]) {
    const api = setup(async () => modelResult)
    const response = await api.post()
    assert.equal(response.status, 502)
    assert.match(response.message, /ACJC/)
    assert.match(response.message, /No papers from this batch were saved/)
    assert.ok(response.issues.length > 0)
    assert.equal(api.calls.length, 2)
    assert.equal(api.writes.length, 0)
    assert.equal(api.connections, 0)
  }
})

test("failure on the second paper leaves the entire batch unsaved", async () => {
  const api = setup(async (_, attempt) => attempt === 1 ? result() : result([question({ difficulty: null })]))
  const response = await api.post({ count: 2 })
  assert.equal(response.status, 502)
  assert.match(response.filename, /P2/)
  assert.match(response.message, /Question 1: difficulty/)
  assert.equal(api.calls.length, 3)
  assert.equal(api.writes.length, 0)
  assert.equal(api.connections, 0)
})

test("a valid multi-paper batch finishes analysis before saving", async () => {
  const api = setup(async () => result())
  const response = await api.post({ count: 3 })
  assert.equal(response.status, 200)
  assert.equal(response.results.length, 3)
  assert.deepEqual(api.events.slice(0, 4), ["analyse", "analyse", "analyse", "save"])
})

test("question-only papers support both absent and embedded answers", async () => {
  for (const answer_key_page of [[], [3]]) {
    const api = setup(async config => {
      assert.equal(config.input.length, 2)
      assert.match(config.input[0].text, /There is no separate answer document/)
      return result([question({ answer_key_page })])
    })
    const response = await api.post({ separateAnswer: false })
    assert.equal(response.status, 200)
    assert.equal(response.results[0].answer_file, null)
    assert.equal(api.writes.filter(w => w.type === "pdf").length, 1)
    assert.deepEqual(Array.from(api.writes.find(w => w.type === "questions").data[0].answer_key_page), answer_key_page)
  }
})

test("null and malformed pairing manifests fail before analysis or persistence", async () => {
  const api = setup(async () => { throw new Error("Must not call Gemini") })
  for (const rawManifest of ["null", "{bad", "{}", "[]"]) {
    assert.equal((await api.post({ rawManifest })).status, 400)
  }
  assert.equal(api.calls.length, 0)
  assert.equal(api.connections, 0)
})
