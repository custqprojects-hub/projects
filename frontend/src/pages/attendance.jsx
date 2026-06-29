import { useEffect, useState } from "react";
import { useListAttendance, useListClasses, useMarkAttendance, useListStudents, useListStaff, getListAttendanceQueryKey, getListClassesQueryKey, getListStudentsQueryKey, getListStaffQueryKey, UserRole } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Clock, AlertCircle, Plus, Grid3X3, User, BookOpen, TrendingUp, TrendingDown, Minus, Users, CalendarDays, X, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const statusConfig = {
    present: {
        label: "Present",
        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
        bgColor: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
        dotColor: "bg-emerald-400",
        icon: CheckCircle,
        quick: "P",
    },
    absent: {
        label: "Absent",
        color: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
        bgColor: "bg-red-500/15 border-red-500/30 text-red-400",
        dotColor: "bg-red-400",
        icon: XCircle,
        quick: "A",
    },
    late: {
        label: "Late",
        color: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400",
        bgColor: "bg-amber-500/15 border-amber-500/30 text-amber-400",
        dotColor: "bg-amber-400",
        icon: Clock,
        quick: "L",
    },
    half_day: {
        label: "Half Day",
        color: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
        bgColor: "bg-blue-500/15 border-blue-500/30 text-blue-400",
        dotColor: "bg-blue-400",
        icon: AlertCircle,
        quick: "H",
    },
};
const periodStatusConfig = {
    present: statusConfig.present,
    absent: statusConfig.absent,
    late: statusConfig.late,
};
const getClassLevel = (cls) => {
    const raw = String(cls?.grade ?? cls?.name ?? "");
    const match = raw.match(/\d+/);
    return match ? Number(match[0]) : null;
};
const isPeriodwiseClass = (cls) => {
    const level = getClassLevel(cls);
    return level !== null && level >= 6;
};
const getAttendanceMode = (cls) => (isPeriodwiseClass(cls) ? "periodwise" : "daily");
const BEHAVIOR_CATEGORIES = [
    { value: "bullying", label: "Bullying", type: "negative" },
    { value: "late_coming", label: "Late Coming", type: "negative" },
    { value: "uniform_violation", label: "Uniform Violation", type: "negative" },
    { value: "property_damage", label: "Property Damage", type: "negative" },
    { value: "disruptive_behavior", label: "Disruptive Behavior", type: "negative" },
    { value: "fighting", label: "Fighting", type: "negative" },
    { value: "achievement", label: "Academic Achievement", type: "positive" },
    { value: "sports_win", label: "Sports Win", type: "positive" },
    { value: "leadership", label: "Leadership", type: "positive" },
    { value: "helping_others", label: "Helping Others", type: "positive" },
    { value: "full_attendance", label: "Full Attendance", type: "positive" },
    { value: "counseling", label: "Counseling Session", type: "neutral" },
    { value: "other", label: "Other", type: "neutral" },
];
const behaviorTypeConfig = {
    positive: { color: "bg-emerald-500/10 text-emerald-400", icon: TrendingUp },
    negative: { color: "bg-red-500/10 text-red-400", icon: TrendingDown },
    neutral: { color: "bg-blue-500/10 text-blue-400", icon: Minus },
};
const summarizeAttendance = (rows = []) => {
    const counted = rows.filter((r) => r.status !== "excused");
    const present = counted.reduce((sum, r) => sum + (r.status === "present" || r.status === "late" ? 1 : r.status === "half_day" ? 0.5 : 0), 0);
    const absent = counted.length - present;
    return {
        total: counted.length,
        present,
        absent,
        percentage: counted.length > 0 ? Math.round((present / counted.length) * 100) : 0,
    };
};
const summarizeStudentDayAttendance = (rows = []) => {
    const buckets = new Map();
    const workingDays = new Set();
    rows.forEach((row) => {
        workingDays.add(String(row.date));
        const key = `${row.studentId}:${row.date}`;
        const bucket = buckets.get(key) ?? [];
        bucket.push(row);
        buckets.set(key, bucket);
    });
    let total = 0;
    let present = 0;
    let absent = 0;
    for (const bucket of buckets.values()) {
        const statuses = bucket.map((r) => r.status);
        if (statuses.every((status) => status === "excused"))
            continue;
        total += 1;
        const credit = statuses.some((status) => status === "present" || status === "late")
            ? 1
            : statuses.some((status) => status === "half_day")
                ? 0.5
                : 0;
        present += credit;
        absent += 1 - credit;
    }
    return {
        total,
        present,
        absent,
        workingDays: workingDays.size,
        percentage: total > 0 ? Math.round((present / total) * 100) : 0,
    };
};
const getPeriodDisplayLabel = (slot, index) => `Period ${index + 1}`;
export default function Attendance() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const today = new Date().toISOString().split("T")[0];
    const isAdmin = user?.role === "admin";
    const isTeacherOrAdmin = isAdmin || user?.role === "teacher";
    const [activeTab, setActiveTab] = useState("attendance");
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedDate, setSelectedDate] = useState(isTeacherOrAdmin ? today : "");
    const [open, setOpen] = useState(false);
    const [gridMode, setGridMode] = useState(false);
    const [gridStatuses, setGridStatuses] = useState({});
    const [form, setForm] = useState({ studentId: "", classId: "", date: today, status: "present", remarks: "" });
    const [behaviorOpen, setBehaviorOpen] = useState(false);
    const [behaviorLogs, setBehaviorLogs] = useState([]);
    const [behaviorLoading, setBehaviorLoading] = useState(false);
    const [behaviorForm, setBehaviorForm] = useState({ studentId: "", type: "negative", category: "bullying", description: "", date: today, points: "" });
    const [behaviorSubmitting, setBehaviorSubmitting] = useState(false);
    const [mode, setMode] = useState("view");
    const [bulkAttendance, setBulkAttendance] = useState({});
    const [saving, setSaving] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [attendanceMode, setAttendanceMode] = useState("manual");
    const [selectedPeriod, setSelectedPeriod] = useState("");
    const [periodEntryMode, setPeriodEntryMode] = useState("view");
    const [periodStatuses, setPeriodStatuses] = useState({});
    const [periodRemarks, setPeriodRemarks] = useState({});
    const [periodSaving, setPeriodSaving] = useState(false);
    const [staffDate, setStaffDate] = useState(today);
    const [staffDepartment, setStaffDepartment] = useState("");
    const [staffFilter, setStaffFilter] = useState("");
    const [updatedRecords, setUpdatedRecords] = useState({});
    const { data: classes = [] } = useListClasses({ query: { queryKey: getListClassesQueryKey(), staleTime: 30000 } });
    const periodwiseClasses = classes.filter(isPeriodwiseClass);
    const selectedClassInfo = selectedClass ? classes.find((c) => String(c.id) === selectedClass) ?? null : null;
    const selectedClassMode = selectedClassInfo ? getAttendanceMode(selectedClassInfo) : null;
    const selectedClassLabel = selectedClassInfo?.name ?? (selectedClassInfo ? `Class ${selectedClassInfo.grade}-${selectedClassInfo.section}` : "");
    const isTeacher = user?.role === "teacher";
    // Roster lookups are only needed for admin/teacher views (bulk entry, name lookup).
    // Student/parent receive server-scoped data and have no need for the full roster.
    const canSeeRoster = user?.role === "admin" || user?.role === "teacher";
    const { data: allStudents = [] } = useListStudents({}, { query: { queryKey: getListStudentsQueryKey(), staleTime: 30000, enabled: canSeeRoster } });
    const { data: allStaff = [] } = useListStaff({}, { query: { queryKey: getListStaffQueryKey(), staleTime: 30000, enabled: canSeeRoster } });
    const myStaffRecord = isTeacher ? allStaff.find((s) => s.userId === user?.id || s.email === user?.email) ?? null : null;
    const handleClassChange = (value) => {
        const nextClassId = value === "all" ? "" : value;
        setSelectedClass(nextClassId);
        setMode("view");
        setGridMode(false);
        setSelectedPeriod("");
        setPeriodEntryMode("view");
        setPeriodStatuses({});
        setPeriodRemarks({});
        if (!nextClassId)
            return;
        const nextClassInfo = classes.find((c) => String(c.id) === nextClassId) ?? null;
        if (nextClassInfo) {
            setActiveTab(getAttendanceMode(nextClassInfo) === "periodwise" ? "periodwise" : "attendance");
        }
    };
    const params = {};
    if (selectedClass)
        params.classId = selectedClass;
    if (selectedDate)
        params.date = selectedDate;
    // Student/parent scoping is enforced server-side via session role â€” do NOT
    // pass studentId=user.id (user.id is the auth user id, not the student row id)
    // and do NOT pass parentId (unsupported and would 403 as out-of-scope).
    const { data: records = [], isLoading } = useListAttendance(params, { query: { queryKey: getListAttendanceQueryKey(params), staleTime: 5000 } });
    useEffect(() => {
        if (!selectedClassInfo)
            return;
        const nextTab = selectedClassMode === "periodwise" ? "periodwise" : "attendance";
        if (activeTab !== nextTab) {
            setActiveTab(nextTab);
        }
        setSelectedPeriod("");
        setPeriodEntryMode("view");
        setPeriodStatuses({});
        setPeriodRemarks({});
    }, [activeTab, selectedClassInfo, selectedClassMode]);
    const dayName = selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", { weekday: "long" }) : "";
    const timetableParams = new URLSearchParams();
    if (selectedClass)
        timetableParams.set("classId", selectedClass);
    const { data: timetableSlots = [] } = useQuery({
        queryKey: ["timetable", selectedClass],
        queryFn: async () => {
            const res = await fetch(`/api/timetable${timetableParams.toString() ? `?${timetableParams}` : ""}`, { credentials: "include" });
            if (!res.ok)
                throw new Error("Failed to load timetable");
            return res.json();
        },
        enabled: activeTab === "periodwise",
        staleTime: 30000,
    });
    const periodSlots = timetableSlots
        .filter((slot) => !selectedClass || periodwiseClasses.some((c) => String(c.id) === String(slot.classId)))
        .filter((slot) => !dayName || slot.dayOfWeek === dayName)
        .filter((slot) => !isTeacher || !myStaffRecord || String(slot.staffId) === String(myStaffRecord.id))
        .sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
    const teacherPeriodClassIds = new Set(timetableSlots.map((slot) => String(slot.classId)));
    const periodClassOptions = isTeacher
        ? periodwiseClasses.filter((cls) => teacherPeriodClassIds.has(String(cls.id)))
        : periodwiseClasses;
    const periodParams = new URLSearchParams();
    if (selectedClass)
        periodParams.set("classId", selectedClass);
    if (selectedDate)
        periodParams.set("date", selectedDate);
    if (selectedPeriod)
        periodParams.set("timetableSlotId", selectedPeriod);
    const { data: periodRecords = [], isLoading: periodLoading } = useQuery({
        queryKey: ["period-attendance", selectedClass, selectedDate, selectedPeriod],
        queryFn: async () => {
            const res = await fetch(`/api/attendance/period${periodParams.toString() ? `?${periodParams}` : ""}`, { credentials: "include" });
            if (!res.ok)
                throw new Error("Failed to load period attendance");
            return res.json();
        },
        enabled: activeTab === "periodwise",
        staleTime: 5000,
    });
    const monthlyParams = {};
    if (selectedClass)
        monthlyParams.classId = selectedClass;
    const { data: monthlyRecords = [] } = useListAttendance(monthlyParams, { query: { queryKey: getListAttendanceQueryKey(monthlyParams), staleTime: 30000, enabled: activeTab === "attendance" } });
    const periodDayParams = {};
    if (selectedClass)
        periodDayParams.classId = selectedClass;
    if (selectedDate)
        periodDayParams.date = selectedDate;
    const { data: periodDayRecords = [] } = useQuery({
        queryKey: ["period-attendance-day", selectedClass, selectedDate],
        queryFn: async () => {
            const res = await fetch(`/api/attendance/period${new URLSearchParams(periodDayParams).toString() ? `?${new URLSearchParams(periodDayParams)}` : ""}`, { credentials: "include" });
            if (!res.ok)
                throw new Error("Failed to load period attendance");
            return res.json();
        },
        enabled: activeTab === "periodwise",
        staleTime: 5000,
    });
    const periodMonthlyParams = {};
    if (selectedClass)
        periodMonthlyParams.classId = selectedClass;
    const { data: periodMonthlyRecords = [] } = useQuery({
        queryKey: ["period-attendance-month", selectedClass],
        queryFn: async () => {
            const res = await fetch(`/api/attendance/period${new URLSearchParams(periodMonthlyParams).toString() ? `?${new URLSearchParams(periodMonthlyParams)}` : ""}`, { credentials: "include" });
            if (!res.ok)
                throw new Error("Failed to load period attendance");
            return res.json();
        },
        enabled: activeTab === "periodwise",
        staleTime: 30000,
    });
    const staffParams = new URLSearchParams();
    if (staffDate)
        staffParams.set("date", staffDate);
    if (staffDepartment)
        staffParams.set("department", staffDepartment);
    if (staffFilter)
        staffParams.set("staffId", staffFilter);
    const { data: staffRecords = [], isLoading: staffLoading } = useQuery({
        queryKey: ["staff-attendance", staffDate, staffDepartment, staffFilter],
        queryFn: async () => {
            const res = await fetch(`/api/attendance/staff${staffParams.toString() ? `?${staffParams}` : ""}`, { credentials: "include" });
            if (!res.ok)
                throw new Error("Failed to load staff attendance");
            return res.json();
        },
        enabled: activeTab === "staff" && isAdmin,
        staleTime: 5000,
    });
    const staffDepartments = Array.from(new Set(allStaff.map((staff) => String(staff.department ?? "").trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const departmentStaff = staffDepartment ? allStaff.filter((staff) => String(staff.department ?? "").trim() === staffDepartment) : [];
    const invalidateAttendanceSummaries = () => qc.invalidateQueries({
        predicate: (query) => {
            const key = String(query.queryKey?.[0] ?? "");
            return key.startsWith("/api/attendance/student/") || key === "/api/dashboard/attendance-overview";
        },
    });
    const markMutation = useMarkAttendance({
        mutation: {
            onSuccess: (record) => {
                markAsUpdated(record);
                qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
                invalidateAttendanceSummaries();
                setOpen(false);
            },
            onError: (err) => {
                toast({ title: "Failed to mark attendance", description: err?.message ?? "Please try again.", variant: "destructive" });
            },
        },
    });
    const isStudent = user?.role === UserRole.student;
    const isParent = user?.role === UserRole.parent;
    const myStudent = isStudent ? allStudents.find((s) => s.userId === user?.id) : null;
    // Server already scopes attendance records by session role. No client-side filter needed.
    const scopedRecords = records;
    const selectedMonth = (selectedDate || today).slice(0, 7);
    const selectedDay = selectedDate || today;
    const dailySummary = summarizeStudentDayAttendance(scopedRecords.filter((r) => r.date === selectedDay));
    const monthlySummary = summarizeStudentDayAttendance(monthlyRecords.filter((r) => String(r.date).startsWith(selectedMonth)));
    const periodDailySummary = summarizeStudentDayAttendance(periodDayRecords);
    const periodMonthlySummary = summarizeStudentDayAttendance(periodMonthlyRecords.filter((r) => String(r.date).startsWith(selectedMonth)));
    const classStudents = selectedClass
        ? allStudents.filter(s => String(s.classId) === selectedClass)
        : [];
    const periodwiseClassStudents = selectedClass && periodwiseClasses.some((c) => String(c.id) === selectedClass)
        ? classStudents
        : [];
    void isParent;
    void myStudent;
    const canUseDailyAttendance = !selectedClassMode || selectedClassMode === "daily";
    const canUsePeriodAttendance = !selectedClassMode || selectedClassMode === "periodwise";
    const selectedSlot = periodSlots.find((slot) => String(slot.id) === selectedPeriod);
    const periodExistingByStudent = {};
    for (const r of periodRecords) {
        if (!selectedPeriod || String(r.timetableSlotId) === selectedPeriod)
            periodExistingByStudent[r.studentId] = r;
    }
    const existingByStudent = {};
    for (const r of records) {
        existingByStudent[r.studentId] = r.status;
    }
    const markAsUpdated = (record) => {
        if (!record?.wasUpdated)
            return;
        const key = `${record.studentId}:${record.classId}:${record.date}:${record.timetableSlotId ?? "daily"}`;
        setUpdatedRecords((prev) => ({ ...prev, [key]: true }));
    };
    const handleGridSubmit = async () => {
        for (const [studentIdStr, status] of Object.entries(gridStatuses)) {
            const studentId = parseInt(studentIdStr);
            const record = await markMutation.mutateAsync({
                data: { studentId, classId: parseInt(selectedClass), date: selectedDate, status },
            });
            markAsUpdated(record);
        }
        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
        invalidateAttendanceSummaries();
        setGridStatuses({});
    };
    const cycleStatus = (studentId) => {
        const order = ["present", "absent", "late", "half_day"];
        const current = gridStatuses[studentId] ?? (existingByStudent[studentId] ?? "present");
        const next = order[(order.indexOf(current) + 1) % order.length];
        setGridStatuses((prev) => ({ ...prev, [studentId]: next }));
    };
    const loadBehaviorLogs = async (studentId) => {
        setBehaviorLoading(true);
        try {
            const url = studentId ? `/api/behavior-logs?studentId=${studentId}` : "/api/behavior-logs";
            const res = await fetch(url);
            if (res.ok)
                setBehaviorLogs(await res.json());
        }
        catch { }
        setBehaviorLoading(false);
    };
    const handleBehaviorTabClick = () => {
        setActiveTab("behavior");
        loadBehaviorLogs();
    };
    const handleAttendanceTabClick = () => {
        if (selectedClassMode === "periodwise") {
            setSelectedClass("");
            setSelectedPeriod("");
            setPeriodStatuses({});
            setPeriodRemarks({});
        }
        setActiveTab("attendance");
    };
    const handleBehaviorSubmit = async () => {
        if (!behaviorForm.studentId || !behaviorForm.description || !behaviorForm.date)
            return;
        setBehaviorSubmitting(true);
        try {
            const res = await fetch("/api/behavior-logs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: parseInt(behaviorForm.studentId),
                    type: behaviorForm.type,
                    category: behaviorForm.category,
                    description: behaviorForm.description,
                    date: behaviorForm.date,
                    points: behaviorForm.points ? parseInt(behaviorForm.points) : (behaviorForm.type === "positive" ? 5 : -5),
                }),
            });
            if (res.ok) {
                toast({ title: "Behavior log added successfully" });
                setBehaviorOpen(false);
                setBehaviorForm({ studentId: "", type: "negative", category: "bullying", description: "", date: today, points: "" });
                loadBehaviorLogs();
            }
            else {
                toast({ title: "Failed to add log", variant: "destructive" });
            }
        }
        catch {
            toast({ title: "Failed to add log", variant: "destructive" });
        }
        setBehaviorSubmitting(false);
    };
    const filteredCategories = BEHAVIOR_CATEGORIES.filter((c) => behaviorForm.type === "neutral" || c.type === behaviorForm.type || c.type === "neutral");
    const initBulkAttendance = () => {
        const initial = {};
        classStudents.forEach(s => { initial[s.id] = existingByStudent[s.id] ?? "present"; });
        setBulkAttendance(initial);
        setMode("bulk");
    };
    const toggleStatus = (studentId) => {
        setBulkAttendance(prev => ({
            ...prev,
            [studentId]: prev[studentId] === "present" ? "absent" : "present",
        }));
    };
    const setStatus = (studentId, status) => {
        setBulkAttendance(prev => ({ ...prev, [studentId]: status }));
    };
    const saveBulkAttendance = async () => {
        if (!selectedClass || Object.keys(bulkAttendance).length === 0)
            return;
        setSaving(true);
        try {
            let createdCount = 0;
            let updatedCount = 0;
            for (const [studentIdStr, status] of Object.entries(bulkAttendance)) {
                const record = await markMutation.mutateAsync({
                    data: {
                        studentId: parseInt(studentIdStr),
                        classId: parseInt(selectedClass),
                        date: selectedDate,
                        status: status,
                    }
                });
                if (record?.wasUpdated)
                    updatedCount += 1;
                else
                    createdCount += 1;
            }
            toast({ title: "Attendance updated", description: `${createdCount} new, ${updatedCount} corrected. No duplicate records saved.` });
            setMode("view");
            qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
            invalidateAttendanceSummaries();
        }
        catch {
            toast({ title: "Error saving attendance", variant: "destructive" });
        }
        setSaving(false);
    };
    const savePeriodAttendance = async () => {
        if (!selectedClass || !selectedPeriod || Object.keys(periodStatuses).length === 0)
            return;
        setPeriodSaving(true);
        try {
            let createdCount = 0;
            let updatedCount = 0;
            for (const [studentIdStr, status] of Object.entries(periodStatuses)) {
                const res = await fetch("/api/attendance/period", {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        studentId: Number(studentIdStr),
                        classId: Number(selectedClass),
                        timetableSlotId: Number(selectedPeriod),
                        date: selectedDate,
                        status,
                    remarks: periodRemarks[studentIdStr] || undefined,
                    }),
                });
                if (!res.ok) {
                    let message = "Failed to save period attendance";
                    try {
                        const payload = await res.json();
                        message = payload?.error || payload?.details || message;
                    }
                    catch {
                        const text = await res.text().catch(() => "");
                        if (text)
                            message = text;
                    }
                    throw new Error(message);
                }
                const record = await res.json();
                if (record?.wasUpdated)
                    updatedCount += 1;
                else
                    createdCount += 1;
                markAsUpdated(record);
            }
            toast({ title: "Period attendance updated", description: `${createdCount} new, ${updatedCount} corrected. No duplicate records saved.` });
            setPeriodEntryMode("view");
            setPeriodStatuses({});
            setPeriodRemarks({});
            qc.invalidateQueries({ queryKey: ["period-attendance"] });
            qc.invalidateQueries({ queryKey: ["period-attendance-day"] });
            qc.invalidateQueries({ queryKey: ["period-attendance-month"] });
            qc.invalidateQueries({ queryKey: getListAttendanceQueryKey() });
            invalidateAttendanceSummaries();
        }
        catch (err) {
            toast({ title: "Error saving period attendance", description: err?.message ?? "Please try again.", variant: "destructive" });
        }
        setPeriodSaving(false);
    };
    const presentCount = Object.values(bulkAttendance).filter(s => s === "present").length;
    const absentCount = Object.values(bulkAttendance).filter(s => s === "absent").length;
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Top summary cards â€” today's present/absent for students AND staff */}
      {isTeacherOrAdmin && (() => {
            const studentsPresent = records.filter(r => r.date === today && (r.status === "present" || r.status === "late")).length;
            const studentsAbsent = records.filter(r => r.date === today && r.status === "absent").length;
            // Staff attendance: derived from staff.status (active = on-duty / present today)
            const staffPresent = allStaff.filter((s) => s.status === "active").length;
            const staffAbsent = allStaff.filter((s) => s.status && s.status !== "active").length;
            return (<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
                    { label: "Students Present", value: studentsPresent, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: CheckCircle },
                    { label: "Students Absent", value: studentsAbsent, color: "text-red-400", bg: "bg-red-500/10", border: "border-t-red-500/40", icon: XCircle },
                    { label: "Staff Present", value: staffPresent, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-t-purple-500/40", icon: Users },
                    { label: "Staff Absent", value: staffAbsent, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-500/40", icon: AlertCircle },
                ].map(s => (<Card key={s.label} className={`glass-card glass-hover border-t-2 ${s.border}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className={`${s.bg} p-2 rounded-lg ${s.color}`}><s.icon className="w-4 h-4"/></div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}{s.sub && <span className="text-xs ml-1 opacity-70">({s.sub})</span>}</p>
                  </div>
                </CardContent>
              </Card>))}
          </div>);
        })()}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-cyan-400">Attendance &amp; Behavior</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isStudent ? "Your personal attendance record" : isParent ? "Your child's attendance" : "Track attendance and student behavior"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isTeacher && activeTab === "attendance" && mode === "view" && (<>
              <Button variant="outline" className="gap-2" onClick={() => setGridMode((g) => !g)}>
                <Grid3X3 className="w-4 h-4"/>
                {gridMode ? "List View" : "Grid Mark"}
              </Button>
              <Button className="gap-2" onClick={() => {
                if (!selectedClass) {
                    toast({ title: "Select a class first" });
                    return;
                }
                initBulkAttendance();
            }}>
                <Users className="w-4 h-4"/>
                Bulk Attendance
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Plus className="w-4 h-4"/>
                    Mark Single
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Mark Attendance</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                    <div>
                      <Label>Student *</Label>
                      <Select value={form.studentId} onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select student"/></SelectTrigger>
                        <SelectContent>
                          {allStudents.map((s) => (<SelectItem key={s.id} value={String(s.id)}>{s.name} â€” {s.className}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Class *</Label>
                      <Select value={form.classId} onValueChange={(v) => setForm((f) => ({ ...f, classId: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Select class"/></SelectTrigger>
                        <SelectContent>
                          {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Date *</Label>
                        <Input type="date" className="mt-1" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}/>
                      </div>
                      <div>
                        <Label>Status *</Label>
                        <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusConfig).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label>Remarks</Label>
                      <Input className="mt-1" value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} placeholder="Optional note"/>
                    </div>
                    <Button className="w-full" disabled={!form.studentId || !form.classId || markMutation.isPending} onClick={() => markMutation.mutate({
                data: {
                    studentId: parseInt(form.studentId),
                    classId: parseInt(form.classId),
                    date: form.date,
                    status: form.status,
                    remarks: form.remarks || undefined,
                },
            })}>
                      {markMutation.isPending ? "Savingâ€¦" : "Save Attendance"}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </>)}

          {isTeacherOrAdmin && activeTab === "behavior" && (<Dialog open={behaviorOpen} onOpenChange={setBehaviorOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4"/>
                  Log Behavior
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Log Student Behavior</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Student *</Label>
                    <Select value={behaviorForm.studentId} onValueChange={(v) => setBehaviorForm((f) => ({ ...f, studentId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select student"/></SelectTrigger>
                      <SelectContent>
                        {allStudents.map((s) => (<SelectItem key={s.id} value={String(s.id)}>{s.name} â€” {s.className}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {["positive", "negative", "neutral"].map((t) => (<button key={t} onClick={() => setBehaviorForm((f) => ({ ...f, type: t }))} className={`py-2 px-3 rounded-lg border text-xs font-medium capitalize transition-colors ${behaviorForm.type === t ? behaviorTypeConfig[t].color + " border-current/30" : "border-border text-muted-foreground hover:bg-accent/20"}`}>
                        {t}
                      </button>))}
                  </div>
                  <div>
                    <Label>Category *</Label>
                    <Select value={behaviorForm.category} onValueChange={(v) => setBehaviorForm((f) => ({ ...f, category: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((c) => (<SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Description *</Label>
                    <Textarea className="mt-1 resize-none" rows={3} value={behaviorForm.description} onChange={(e) => setBehaviorForm((f) => ({ ...f, description: e.target.value }))} placeholder="Describe what happenedâ€¦"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Date *</Label>
                      <Input type="date" className="mt-1" value={behaviorForm.date} onChange={(e) => setBehaviorForm((f) => ({ ...f, date: e.target.value }))}/>
                    </div>
                    <div>
                      <Label>Points</Label>
                      <Input type="number" className="mt-1" value={behaviorForm.points} onChange={(e) => setBehaviorForm((f) => ({ ...f, points: e.target.value }))} placeholder={behaviorForm.type === "positive" ? "+5" : "-5"}/>
                    </div>
                  </div>
                  <Button className="w-full" disabled={!behaviorForm.studentId || !behaviorForm.description || behaviorSubmitting} onClick={handleBehaviorSubmit}>
                    {behaviorSubmitting ? "Savingâ€¦" : "Save Behavior Log"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>)}

          {isTeacherOrAdmin && mode === "bulk" && (<>
              <Button variant="outline" onClick={() => setMode("view")}>Cancel</Button>
              <Button onClick={saveBulkAttendance} disabled={saving}>
                {saving ? "Saving..." : `Save (${presentCount}P / ${absentCount}A)`}
              </Button>
            </>)}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={activeTab === "attendance" ? "default" : "outline"} size="sm" onClick={handleAttendanceTabClick} className="gap-2">
          <CheckCircle className="w-4 h-4"/> Attendance
        </Button>
        <Button variant={activeTab === "periodwise" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("periodwise")} className="gap-2" disabled={!canUsePeriodAttendance}>
          <Clock className="w-4 h-4"/> Periodwise
        </Button>
        {isAdmin && (<Button variant={activeTab === "staff" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("staff")} className="gap-2">
            <Users className="w-4 h-4"/> Staff
        </Button>)}
        {isTeacherOrAdmin && (<Button variant={activeTab === "behavior" ? "default" : "outline"} size="sm" onClick={handleBehaviorTabClick} className="gap-2">
            <BookOpen className="w-4 h-4"/> Behavior Log
          </Button>)}
      </div>

      {/* â”€â”€â”€ ATTENDANCE TAB â”€â”€â”€ */}
      {activeTab === "attendance" && (<>
          {/* Student summary banner */}
          {isStudent && myStudent && (<Card className="border-cyan-500/20 bg-cyan-500/5">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="p-2 rounded-full bg-cyan-500/10">
                  <User className="w-5 h-5 text-cyan-400"/>
                </div>
                <div>
                  <p className="font-medium">{myStudent.name}</p>
                  <p className="text-sm text-muted-foreground">{myStudent.rollNumber} Â· {myStudent.className}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-2xl font-bold text-cyan-400">
                    {scopedRecords.length > 0 ? Math.round((scopedRecords.filter((r) => r.status === "present").length / scopedRecords.length) * 100) : "-"}
                    {scopedRecords.length > 0 ? "%" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">Attendance rate</p>
                </div>
              </CardContent>
            </Card>)}

          {/* Filters */}
              {mode === "view" && (<div className="flex flex-col sm:flex-row gap-3">
                {!isStudent && (<Select value={selectedClass || "all"} onValueChange={handleClassChange}>
                    <SelectTrigger className="sm:w-48"><SelectValue placeholder="All classes"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All classes</SelectItem>
                      {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                    </SelectContent>
                </Select>)}
              <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="sm:w-48"/>
              {isTeacherOrAdmin && (
                <Select value={attendanceMode} onValueChange={setAttendanceMode}>
                  <SelectTrigger className="sm:w-48"><SelectValue placeholder="Input Mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual Input</SelectItem>
                    <SelectItem value="rfid">RFID Scanner Mode</SelectItem>
                    <SelectItem value="biometric">Biometric Device Mode</SelectItem>
                  </SelectContent>
                </Select>
              )}
              <Button variant="outline" onClick={() => { setSelectedClass(""); setSelectedDate(isTeacherOrAdmin ? today : ""); setAttendanceMode("manual"); setMode("view"); }}>Reset</Button>
              </div>)}

            {selectedClass && selectedClassInfo && (<Card className={selectedClassMode === "periodwise" ? "border-blue-500/20 bg-blue-500/5 mt-3" : "border-cyan-500/20 bg-cyan-500/5 mt-3"}>
                <CardContent className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold">{selectedClassLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      {selectedClassMode === "periodwise"
                        ? "Classes 6+ use periodwise attendance. Daily attendance is calculated from period records."
                        : "Classes 1-5 use direct daily attendance."}
                    </p>
                    {selectedClassMode === "periodwise" && (
                      <p className="mt-1 text-xs text-blue-400 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        This class automatically opens Periodwise Attendance for admin and teacher.
                      </p>
                    )}
                  </div>
                  <Badge className={selectedClassMode === "periodwise" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"}>
                    {selectedClassMode === "periodwise" ? "Periodwise" : "Daily"}
                  </Badge>
                </CardContent>
              </Card>)}

          {isTeacher && attendanceMode !== "manual" && (
              <div className={`p-4 rounded-lg border flex items-center justify-between animate-in fade-in duration-300 mt-3 ${attendanceMode === "rfid" ? "bg-cyan-500/10 border-cyan-500/25 text-cyan-400" : "bg-purple-500/10 border-purple-500/25 text-purple-400"}`}>
              <div className="flex items-center gap-3">
                <div className={`w-2.5 h-2.5 rounded-full animate-ping ${attendanceMode === "rfid" ? "bg-cyan-400" : "bg-purple-400"}`} />
                <div className="text-xs">
                  <p className="font-semibold">{attendanceMode === "rfid" ? "RFID Integration Active" : "Biometric Device Sync Active"}</p>
                  <p className="opacity-80">{attendanceMode === "rfid" ? "Listening for RFID badge scans at local terminals..." : "Fetching fingerprint/facial recognition records from access gates..."}</p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="text-xs h-7 border-current/20 hover:bg-white/5" onClick={() => {
                toast({ title: attendanceMode === "rfid" ? "RFID Badge Detected" : "Biometric Match Confirmed", description: "Successfully synced latest entry records to attendance log." });
              }}>Simulate Scan</Button>
            </div>
          )}

          {/* Grid marking mode */}
          {gridMode && isTeacher && selectedClass && mode === "view" && (<Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Grid3X3 className="w-4 h-4 text-primary"/>
                  Grid Marking â€” {selectedDate} â€” Click to cycle P/A/L/E
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {classStudents.length === 0 ? (<p className="text-sm text-muted-foreground">No students in this class.</p>) : (<>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {classStudents.map((student) => {
                        const currentStatus = gridStatuses[student.id] ?? existingByStudent[student.id] ?? "present";
                        const cfg = statusConfig[currentStatus];
                        return (<button key={student.id} onClick={() => cycleStatus(student.id)} className={`p-3 rounded-lg border text-left transition-all hover:opacity-90 ${cfg.color} border-current/20`}>
                            <div className="flex items-center justify-between mb-1">
                              <p className="font-medium text-xs truncate">{student.name}</p>
                              <span className="font-bold text-xs">{cfg.quick}</span>
                            </div>
                            <p className="text-xs opacity-70">{student.rollNumber}</p>
                          </button>);
                    })}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        {Object.entries(statusConfig).map(([k, v]) => (<span key={k} className={`px-2 py-1 rounded ${v.color}`}>{v.quick} = {v.label}</span>))}
                      </div>
                      <Button className="ml-auto" size="sm" disabled={Object.keys(gridStatuses).length === 0 || markMutation.isPending} onClick={handleGridSubmit}>
                        {markMutation.isPending ? "Saving..." : `Submit ${Object.keys(gridStatuses).length} Records`}
                      </Button>
                    </div>
                  </>)}
              </CardContent>
            </Card>)}

          {/* Bulk marking grid */}
          {mode === "bulk" && isTeacher && classStudents.length > 0 && (<Card className="border-orange-500/20 bg-orange-500/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-orange-400"/>
                    Marking â€” {classes.find(c => String(c.id) === selectedClass)?.name} Â· {selectedDate}
                  </CardTitle>
                  <div className="flex gap-3 text-sm">
                    <span className="text-emerald-400 font-medium">{presentCount}P</span>
                    <span className="text-red-400 font-medium">{absentCount}A</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-2">
                  <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs" onClick={() => { const all = {}; classStudents.forEach(s => { all[s.id] = "present"; }); setBulkAttendance(all); }}>All Present</Button>
                  <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 text-xs" onClick={() => { const all = {}; classStudents.forEach(s => { all[s.id] = "absent"; }); setBulkAttendance(all); }}>All Absent</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {classStudents.map(student => {
                    const status = bulkAttendance[student.id] ?? "present";
                    const cfg = statusConfig[status] ?? statusConfig.present;
                    return (<div key={student.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all select-none ${cfg.bgColor}`} onClick={() => toggleStatus(student.id)}>
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarImage src={student.avatarUrl} />
                          <AvatarFallback className="text-xs bg-muted">{student.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{student.name}</p>
                          <p className="text-xs text-muted-foreground">{student.rollNumber}</p>
                        </div>
                        <Select value={status} onValueChange={v => setStatus(student.id, v)}>
                          <SelectTrigger className="w-24 h-7 text-xs border-0 bg-transparent p-1" onClick={e => e.stopPropagation()}>
                            <div className={`w-2 h-2 rounded-full ${cfg.dotColor} mr-1.5`}/>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(statusConfig).map(([k, v]) => (<SelectItem key={k} value={k} className="text-xs">{v.label}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>);
                })}
                </div>
              </CardContent>
            </Card>)}

          {mode === "bulk" && isTeacher && selectedClass && classStudents.length === 0 && (<Card className="glass-card border-t-2 border-t-cyan-500/30"><CardContent className="py-8 text-center text-muted-foreground">No students found in this class.</CardContent></Card>)}

          {mode === "view" && (<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="border border-cyan-500/20 bg-cyan-500/5">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Daily Percentage</p>
                      <p className="text-xs text-muted-foreground">{selectedDay}</p>
                    </div>
                    <p className={`text-2xl font-bold ${dailySummary.percentage < 75 ? "text-red-400" : "text-cyan-400"}`}>{dailySummary.percentage}%</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Percentage</p>
                      <p className="text-xs text-muted-foreground">{selectedMonth}</p>
                    </div>
                    <p className={`text-2xl font-bold ${monthlySummary.percentage < 75 ? "text-red-400" : "text-emerald-400"}`}>{monthlySummary.percentage}%</p>
                  </div>
                </CardContent>
              </Card>
            </div>)}

          {/* Stats Summary */}
          {mode === "view" && scopedRecords.length > 0 && (<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {Object.entries(statusConfig).map(([status, cfg]) => {
                    const count = scopedRecords.filter((r) => r.status === status).length;
                    const Icon = cfg.icon;
                    return (<Card key={status} className={`border ${cfg.bgColor}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <Icon className="w-5 h-5 shrink-0"/>
                      <div>
                        <p className="text-xs opacity-70">{cfg.label}</p>
                        <p className="text-xl font-bold">{count}</p>
                        <p className="text-xs opacity-60">{scopedRecords.length > 0 ? Math.round((count / scopedRecords.length) * 100) : 0}%</p>
                      </div>
                    </CardContent>
                  </Card>);
                })}
            </div>)}

          {/* Records List */}
          {mode === "view" && (<Card className="glass-card border-t-2 border-t-cyan-500/30">
              <CardHeader><CardTitle className="text-base font-serif">Attendance Records Â· {scopedRecords.length}</CardTitle></CardHeader>
              <CardContent>
                {isLoading ? (<div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-12 w-full"/>))}</div>) : scopedRecords.length === 0 ? (<div className="text-center py-12 text-muted-foreground">
                {isTeacher ? "No records for selected filters. Select a class and use 'Bulk Attendance' to get started." : "No attendance records found."}
                  </div>) : (<div className="space-y-2">
                    {scopedRecords.map((record) => {
                        const cfg = statusConfig[record.status] ?? statusConfig.present;
                        const Icon = cfg.icon;
                        const studentRecords = scopedRecords.filter(r => r.studentId === record.studentId);
                        const rate = studentRecords.length > 0
                            ? (studentRecords.filter(r => r.status === "present" || r.status === "late").length / studentRecords.length) * 100
                            : 100;
                        const isDanger = rate < 75;
                        const isSelected = selectedRecord?.id === record.id;
                        const updateKey = `${record.studentId}:${record.classId}:${record.date}:${record.timetableSlotId ?? "daily"}`;
                        const isUpdated = !!updatedRecords[updateKey];
                        return (<div key={record.id} className="rounded-lg border border-border/50 overflow-hidden transition-all">
                          <div className={`flex items-center justify-between p-3 cursor-pointer hover:bg-cyan-500/5 transition-colors group ${isSelected ? "bg-cyan-500/8 border-l-2 border-l-cyan-400" : ""}`} onClick={() => setSelectedRecord(isSelected ? null : record)}>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={record.studentAvatarUrl} />
                                <AvatarFallback className={`text-xs font-semibold ${cfg.bgColor}`}>{(record.studentName || "S").charAt(0)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className={`font-medium text-sm transition-colors ${isDanger ? "text-red-400 group-hover:text-red-300 font-semibold" : "group-hover:text-cyan-400"}`}>
                                  {record.studentName || `Student ${record.studentId}`}
                                  {isDanger && (
                                    <span className="text-[10px] ml-2 px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 font-mono">
                                      {Math.round(rate)}%
                                    </span>
                                  )}
                                </p>
                                <p className="text-xs text-muted-foreground">{record.className || `Class ${record.classId}`} Â· {record.date}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                              {isUpdated && <Badge className="text-xs border bg-amber-500/10 text-amber-400 border-amber-500/20">Updated</Badge>}
                              <Badge className={`text-xs border ${cfg.bgColor}`}>{cfg.label}</Badge>
                              <Button size="icon" variant="ghost" className={`h-7 w-7 ${isSelected ? "bg-cyan-500/15 text-cyan-400" : "hover:bg-cyan-500/10 hover:text-cyan-400"}`} onClick={() => setSelectedRecord(isSelected ? null : record)}>
                                <Eye className="h-3.5 w-3.5"/>
                              </Button>
                            </div>
                          </div>
                          {isSelected && (<div className="border-t border-cyan-500/20 bg-cyan-500/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                              <div className="flex items-center justify-between mb-3">
                                <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">Attendance Record</p>
                                <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground" onClick={() => setSelectedRecord(null)}><X className="h-3 w-3"/></Button>
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div><span className="text-xs text-muted-foreground block">Student</span><p className="font-medium">{record.studentName || `#${record.studentId}`}</p></div>
                                <div><span className="text-xs text-muted-foreground block">Class</span><p className="font-medium">{record.className || `Class ${record.classId}`}</p></div>
                                <div><span className="text-xs text-muted-foreground block">Date</span><p className="font-medium">{record.date}</p></div>
                                <div><span className="text-xs text-muted-foreground block">Status</span><div className="flex items-center gap-2 mt-0.5 flex-wrap"><Badge className={`text-xs border ${cfg.bgColor}`}>{cfg.label}</Badge>{isUpdated && <Badge className="text-xs border bg-amber-500/10 text-amber-400 border-amber-500/20">Updated</Badge>}</div></div>
                                {record.remarks && <div className="col-span-2 sm:col-span-4"><span className="text-xs text-muted-foreground block">Remarks</span><p className="font-medium italic">{record.remarks}</p></div>}
                              </div>
                            </div>)}
                        </div>);
                    })}
                  </div>)}
              </CardContent>
            </Card>)}
        </>)}

          {activeTab === "periodwise" && (<>
            <div className="flex flex-col sm:flex-row gap-3">
            {!isStudent && (<Select value={selectedClass || "all"} onValueChange={handleClassChange}>
                  <SelectTrigger className="sm:w-48"><SelectValue placeholder="All classes"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All classes</SelectItem>
                    {periodClassOptions.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                  </SelectContent>
              </Select>)}
            <Input type="date" value={selectedDate} onChange={(e) => { setSelectedDate(e.target.value); setSelectedPeriod(""); setPeriodEntryMode("view"); setPeriodStatuses({}); setPeriodRemarks({}); }} className="sm:w-48"/>
            <Select value={selectedPeriod || "all"} onValueChange={(v) => {
                const nextPeriod = v === "all" ? "" : v;
                setSelectedPeriod(nextPeriod);
                const slot = periodSlots.find((item) => String(item.id) === nextPeriod);
                if (slot?.classId)
                    setSelectedClass(String(slot.classId));
                setPeriodEntryMode("view");
                setPeriodStatuses({});
                setPeriodRemarks({});
            }}>
              <SelectTrigger className="sm:w-72"><SelectValue placeholder={isTeacher ? "Select period" : "All periods"}/></SelectTrigger>
              <SelectContent>
                {!isTeacher && <SelectItem value="all">All periods</SelectItem>}
                {periodSlots.map((slot, index) => (<SelectItem key={slot.id} value={String(slot.id)}>
                    {getPeriodDisplayLabel(slot, index)} · {slot.startTime}-{slot.endTime} · {slot.subjectName} · {slot.className}
                  </SelectItem>))}
              </SelectContent>
            </Select>
            {isTeacher && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={periodEntryMode === "bulk" ? "default" : "outline"} onClick={() => {
                  if (!selectedClass || !selectedPeriod || periodwiseClassStudents.length === 0) {
                    toast({ title: "Select a class and period first" });
                    return;
                  }
                  const initial = {};
                  const remarks = {};
                  periodwiseClassStudents.forEach((student) => {
                    initial[student.id] = periodExistingByStudent[student.id]?.status ?? "present";
                    remarks[student.id] = periodExistingByStudent[student.id]?.remarks ?? "";
                  });
                  setPeriodEntryMode("bulk");
                  setPeriodStatuses(initial);
                  setPeriodRemarks(remarks);
                }} disabled={!selectedClass || !selectedPeriod || periodwiseClassStudents.length === 0} className="gap-2">
                  <Users className="w-4 h-4" />
                  Mark Period
                </Button>
              </div>
            )}
          </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Card className="border border-blue-500/20 bg-blue-500/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Daily Roll-up</p>
                      <p className="text-xs text-muted-foreground">{selectedDate}</p>
                    </div>
                    <p className={`text-2xl font-bold ${periodDailySummary.percentage < 75 ? "text-red-400" : "text-blue-400"}`}>{periodDailySummary.percentage}%</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border border-emerald-500/20 bg-emerald-500/5">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-muted-foreground">Monthly Roll-up</p>
                      <p className="text-xs text-muted-foreground">{selectedMonth}</p>
                    </div>
                    <p className={`text-2xl font-bold ${periodMonthlySummary.percentage < 75 ? "text-red-400" : "text-emerald-400"}`}>{periodMonthlySummary.percentage}%</p>
                  </div>
                </CardContent>
              </Card>
          </div>

          {isTeacher && periodSlots.length === 0 && (<Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4 text-sm text-amber-300">
                No assigned periods found for this date. Choose a date that matches the timetable day, or ask admin to assign a Class 6+ period to this teacher.
              </CardContent>
            </Card>)}

          {isTeacher && selectedClass && selectedPeriod && periodwiseClassStudents.length === 0 && (<Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4 text-sm text-amber-300">
                This class has no students yet. Add students to the selected Class 6+ class before marking period attendance.
              </CardContent>
            </Card>)}

          {selectedClass && selectedPeriod && periodEntryMode === "view" && (<Card className="glass-card border-t-2 border-t-blue-500/30">
              <CardHeader>
                <CardTitle className="text-base font-serif">
                  Period Attendance Records · {selectedSlot?.subjectName ?? "Selected Period"} · {selectedDate}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {periodLoading ? (<div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-14 w-full"/>))}</div>) : periodwiseClassStudents.length === 0 ? (<div className="text-center py-10 text-muted-foreground">No students found for the selected class.</div>) : (<div className="space-y-2">
                    {periodwiseClassStudents.map((student) => {
                        const record = periodExistingByStudent[student.id];
                        const status = record?.status ?? "not_marked";
                        const cfg = periodStatusConfig[status] ?? null;
                        const isUpdated = !!updatedRecords[`${student.id}:${selectedClass}:${selectedDate}:${selectedPeriod}`];
                        return (<div key={student.id} className="rounded-lg border border-border/50 p-3 hover:bg-blue-500/5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <Avatar className="h-8 w-8 shrink-0">
                                  <AvatarImage src={student.avatarUrl}/>
                                  <AvatarFallback className="text-xs bg-muted">{student.name.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{student.name}</p>
                                  <p className="text-xs text-muted-foreground">{student.rollNumber}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                {isUpdated && <Badge className="text-xs border bg-amber-500/10 text-amber-400 border-amber-500/20">Updated</Badge>}
                                {record ? (<Badge className={`text-xs border ${cfg?.bgColor ?? ""}`}>{cfg?.label ?? record.status}</Badge>) : (<Badge className="text-xs border bg-muted text-muted-foreground">Not marked</Badge>)}
                              </div>
                            </div>
                            {record?.remarks && <p className="text-xs text-muted-foreground mt-2 italic">{record.remarks}</p>}
                          </div>);
                    })}
                  </div>)}
              </CardContent>
            </Card>)}

                    {isTeacher && selectedClass && selectedPeriod && periodEntryMode === "bulk" && (<Card className="border-blue-500/20 bg-blue-500/5">
              <CardHeader>
                <CardTitle className="text-base font-serif">
                  {selectedSlot?.subjectName ?? "Selected Period"} · {selectedSlot?.startTime}-{selectedSlot?.endTime} · {selectedDate}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs" onClick={() => { const all = {}; periodwiseClassStudents.forEach(s => { all[s.id] = "present"; }); setPeriodStatuses(all); }}>All Present</Button>
                  <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 text-xs" onClick={() => { const all = {}; periodwiseClassStudents.forEach(s => { all[s.id] = "absent"; }); setPeriodStatuses(all); }}>All Absent</Button>
                  <Button size="sm" variant="outline" className="text-muted-foreground text-xs" onClick={() => setPeriodStatuses({})}>Clear</Button>
                </div>
                <div className="space-y-2">
                  {periodwiseClassStudents.map((student) => {
                        const status = periodStatuses[student.id] ?? periodExistingByStudent[student.id]?.status ?? "present";
                        const cfg = periodStatusConfig[status] ?? periodStatusConfig.present;
                        return (<div key={student.id} className={`grid grid-cols-1 md:grid-cols-[1fr_180px_220px] gap-3 items-center p-3 rounded-lg border ${cfg.bgColor}`}>
                          <div className="flex items-center gap-3 min-w-0">
                            <Avatar className="h-8 w-8 shrink-0">
                              <AvatarImage src={student.avatarUrl}/>
                              <AvatarFallback className="text-xs bg-muted">{student.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{student.name}</p>
                              <p className="text-xs text-muted-foreground">{student.rollNumber}</p>
                            </div>
                          </div>
                          <Select value={status} onValueChange={(v) => setPeriodStatuses((prev) => ({ ...prev, [student.id]: v }))}>
                            <SelectTrigger className="h-8 bg-background/70"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              {Object.entries(periodStatusConfig).map(([key, value]) => (<SelectItem key={key} value={key}>{value.label}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Input value={periodRemarks[student.id] ?? ""} onChange={(e) => setPeriodRemarks((prev) => ({ ...prev, [student.id]: e.target.value }))} placeholder="Remarks" className="h-8 bg-background/70"/>
                        </div>);
                    })}
                </div>
                <div className="flex items-center justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => { setPeriodEntryMode("view"); setPeriodStatuses({}); setPeriodRemarks({}); }}>Cancel</Button>
                  <Button size="sm" onClick={savePeriodAttendance} disabled={periodSaving || Object.keys(periodStatuses).length === 0}>
                    {periodSaving ? "Saving..." : "Save Bulk"}
                  </Button>
                </div>
              </CardContent>
            </Card>)}

        </>)}

      {activeTab === "staff" && isAdmin && (<>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input type="date" value={staffDate} onChange={(e) => setStaffDate(e.target.value)} className="sm:w-48"/>
            <Select value={staffDepartment || "all"} onValueChange={(v) => { setStaffDepartment(v === "all" ? "" : v); setStaffFilter(""); }}>
              <SelectTrigger className="sm:w-64"><SelectValue placeholder="Select department"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All departments</SelectItem>
                {staffDepartments.map((department) => (<SelectItem key={department} value={department}>{department}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={staffFilter || "all"} onValueChange={(v) => setStaffFilter(v === "all" ? "" : v)} disabled={!!staffDepartments.length && !staffDepartment}>
              <SelectTrigger className="sm:w-72"><SelectValue placeholder={staffDepartment ? "Select staff" : "Choose department first"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All staff</SelectItem>
                {(staffDepartment ? departmentStaff : allStaff).map((staff) => (
                  <SelectItem key={staff.id} value={String(staff.id)}>
                    {staff.name} · {staff.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Card className="glass-card border-t-2 border-t-purple-500/30">
            <CardHeader><CardTitle className="text-base font-serif">Staff Attendance Records · {staffRecords.length}</CardTitle></CardHeader>
            <CardContent>
              {staffLoading ? (<div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-16 w-full"/>))}</div>) : staffRecords.length === 0 ? (<div className="text-center py-12 text-muted-foreground">No staff check-in or attendance records found for the selected filters.</div>) : (<div className="space-y-2">
                  {staffRecords.map((record) => {
                        const checkedIn = !!record.checkInTime;
                        const checkedOut = !!record.checkOutTime;
                        const sourceLabel = record.source === "staff_checkins" ? "Check-in/out" : "Staff attendance";
                        return (<div key={`${record.source ?? "staff"}-${record.id}`} className="rounded-lg border border-border/50 p-3 hover:bg-purple-500/5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-sm truncate">{record.staffName || `Staff ${record.staffId}`}</p>
                                <p className="text-xs text-muted-foreground">{record.staffDepartment || staffDepartment || "Department"} · {record.staffRole || "staff"} · {record.date}</p>
                                <p className="text-[11px] text-muted-foreground mt-1">
                                  {sourceLabel}
                                  {checkedIn && record.checkInTime ? ` · In ${new Date(record.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                                  {checkedOut && record.checkOutTime ? ` · Out ${new Date(record.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : ""}
                                </p>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={record.source === "staff_checkins" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"}>{sourceLabel}</Badge>
                                <Badge className={checkedOut ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : checkedIn ? "bg-amber-500/10 text-amber-400 border-amber-500/20" : "bg-muted text-muted-foreground"}>
                                  {checkedOut ? "Checked Out" : checkedIn ? "Checked In" : record.status || "Pending"}
                                </Badge>
                              </div>
                            </div>
                            {(record.checkInReason || record.checkOutReason || record.remarks) && (
                              <p className="text-xs text-muted-foreground mt-2 italic">
                                {record.checkInReason || record.checkOutReason || record.remarks}
                              </p>
                            )}
                          </div>);
                    })}
                </div>)}
            </CardContent>
          </Card>
        </>)}
      {/* â”€â”€â”€ BEHAVIOR LOG TAB â”€â”€â”€ */}
      {activeTab === "behavior" && (<>
          <div className="flex gap-3">
            <Select value="" onValueChange={(v) => loadBehaviorLogs(v || undefined)}>
              <SelectTrigger className="w-60"><SelectValue placeholder="Filter by student (all)"/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All students</SelectItem>
                {allStudents.map((s) => (<SelectItem key={s.id} value={String(s.id)}>{s.name} â€” {s.className}</SelectItem>))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => loadBehaviorLogs()}>Refresh</Button>
          </div>

          {behaviorLoading ? (<div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-20 w-full"/>))}</div>) : behaviorLogs.length === 0 ? (<Card><CardContent className="py-12 text-center text-muted-foreground">No behavior logs yet. Use "Log Behavior" to add the first entry.</CardContent></Card>) : (<div className="space-y-3">
              {behaviorLogs.map((log) => {
                    const cfg = behaviorTypeConfig[log.type] ?? behaviorTypeConfig.neutral;
                    const BIcon = cfg.icon;
                    return (<Card key={log.id} className={`border-l-4 ${log.type === "positive" ? "border-l-emerald-500" : log.type === "negative" ? "border-l-red-500" : "border-l-blue-500"}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-full ${cfg.color}`}><BIcon className="w-3.5 h-3.5"/></span>
                          <div>
                            <p className="font-medium text-sm">{log.studentName ?? `Student #${log.studentId}`}</p>
                            <p className="text-xs text-muted-foreground capitalize">{log.category?.replace(/_/g, " ")} Â· {log.date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {log.points !== undefined && log.points !== null && (<span className={`text-xs font-bold ${log.points > 0 ? "text-emerald-400" : "text-red-400"}`}>
                              {log.points > 0 ? "+" : ""}{log.points} pts
                            </span>)}
                          <Badge className={`text-xs capitalize ${cfg.color} border-0`}>{log.type}</Badge>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2 pl-8">{log.description}</p>
                    </CardContent>
                  </Card>);
                })}
            </div>)}
        </>)}
    </div>);
}