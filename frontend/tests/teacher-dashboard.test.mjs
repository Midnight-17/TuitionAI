// Run with: node --test tests/teacher-dashboard.test.mjs
// Real dashboard queries, serialization and route; only database access is mocked.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import vm from "node:vm"
import ts from "typescript"

const sources = new Map([
  ["@/lib/studyDate", "../lib/studyDate.ts"],
  ["@/lib/teacherDashboardShared", "../lib/teacherDashboardShared.ts"],
  ["@/lib/teacherDashboard", "../lib/teacherDashboard.ts"],
  ["@/app/data/h2PhysicsTopics", "../app/data/h2PhysicsTopics.ts"],
  ["route", "../app/api/teacher/dashboard/route.ts"],
  ["dailyRoute", "../app/api/practice/daily/route.ts"],
  ["completionRoute", "../app/api/assignment/complete/route.ts"],
  ["teacherEntry", "../app/teacher/page.tsx"],
].map(([name, path]) => [name, ts.transpileModule(
  readFileSync(new URL(path, import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText]))

function load(name, mocks = {}, cache = new Map()) {
  if (Object.hasOwn(mocks, name)) return mocks[name]
  if (cache.has(name)) return cache.get(name)
  assert.ok(sources.has(name), `Unexpected import: ${name}`)
  const context = {
    exports: {}, Date: mocks.clock ?? Date, Intl, URL, Response,
    require: dependency => load(dependency, mocks, cache),
  }
  vm.runInNewContext(sources.get(name), context)
  cache.set(name, context.exports)
  return context.exports
}

const shared = load("@/lib/teacherDashboardShared")
const studyDate = load("@/lib/studyDate")
const plain = value => JSON.parse(JSON.stringify(value))

function valuesAt(value, path) {
  if (Array.isArray(value)) return value.flatMap(item => valuesAt(item, path))
  if (path.length === 0) return [value]
  return valuesAt(value?.[path[0]], path.slice(1))
}

function matches(record, query) {
  return Object.entries(query).every(([field, condition]) => {
    if (field === "$or") return condition.some(option => matches(record, option))
    const values = valuesAt(record, field.split("."))
    if (condition !== null && typeof condition === "object") {
      if ("$in" in condition) return values.some(value => condition.$in.includes(value))
      return values.some(value => value >= condition.$gte && value < condition.$lt)
    }
    return values.includes(condition)
  })
}

function setup(overrides = {}) {
  const fixtures = {
    Teacher: [{ _id: "teacher-1", teacher_id: "T001", name: "Ms Tan", students: [{ student: "student-1" }] }],
    Student: [
      { _id: "student-1", student_id: "S001", name: "Alex Tan", teachers: [] },
      { _id: "student-2", student_id: "S002", name: "Alex Tan", teachers: [{ teacher: "teacher-1" }] },
      { _id: "student-3", student_id: "S003", name: "Elsewhere", teachers: [{ teacher: "teacher-2" }] },
    ],
    Assignment: [
      { _id: "assignment-1", teacher: "teacher-1", student: "student-1" },
      { _id: "assignment-2", teacher: "teacher-1", student: "student-2" },
      { _id: "assignment-other", teacher: "teacher-2", student: "student-1" },
    ],
    Submissions: [],
    ...overrides,
  }
  const queries = []
  const mocks = { "@/lib/mongodb": { connectDB: async () => {} } }
  for (const [model, records] of Object.entries(fixtures)) {
    function query(filter, one = false) {
      queries.push({ model, filter })
      let selected = records.filter(record => matches(record, filter))
      return {
        select() { return this },
        sort(order) {
          selected = selected.toSorted((a, b) => {
            for (const [field, direction] of Object.entries(order)) {
              if (a[field] < b[field]) return -direction
              if (a[field] > b[field]) return direction
            }
            return 0
          })
          return this
        },
        async lean() { return one ? selected[0] ?? null : selected },
      }
    }
    mocks[`@/app/models/${model}`] = {
      default: { find: query, findOne: filter => query(filter, true) },
    }
  }
  const dashboard = load("@/lib/teacherDashboard", mocks)
  return { dashboard, queries, fixtures }
}

const today = new Date("2026-09-17T08:00:00Z")
const submission = (overrides = {}) => ({
  _id: "submission-1",
  student: "student-1",
  assignment: "assignment-1",
  submitted_at: new Date("2026-09-17T07:00:00Z"),
  status: "completed",
  ...overrides,
})

test("Singapore day rolls over at 16:00 UTC, including the year boundary", () => {
  const { dashboard } = setup()
  const before = dashboard.getSingaporeDay(new Date("2026-12-31T15:59:59.999Z"))
  assert.equal(before.date, "2026-12-31")
  assert.equal(before.start.toISOString(), "2026-12-30T16:00:00.000Z")
  assert.equal(before.end.toISOString(), "2026-12-31T16:00:00.000Z")
  const after = dashboard.getSingaporeDay(new Date("2026-12-31T16:00:00Z"))
  assert.equal(after.date, "2027-01-01")
  assert.equal(after.end.toISOString(), "2027-01-01T16:00:00.000Z")
})

test("shared study day keeps streak numbers aligned through leap days and year rollover", () => {
  const leapDay = studyDate.getStudyDay(new Date("2028-02-28T16:00:00Z"))
  assert.equal(leapDay.date, "2028-02-29")
  assert.equal(leapDay.dayOfYear, 60)
  assert.equal(leapDay.month, 2)
  assert.equal(leapDay.dayOfMonth, 29)
  const march = studyDate.getStudyDay(new Date("2028-02-29T16:00:00Z"))
  assert.equal(march.date, "2028-03-01")
  assert.equal(march.dayOfYear, 61)
  const newYear = studyDate.getStudyDay(new Date("2028-12-31T16:00:00Z"))
  assert.equal(newYear.year, 2029)
  assert.equal(newYear.month, 1)
  assert.equal(newYear.dayOfMonth, 1)
  assert.equal(newYear.dayOfYear, 1)
  assert.equal(shared.TEACHER_TIME_ZONE, studyDate.STUDY_TIME_ZONE)
})

test("duplicate and international student names have distinct, readable routes", () => {
  assert.equal(shared.getTeacherStudentSlug("  Alex Tan! ", "S001"), "alex-tan--S001")
  assert.equal(shared.getTeacherStudentSlug("Alex Tan", "S002"), "alex-tan--S002")
  assert.equal(shared.getTeacherStudentSlug("Chloé 李", "S003"), "chloe-李--S003")
  assert.equal(shared.getTeacherStudentSlug("!!!", "S004"), "student--S004")
})

test("teacher-scoped URLs handle duplicate names and encode each path segment", () => {
  assert.equal(shared.getTeacherSlug("Mr Tan", "T001"), "mr-tan--T001")
  assert.equal(shared.getTeacherSlug("Mr Tan", "T002"), "mr-tan--T002")
  assert.equal(shared.getTeacherSlug("!!!", "T003"), "teacher--T003")
  assert.equal(shared.getTeacherIdFromSlug("mr-tan--T001"), "T001")
  for (const slug of ["", "mr-tan", "--T001", "mr-tan--"]) {
    assert.equal(shared.getTeacherIdFromSlug(slug), null)
  }
  assert.equal(shared.teacherHref("mr-tan--T001"), "/teacher/mr-tan--T001")
  assert.equal(shared.teacherStudentHref("mr-tan--T001", "john--S001"), "/teacher/mr-tan--T001/john--S001")
  assert.equal(shared.teacherStudentHref("李--T002", "chloe-李--S003"), "/teacher/%E6%9D%8E--T002/chloe-%E6%9D%8E--S003")
})

test("the default teacher entry redirects using the teacher's database name", async () => {
  const entry = load("teacherEntry", {
    "@/lib/teacherDashboard": { loadTeacherDashboard: async id => {
      assert.equal(id, "T001")
      return { teacher: { name: "Mr Tan", teacher_id: id } }
    } },
    "next/navigation": {
      redirect: path => { throw new Error(`redirect:${path}`) },
      notFound: () => { throw new Error("not found") },
    },
  })
  await assert.rejects(entry.default(), /redirect:\/teacher\/mr-tan--T001/)
})

test("roster includes either direction of the teacher relationship, without unrelated students", async () => {
  const { dashboard } = setup()
  const result = plain(await dashboard.loadTeacherDashboard("T001", today))
  assert.deepEqual(result.students.map(student => student.student_id), ["S001", "S002"])
  assert.deepEqual(result.counts, { total: 2, submitted: 0, pending: 2 })
  assert.equal(result.students[0].submittedAt, null)
  assert.equal(result.students[0].submissionStatus, null)
  assert.equal(result.date, "2026-09-17")
  assert.equal(result.timeZone, "Asia/Singapore")
})

test("empty relationships return an empty roster even with other students in the database", async () => {
  const { dashboard, queries } = setup({
    Teacher: [{ _id: "unlinked-teacher", teacher_id: "T001", name: "Ms Tan", students: [] }],
  })
  const result = plain(await dashboard.loadTeacherDashboard("T001", today))
  assert.deepEqual(result.students, [])
  assert.deepEqual(result.counts, { total: 0, submitted: 0, pending: 0 })
  assert.equal(queries.some(query => query.model === "Assignment"), false)
})

test("daily submissions include midnight, exclude tomorrow, and preserve the latest marking status", async () => {
  const { dashboard } = setup({ Submissions: [
    submission({ _id: "before", submitted_at: new Date("2026-09-16T15:59:59.999Z") }),
    submission({ _id: "midnight", submitted_at: new Date("2026-09-16T16:00:00Z"), status: "submitted" }),
    submission({ _id: "latest", status: "failed" }),
    submission({ _id: "tomorrow", submitted_at: new Date("2026-09-17T16:00:00Z") }),
    submission({ _id: "second", student: "student-2", assignment: "assignment-2", status: "processing" }),
  ] })
  const result = plain(await dashboard.loadTeacherDashboard("T001", today))
  assert.deepEqual(result.counts, { total: 2, submitted: 2, pending: 0 })
  assert.equal(result.students[0].submissionStatus, "failed")
  assert.equal(result.students[0].submittedAt, "2026-09-17T07:00:00.000Z")
  assert.equal(result.students[1].submissionStatus, "processing")
})

test("the opening boundary counts as submitted, even before grading", async () => {
  const { dashboard } = setup({ Submissions: [submission({
    submitted_at: new Date("2026-09-16T16:00:00Z"), status: "submitted",
  })] })
  const result = await dashboard.loadTeacherDashboard("T001", today)
  assert.equal(result.students[0].submittedToday, true)
  assert.equal(result.students[0].submissionStatus, "submitted")
})

test("work for another teacher and mismatched assignment owners never count", async () => {
  const { dashboard } = setup({ Submissions: [
    submission({ assignment: "assignment-other" }),
    submission({ _id: "mismatched", assignment: "assignment-2" }),
  ] })
  const result = plain(await dashboard.loadTeacherDashboard("T001", today))
  assert.deepEqual(result.counts, { total: 2, submitted: 0, pending: 2 })
})

test("missing teachers return null without querying student data", async () => {
  const { dashboard, queries } = setup()
  assert.equal(await dashboard.loadTeacherDashboard("missing", today), null)
  assert.equal(queries.length, 1)
})

test("API validates IDs, reports unavailable data, and prevents response caching", async () => {
  const { dashboard } = setup()
  let calls = 0
  const route = load("route", { "@/lib/teacherDashboard": {
    loadTeacherDashboard: async id => {
      calls++
      if (id === "broken") throw new Error("secret database detail")
      return dashboard.loadTeacherDashboard(id, today)
    },
  } })
  const request = id => new Request(`http://localhost/api/teacher/dashboard${id === undefined ? "" : `?teacher_id=${id}`}`)
  assert.equal((await route.GET(request())).status, 400)
  assert.equal((await route.GET(request("%20"))).status, 400)
  assert.equal(calls, 0)
  assert.equal((await route.GET(request("missing"))).status, 404)
  const failure = await route.GET(request("broken"))
  assert.equal(failure.status, 500)
  assert.doesNotMatch(JSON.stringify(await failure.json()), /secret/)
  const success = await route.GET(request("T001"))
  assert.equal(success.status, 200)
  assert.equal(success.headers.get("Cache-Control"), "private, no-store")
  assert.equal((await success.json()).students.length, 2)
})

test("teacher URL selects its own roster, rejects wrong names, and never falls back to the default teacher", async () => {
  const { dashboard } = setup({ Teacher: [
    { _id: "teacher-1", teacher_id: "T001", name: "Ms Tan", students: [{ student: "student-1" }] },
    { _id: "teacher-2", teacher_id: "T002", name: "Ms Tan", students: [] },
  ] })
  const route = load("route", { "@/lib/teacherDashboard": {
    loadTeacherDashboard: id => dashboard.loadTeacherDashboard(id, today),
  } })
  const request = slug => new Request(`http://localhost/api/teacher/dashboard?teacher_slug=${encodeURIComponent(slug)}&teacher_id=T001`)
  const first = await route.GET(request("ms-tan--T001"))
  assert.equal(first.status, 200)
  assert.deepEqual((await first.json()).students.map(student => student.student_id), ["S001", "S002"])
  const second = await route.GET(request("ms-tan--T002"))
  assert.equal(second.status, 200)
  const secondBody = await second.json()
  assert.equal(secondBody.teacher.teacher_id, "T002")
  assert.deepEqual(secondBody.students.map(student => student.student_id), ["S003"])
  for (const slug of ["wrong-name--T001", "ms-tan--missing"]) {
    assert.equal((await route.GET(request(slug))).status, 404)
  }
  for (const slug of ["", "ms-tan", "--T001"]) {
    assert.equal((await route.GET(request(slug))).status, 400)
  }
})

function clockAt(instant) {
  return class extends Date {
    constructor(...args) {
      super(...(args.length === 0 ? [instant] : args))
    }
    static now() { return new Date(instant).getTime() }
  }
}

test("daily practice reuses the Singapore calendar day's assignment around midnight", async () => {
  let dailyQuery
  const route = load("dailyRoute", {
    clock: clockAt("2026-12-31T16:00:00Z"),
    "next/server": { NextResponse: Response },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/app/models/Student": { default: { findOne: async () => ({ _id: "student-1" }) } },
    "@/app/models/Teacher": { default: { findOne: async () => ({
      _id: "teacher-1",
      teaching_scopes: [{ subject: "Physics", level: "H2", selected_topics: [1] }],
    }) } },
    "@/app/models/Questions": { default: {} },
    "@/app/models/Assignment": { default: { findOne: query => {
      dailyQuery = query
      return { populate: async () => ({ _id: "existing", questions: [{ _id: "question-1" }] }) }
    } } },
  })
  const response = await route.POST(new Request("http://localhost/api/practice/daily", {
    method: "POST", body: JSON.stringify({ student_id: "S001", teacher_id: "T001" }),
  }))
  assert.equal(response.status, 200)
  assert.equal(dailyQuery.practice_date.$gte.toISOString(), "2026-12-31T16:00:00.000Z")
  assert.equal(dailyQuery.practice_date.$lt.toISOString(), "2027-01-01T16:00:00.000Z")
  assert.equal((await response.json()).assignment._id, "existing")
})

test("assignment completion resets streaks on Singapore New Year, without adding duplicate days", async () => {
  const assignment = { _id: "assignment-1", student: "student-1", questions: ["question-1"], save: async () => {} }
  const submission = { assignment: "assignment-1", save: async () => {} }
  const student = { streak_year: 2026, streak_month: 12, year_streak: [365], monthly_streak: [31], save: async () => {} }
  const route = load("completionRoute", {
    clock: clockAt("2026-12-31T16:00:00Z"),
    "next/server": { NextResponse: Response },
    "@/lib/mongodb": { connectDB: async () => {} },
    "@/lib/mastery": { updateMasteryFromAssignment: async () => {} },
    "@/app/models/Assignment": { default: { findById: async () => assignment } },
    "@/app/models/Submissions": { default: { findById: async () => submission } },
    "@/app/models/Student": { default: { findById: async () => student } },
    "@/app/models/Attempt": { default: { countDocuments: async () => 1 } },
  })
  const request = () => new Request("http://localhost/api/assignment/complete", {
    method: "POST", body: JSON.stringify({ assignment_id: "assignment-1", submission_id: "submission-1" }),
  })
  assert.equal((await route.POST(request())).status, 200)
  assert.equal(student.streak_year, 2027)
  assert.equal(student.streak_month, 1)
  assert.deepEqual(Array.from(student.year_streak), [1])
  assert.deepEqual(Array.from(student.monthly_streak), [1])
  assert.equal((await route.POST(request())).status, 200)
  assert.deepEqual(Array.from(student.year_streak), [1])
  assert.deepEqual(Array.from(student.monthly_streak), [1])
})
