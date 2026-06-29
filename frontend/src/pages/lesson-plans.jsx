import { useEffect, useState } from "react";
import { useListLessonPlans, useUpdateLessonPlan, useDeleteLessonPlan, useListSubjects, useListClasses, useListStaff, getListLessonPlansQueryKey, } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, BookOpen, Check, Upload, Grid3X3, Eye, Download } from "lucide-react";
const statusColors = {
    draft: "bg-muted/50 text-muted-foreground",
    approved: "bg-emerald-500/10 text-emerald-400",
    submitted: "bg-blue-500/10 text-blue-400",
};
const defaultForm = {
    title: "",
    objectives: "",
    content: "",
    subjectId: "",
    classId: "",
    weekDate: "",
    duration: "45",
};
const defaultAdminForm = {
    classId: "",
    weekDate: "",
    duration: "45",
};
function newestFirst(a, b) {
    const bTime = new Date(b.createdAt ?? 0).getTime();
    const aTime = new Date(a.createdAt ?? 0).getTime();
    if (bTime !== aTime)
        return bTime - aTime;
    return (b.id ?? 0) - (a.id ?? 0);
}
function toDateInputValue(date) {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 10);
}
export default function LessonPlans() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [filterClass, setFilterClass] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 5;
    const [gridMode, setGridMode] = useState(false);
    const [gridClassId, setGridClassId] = useState("");
    const [form, setForm] = useState(defaultForm);
    const [selectedFile, setSelectedFile] = useState(null);
    const [isSaving, setIsSaving] = useState(false);
    const [adminForm, setAdminForm] = useState(defaultAdminForm);
    const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);
    const [adminRows, setAdminRows] = useState({});
    const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
    const params = {};
    if (filterClass)
        params.classId = filterClass;
    const { data: plans = [], isLoading } = useListLessonPlans(params, {
        query: { queryKey: getListLessonPlansQueryKey(params), staleTime: 10000 },
    });
    const { data: subjects = [] } = useListSubjects();
    const { data: classes = [] } = useListClasses();
    const { data: staff = [] } = useListStaff(undefined, { query: { staleTime: 30000 } });
    const resetForm = () => {
        setForm(defaultForm);
        setSelectedFile(null);
    };
    const resetAdminForm = () => {
        setAdminForm(defaultAdminForm);
        setSelectedSubjectIds([]);
        setAdminRows({});
        setSubjectMenuOpen(false);
    };
    const updateAdminRow = (subjectId, patch) => {
        setAdminRows((rows) => ({
            ...rows,
            [subjectId]: {
                lessonOrder: selectedSubjectIds.indexOf(subjectId) + 1 || 1,
                teacherId: "",
                title: "",
                objectives: "",
                content: "",
                file: null,
                ...(rows[subjectId] ?? {}),
                ...patch,
            },
        }));
    };
    const handleAdminClassChange = (classId) => {
        setAdminForm((f) => ({ ...f, classId }));
        setSelectedSubjectIds([]);
        setAdminRows({});
        setSubjectMenuOpen(false);
    };
    const toggleAdminSubject = (subjectId) => {
        setSelectedSubjectIds((ids) => {
            const exists = ids.includes(subjectId);
            const next = exists ? ids.filter((id) => id !== subjectId) : [...ids, subjectId];
            setAdminRows((rows) => {
                const updated = { ...rows };
                if (exists) {
                    delete updated[subjectId];
                }
                else {
                    updated[subjectId] = {
                        lessonOrder: next.indexOf(subjectId) + 1,
                        teacherId: "",
                        title: "",
                        objectives: "",
                        content: "",
                        file: null,
                    };
                }
                return updated;
            });
            return next;
        });
    };
    const handleCreatePlan = async () => {
        setIsSaving(true);
        const body = new FormData();
        body.append("title", form.title);
        body.append("objectives", form.objectives);
        body.append("content", form.content);
        body.append("subjectId", form.subjectId);
        body.append("classId", form.classId);
        body.append("teacherId", selectedTeacherId ?? "");
        body.append("weekDate", form.weekDate);
        body.append("duration", form.duration);
        if (selectedFile)
            body.append("file", selectedFile);
        try {
            const res = await fetch("/api/lesson-plans", {
                method: "POST",
                credentials: "include",
                body,
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error?.details || error?.error || "Failed to save lesson plan");
            }
            qc.invalidateQueries({ queryKey: getListLessonPlansQueryKey() });
            setOpen(false);
            resetForm();
        }
        catch (err) {
            console.error("Create lesson plan failed", err);
            alert(err?.message || "Failed to save lesson plan");
        }
        finally {
            setIsSaving(false);
        }
    };
    const createMutation = {
        isPending: isSaving,
        mutate: handleCreatePlan,
    };
    const updateMutation = useUpdateLessonPlan({
        mutation: {
            onSuccess: () => qc.invalidateQueries({ queryKey: getListLessonPlansQueryKey() }),
        },
    });
    const deleteMutation = useDeleteLessonPlan({
        mutation: {
            onSuccess: () => qc.invalidateQueries({ queryKey: getListLessonPlansQueryKey() }),
        },
    });
    const isAdmin = user?.role === "admin";
    const isTeacher = user?.role === "admin" || user?.role === "teacher";
    // Filter subjects for grid mode class
    const gridSubjects = gridClassId
        ? subjects.filter((s) => String(s.classId) === gridClassId)
        : [];
    // Filter subjects for form
    const formSubjects = form.classId
        ? subjects.filter((s) => String(s.classId) === form.classId)
        : subjects;
    const selectedClass = classes.find((c) => String(c.id) === form.classId);
    const selectedSubject = subjects.find((s) => String(s.id) === form.subjectId);
    const selectedTeacherId = selectedSubject?.teacherId ?? selectedClass?.teacherId;
    const adminSubjects = adminForm.classId
        ? subjects.filter((s) => String(s.classId) === adminForm.classId)
        : [];
    const selectedAdminSubjects = selectedSubjectIds
        .map((id) => adminSubjects.find((s) => String(s.id) === String(id)))
        .filter(Boolean);
    const teacherOptions = staff.filter((s) => !s.role || ["teacher", "staff", "admin"].includes(String(s.role).toLowerCase()));
    const sortedPlans = [...plans].sort(newestFirst);
    const totalPages = Math.max(1, Math.ceil(sortedPlans.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pagedPlans = sortedPlans.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    useEffect(() => {
        if (page !== safePage) {
            setPage(safePage);
        }
    }, [page, safePage]);
    const toggleAllAdminSubjects = () => {
        if (selectedSubjectIds.length === adminSubjects.length) {
            setSelectedSubjectIds([]);
            setAdminRows({});
            return;
        }
        const ids = adminSubjects.map((s) => String(s.id));
        setSelectedSubjectIds(ids);
        setAdminRows(Object.fromEntries(ids.map((id, index) => [id, {
            lessonOrder: index + 1,
            teacherId: "",
            title: "",
            objectives: "",
            content: "",
            file: null,
        }])));
    };
    const handleAdminSavePlans = async () => {
        if (!adminForm.classId || selectedSubjectIds.length === 0 || !adminForm.weekDate) {
            alert("Select class, subjects, and date.");
            return;
        }
        const missingTeacher = selectedSubjectIds.some((id) => !adminRows[id]?.teacherId);
        if (missingTeacher) {
            alert("Select teacher for every selected subject.");
            return;
        }
        setIsSaving(true);
        try {
            for (const subjectId of selectedSubjectIds) {
                const row = adminRows[subjectId] ?? {};
                const subject = adminSubjects.find((s) => String(s.id) === String(subjectId));
                const body = new FormData();
                body.append("classId", adminForm.classId);
                body.append("subjectId", subjectId);
                body.append("teacherId", row.teacherId);
                body.append("weekDate", adminForm.weekDate);
                body.append("duration", adminForm.duration);
                body.append("lessonOrder", String(row.lessonOrder || selectedSubjectIds.indexOf(subjectId) + 1));
                body.append("title", row.title || `${subject?.name ?? "Subject"} Plan`);
                body.append("objectives", row.objectives || "");
                body.append("content", row.content || "");
                if (row.file)
                    body.append("file", row.file);
                const res = await fetch("/api/lesson-plans", {
                    method: "POST",
                    credentials: "include",
                    body,
                });
                if (!res.ok) {
                    const error = await res.json().catch(() => ({}));
                    throw new Error(error?.details || error?.error || "Failed to save lesson plans");
                }
            }
            qc.invalidateQueries({ queryKey: getListLessonPlansQueryKey() });
            setOpen(false);
            resetAdminForm();
        }
        catch (err) {
            console.error("Create admin lesson plans failed", err);
            alert(err?.message || "Failed to save lesson plans");
        }
        finally {
            setIsSaving(false);
        }
    };
    const minWeekDate = toDateInputValue(new Date());
    const formatClassLabel = (classItem) => classItem.teacherName ? `${classItem.name} - ${classItem.teacherName}` : classItem.name;
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-teal-400">Lesson Plans</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Weekly teaching plan and curriculum
          </p>
        </div>
        {isTeacher && (<div className="flex gap-2">
            {/* <Button variant="outline" className="gap-2" onClick={() => setGridMode(!gridMode)}>
              <Grid3X3 className="w-4 h-4"/>
              {gridMode ? "List View" : "Grid Plan"}
            </Button> */}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="w-4 h-4"/>
                  New Plan
                </Button>
              </DialogTrigger>
              <DialogContent className={isAdmin ? "max-w-[96vw] max-h-[90vh] overflow-y-auto" : "max-w-lg max-h-[90vh] overflow-y-auto"}>
                <DialogHeader>
                  <DialogTitle>Create Lesson Plan</DialogTitle>
                </DialogHeader>
                {isAdmin ? (<div className="space-y-5 py-2">
                  <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_180px_150px] gap-3 items-end">
                    <div>
                      <Label>Class</Label>
                      <Select value={adminForm.classId} onValueChange={handleAdminClassChange}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select class"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                            {formatClassLabel(c)}
                          </SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="relative">
                      <Label>Subject</Label>
                      <Button type="button" variant="outline" className="mt-1 w-full justify-between font-normal" disabled={!adminForm.classId} onClick={() => setSubjectMenuOpen((v) => !v)}>
                        {selectedSubjectIds.length ? `${selectedSubjectIds.length} selected` : "Select subjects"}
                        <span className="text-xs">v</span>
                      </Button>
                      {subjectMenuOpen && (<div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-2 shadow-lg max-h-64 overflow-y-auto">
                        <label className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer">
                          <Checkbox checked={adminSubjects.length > 0 && selectedSubjectIds.length === adminSubjects.length} onCheckedChange={toggleAllAdminSubjects}/>
                          All subjects
                        </label>
                        {adminSubjects.length === 0 ? (<p className="px-2 py-2 text-sm text-muted-foreground">No subjects for this class</p>) : adminSubjects.map((s) => (<label key={s.id} className="flex items-center gap-2 px-2 py-2 text-sm cursor-pointer">
                          <Checkbox checked={selectedSubjectIds.includes(String(s.id))} onCheckedChange={() => toggleAdminSubject(String(s.id))}/>
                          {s.name}
                        </label>))}
                      </div>)}
                    </div>
                    <div>
                      <Label>Date</Label>
                    <Input type="date" min={minWeekDate} className="mt-1 [&::-webkit-calendar-picker-indicator]:invert" value={adminForm.weekDate} onChange={(e) => setAdminForm((f) => ({ ...f, weekDate: e.target.value }))} onKeyDown={(e) => e.preventDefault()} onPaste={(e) => e.preventDefault()}/>
                    
                    
                        </div>
                    <div>
                      <Label>Duration</Label>
                      <Input type="number" className="mt-1" value={adminForm.duration} onChange={(e) => setAdminForm((f) => ({ ...f, duration: e.target.value }))}/>
                    </div>
                  </div>
                  {selectedAdminSubjects.length > 0 && (<div className="flex flex-wrap gap-2 text-xs">
                    {selectedAdminSubjects.map((s) => (<Badge key={s.id} variant="outline">{s.name}</Badge>))}
                  </div>)}
                  <div className="overflow-x-auto">
                    <div className="min-w-[1120px] space-y-2">
                      <div className="grid grid-cols-[70px_140px_180px_160px_190px_190px_190px] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>S.No</span><span>Subject</span><span>Teacher</span><span>Title Plan</span><span>Learning Obj</span><span>Lesson Content</span><span>Document Upload</span>
                      </div>
                      {selectedAdminSubjects.length === 0 ? (<div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">Selected subjects will appear here.</div>) : selectedAdminSubjects.map((subject, index) => {
                        const id = String(subject.id);
                        const row = adminRows[id] ?? {};
                        return (<div key={id} className="grid grid-cols-[70px_140px_180px_160px_190px_190px_190px] gap-2 items-center">
                          <Input type="number" min="1" value={row.lessonOrder ?? index + 1} onChange={(e) => updateAdminRow(id, { lessonOrder: Number(e.target.value) })}/>
                          <div className="text-sm font-medium truncate">{subject.name}</div>
                          <Select value={row.teacherId ?? ""} onValueChange={(v) => updateAdminRow(id, { teacherId: v })}>
                            <SelectTrigger><SelectValue placeholder="Teacher"/></SelectTrigger>
                            <SelectContent className="max-h-60 overflow-y-auto">
                              {teacherOptions.map((t) => (<SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <Input value={row.title ?? ""} onChange={(e) => updateAdminRow(id, { title: e.target.value })} placeholder={`Plan ${index + 1}`}/>
                          <Input value={row.objectives ?? ""} onChange={(e) => updateAdminRow(id, { objectives: e.target.value })} placeholder="Learning objective"/>
                          <Input value={row.content ?? ""} onChange={(e) => updateAdminRow(id, { content: e.target.value })} placeholder="Lesson content"/>
                          <div>
                            <Input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,image/*" onChange={(e) => updateAdminRow(id, { file: e.target.files?.[0] ?? null })}/>
                            {row.file && <p className="text-[11px] text-muted-foreground truncate mt-1">{row.file.name}</p>}
                          </div>
                        </div>);
                      })}
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button className="min-w-40" disabled={isSaving || selectedSubjectIds.length === 0} onClick={handleAdminSavePlans}>
                      {isSaving ? "Saving..." : "Save Plan"}
                    </Button>
                  </div>
                </div>) : (<div className="space-y-4 py-2">
                  <div>
                    <Label>Title *</Label>
                    <Input className="mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Lesson title"/>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Class *</Label>
                      <Select value={form.classId} onValueChange={(v) => setForm((f) => ({ ...f, classId: v, subjectId: "" }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select class"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                              {formatClassLabel(c)}
                            </SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Subject *</Label>
                      <Select value={form.subjectId} onValueChange={(v) => setForm((f) => ({ ...f, subjectId: v }))} disabled={!form.classId}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select subject"/>
                        </SelectTrigger>
                        <SelectContent className="max-h-60 overflow-y-auto">
                          {formSubjects.length > 0 ? formSubjects.map((s) => (<SelectItem key={s.id} value={String(s.id)}>
                              {s.name}
                            </SelectItem>)) : (<div className="px-2 py-2 text-sm text-muted-foreground">No subjects found for this class</div>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Week Date</Label>
                   
                   <Input type="date" min={minWeekDate} className="mt-1 [&::-webkit-calendar-picker-indicator]:invert" value={form.weekDate} onChange={(e) => setForm((f) => ({ ...f, weekDate: e.target.value }))} onKeyDown={(e) => e.preventDefault()} onPaste={(e) => e.preventDefault()}/>
                   
                         </div>
                    <div>
                      <Label>Duration (min)</Label>
                      <Input type="number" className="mt-1" value={form.duration} onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}/>
                    </div>
                  </div>
                  <div>
                    <Label>Learning Objectives</Label>
                    <Textarea className="mt-1 resize-none" rows={3} value={form.objectives} onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))} placeholder="What students will learn…"/>
                  </div>
                  <div>
                    <Label>Lesson Content</Label>
                    <Textarea className="mt-1 resize-none" rows={4} value={form.content} onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))} placeholder="Topics, activities, resources…"/>
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <Upload className="w-4 h-4"/> Attach Document (optional)
                    </Label>
                    <Input type="file" className="mt-1" accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,.txt" onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}/>
                    {selectedFile && <p className="text-xs text-muted-foreground mt-1">{selectedFile.name}</p>}
                  </div>
                  <Button className="w-full" disabled={!form.title ||
                !form.subjectId ||
                !form.classId ||
                createMutation.isPending} onClick={() => createMutation.mutate({
                data: {
                    title: form.title,
                    objectives: form.objectives || undefined,
                    content: form.content || undefined,
                    subjectId: parseInt(form.subjectId),
                    classId: parseInt(form.classId),
                    teacherId: selectedTeacherId,
                    weekDate: form.weekDate,
                    duration: parseInt(form.duration),
                },
            })}>
                    {createMutation.isPending ? "Saving…" : "Save Plan"}
                  </Button>
                </div>)}
              </DialogContent>
            </Dialog>
          </div>)}
      </div>

      {/* Grid Planning Mode */}
      {/* {gridMode && isTeacher && (<Card className="border-blue-500/30 bg-blue-500/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Grid3X3 className="w-4 h-4 text-blue-400"/>
              Grid Planning — Select class to plan all subjects at once
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={gridClassId} onValueChange={setGridClassId}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select class"/>
                </SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                      {formatClassLabel(c)}
                    </SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            {gridClassId && gridSubjects.length > 0 && (<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {gridSubjects.map((subject) => {
                    const existingPlan = plans.find((p) => String(p.classId) === gridClassId &&
                        String(p.subjectId) === String(subject.id));
                    return (<div key={subject.id} className={`p-3 rounded-lg border ${existingPlan
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-border bg-card"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{subject.name}</p>
                        {existingPlan && (<Badge className="text-xs bg-emerald-500/10 text-emerald-400">
                            Planned
                          </Badge>)}
                      </div>
                      {existingPlan ? (<p className="text-xs text-muted-foreground line-clamp-2">
                          {existingPlan.title}
                        </p>) : (<Button size="sm" variant="outline" className="w-full text-xs gap-1" onClick={() => {
                                setForm({
                                    ...defaultForm,
                                    classId: gridClassId,
                                    subjectId: String(subject.id),
                                });
                                setOpen(true);
                            }}>
                          <Plus className="w-3 h-3"/>
                          Add Plan
                        </Button>)}
                    </div>);
                })}
              </div>)}
            {gridClassId && gridSubjects.length === 0 && (<p className="text-sm text-muted-foreground">
                No subjects assigned to this class yet.
              </p>)}
          </CardContent>
        </Card>)} */}

      {/* Filter */}
      <div className="flex gap-3">
        <Select value={filterClass || "all"} onValueChange={(v) => { setFilterClass(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All classes"/>
          </SelectTrigger>
          <SelectContent className="max-h-60 overflow-y-auto">
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                {formatClassLabel(c)}
              </SelectItem>))}
          </SelectContent>
        </Select>
        {filterClass && (<Button variant="outline" onClick={() => { setFilterClass(""); setPage(1); }}>
            Clear
          </Button>)}
      </div>

      {/* List */}
      {isLoading ? (<div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-28 w-full"/>))}
        </div>) : sortedPlans.length === 0 ? (<Card className="glass-card border-t-2 border-t-teal-500/30">
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <BookOpen className="w-8 h-8 opacity-30"/>
            <p>No lesson plans created yet.</p>
          </CardContent>
        </Card>) : (<>
        <div className="space-y-3">
          {pagedPlans.map((plan) => (<Card key={plan.id} className="glass-card glass-hover border-l-2 border-l-teal-500/40 transition-colors group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-teal-500/10 shrink-0 mt-0.5">
                      <BookOpen className="w-4 h-4 text-teal-400"/>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="font-semibold">{plan.title}</h3>
                        <Badge className={`text-xs ${statusColors[plan.status ?? "draft"]}`}>
                          {plan.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {plan.className} · {plan.subjectName}
                        {plan.weekDate ? ` · ${plan.weekDate}` : ""}
                        {plan.duration ? ` · ${plan.duration}min` : ""}
                      </p>
                      {plan.objectives && (<p className="text-sm text-muted-foreground line-clamp-2">
                          {plan.objectives}
                        </p>)}
                    </div>
                  </div>
                  {isTeacher && (<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {plan.fileUrl && (<>
                          <a href={plan.fileUrl} target="_blank" rel="noopener noreferrer" title="View attachment">
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-teal-400">
                              <Eye className="w-3.5 h-3.5"/>
                            </Button>
                          </a>
                          <a href={`${plan.fileUrl}?disposition=attachment`} target="_blank" rel="noopener noreferrer" title="Download attachment">
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-blue-400">
                              <Download className="w-3.5 h-3.5"/>
                            </Button>
                          </a>
                        </>)}
                      {/* {plan.status === "draft" && (<Button size="icon" variant="ghost" className="w-7 h-7 text-emerald-400" title="Submit for approval" onClick={() => updateMutation.mutate({
                            id: plan.id,
                            data: { status: "submitted" },
                        })}>
                          <Check className="w-3.5 h-3.5"/>
                        </Button>)} */}
                      {/* <Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" onClick={() => deleteMutation.mutate({ id: plan.id })}>
                        <Trash2 className="w-3.5 h-3.5"/>
                      </Button> */}
                    </div>)}
                </div>
              </CardContent>
            </Card>))}
        </div>
        {totalPages > 1 && (<div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>{(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, sortedPlans.length)} of {sortedPlans.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="px-2 text-foreground">Page {safePage} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>)}
        </>)}
    </div>);
}
