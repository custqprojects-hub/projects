import { pgTable, serial, text, integer, timestamp, varchar, date, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const studentsTable = pgTable("students", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    rollNumber: varchar("roll_number", { length: 50 }).notNull().unique(),
    classId: integer("class_id").notNull(),
    gender: varchar("gender", { length: 20 }).notNull(),
    dateOfBirth: date("date_of_birth"),
    phone: text("phone"),
    email: text("email"),
    parentName: text("parent_name"),
    parentPhone: text("parent_phone"),
    address: text("address"),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    admissionDate: date("admission_date").notNull(),
    avatarUrl: text("avatar_url"),
    userId: integer("user_id"),
    documents: jsonb("documents").default([]).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const insertStudentSchema = createInsertSchema(studentsTable).omit({ id: true, createdAt: true });
