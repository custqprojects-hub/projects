// subjects.jsx
import { useEffect, useMemo, useState } from "react";
import { useListSubjects, useCreateSubject, useUpdateSubject, useDeleteSubject, useListClasses, useListStaff, getListSubjectsQueryKey, getListClassesQueryKey, getListStaffQueryKey, UserRole, } from "@/api-client";
import { CreateSubjectBody, UpdateSubjectBody } from "@/api-zod";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription, } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Plus, BookOpen, Trash2, Pencil, Search, Users, BarChart2, GraduationCap, UserCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const defaultForm = {
    name: "",
    code: "",
    classId: "",
    teacherId: "",
    description: "",
    credits: "1",
};

function generateCode(name) {
    return name.toUpperCase().replace(/\s+/g, "").slice(0, 4) + Math.floor(100 + Math.random() * 900);
}

export default function Subjects() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [createOpen, setCreateOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [search, setSearch] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [form, setForm] = useState(defaultForm);
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;

    const { data: subjects = [], isLoading } = useListSubjects({ query: { queryKey: getListSubjectsQueryKey(), staleTime: 15000 } });
    const { data: classes = [] } = useListClasses({ query: { queryKey: getListClassesQueryKey(), staleTime: 30000 } });
    const { data: staff = [] } = useListStaff(undefined, { query: { queryKey: getListStaffQueryKey(), staleTime: 30000 } });

    const teachers = staff.filter((s) => s.role === "teacher");
    const isAdmin = user?.role === UserRole.admin;
    const isTeacher = user?.role === UserRole.teacher;
    
    // Get the current teacher's staff record if they are a teacher
    const currentTeacher = useMemo(() => {
        if (!isTeacher) return null;
        return staff.find((s) => s.userId === user?.id || s.email === user?.email);
    }, [isTeacher, staff, user]);

    // Get teacher IDs that are already assigned to subjects (excluding the current editing subject)
    const assignedTeacherIds = useMemo(() => {
        const assignedIds = new Set();
        subjects.forEach((subject) => {
            if (subject.teacherId) {
                // If we're editing, exclude the current subject's teacher
                if (editing && subject.id === editing.id) {
                    return;
                }
                assignedIds.add(subject.teacherId);
            }
        });
        return assignedIds;
    }, [subjects, editing]);

    // Filter available teachers (exclude already assigned ones)
    const availableTeachers = useMemo(() => {
        return teachers.filter((teacher) => !assignedTeacherIds.has(teacher.id));
    }, [teachers, assignedTeacherIds]);

    const canCreate = isAdmin;
    const canEdit = isAdmin;
    const canDelete = isAdmin;

    const invalidate = () => qc.invalidateQueries({ queryKey: getListSubjectsQueryKey() });

    const createMutation = useCreateSubject({
        mutation: {
            onSuccess: () => {
                invalidate();
                setCreateOpen(false);
                setForm(defaultForm);
                toast({ title: "Subject created" });
            },
            onError: (err) => {
                toast({
                    title: "Failed to create subject",
                    description: err?.data?.message ?? err?.message ?? "Check all required fields.",
                    variant: "destructive",
                });
            },
        },
    });

    const updateMutation = useUpdateSubject({
        mutation: {
            onSuccess: () => {
                invalidate();
                setEditing(null);
                toast({ title: "Subject updated" });
            },
            onError: (err) => {
                toast({
                    title: "Failed to update subject",
                    description: err?.data?.message ?? err?.message ?? "Please try again.",
                    variant: "destructive",
                });
            },
        },
    });

    const deleteMutation = useDeleteSubject({
        mutation: {
            onSuccess: () => {
                invalidate();
                setDeleting(null);
                toast({ title: "Subject deleted" });
            },
            onError: (err) => {
                toast({
                    title: "Cannot delete subject",
                    description: err?.data?.message ?? err?.message ?? "Failed to delete subject.",
                    variant: "destructive",
                });
                setDeleting(null);
            },
        },
    });

    const openCreate = () => {
        setForm(defaultForm);
        setCreateOpen(true);
    };

    const openEdit = (s) => {
        setForm({
            name: s.name,
            code: s.code,
            classId: String(s.classId),
            teacherId: s.teacherId ? String(s.teacherId) : "",
            description: s.description ?? "",
            credits: s.credits ? String(s.credits) : "1",
        });
        setEditing(s);
    };

    const submitCreate = () => {
        const payload = {
            name: form.name.trim(),
            code: form.code.trim(),
            classId: form.classId && form.classId !== "none" ? parseInt(form.classId) : null,
            teacherId: form.teacherId && form.teacherId !== "none" ? parseInt(form.teacherId) : null,
            credits: parseInt(form.credits) || 1,
            description: form.description || null,
        };

        const parsed = CreateSubjectBody.safeParse(payload);
        if (!parsed.success) {
            toast({
                title: "Invalid subject",
                description: parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; "),
                variant: "destructive",
            });
            return;
        }

        createMutation.mutate({ data: payload });
    };

    const submitEdit = () => {
        if (!editing) return;

        const payload = {
            name: form.name.trim(),
            code: form.code.trim(),
            classId: form.classId && form.classId !== "none" ? parseInt(form.classId) : null,
            teacherId: form.teacherId === "" || form.teacherId === "none" ? null : parseInt(form.teacherId),
            credits: parseInt(form.credits) || 1,
            description: form.description === "" ? null : form.description,
        };

        const parsed = UpdateSubjectBody.safeParse(payload);
        if (!parsed.success) {
            toast({
                title: "Invalid subject",
                description: parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; "),
                variant: "destructive",
            });
            return;
        }

        updateMutation.mutate({ id: editing.id, data: payload });
    };

    // Filter subjects - for teachers, only show their assigned subjects
    const filtered = useMemo(() => {
        let filteredSubjects = subjects;
        
        // If user is a teacher, only show subjects assigned to them
        if (isTeacher && currentTeacher) {
            filteredSubjects = subjects.filter((s) => s.teacherId === currentTeacher.id);
        }
        
        // Apply search and class filters
        return filteredSubjects.filter((s) => {
            const q = search.toLowerCase();
            const matchSearch = !q ||
                s.name.toLowerCase().includes(q) ||
                s.code.toLowerCase().includes(q) ||
                (s.className ?? "").toLowerCase().includes(q) ||
                (s.teacherName ?? "").toLowerCase().includes(q);
            const matchClass = filterClass ? String(s.classId) === filterClass : true;
            return matchSearch && matchClass;
        });
        }, [subjects, search, filterClass, isTeacher, currentTeacher]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pagedSubjects = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [search, filterClass, isTeacher, currentTeacher]);

    // Get the teacher's assigned subjects count
    const teacherSubjectCount = useMemo(() => {
        if (!isTeacher || !currentTeacher) return 0;
        return subjects.filter((s) => s.teacherId === currentTeacher.id).length;
    }, [isTeacher, currentTeacher, subjects]);

    const renderFormBody = (mode) => {
        // Determine which teachers to show based on mode
        let teachersToShow = [];
        if (mode === "create") {
            teachersToShow = availableTeachers;
        } else if (mode === "edit") {
            // For edit mode, show all teachers except those assigned to other subjects
            teachersToShow = teachers.filter((teacher) => {
                // If teacher is assigned to the current subject, show them
                if (editing && editing.teacherId === teacher.id) {
                    return true;
                }
                // If teacher is assigned to any other subject, hide them
                return !assignedTeacherIds.has(teacher.id);
            });
        }

        return (
            <div className="space-y-4 py-2">
                <div>
                    <Label>Subject Name *</Label>
                    <Input 
                        className="mt-1" 
                        value={form.name} 
                        onChange={(e) => {
                            const name = e.target.value;
                            setForm((f) => ({
                                ...f,
                                name,
                                code: mode === "create" && (!f.code || f.code === generateCodePrefix(f.name))
                                    ? (name ? generateCode(name) : "")
                                    : f.code,
                            }));
                        }} 
                        placeholder="e.g. Mathematics"
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <Label>Subject Code *</Label>
                        <Input 
                            className="mt-1 font-mono" 
                            value={form.code} 
                            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} 
                            placeholder="Auto-generated"
                        />
                    </div>
                    <div>
                        <Label>Credits</Label>
                        <Input 
                            type="number" 
                            className="mt-1" 
                            min="1" 
                            max="10" 
                            value={form.credits} 
                            onChange={(e) => setForm((f) => ({ ...f, credits: e.target.value }))}
                        />
                    </div>
                </div>

                <div>
                    <Label>Class</Label>
                    <Select 
                        value={form.classId || "none"} 
                        onValueChange={(v) => setForm((f) => ({ ...f, classId: v === "none" ? "" : v }))}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Unassigned (optional)"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">Unassigned</SelectItem>
                            {classes.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <Label>Teacher</Label>
                    <Select 
                        value={form.teacherId || "none"} 
                        onValueChange={(v) => setForm((f) => ({ ...f, teacherId: v }))}
                    >
                        <SelectTrigger className="mt-1">
                            <SelectValue placeholder="Assign a teacher (optional)"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="none">No teacher assigned</SelectItem>
                            {teachersToShow.length > 0 ? (
                                teachersToShow.map((t) => (
                                    <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
                                ))
                            ) : (
                                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                                    No available teachers
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                    {mode === "create" && availableTeachers.length === 0 && teachers.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                            All teachers are already assigned to subjects
                        </p>
                    )}
                    {isTeacher && currentTeacher && (
                        <p className="text-xs text-muted-foreground mt-1">
                            You are currently assigned to {teacherSubjectCount} subject{teacherSubjectCount !== 1 ? 's' : ''}
                        </p>
                    )}
                </div>

                <div>
                    <Label>Description</Label>
                    <Textarea 
                        className="mt-1 resize-none" 
                        rows={2} 
                        value={form.description} 
                        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} 
                        placeholder="Brief description of the subject…"
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-rose-400">Subjects</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {isTeacher && currentTeacher 
                            ? `Manage your assigned subjects (${teacherSubjectCount} subject${teacherSubjectCount !== 1 ? 's' : ''})`
                            : "Manage subjects and curriculum assignments"
                        }
                    </p>
                </div>
                {canCreate && (
                    <Button className="gap-2" onClick={openCreate}>
                        <Plus className="w-4 h-4"/>
                        Add Subject
                    </Button>
                )}
            </div>

            {/* Stats Cards - Show different stats for teachers */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {isTeacher && currentTeacher ? (
                    // Teacher-specific stats
                    <>
                        <Card className="glass-card glass-hover border-t-2 border-t-rose-500/40">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-rose-500/10 p-2 rounded-lg text-rose-400">
                                    <BookOpen className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">My Subjects</p>
                                    <p className="text-2xl font-bold text-rose-400">{teacherSubjectCount}</p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card glass-hover border-t-2 border-t-indigo-500/40">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                                    <GraduationCap className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Classes Teaching</p>
                                    <p className="text-2xl font-bold text-indigo-400">
                                        {new Set(subjects.filter(s => s.teacherId === currentTeacher.id && s.classId != null).map(s => s.classId)).size}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                                    <UserCheck className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Status</p>
                                    <p className="text-lg font-bold text-emerald-400">
                                        {teacherSubjectCount > 0 ? "Active" : "Available"}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                        {/* <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40">
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className="bg-amber-500/10 p-2 rounded-lg text-amber-400">
                                    <BarChart2 className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Students</p>
                                    <p className="text-2xl font-bold text-amber-400">-</p>
                                </div>
                            </CardContent>
                        </Card> */}
                    </>
                ) : (
                    // Admin stats
                    [
                        { label: "Total Subjects", value: subjects.length, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-t-rose-500/40", icon: BookOpen },
                        { label: "Classes Covered", value: new Set(subjects.filter((s) => s.classId != null).map((s) => s.classId)).size, color: "text-indigo-400", bg: "bg-indigo-500/10", border: "border-t-indigo-500/40", icon: GraduationCap },
                        { label: "With Teacher", value: subjects.filter((s) => s.teacherName).length, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: Users },
                        // { label: "Avg / Class", value: classes.length > 0 ? Math.round(subjects.length / classes.length) : 0, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-500/40", icon: BarChart2 },
                    ].map(s => (
                        <Card key={s.label} className={`glass-card glass-hover border-t-2 ${s.border}`}>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`${s.bg} p-2 rounded-lg ${s.color}`}>
                                    <s.icon className="w-4 h-4"/>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">{s.label}</p>
                                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Search and Filter - Hide for teachers since they see limited subjects */}
            {!isTeacher && (
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                        <Input 
                            placeholder="Search subjects, code, teacher…" 
                            className="pl-9" 
                            value={search} 
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Select value={filterClass || "all"} onValueChange={(v) => setFilterClass(v === "all" ? "" : v)}>
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="All classes"/>
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All classes</SelectItem>
                            {classes.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {(search || filterClass) && (
                        <Button variant="outline" onClick={() => { setSearch(""); setFilterClass(""); }}>
                            Clear
                        </Button>
                    )}
                </div>
            )}

            {/* Subjects Table */}
            <Card className="shadow-sm border-t-2 border-t-amber-400/30">
                <CardContent className="pt-6">
                    {isLoading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full"/>)}
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-3">
                            <BookOpen className="w-10 h-10 opacity-30"/>
                            <p>
                                {isTeacher && currentTeacher 
                                    ? "You don't have any assigned subjects yet."
                                    : subjects.length === 0
                                        ? `No subjects found.${canCreate ? ' Click "Add Subject" to get started.' : ""}`
                                        : "No subjects match your filters."
                                }
                            </p>
                            {isTeacher && currentTeacher && teacherSubjectCount === 0 && (
                                <p className="text-xs text-muted-foreground">
                                    Contact an administrator to get subjects assigned to you.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Subject</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Class</TableHead>
                                        <TableHead>Teacher</TableHead>
                                        <TableHead>Credits</TableHead>
                                        {(canEdit || canDelete) && <TableHead className="w-24 text-right">Actions</TableHead>}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pagedSubjects.map((s) => (
                                        <TableRow key={s.id} className="hover:bg-accent/20">
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded bg-amber-500/10 flex items-center justify-center">
                                                        <BookOpen className="w-3.5 h-3.5 text-amber-400"/>
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{s.name}</p>
                                                        {s.description && (
                                                            <p className="text-xs text-muted-foreground line-clamp-1">{s.description}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className="text-xs font-mono bg-muted text-muted-foreground border-0">
                                                    {s.code}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {s.className ?? <span className="text-muted-foreground/60 italic">Unassigned</span>}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {s.teacherName ? (
                                                    <span className="flex items-center gap-1">
                                                        {s.teacherName}
                                                        {isTeacher && currentTeacher && s.teacherId === currentTeacher.id && (
                                                            <Badge className="text-xs bg-emerald-500/20 text-emerald-400 border-0 ml-1">
                                                                You
                                                            </Badge>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-muted-foreground/60 italic">Not assigned</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">
                                                    {s.credits} cr
                                                </span>
                                            </TableCell>
                                            {(canEdit || canDelete) && (
                                                <TableCell className="text-right">
                                                    {canEdit && (
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="w-8 h-8 text-muted-foreground hover:text-rose-400" 
                                                            onClick={() => openEdit(s)} 
                                                            data-testid={`edit-subject-${s.id}`}
                                                        >
                                                            <Pencil className="w-3.5 h-3.5"/>
                                                        </Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button 
                                                            size="icon" 
                                                            variant="ghost" 
                                                            className="w-8 h-8 text-muted-foreground hover:text-destructive" 
                                                            onClick={() => setDeleting(s)} 
                                                            data-testid={`delete-subject-${s.id}`}
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5"/>
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                    {!isLoading && filtered.length > 0 && (
                        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <p className="text-sm text-muted-foreground">
                                Showing {((safePage - 1) * PAGE_SIZE) + 1}-{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
                            </p>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                                    Previous
                                </Button>
                                <span className="text-sm text-muted-foreground px-2">
                                    Page {safePage} of {totalPages}
                                </span>
                                <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                                    Next
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create Subject Dialog */}
            <Dialog open={createOpen} onOpenChange={(o) => { 
                setCreateOpen(o); 
                if (!o) setForm(defaultForm); 
            }}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add New Subject</DialogTitle>
                    </DialogHeader>
                    {renderFormBody("create")}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                        <Button 
                            disabled={!form.name || !form.code || createMutation.isPending} 
                            onClick={submitCreate}
                        >
                            {createMutation.isPending ? "Creating…" : "Add Subject"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Subject Dialog */}
            <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
                <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Subject</DialogTitle>
                        <DialogDescription>Update subject details, class and teacher.</DialogDescription>
                    </DialogHeader>
                    {renderFormBody("edit")}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
                        <Button 
                            disabled={!form.name || !form.code || updateMutation.isPending} 
                            onClick={submitEdit}
                        >
                            {updateMutation.isPending ? "Saving…" : "Save Changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete subject {deleting?.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This permanently removes the subject. If timetable slots, exams, assignments, lesson
                            plans or study materials still reference it, the delete will be blocked.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90" 
                            disabled={deleteMutation.isPending} 
                            onClick={(e) => {
                                e.preventDefault();
                                if (deleting) deleteMutation.mutate({ id: deleting.id });
                            }}
                        >
                            {deleteMutation.isPending ? "Deleting…" : "Delete"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function generateCodePrefix(name) {
    return name.toUpperCase().replace(/\s+/g, "").slice(0, 4);
}