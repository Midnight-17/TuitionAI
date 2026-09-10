import Attempt from "@/app/models/Attempt";
import Question from "@/app/models/Questions";
import Student from "@/app/models/Student";
import Assignment from "@/app/models/Assignment";

export async function updateMasteryFromAssignment(
    assignmentId: string,
    studentId: string,
) {
    const attempts = await Attempt.find({ assignment: assignmentId }).lean();
    const questionIds = attempts.map((attempt) => attempt.question);
    const questions = await Question.find({ _id: { $in: questionIds } }).lean();
    const questionsById = new Map(questions.map((question) => [question._id.toString(), question]));

    const scores = new Map<string, { awarded: number; total: number; topic: string }>();
    for (const attempt of attempts) {
        const question = questionsById.get(attempt.question.toString());
        if (!question) continue;
        const subtopics = question.subtopics?.length
            ? question.subtopics
            : question.subtopic
                ? [question.subtopic]
                : [];

        for (const subtopic of subtopics) {
            const key = `${question.topic}::${subtopic}`;
            const current = scores.get(key) ?? {
                awarded: 0,
                total: 0,
                topic: question.topic,
            };
            current.awarded += attempt.marks_awarded;
            current.total += question.total_marks;
            scores.set(key, current);
        }
    }

    const student = await Student.findById(studentId).lean();
    if (!student) return;
    const assignment = await Assignment.findById(assignmentId).select("subject").lean();
    if (!assignment) return;
    const subjects = student.subjects ?? [];
    const topicScores = new Map<string, { total: number; count: number }>();

    for (const [key, score] of scores) {
        const [, subtopicName] = key.split("::");
        let subject = subjects.find((item: { name: string }) => item.name === assignment.subject);
        if (!subject) {
            subject = { name: assignment.subject, topics: [] };
            subjects.push(subject);
        }
        if (!subject.topics) subject.topics = [];
        let topic = subject.topics.find((item: { name: string }) => item.name === score.topic);
        if (!topic) {
            topic = { name: score.topic, subtopics: [] };
            subject.topics.push(topic);
        }
        if (!topic.subtopics) topic.subtopics = [];
        const mastery = score.total === 0 ? 0 : Math.round((score.awarded / score.total) * 100);
        const topicScore = topicScores.get(score.topic) ?? { total: 0, count: 0 };
        topicScore.total += mastery;
        topicScore.count += 1;
        topicScores.set(score.topic, topicScore);
        const subtopic = topic.subtopics.find((item: { name: string }) => item.name === subtopicName);
        if (subtopic) subtopic.mastery = mastery;
        else topic.subtopics.push({ name: subtopicName, mastery });
    }

    for (const [topicName, score] of topicScores) {
        for (const subject of subjects) {
            const topic = subject.topics?.find((item: { name: string }) => item.name === topicName);
            if (topic) topic.mastery = Math.round(score.total / score.count);
        }
    }

    await Student.updateOne({ _id: studentId }, { $set: { subjects } });
}
