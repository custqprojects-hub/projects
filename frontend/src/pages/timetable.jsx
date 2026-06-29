//timetable.jsx
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListClasses, useListSubjects, useListStaff } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Clock, Info } from "lucide-react";

async function apiFetch(url, init) {
    const res = await fetch(url, init);
    if (!res.ok) {
        const text = await res.text();
        try {
            const parsed = JSON.parse(text);
            throw new Error(parsed.error || parsed.message || text);
        }
        catch (err) {
            if (err instanceof Error && err.message !== text) {
                throw err;
            }
            throw new Error(text);
        }
    }
    if (res.status === 204)
        return null;
    return res.json();
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TODAY_DAY = new Date().toLocaleDateString("en-US", { weekday: "long" });

export default function Timetable() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [view, setView] = useState("weekly");
    const [selectedDay, setSelectedDay] = useState(DAYS.includes(TODAY_DAY) ? TODAY_DAY : "Monday");
    const [selectedClass, setSelectedClass] = useState("");
    const [form, setForm] = useState({ 
        classId: "", 
        subjectId: "", 
        staffId: "", 
        dayOfWeek: "Monday", 
        startTime: "08:00", 
        endTime: "08:45", 
        room: "" 
    });

    const { data: classes = [] } = useListClasses();
    const { data: subjects = [] } = useListSubjects();
    const { data: staff = [] } = useListStaff();

    // Show all subjects - no class restriction
    const formSubjects = subjects;

    // Show all teachers (only those with role "teacher")
    const teacherOptions = staff.filter(s => s.role === "teacher");

    const { data: slots = [], isLoading } = useQuery({
        queryKey: ["timetable", selectedClass],
        queryFn: () => {
            const params = selectedClass ? `?classId=${selectedClass}` : "";
            return apiFetch(`/api/timetable${params}`);
        },
        staleTime: 10000,
    });

    const createMutation = useMutation({
        mutationFn: (data) => apiFetch("/api/timetable", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(data) 
        }),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ["timetable"] }); 
            setOpen(false); 
            setForm({ 
                classId: "", 
                subjectId: "", 
                staffId: "", 
                dayOfWeek: "Monday", 
                startTime: "08:00", 
                endTime: "08:45", 
                room: "" 
            }); 
        },
        onError: (err) => {
            // Show error message from backend
            alert(err?.message || "Failed to add timetable period");
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id) => apiFetch(`/api/timetable/${id}`, { method: "DELETE" }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ["timetable"] }),
        onError: (err) => alert(err?.message || "Failed to delete timetable period"),
    });

    const canManagePeriods = user?.role === "admin";
    const showClassFilter = user?.role !== "student";
    
    // For teachers, they can only see their own classes
    const isTeacher = user?.role === "teacher";
    
    // Filter classes for teacher dropdown if needed
    const visibleClasses = isTeacher 
        ? classes.filter(c => {
            // Find teacher's staff record
            const teacherStaff = staff.find(s => s.userId === user?.id || s.email === user?.email);
            if (!teacherStaff) return false;
            // Check if this class has this teacher assigned or if teacher has timetable slots for this class
            return c.teacherId === teacherStaff.id || 
                   slots.some(slot => slot.classId === c.id && slot.staffId === teacherStaff.id);
          })
        : classes;
    
    const visibleSlots = slots;
    const classFilterOptions = isTeacher ? visibleClasses : classes;
    
    const slotsByDay = DAYS.reduce((acc, day) => {
        acc[day] = visibleSlots.filter((s) => s.dayOfWeek === day).sort((a, b) => a.startTime.localeCompare(b.startTime));
        return acc;
    }, {});

    const slotsBySubject = visibleSlots.reduce((acc, slot) => {
        const key = slot.subjectName || "Other";
        if (!acc[key]) acc[key] = [];
        acc[key].push(slot);
        return acc;
    }, {});

    const dayOrder = { "Monday": 1, "Tuesday": 2, "Wednesday": 3, "Thursday": 4, "Friday": 5, "Saturday": 6 };
    Object.keys(slotsBySubject).forEach(subject => {
        slotsBySubject[subject].sort((a, b) => {
            const dayDiff = dayOrder[a.dayOfWeek] - dayOrder[b.dayOfWeek];
            if (dayDiff !== 0) return dayDiff;
            return a.startTime.localeCompare(b.startTime);
        });
    });

    const dayColors = {
        Monday: "border-blue-500/30 bg-blue-500/5",
        Tuesday: "border-purple-500/30 bg-purple-500/5",
        Wednesday: "border-emerald-500/30 bg-emerald-500/5",
        Thursday: "border-amber-500/30 bg-amber-500/5",
        Friday: "border-pink-500/30 bg-pink-500/5",
        Saturday: "border-cyan-500/30 bg-cyan-500/5",
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-blue-400">Timetable</h1>
                    <p className="text-muted-foreground text-sm mt-1">Class schedule and period management</p>
                </div>
                {canManagePeriods && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2">
                                <Plus className="w-4 h-4"/>
                                Add Period
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader>
                                <DialogTitle>Add Timetable Slot</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div>
                                    <Label>Class</Label>
                                    <Select 
                                        value={form.classId} 
                                        onValueChange={v => {
                                            setForm(f => ({ 
                                                ...f, 
                                                classId: v
                                            }));
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select class"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {classes.map((c) => (
                                                <SelectItem key={c.id} value={String(c.id)}>
                                                    {c.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div>
                                    <Label>Subject</Label>
                                    <Select 
                                        value={form.subjectId} 
                                        onValueChange={v => setForm(f => ({ ...f, subjectId: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select subject"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {formSubjects.map((s) => (
                                                <SelectItem key={s.id} value={String(s.id)}>
                                                    {s.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div>
                                    <Label>Teacher</Label>
                                    <Select 
                                        value={form.staffId} 
                                        onValueChange={v => setForm(f => ({ ...f, staffId: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select teacher"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            {teacherOptions.map((s) => (
                                                <SelectItem key={s.id} value={String(s.id)}>
                                                    {s.name} {form.classId && classes.find(c => String(c.id) === form.classId)?.teacherId === s.id && "⭐"}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {teacherOptions.length === 0 && (
                                        <p className="text-xs text-destructive mt-1">
                                            No teachers found. Please add teachers to the system first.
                                        </p>
                                    )}
                                    {form.classId && (
                                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                            <Info className="w-3 h-3"/>
                                            {classes.find(c => String(c.id) === form.classId)?.teacherId 
                                                ? `Class teacher: ${staff.find(s => s.id === classes.find(c => String(c.id) === form.classId)?.teacherId)?.name || 'Not assigned'}`
                                                : 'No class teacher assigned'}
                                        </p>
                                    )}
                                </div>
                                
                                <div>
                                    <Label>Day</Label>
                                    <Select 
                                        value={form.dayOfWeek} 
                                        onValueChange={v => setForm(f => ({ ...f, dayOfWeek: v }))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {DAYS.map(d => (
                                                <SelectItem key={d} value={d}>
                                                    {d}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>Start Time</Label>
                                        <input 
                                            type="time" 
                                            value={form.startTime} 
                                            onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} 
                                            className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                        />
                                    </div>
                                    <div>
                                        <Label>End Time</Label>
                                        <input 
                                            type="time" 
                                            value={form.endTime} 
                                            onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} 
                                            className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                        />
                                    </div>
                                </div>
                                
                                <div>
                                    <Label>Room (optional)</Label>
                                    <input 
                                        value={form.room} 
                                        onChange={e => setForm(f => ({ ...f, room: e.target.value }))} 
                                        className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                        placeholder="e.g. Room 101"
                                    />
                                </div>
                                
                                {/* Display selected details before adding */}
                                {form.classId && form.subjectId && form.staffId && (
                                    <div className="mt-4 p-4 bg-muted/30 rounded-lg border border-border/50 space-y-2">
                                        <p className="text-sm font-semibold text-blue-400">Review Details</p>
                                        <div className="text-sm space-y-1">
                                            <p><span className="text-muted-foreground">Class:</span> {classes.find(c => String(c.id) === form.classId)?.name || "Not selected"}</p>
                                            <p><span className="text-muted-foreground">Subject:</span> {subjects.find(s => String(s.id) === form.subjectId)?.name || "Not selected"}</p>
                                            <p><span className="text-muted-foreground">Teacher:</span> {staff.find(s => String(s.id) === form.staffId)?.name || "Not selected"}</p>
                                            <p><span className="text-muted-foreground">Day:</span> {form.dayOfWeek}</p>
                                            <p><span className="text-muted-foreground">Time:</span> {form.startTime} - {form.endTime}</p>
                                            {form.room && <p><span className="text-muted-foreground">Room:</span> {form.room}</p>}
                                        </div>
                                    </div>
                                )}
                                
                                <Button 
                                    className="w-full" 
                                    disabled={
                                        !form.classId || 
                                        !form.subjectId || 
                                        !form.staffId || 
                                        createMutation.isPending
                                    } 
                                    onClick={() => {
                                        // Log the data being sent for debugging
                                        const data = { 
                                            classId: parseInt(form.classId), 
                                            subjectId: parseInt(form.subjectId), 
                                            staffId: parseInt(form.staffId), 
                                            dayOfWeek: form.dayOfWeek, 
                                            startTime: form.startTime, 
                                            endTime: form.endTime, 
                                            room: form.room || undefined 
                                        };
                                        console.log("Sending data:", data);
                                        createMutation.mutate(data);
                                    }}
                                >
                                    {createMutation.isPending ? "Saving..." : "Add to Timetable"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-2">
                    <Button 
                        variant={view === "daily" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setView("daily")}
                    >
                        Daily View
                    </Button>
                    <Button 
                        variant={view === "weekly" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setView("weekly")}
                    >
                        Weekly View
                    </Button>
                    <Button 
                        variant={view === "subject" ? "default" : "outline"} 
                        size="sm" 
                        onClick={() => setView("subject")}
                    >
                        Subject-wise View
                    </Button>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                    {showClassFilter && (
                        <Select 
                            value={selectedClass || "all"} 
                            onValueChange={v => setSelectedClass(v === "all" ? "" : v)}
                        >
                            <SelectTrigger className="w-48">
                                <SelectValue placeholder={isTeacher ? "Your Classes" : "All classes"}/>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">{isTeacher ? "All your classes" : "All classes"}</SelectItem>
                                {classFilterOptions.map((c) => (
                                    <SelectItem key={c.id} value={String(c.id)}>
                                        {c.name} {isTeacher && c.teacherId === staff.find(s => s.userId === user?.id)?.id && "⭐"}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4"/>
                        <span>{visibleSlots.length} period{visibleSlots.length !== 1 ? "s" : ""} scheduled</span>
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-40 w-full"/>
                    ))}
                </div>
            ) : visibleSlots.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center text-muted-foreground">
                        No timetable slots found. Add periods to get started.
                    </CardContent>
                </Card>
            ) : (
                <>
                    {/* Daily View */}
                    {view === "daily" && (
                        <div className="space-y-4">
                            <div className="flex gap-1.5 flex-wrap">
                                {DAYS.map(day => (
                                    <Button 
                                        key={day} 
                                        variant={selectedDay === day ? "secondary" : "ghost"} 
                                        size="sm" 
                                        onClick={() => setSelectedDay(day)} 
                                        className={selectedDay === day ? "bg-blue-500/20 text-blue-400 border-blue-500/30" : ""}
                                    >
                                        {day}
                                    </Button>
                                ))}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {(slotsByDay[selectedDay] ?? []).length === 0 ? (
                                    <Card className="col-span-full">
                                        <CardContent className="py-12 text-center text-muted-foreground">
                                            No periods scheduled for {selectedDay}.
                                        </CardContent>
                                    </Card>
                                ) : (
                                    (slotsByDay[selectedDay] ?? []).map((slot) => {
                                        const teacherObj = staff.find(s => s.id === slot.staffId || s.name === slot.teacherName);
                                        return (
                                            <Card key={slot.id} className="border border-border/50 bg-background/30 hover:border-blue-500/30 transition-all">
                                                <CardContent className="p-4 space-y-2">
                                                    <div className="flex justify-between items-start">
                                                        <p className="font-semibold text-base text-blue-400">{slot.subjectName}</p>
                                                        {canManagePeriods && (
                                                            <Button 
                                                                size="icon" 
                                                                variant="ghost" 
                                                                className="w-6 h-6 text-muted-foreground hover:text-destructive" 
                                                                onClick={() => deleteMutation.mutate(slot.id)}
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5"/>
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <p className="text-sm font-medium text-foreground">{slot.teacherName}</p>
                                                    {teacherObj && (
                                                        <div className="text-xs text-muted-foreground space-y-0.5 border-t border-border/10 pt-1">
                                                            {teacherObj.email && <p className="truncate">📧 {teacherObj.email}</p>}
                                                            {teacherObj.phone && <p>📞 {teacherObj.phone}</p>}
                                                        </div>
                                                    )}
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border/10 pt-2">
                                                        <Clock className="w-3.5 h-3.5"/>
                                                        <span>{slot.startTime} – {slot.endTime}</span>
                                                        {slot.room && <span>· Room {slot.room}</span>}
                                                    </div>
                                                    {!selectedClass && <p className="text-xs text-primary/70">{slot.className}</p>}
                                                </CardContent>
                                            </Card>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Weekly View */}
                    {view === "weekly" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {DAYS.map(day => {
                                const daySlots = slotsByDay[day] ?? [];
                                if (daySlots.length === 0 && !selectedClass)
                                    return null;
                                return (
                                    <Card key={day} className={`border ${dayColors[day]} ${day === TODAY_DAY ? "ring-2 ring-primary/40 shadow-lg shadow-primary/10" : ""}`}>
                                        <CardHeader className="pb-2">
                                            <CardTitle className="text-sm font-semibold flex items-center justify-between">
                                                {day}
                                                {day === TODAY_DAY && (
                                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/15 text-primary px-2 py-0.5 rounded-full">
                                                        Today
                                                    </span>
                                                )}
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="space-y-2">
                                            {daySlots.length === 0 ? (
                                                <p className="text-xs text-muted-foreground text-center py-4">No periods</p>
                                            ) : (
                                                daySlots.map((slot) => {
                                                    const teacherObj = staff.find(s => s.id === slot.staffId || s.name === slot.teacherName);
                                                    return (
                                                        <div key={slot.id} className="flex items-start justify-between p-2.5 rounded-md bg-card border border-border group hover:border-primary/30 transition-colors">
                                                            <div className="min-w-0 space-y-1">
                                                                <p className="font-medium text-sm truncate">{slot.subjectName}</p>
                                                                <div>
                                                                    <p className="text-xs text-muted-foreground">{slot.teacherName}</p>
                                                                    {teacherObj && (
                                                                        <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
                                                                            {teacherObj.email && <p className="truncate">📧 {teacherObj.email}</p>}
                                                                            {teacherObj.phone && <p>📞 {teacherObj.phone}</p>}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground">
                                                                    <Clock className="w-3 h-3"/>
                                                                    <span>{slot.startTime} – {slot.endTime}</span>
                                                                    {slot.room && <span>· R: {slot.room}</span>}
                                                                </div>
                                                                {!selectedClass && <p className="text-[11px] text-primary/70">{slot.className}</p>}
                                                            </div>
                                                            {canManagePeriods && (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="w-6 h-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                                                                    onClick={() => deleteMutation.mutate(slot.id)}
                                                                >
                                                                    <Trash2 className="w-3 h-3"/>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}

                    {/* Subject-wise View */}
                    {view === "subject" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {Object.keys(slotsBySubject).length === 0 ? (
                                <Card className="col-span-full">
                                    <CardContent className="py-12 text-center text-muted-foreground">
                                        No periods scheduled.
                                    </CardContent>
                                </Card>
                            ) : (
                                Object.keys(slotsBySubject).map(subject => {
                                    const subjSlots = slotsBySubject[subject];
                                    return (
                                        <Card key={subject} className="border border-border/50 bg-background/30 hover:border-primary/30 transition-all">
                                            <CardHeader className="pb-2">
                                                <CardTitle className="text-sm font-semibold text-teal-400">{subject}</CardTitle>
                                            </CardHeader>
                                            <CardContent className="space-y-2">
                                                {subjSlots.map((slot) => {
                                                    const teacherObj = staff.find(s => s.id === slot.staffId || s.name === slot.teacherName);
                                                    return (
                                                        <div key={slot.id} className="p-2.5 rounded-md bg-card border border-border group flex justify-between items-start">
                                                            <div className="min-w-0 space-y-1">
                                                                <p className="font-semibold text-xs text-amber-400">{slot.dayOfWeek}</p>
                                                                <p className="text-xs text-muted-foreground">{slot.teacherName}</p>
                                                                {teacherObj && (
                                                                    <div className="text-[10px] text-muted-foreground space-y-0.5">
                                                                        {teacherObj.email && <p className="truncate">📧 {teacherObj.email}</p>}
                                                                        {teacherObj.phone && <p>📞 {teacherObj.phone}</p>}
                                                                    </div>
                                                                )}
                                                                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                                    <Clock className="w-3.5 h-3.5"/>
                                                                    <span>{slot.startTime} – {slot.endTime}</span>
                                                                    {slot.room && <span>· Room {slot.room}</span>}
                                                                </div>
                                                                {!selectedClass && <p className="text-[11px] text-primary/70">{slot.className}</p>}
                                                            </div>
                                                            {canManagePeriods && (
                                                                <Button 
                                                                    size="icon" 
                                                                    variant="ghost" 
                                                                    className="w-6 h-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0" 
                                                                    onClick={() => deleteMutation.mutate(slot.id)}
                                                                >
                                                                    <Trash2 className="w-3 h-3"/>
                                                                </Button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </CardContent>
                                        </Card>
                                    );
                                })
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}