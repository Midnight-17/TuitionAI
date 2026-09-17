import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TuitionAI | Teacher dashboard",
  description: "Your students, their daily practice, and their progress in one place.",
}

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return children
}
