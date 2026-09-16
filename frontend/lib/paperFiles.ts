export type PaperFilePair = {
  paperId: string
  questionFile: File
  answerFile: File | null
}

export type UnmatchedPaperFile = {
  filename: string
  reason: string
}

export type PaperPairingGroup = {
  paperId: string
  questionFileId: number
  answerFileId: number | null
  confidence: number
  note: string
}

export type PaperPairingManifest = {
  groups: PaperPairingGroup[]
  unmatched: Array<{
    fileId: number
    reason: string
  }>
}

export function normalisePaperId(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildPaperPairs(
  files: File[],
  manifest: PaperPairingManifest,
): {
  pairs: PaperFilePair[]
  unmatched: UnmatchedPaperFile[]
} {
  const pairs: PaperFilePair[] = []
  const unmatched: UnmatchedPaperFile[] = []
  const usedQuestionIds = new Set<number>()
  const usedPaperIds = new Set<string>()

  for (const group of manifest.groups) {
    const questionFile = files[group.questionFileId]
    const answerFile =
      group.answerFileId === null ? null : files[group.answerFileId]

    if (!questionFile || usedQuestionIds.has(group.questionFileId)) continue
    if (group.answerFileId !== null && !answerFile) continue
    if (group.answerFileId === group.questionFileId) continue

    usedQuestionIds.add(group.questionFileId)

    const basePaperId = normalisePaperId(group.paperId) || `paper-${group.questionFileId + 1}`
    let paperId = basePaperId
    let duplicateNumber = 2
    while (usedPaperIds.has(paperId)) {
      paperId = `${basePaperId}-${duplicateNumber}`
      duplicateNumber += 1
    }
    usedPaperIds.add(paperId)

    pairs.push({ paperId, questionFile, answerFile })
  }

  for (const item of manifest.unmatched) {
    const file = files[item.fileId]
    if (file) unmatched.push({ filename: file.name, reason: item.reason })
  }

  files.forEach((file, fileId) => {
    const isQuestion = usedQuestionIds.has(fileId)
    const isAnswer = manifest.groups.some((group) => group.answerFileId === fileId)
    const isAlreadyUnmatched = manifest.unmatched.some((item) => item.fileId === fileId)

    if (!isQuestion && !isAnswer && !isAlreadyUnmatched) {
      unmatched.push({
        filename: file.name,
        reason: "AI did not assign this file to a paper",
      })
    }
  })

  return { pairs, unmatched }
}
