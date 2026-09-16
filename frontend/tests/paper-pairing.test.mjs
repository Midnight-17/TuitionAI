// Run with: node --test tests/paper-pairing.test.mjs
// Exercise the real route with a fake AI transport: no network, keys or PDFs.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
function compile(relativePath) {
  return ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
}
const routeCode = compile("../app/api/analyse/pairing/route.ts")
const paperFilesCode = compile("../lib/paperFiles.ts")

function setup(generate) {
  let calls = 0
  let now = 1000
  const paperModule = { exports: {} }
  vm.runInNewContext(paperFilesCode, paperModule)
  const routeModule = {
    exports: {}, Response, Error,
    Date: { now: () => now },
    process: { env: {} },
    console: { info() {}, error() {} },
    require(name) {
      if (name === "@/lib/paperFiles") return paperModule.exports
      if (name === "node:crypto") return require(name)
      assert.equal(name, "@google/genai")
      return {
        ThinkingLevel: { MINIMAL: "MINIMAL" },
        GoogleGenAI: class {
          models = { generateContent: async (config) => {
            calls++
            assert.equal(config.config.thinkingConfig.thinkingLevel, "MINIMAL")
            assert.equal(config.config.httpOptions.timeout, 12000)
            assert.equal(config.config.httpOptions.retryOptions.attempts, 1)
            return generate(config, calls)
          } }
        },
      }
    },
  }
  vm.runInNewContext(routeCode, routeModule)
  return {
    get calls() { return calls },
    advance(ms) { now += ms },
    async post(files = filenames(), rawBody) {
      const response = await routeModule.exports.POST(new Request("http://localhost/api/analyse/pairing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: rawBody ?? JSON.stringify({ files }),
      }))
      return { status: response.status, ...await response.json() }
    },
  }
}

const filenames = () => ["NJC 2025 P3 QP.pdf", "NJC 2025 P3 Ans.pdf"]
  .map((name, id) => ({ id, name, size: 1024 }))
const group = (question = 0, answer = 1) => ({
  paper_id: "NJC 2025 P3", question_file_id: question,
  answer_file_id: answer, confidence: 0.95, note: "",
})
const result = (groups = [group()], unmatched = []) => ({ text: JSON.stringify({ groups, unmatched }) })

test("normalizes AI IDs, keeps shared answers and question-only papers", async () => {
  const api = setup(async () => result([group(0, 2), group(1, 2), group(3, null)]))
  const files = Array.from({ length: 4 }, (_, id) => ({ id, name: `file-${id}.pdf`, size: 1 }))
  const response = await api.post(files)
  assert.equal(response.status, 200)
  assert.equal(response.manifest.groups[0].paperId, "njc-2025-p3")
  assert.deepEqual(response.manifest.groups.map(g => g.answerFileId), [2, 2, null])
})

test("reuses an exact successful batch without another AI request", async () => {
  const api = setup(async () => result())
  assert.equal((await api.post()).cached, false)
  assert.equal((await api.post()).cached, true)
  assert.equal(api.calls, 1)
})

test("simultaneous identical requests share one AI call", async () => {
  let release
  const api = setup(() => new Promise(resolve => { release = resolve }))
  const first = api.post()
  const second = api.post()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(api.calls, 1)
  release(result())
  assert.deepEqual((await Promise.all([first, second])).map(r => r.status), [200, 200])
})

test("Google deadline errors are 504 and a failed result can be retried", async () => {
  const api = setup(async (_, calls) => {
    if (calls === 1) throw new Error("504 DEADLINE_EXCEEDED: Deadline expired before operation could complete.")
    return result()
  })
  const failed = await api.post()
  assert.equal(failed.status, 504)
  assert.match(failed.message, /timed out/)
  assert.match(failed.message, /not been uploaded/)
  assert.equal((await api.post()).status, 200)
  assert.equal(api.calls, 2)
})

test("busy upstream returns a retryable service error", async () => {
  const api = setup(async () => { throw new Error("429 RESOURCE_EXHAUSTED") })
  assert.equal((await api.post()).status, 503)
})

test("malformed, null and conflicting AI output is rejected, never cached", async () => {
  for (const response of [
    { text: "{truncated" }, { text: "null" }, result([null]),
    result([group(0, 1), group(1, null)]), result([group(0, 0)]),
    result([group(0, 99)]), result([group(0, 1), group(0, 1)]),
  ]) {
    const api = setup(async () => response)
    assert.equal((await api.post()).status, 502)
    assert.equal((await api.post()).status, 502)
    assert.equal(api.calls, 2)
  }
})

test("empty classification is not cached and omitted files are flagged", async () => {
  const api = setup(async () => result([]))
  const response = await api.post()
  assert.equal(response.status, 422)
  assert.equal(response.manifest.unmatched.length, 2)
  await api.post()
  assert.equal(api.calls, 2)
})

test("bad requests never reach the AI", async () => {
  const api = setup(async () => { throw new Error("Must not run") })
  for (const files of [null, [], [null], [{ id: 4, name: "a.pdf", size: 1 }],
    [{ id: 0, name: "a.exe", size: 1 }], [{ id: 0, name: "a.pdf", size: -1 }],
    Array.from({ length: 301 }, (_, id) => ({ id, name: `${id}.pdf`, size: 1 })),
  ]) assert.equal((await api.post(files)).status, 400)
  assert.equal((await api.post(undefined, "{bad json")).status, 400)
  assert.equal(api.calls, 0)
})

test("cache keys distinguish file order, folder context and size", async () => {
  const api = setup(async () => result())
  await api.post()
  await api.post(filenames().reverse().map((file, id) => ({ ...file, id })))
  await api.post(filenames().map(file => ({ ...file, relativePath: `School/${file.name}` })))
  await api.post(filenames().map(file => ({ ...file, size: 2048 })))
  assert.equal(api.calls, 4)
})

test("cache expires after ten minutes and is bounded to forty batches", async () => {
  const api = setup(async () => result())
  await api.post()
  api.advance(600001)
  assert.equal((await api.post()).cached, false)
  for (let i = 0; i < 40; i++) {
    await api.post(filenames().map(file => ({ ...file, relativePath: `${i}/${file.name}` })))
  }
  assert.equal((await api.post()).cached, false)
  assert.equal(api.calls, 43)
})
