import { Router } from "express";
import { db } from "@workspace/db";
import { behaviorLogsTable, studentsTable, staffTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { requireRole } from "../middlewares/auth";
const router = Router();
router.get("/behavior-logs", requireRole("admin", "teacher", "student", "parent"), async (req, res) => {
    try {
        const { studentId } = req.query;
        let logs = await db.select().from(behaviorLogsTable).orderBy(desc(behaviorLogsTable.createdAt));
        if (studentId) {
            const sid = parseInt(String(studentId));
            logs = logs.filter((l) => l.studentId === sid);
        }
        const students = await db.select().from(studentsTable);
        const studentMap = Object.fromEntries(students.map((s) => [s.id, s.name]));
        const staff = await db.select().from(staffTable);
        const staffMap = Object.fromEntries(staff.map((s) => [s.id, s.name]));
        return res.json(logs.map((l) => ({
            ...l,
            studentName: studentMap[l.studentId] ?? null,
            teacherName: l.teacherId ? (staffMap[l.teacherId] ?? null) : null,
        })));
    }
    catch (err) {
        req.log.error({ err }, "List behavior logs error");
        return res.status(500).json({ error: "Internal server error" });
    }
});
router.post("/behavior-logs", requireRole("admin", "teacher"), async (req, res) => {
    try {
        const { studentId, teacherId, type, category, description, date, points } = req.body;
        if (!studentId || !category || !description || !date) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const [log] = await db
            .insert(behaviorLogsTable)
            .values({
            studentId: parseInt(String(studentId)),
            teacherId: teacherId ? parseInt(String(teacherId)) : null,
            type: type ?? "neutral",
            category,
            description,
            date,
            points: points ? parseInt(String(points)) : 0,
        })
            .returning();
        return res.status(201).json(log);
    }
    catch (err) {
        req.log.error({ err }, "Create behavior log error");
        return res.status(500).json({ error: "Internal server error" });
    }
});
export default router;
