
import { useState } from "react";
import { useListExams, useCreateExam, useUpdateExam, useListClasses, getListExamsQueryKey, getListClassesQueryKey, useDeleteExam,  } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Calendar, BookOpen, Trophy, XCircle, ChevronLeft, ChevronRight, Trash2, RotateCcw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusColors = {
    upcoming: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    ongoing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    completed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
};

const typeColors = {
    unit_test: "text-sky-400",
    midterm: "text-indigo-400",
    final: "text-pink-400",
    practical: "text-teal-400",
    external: "text-violet-400",
};

const ACTIVE_EXAM_STATUSES = new Set(["upcoming", "ongoing"]);

const emptyForm = { 
    name: "", 
    type: "unit_test", 
    classId: "", 
    startDate: "", 
    endDate: "", 
    maxMarks: "100", 
    passingMarks: "40", 
    startTime: "", 
    endTime: "", 
    room: "" 
};

function normalizeScheduleValue(value) {
    return value === undefined || value === null ? "" : String(value).trim().toLowerCase();
}

function isDuplicateExamSchedule(exam, data) {
    return ACTIVE_EXAM_STATUSES.has(exam.status) &&
        normalizeScheduleValue(exam.name) === normalizeScheduleValue(data.name) &&
        normalizeScheduleValue(exam.type) === normalizeScheduleValue(data.type) &&
        Number(exam.classId) === Number(data.classId) &&
        normalizeScheduleValue(exam.startDate) === normalizeScheduleValue(data.startDate) &&
        normalizeScheduleValue(exam.endDate) === normalizeScheduleValue(data.endDate || data.startDate) &&
        normalizeScheduleValue(exam.startTime) === normalizeScheduleValue(data.startTime) &&
        normalizeScheduleValue(exam.endTime) === normalizeScheduleValue(data.endTime) &&
        normalizeScheduleValue(exam.room) === normalizeScheduleValue(data.room);
}

export default function Exams() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState("");
    const [form, setForm] = useState(emptyForm);
    const [scheduleMode, setScheduleMode] = useState("regular");
    const [selectedOriginalExam, setSelectedOriginalExam] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 7;

    const { data: exams = [], isLoading } = useListExams({ 
        query: { 
            queryKey: getListExamsQueryKey(), 
            staleTime: 10000 
        } 
    });

    const { data: classes = [] } = useListClasses({ 
        query: { 
            queryKey: getListClassesQueryKey(), 
            staleTime: 30000 
        } 
    });

    const createMutation = useCreateExam({
        mutation: {
            onSuccess: () => { 
                qc.invalidateQueries({ queryKey: getListExamsQueryKey() }); 
                setOpen(false); 
                setForm(emptyForm);
                setScheduleMode("regular");
                setSelectedOriginalExam(null);
                toast({ 
                    title: "Exam scheduled", 
                    description: "The exam schedule has been created." 
                }); 
            },
            onError: (error) => toast({ 
                title: "Error", 
                description: error?.status === 409 ? "An active exam with the same schedule already exists." : "Failed to schedule exam.", 
                variant: "destructive" 
            }),
        }
    });

    const updateMutation = useUpdateExam({ 
        mutation: { 
            onSuccess: () => qc.invalidateQueries({ queryKey: getListExamsQueryKey() }), 
            onError: () => toast({ 
                title: "Error", 
                description: "Failed to update exam.", 
                variant: "destructive" 
            }) 
        } 
    });

    const deleteMutation = useDeleteExam({
        mutation: {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListExamsQueryKey() });
                toast({
                    title: "Exam deleted",
                    description: "The exam has been permanently deleted.",
                });
            },
            onError: (error) => {
                toast({
                    title: "Error",
                    description: error?.message || "Failed to delete exam.",
                    variant: "destructive",
                });
            },
        }
    });

    const isAdmin = user?.role === "admin";
    const isTeacher = user?.role === "teacher";
    const canCreate = isAdmin;
    const isSupplyMode = scheduleMode === "supply";

    // Teachers can only create unit tests
    const availableTypes = isTeacher && !isAdmin
        ? [{ value: "unit_test", label: "Unit Test" }]
        : [
            { value: "unit_test", label: "Unit Test" },
            { value: "midterm", label: "Mid-Term" },
            { value: "final", label: "Final Exam" },
            { value: "practical", label: "Practical" },
            { value: "external", label: "External" },
        ];

    const filteredExams = filterStatus ? exams.filter(e => e.status === filterStatus) : exams;
    const upcoming = exams.filter(e => e.status === "upcoming");
    const ongoing = exams.filter(e => e.status === "ongoing");
    const completed = exams.filter(e => e.status === "completed");

    // Pagination calculations
    const totalPages = Math.ceil(filteredExams.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentExams = filteredExams.slice(startIndex, endIndex);

    // Reset to first page when filter changes
    const handleFilterChange = (status) => {
        setFilterStatus(status);
        setCurrentPage(1);
    };

    // Helper function to get minimum time for today
    const getMinTimeForToday = () => {
        const now = new Date();
        const currentDate = now.toISOString().split("T")[0];
        if (form.startDate === currentDate) {
            return now.toTimeString().slice(0, 5);
        }
        return undefined;
    };

    // Helper function to check if date is in the past
    const isDateInPast = (dateStr, timeStr = null) => {
        if (!dateStr) return false;
        
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        
        // If date is in the past
        if (dateStr < today) return true;
        
        // If date is today, check time
        if (dateStr === today && timeStr) {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const examTime = new Date();
            examTime.setHours(hours, minutes, 0, 0);
            return examTime < now;
        }
        
        return false;
    };

    // Helper function to check if two time periods overlap
    const doTimeRangesOverlap = (start1, end1, start2, end2) => {
        // If any time is missing, consider it as full day (no time restriction)
        if (!start1 || !end1 || !start2 || !end2) return true;
        
        // Convert times to minutes for easier comparison
        const toMinutes = (time) => {
            const [hours, minutes] = time.split(':').map(Number);
            return hours * 60 + minutes;
        };
        
        const s1 = toMinutes(start1);
        const e1 = toMinutes(end1);
        const s2 = toMinutes(start2);
        const e2 = toMinutes(end2);
        
        // Check if ranges overlap
        return (s1 < e2 && s2 < e1);
    };

    // Helper function to check if date ranges overlap
    const doDateRangesOverlap = (start1, end1, start2, end2) => {
        const s1 = new Date(start1);
        const e1 = new Date(end1 || start1);
        const s2 = new Date(start2);
        const e2 = new Date(end2 || start2);
        
        // Set time to end of day for end dates
        e1.setHours(23, 59, 59, 999);
        e2.setHours(23, 59, 59, 999);
        
        return (s1 <= e2 && s2 <= e1);
    };

    // Main function to check for exam conflicts
    const hasExamConflict = (newExam) => {
        const activeExams = exams.filter(exam => ACTIVE_EXAM_STATUSES.has(exam.status));
        
        for (const existingExam of activeExams) {
            // Only check conflicts for the same class
            if (Number(existingExam.classId) !== Number(newExam.classId)) continue;
            
            // Check if date ranges overlap
            const datesOverlap = doDateRangesOverlap(
                newExam.startDate,
                newExam.endDate || newExam.startDate,
                existingExam.startDate,
                existingExam.endDate || existingExam.startDate
            );
            
            if (!datesOverlap) continue;
            
            // Check if time ranges overlap (if both have times)
            const timesOverlap = doTimeRangesOverlap(
                newExam.startTime,
                newExam.endTime,
                existingExam.startTime,
                existingExam.endTime
            );
            
            if (timesOverlap) {
                return {
                    hasConflict: true,
                    conflictingExam: existingExam
                };
            }
        }
        
        return { hasConflict: false };
    };

    const openRegularExamDialog = () => {
        setScheduleMode("regular");
        setSelectedOriginalExam(null);
        setForm(emptyForm);
        setOpen(true);
    };

    const openSupplyExamDialog = (exam) => {
        setScheduleMode("supply");
        setSelectedOriginalExam(exam);
        setForm({
            ...emptyForm,
            name: `${exam.name} Supply`,
            type: exam.type || "unit_test",
            classId: String(exam.classId),
            maxMarks: String(exam.maxMarks ?? 100),
            passingMarks: String(exam.passingMarks ?? 40),
        });
        setOpen(true);
    };

    const scheduleExam = () => {
        // Check if start date is in the past
        if (form.startDate) {
            if (isDateInPast(form.startDate, form.startTime)) {
                toast({ 
                    title: "Invalid date/time", 
                    description: "Cannot schedule an exam in the past. Please select a future date and time.", 
                    variant: "destructive" 
                });
                return;
            }
        }

        if (form.startTime && form.endTime) {
            const [startH, startM] = form.startTime.split(":").map(Number);
            const [endH, endM] = form.endTime.split(":").map(Number);
            const diffMinutes = (endH * 60 + endM) - (startH * 60 + startM);
            if (diffMinutes < 30) {
                toast({ 
                    title: "Invalid time range", 
                    description: "Exam must have at least 30 minutes duration between start and end time.", 
                    variant: "destructive" 
                });
                return;
            }
        }

        const payload = { 
            name: form.name, 
            type: form.type, 
            classId: parseInt(form.classId), 
            startDate: form.startDate, 
            endDate: form.endDate || form.startDate, 
            maxMarks: parseInt(form.maxMarks), 
            passingMarks: parseInt(form.passingMarks), 
            startTime: form.startTime || null, 
            endTime: form.endTime || null, 
            room: form.room || null,
            isSupply: isSupplyMode,
            originalExamId: selectedOriginalExam?.id,
        };

        // Check for scheduling conflicts
        const conflictCheck = hasExamConflict(payload);
        if (conflictCheck.hasConflict) {
            const conflictingExam = conflictCheck.conflictingExam;
            toast({ 
                title: "Schedule Conflict", 
                description: `This class already has an exam "${conflictingExam.name}" scheduled on ${conflictingExam.startDate}${conflictingExam.startTime ? ` at ${conflictingExam.startTime}` : ''}. Please choose a different date or time.`, 
                variant: "destructive" 
            });
            return;
        }

        // Check for exact duplicate (keeping your existing check)
        if (exams.some(exam => isDuplicateExamSchedule(exam, payload))) {
            toast({ 
                title: "Duplicate exam schedule", 
                description: "An active exam with the same schedule already exists for this class.", 
                variant: "destructive" 
            });
            return;
        }

        createMutation.mutate({ data: payload });
    };

    const cancelExam = (exam) => {
        if (!window.confirm(`Cancel ${exam.name}? This will mark the exam schedule as cancelled.`))
            return;
        updateMutation.mutate({ id: exam.id, data: { status: "cancelled" } });
    };

    const deleteExam = (exam) => {
        if (!window.confirm(`Delete ${exam.name} permanently?\n\nThis action cannot be undone.`)) {
            return;
        }

        if (exam.status === "ongoing") {
            toast({
                title: "Cannot delete",
                description: "Ongoing exams cannot be deleted.",
                variant: "destructive"
            });
            return;
        }

        deleteMutation.mutate({ id: exam.id });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-pink-400">Examinations</h1>
                    <p className="text-muted-foreground text-sm mt-1">Schedule and manage all exams</p>
                </div>
                {canCreate && (
                    <Dialog
                        open={open}
                        onOpenChange={(isOpen) => {
                            setOpen(isOpen);
                            if (!isOpen) {
                                setForm(emptyForm);
                                setScheduleMode("regular");
                                setSelectedOriginalExam(null);
                            }
                        }}
                    >
                        <DialogTrigger asChild>
                            <Button
                                className="gap-2 bg-pink-500/10 text-pink-400 border border-pink-500/30 hover:bg-pink-500/20"
                                onClick={openRegularExamDialog}
                            >
                                <Plus className="w-4 h-4"/>Schedule Exam
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>{isSupplyMode ? "Schedule Supply Exam" : "Schedule New Exam"}</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div>
                                    <Label>Exam Name *</Label>
                                    <input 
                                        value={form.name} 
                                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                                        disabled={isSupplyMode}
                                        className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background disabled:cursor-not-allowed disabled:opacity-70" 
                                        placeholder="e.g. Unit Test 1 - Mathematics"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Exam Type *</Label>
                                        <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))} disabled={isSupplyMode}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {availableTypes.map(t => (
                                                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Class *</Label>
                                        <Select value={form.classId} onValueChange={v => setForm(f => ({ ...f, classId: v }))} disabled={isSupplyMode}>
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Select class"/>
                                            </SelectTrigger>
                                            <SelectContent>
                                                {classes.map(c => (
                                                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Start Date *</Label>
                                        <input 
                                            type="date" 
                                            value={form.startDate} 
                                            min={new Date().toISOString().split("T")[0]} 
                                            onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} 
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                        />
                                    </div>
                                    <div>
                                        <Label>End Date</Label>
                                        <input 
                                            type="date" 
                                            value={form.endDate} 
                                            min={form.startDate || new Date().toISOString().split("T")[0]} 
                                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} 
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                        />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Max Marks *</Label>
                                        <input 
                                            type="number" 
                                            value={form.maxMarks} 
                                            min="1"
                                            onChange={e => setForm(f => ({ ...f, maxMarks: e.target.value }))} 
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                        />
                                    </div>
                                    <div>
                                        <Label>Passing Marks *</Label>
                                        <input 
                                            type="number" 
                                            value={form.passingMarks} 
                                            min="0"
                                            onChange={e => setForm(f => ({ ...f, passingMarks: e.target.value }))} 
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Start Time</Label>
                                        <input 
                                            type="time" 
                                            value={form.startTime} 
                                            min={getMinTimeForToday()}
                                            onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} 
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                        />
                                    </div>
                                    <div>
                                        <Label>End Time</Label>
                                        <input 
                                            type="time" 
                                            value={form.endTime} 
                                            min={form.startTime || getMinTimeForToday()}
                                            onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} 
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                        />
                                    </div>
                                </div>
                                <div>
                                    <Label>Assigned Room</Label>
                                    <input 
                                        type="text" 
                                        value={form.room} 
                                        onChange={e => setForm(f => ({ ...f, room: e.target.value }))} 
                                        className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                        placeholder="e.g. Room 402 / Exam Hall B"
                                    />
                                </div>
                                <Button 
                                    className="w-full" 
                                    disabled={!form.name || !form.classId || !form.startDate || createMutation.isPending} 
                                    onClick={scheduleExam}
                                >
                                    {createMutation.isPending ? "Scheduling..." : isSupplyMode ? "Schedule Supply Exam" : "Schedule Exam"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="glass-card glass-hover border-t-2 border-t-blue-400/30">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Calendar className="w-5 h-5 text-blue-400"/>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Upcoming</p>
                            <p className="text-2xl font-bold text-blue-400">{upcoming.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card glass-hover border-t-2 border-t-amber-400/30">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <BookOpen className="w-5 h-5 text-amber-400"/>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Ongoing</p>
                            <p className="text-2xl font-bold text-amber-400">{ongoing.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card glass-hover border-t-2 border-t-emerald-400/30">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <Trophy className="w-5 h-5 text-emerald-400"/>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Completed</p>
                            <p className="text-2xl font-bold text-emerald-400">{completed.length}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Filter */}
            <div className="flex gap-2 flex-wrap">
                {["", "upcoming", "ongoing", "completed", "cancelled"].map(s => (
                    <Button 
                        key={s} 
                        variant={filterStatus === s ? "default" : "outline"} 
                        size="sm" 
                        className={filterStatus === s ? "bg-pink-500/20 text-pink-400 border-pink-500/30" : "text-xs"} 
                        onClick={() => handleFilterChange(s)}
                    >
                        {s === "" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </Button>
                ))}
            </div>

            {/* Exam List with Pagination */}
            <Card className="glass-card border-t-2 border-t-pink-400/30">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-pink-400"/>All Examinations
                        </CardTitle>
                        {!isLoading && filteredExams.length > 0 && (
                            <span className="text-sm text-muted-foreground">
                                Showing {startIndex + 1}-{Math.min(endIndex, filteredExams.length)} of {filteredExams.length}
                            </span>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 7 }).map((_, i) => (
                                <Skeleton key={i} className="h-16 w-full"/>
                            ))}
                        </div>
                    ) : filteredExams.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No exams found.</div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                {currentExams.map(exam => (
                                    <div key={exam.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-pink-500/5 hover:border-pink-500/20 transition-colors gap-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                <p className="font-semibold">{exam.name}</p>
                                                <Badge className={`text-xs border ${statusColors[exam.status ?? "upcoming"]}`}>
                                                    {exam.status}
                                                </Badge>
                                                {exam.isSupply && (
                                                    <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-400">
                                                        Supply
                                                    </Badge>
                                                )}
                                                <span className={`text-xs font-medium capitalize ${typeColors[exam.type ?? "unit_test"] ?? "text-muted-foreground"}`}>
                                                    {exam.type?.replace("_", " ")}
                                                </span>
                                            </div>
                                            <p className="text-sm text-muted-foreground">{exam.className}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                {exam.startDate} {exam.endDate ? `-> ${exam.endDate}` : ""}
                                                {exam.startTime && ` · ${exam.startTime}`}
                                                {exam.endTime && ` - ${exam.endTime}`}
                                                {exam.room && ` · Room: ${exam.room}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <p className="text-sm font-medium">Max: {exam.maxMarks}</p>
                                                <p className="text-xs text-muted-foreground">Pass: {exam.passingMarks}</p>
                                            </div>
                                            {isAdmin && exam.status === "upcoming" && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="text-xs text-amber-400 border-amber-500/30" 
                                                    onClick={() => updateMutation.mutate({ id: exam.id, data: { status: "ongoing" } })}
                                                >
                                                    Start
                                                </Button>
                                            )}
                                            {isAdmin && exam.status === "ongoing" && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="text-xs text-emerald-400 border-emerald-500/30" 
                                                    onClick={() => updateMutation.mutate({ id: exam.id, data: { status: "completed" } })}
                                                >
                                                    Complete
                                                </Button>
                                            )}
                                            {isAdmin && exam.status === "completed" && !exam.isSupply && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="text-xs text-cyan-400 border-cyan-500/30 gap-1"
                                                    onClick={() => openSupplyExamDialog(exam)}
                                                >
                                                    <RotateCcw className="w-3 h-3"/>Schedule Supply
                                                </Button>
                                            )}
                                            {(isAdmin || isTeacher) && ["upcoming", "ongoing"].includes(exam.status) && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="text-xs text-red-400 border-red-500/30 gap-1" 
                                                    onClick={() => cancelExam(exam)}
                                                >
                                                    <XCircle className="w-3 h-3"/>Cancel
                                                </Button>
                                            )}
                                             {isAdmin && ["upcoming", "cancelled"].includes(exam.status ?? "") && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    className="text-xs text-red-500 hover:text-red-600 border-red-500/30 hover:bg-red-500/10 gap-1"
                                                    onClick={() => deleteExam(exam)}
                                                    disabled={deleteMutation.isPending}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    Delete
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Pagination Controls */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between gap-4 mt-6 pt-4 border-t border-border/50">
                                    <div className="text-sm text-muted-foreground">
                                        Page {currentPage} of {totalPages}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                            disabled={currentPage === 1}
                                            className="gap-1"
                                        >
                                            <ChevronLeft className="w-4 h-4"/>
                                            Previous
                                        </Button>
                                        <div className="flex gap-1">
                                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                                let pageNum;
                                                if (totalPages <= 5) {
                                                    pageNum = i + 1;
                                                } else if (currentPage <= 3) {
                                                    pageNum = i + 1;
                                                } else if (currentPage >= totalPages - 2) {
                                                    pageNum = totalPages - 4 + i;
                                                } else {
                                                    pageNum = currentPage - 2 + i;
                                                }
                                                
                                                return (
                                                    <Button
                                                        key={pageNum}
                                                        variant={currentPage === pageNum ? "default" : "outline"}
                                                        size="sm"
                                                        onClick={() => setCurrentPage(pageNum)}
                                                        className={`w-8 h-8 p-0 ${
                                                            currentPage === pageNum 
                                                                ? "bg-pink-500/20 text-pink-400 border-pink-500/30" 
                                                                : ""
                                                        }`}
                                                    >
                                                        {pageNum}
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                            disabled={currentPage === totalPages}
                                            className="gap-1"
                                        >
                                            Next
                                            <ChevronRight className="w-4 h-4"/>
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
