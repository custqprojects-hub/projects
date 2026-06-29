import { useMemo, useState } from "react";
import { useListClasses, useCreateClass, useUpdateClass, useDeleteClass, useListStaff, useListSubjects, useUpdateSubject, getListClassesQueryKey, getListStaffQueryKey, getListSubjectsQueryKey, UserRole, useListStudents, useUpdateStudent } from "@/api-client";
import { CreateClassBody, UpdateClassBody } from "@/api-zod";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, GraduationCap, Users, BookOpen, Pencil, Trash2, Search, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SECTIONS = ["A", "B", "C", "D", "E", "F"];

const getFutureAcademicYears = () => {
  const currentYear = new Date().getFullYear(); // 2026 right now
  const years = [];

  // Generate next 6 academic years (2026-27 to 2031-32)
  for (let i = 0; i < 6; i++) {
    const start = currentYear + i;
    const end = start + 1;
    years.push(`${start}-${String(end).slice(2)}`);
  }

  return years;
};

const ACADEMIC_YEARS = getFutureAcademicYears();

const defaultForm = {
  grade: "",
  section: "A",
  teacherId: "",
  academicYear: ACADEMIC_YEARS[0], // Default to the nearest future year
  room: "",
  subjectIds: [],
};

export default function Classes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [assigningClass, setAssigningClass] = useState(null);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const { data: allStudents = [] } = useListStudents(undefined, { query: { staleTime: 30000 } });

  const assignStudentMutation = useUpdateStudent({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListClassesQueryKey() });
        qc.invalidateQueries({ queryKey: ["students"] });
      }
    }
  });

  const openAssignStudents = (cls) => {
    setAssigningClass(cls);
    const inClass = allStudents.filter(s => s.classId === cls.id).map(s => s.id);
    setSelectedStudentIds(inClass);
  };

  const handleSaveStudentAssignments = async () => {
    if (!assigningClass) return;
    const currentInClass = allStudents.filter(s => s.classId === assigningClass.id).map(s => s.id);
    const desired = selectedStudentIds;
    const toAdd = desired.filter(id => !currentInClass.includes(id));
    const toRemove = currentInClass.filter(id => !desired.includes(id));

    const ops = [];
    for (const id of toAdd) {
      ops.push(assignStudentMutation.mutateAsync({ id, data: { classId: assigningClass.id } }));
    }
    for (const id of toRemove) {
      ops.push(assignStudentMutation.mutateAsync({ id, data: { classId: null } }));
    }

    try {
      if (ops.length > 0) {
        await Promise.all(ops);
        toast({ title: "Student assignments updated" });
      }
      setAssigningClass(null);
      setSelectedStudentIds([]);
      invalidate();
    } catch (err) {
      toast({
        title: "Failed to update assignments",
        description: err?.message || "Unknown error",
        variant: "destructive"
      });
    }
  };

  const { data: classes = [], isLoading } = useListClasses({ query: { queryKey: getListClassesQueryKey(), staleTime: 15000 } });
  const { data: staff = [] } = useListStaff(undefined, { query: { queryKey: getListStaffQueryKey(), staleTime: 30000 } });
  const { data: subjects = [] } = useListSubjects({ query: { queryKey: getListSubjectsQueryKey(), staleTime: 15000 } });

  const teachers = staff.filter((s) => s.role === "teacher");
  const isAdmin = user?.role === UserRole.admin;

  const updateSubjectMutation = useUpdateSubject();

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getListClassesQueryKey() });
    qc.invalidateQueries({ queryKey: getListSubjectsQueryKey() });
  };

  const syncSubjectAssignments = async (classId, desired, previous) => {
    const desiredSet = new Set(desired);
    const prevSet = new Set(previous);
    const toAttach = desired.filter((id) => !prevSet.has(id));
    const toDetach = previous.filter((id) => !desiredSet.has(id));

    const ops = [];
    for (const id of toAttach) ops.push(updateSubjectMutation.mutateAsync({ id, data: { classId } }));
    for (const id of toDetach) ops.push(updateSubjectMutation.mutateAsync({ id, data: { classId: null } }));

    if (ops.length) {
      const results = await Promise.allSettled(ops);
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        toast({
          title: "Some subjects could not be reassigned",
          description: `${failed} of ${ops.length} subject assignment updates failed.`,
          variant: "destructive",
        });
      }
    }
  };

  const createMutation = useCreateClass();
  const updateMutation = useUpdateClass();
  const deleteMutation = useDeleteClass({
    mutation: {
      onSuccess: () => {
        invalidate();
        setDeleting(null);
        toast({ title: "Class deleted" });
      },
      onError: (err) => {
        toast({
          title: "Cannot delete class",
          description: err?.data?.message ?? err?.message ?? "Failed to delete class.",
          variant: "destructive",
        });
        setDeleting(null);
      },
    },
  });

  const openCreate = () => {
    setForm({
      ...defaultForm,
      academicYear: ACADEMIC_YEARS[0], // Always default to nearest future year
    });
    setCreateOpen(true);
  };

  const openEdit = (cls) => {
    setForm({
      grade: cls.grade,
      section: cls.section,
      teacherId: cls.teacherId ? String(cls.teacherId) : "",
      academicYear: cls.academicYear,
      room: cls.room ?? "",
      subjectIds: subjects.filter((s) => s.classId === cls.id).map((s) => s.id),
    });
    setEditing(cls);
  };

  const submitCreate = async () => {
    const payload = {
      grade: form.grade,
      section: form.section,
      teacherId: form.teacherId && form.teacherId !== "none" ? parseInt(form.teacherId) : null,
      academicYear: form.academicYear,
      room: form.room || null,
    };

    const parsed = CreateClassBody.safeParse(payload);
    if (!parsed.success) {
      toast({
        title: "Invalid class",
        description: parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; "),
        variant: "destructive",
      });
      return;
    }

    try {
      const created = await createMutation.mutateAsync({ data: payload });
      if (form.subjectIds.length > 0) {
        await syncSubjectAssignments(created.id, form.subjectIds, []);
      }
      invalidate();
      setCreateOpen(false);
      setForm(defaultForm);
      toast({ title: "Class created" });
    } catch (err) {
      toast({
        title: "Failed to create class",
        description: err?.data?.message ?? err?.message ?? "Check all required fields and try again.",
        variant: "destructive",
      });
    }
  };

  const submitEdit = async () => {
    if (!editing) return;
    const payload = {
      grade: form.grade,
      section: form.section,
      academicYear: form.academicYear,
      teacherId: form.teacherId === "" || form.teacherId === "none" ? null : parseInt(form.teacherId),
      room: form.room === "" ? null : form.room,
    };

    const parsed = UpdateClassBody.safeParse(payload);
    if (!parsed.success) {
      toast({
        title: "Invalid class",
        description: parsed.error.issues.map((i) => `${i.path.join(".") || "field"}: ${i.message}`).join("; "),
        variant: "destructive",
      });
      return;
    }

    try {
      await updateMutation.mutateAsync({ id: editing.id, data: payload });
      const previous = subjects.filter((s) => s.classId === editing.id).map((s) => s.id);
      await syncSubjectAssignments(editing.id, form.subjectIds, previous);
      invalidate();
      setEditing(null);
      toast({ title: "Class updated" });
    } catch (err) {
      toast({
        title: "Failed to update class",
        description: err?.data?.message ?? err?.message ?? "Please try again.",
        variant: "destructive",
      });
    }
  };

  const toggleSubject = (id) => {
    setForm((f) => ({
      ...f,
      subjectIds: f.subjectIds.includes(id)
        ? f.subjectIds.filter((x) => x !== id)
        : [...f.subjectIds, id],
    }));
  };

  const availableSubjectsForForm = useMemo(() => {
    return subjects.map((s) => ({
      ...s,
      ownedByOtherClass: s.classId != null && s.classId !== (editing?.id ?? -1),
    }));
  }, [subjects, editing]);

  const filtered = useMemo(() => {
        const normalize = (value) => String(value ?? "").trim().replace(/\s+/g, " ").toLowerCase();
        const q = normalize(search);
        const searchedTeacher = q ? teachers.find((t) => normalize(t.name) === q) : null;
        return classes.filter((c) => {
            const matchYear = !filterYear || c.academicYear === filterYear;
            if (searchedTeacher) {
                return normalize(c.teacherName) === normalize(searchedTeacher.name) && matchYear;
            }
            const matchSearch = !q ||
                normalize(c.name).includes(q) ||
                normalize(c.grade).includes(q) ||
                normalize(c.section).includes(q) ||
                normalize(c.teacherName).includes(q) ||
                normalize(c.room).includes(q);
            return matchSearch && matchYear;
        });
    }, [classes, teachers, search, filterYear]);

  const totalStudents = classes.reduce((acc, c) => acc + (c.studentCount ?? 0), 0);

  const renderFormBody = () => (
    <div className="space-y-4 py-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Grade *</Label>
          <Select value={form.grade} onValueChange={(v) => setForm((f) => ({ ...f, grade: v }))}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue placeholder="Select grade" />
            </SelectTrigger>
            <SelectContent>
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "LKG", "UKG"].map((g) => (
                <SelectItem key={g} value={g}>Grade {g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Section *</Label>
          <Select value={form.section} onValueChange={(v) => setForm((f) => ({ ...f, section: v }))}>
            <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SECTIONS.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label className="flex items-center gap-1.5">
            <Calendar className="w-4 h-4" /> Academic Year *
          </Label>
          <Select value={form.academicYear} onValueChange={(v) => setForm((f) => ({ ...f, academicYear: v }))}>
            <SelectTrigger className="mt-1 w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACADEMIC_YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-[10px] text-muted-foreground mt-1">Only future academic years are shown</p>
        </div>
        <div>
          <Label>Room No.</Label>
          <Input className="mt-1 w-full" value={form.room} onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))} placeholder="e.g. 101" />
        </div>
      </div>

      <div>
        <Label>Class Teacher</Label>
        <Select value={form.teacherId || "none"} onValueChange={(v) => setForm((f) => ({ ...f, teacherId: v }))}>
          <SelectTrigger className="mt-1 w-full">
            <SelectValue placeholder="Assign a teacher (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No teacher assigned</SelectItem>
            {teachers.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} · {t.department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>Subjects</Label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Select subjects to assign to this class. Subjects already in another class are marked.
        </p>
        <div className="max-h-48 overflow-y-auto rounded-md border border-border/40 bg-muted/20 p-2 space-y-1">
          {availableSubjectsForForm.length === 0 ? (
            <p className="text-xs text-muted-foreground italic px-1 py-2">No subjects yet — add them on the Subjects page.</p>
          ) : (
            availableSubjectsForForm.map((s) => {
              const checked = form.subjectIds.includes(s.id);
              return (
                <label key={s.id} className="flex items-center gap-2 px-2 py-1 rounded text-sm hover:bg-accent/30 cursor-pointer">
                  <input type="checkbox" className="accent-indigo-400" checked={checked} onChange={() => toggleSubject(s.id)} />
                  <span className="font-medium">{s.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{s.code}</span>
                  {s.ownedByOtherClass && !checked && (
                    <span className="ml-auto text-[10px] text-amber-400">in {s.className}</span>
                  )}
                </label>
              );
            })
          )}
        </div>
      </div>

      {form.grade && form.section && (
        <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          Preview: <strong className="text-foreground">{form.grade}-{form.section}</strong>
          {form.room && <> · Room {form.room}</>} · {form.academicYear}
          {form.subjectIds.length > 0 && <> · {form.subjectIds.length} subject{form.subjectIds.length > 1 ? "s" : ""}</>}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Header & Create Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-indigo-400">Classes</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage class sections, teachers and enrollment</p>
        </div>
        {isAdmin && (
          <>
            <Button className="gap-2" onClick={openCreate}>
              <Plus className="w-4 h-4" />
              Add Class
            </Button>

            <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm(defaultForm); }}>
              <DialogContent className="w-full max-w-md max-h-[85vh] flex flex-col">
                  <DialogHeader>
                  <DialogTitle>Add New Class</DialogTitle>
                  <DialogDescription>Only future academic years are available.</DialogDescription>
                </DialogHeader>
                  <div className="flex-1 overflow-y-auto pr-2">{renderFormBody()}</div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button disabled={!form.grade || !form.section || createMutation.isPending} onClick={submitCreate}>
                    {createMutation.isPending ? "Creating…" : "Create Class"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-indigo-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><GraduationCap className="w-4 h-4" /></div>
            <div><p className="text-xs text-muted-foreground">Total Classes</p><p className="text-2xl font-bold text-indigo-400">{classes.length}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card glass-hover border-t-2 border-t-cyan-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400"><Users className="w-4 h-4" /></div>
            <div><p className="text-xs text-muted-foreground">Total Students</p><p className="text-2xl font-bold text-cyan-400">{totalStudents}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><BookOpen className="w-4 h-4" /></div>
            <div><p className="text-xs text-muted-foreground">With Teacher</p><p className="text-2xl font-bold text-amber-400">{classes.filter((c) => c.teacherName).length}</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search class, teacher, room…" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="w-full sm:w-48">
          <Select value={filterYear || "all"} onValueChange={(v) => setFilterYear(v === "all" ? "" : v)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="All academic years" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All academic years</SelectItem>
              {ACADEMIC_YEARS.map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(search || filterYear) && (
          <Button variant="outline" onClick={() => { setSearch(""); setFilterYear(""); }}>Clear</Button>
        )}
      </div>

      {/* Table & Cards remain unchanged */}
      {/* ... (The rest of your table, cards, edit dialog, delete alert, and assign students dialog stay exactly the same) ... */}

      <Card className="glass-card border-t-2 border-t-indigo-400/30">
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filtered.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Class Name</TableHead>
                    <TableHead>Grade</TableHead>
                    <TableHead>Section</TableHead>
                    <TableHead>Academic Year</TableHead>
                    <TableHead>Class Teacher</TableHead>
                    <TableHead>Students</TableHead>
                    <TableHead>Room</TableHead>
                    {isAdmin && <TableHead className="w-24 text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((cls) => (
                    <TableRow key={cls.id} className="hover:bg-indigo-500/5 transition-colors border-border/40">
                      <TableCell className="font-medium text-indigo-300">{cls.name}</TableCell>
                      <TableCell>{cls.grade}</TableCell>
                      <TableCell>{cls.section}</TableCell>
                      <TableCell className="text-muted-foreground">{cls.academicYear || "—"}</TableCell>
                      <TableCell>{cls.teacherName || <span className="text-muted-foreground">Unassigned</span>}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-400">
                          {cls.studentCount} students
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{cls.room || "—"}</TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-cyan-400" onClick={() => openAssignStudents(cls)} title="Assign Students">
                            <Users className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-indigo-400" onClick={() => openEdit(cls)} data-testid={`edit-class-${cls.id}`}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(cls)} data-testid={`delete-class-${cls.id}`}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-3">
              <GraduationCap className="w-10 h-10 opacity-30" />
              <p>
                {classes.length === 0
                  ? `No classes found.${isAdmin ? " Use the button above to create your first class." : ""}`
                  : "No classes match your filters."}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Card Grid View */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cls) => (
            <Card key={cls.id} className="hover:border-primary/40 transition-colors hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold font-serif">{cls.name}</CardTitle>
                  <Badge className="text-xs bg-primary/10 text-primary border-primary/20">
                    {cls.academicYear}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Students:</span>
                    <span className="font-medium">{cls.studentCount ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Room:</span>
                    <span className="font-medium">{cls.room || "—"}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <GraduationCap className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Teacher:</span>
                  <span className="font-medium truncate">
                    {cls.teacherName || <span className="text-muted-foreground/60 italic">Not assigned</span>}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${Math.min(((cls.studentCount ?? 0) / 40) * 100, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {cls.studentCount ?? 0} / 40 capacity
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent className="w-full max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Edit Class</DialogTitle>
            <DialogDescription>Update class details and teacher assignment.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">{renderFormBody()}</div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={!form.grade || !form.section || updateMutation.isPending} onClick={submitEdit}>
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert */}
      <AlertDialog open={!!deleting} onOpenChange={(o) => { if (!o) setDeleting(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete class {deleting?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the class. If students, subjects, timetable slots, exams or other records still reference it, the delete will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleteMutation.isPending} onClick={(e) => {
              e.preventDefault();
              if (deleting) deleteMutation.mutate({ id: deleting.id });
            }}>
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Assign Students Dialog */}
      <Dialog open={!!assigningClass} onOpenChange={(o) => { if (!o) setAssigningClass(null); }}>
        <DialogContent className="w-full max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Assign Students to {assigningClass?.name}</DialogTitle>
            <DialogDescription>Select students to assign to this class. Deselecting will remove them.</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto space-y-2 py-2 pr-1">
            {allStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground italic text-center py-4">No students found.</p>
            ) : (
              allStudents.map((s) => {
                const checked = selectedStudentIds.includes(s.id);
                return (
                  <label key={s.id} className="flex items-center gap-2 p-2 rounded hover:bg-accent/40 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      className="accent-indigo-400"
                      checked={checked}
                      onChange={() => {
                        setSelectedStudentIds(prev =>
                          prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id]
                        );
                      }}
                    />
                    <div>
                      <p className="font-medium text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        Roll: {s.rollNumber} {s.className ? `· Curr: ${s.className}` : ""}
                      </p>
                    </div>
                  </label>
                );
              })
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="ghost" onClick={() => setAssigningClass(null)}>Cancel</Button>
            <Button disabled={assignStudentMutation.isPending} onClick={handleSaveStudentAssignments}>
              {assignStudentMutation.isPending ? "Saving..." : "Save Assignments"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}