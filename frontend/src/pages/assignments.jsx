import { useEffect, useRef, useState } from "react";
import { useListAssignments, useDeleteAssignment, useListSubjects, useListClasses, useListStaff, getListAssignmentsQueryKey, } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Calendar, FileEdit, Upload, CheckCircle2, Eye, X, Download, Ban } from "lucide-react";
const statusColors = {
    draft: "bg-muted/50 text-muted-foreground",
    published: "bg-blue-500/10 text-blue-400",
    submitted: "bg-amber-500/10 text-amber-400",
    closed: "bg-emerald-500/10 text-emerald-400",
};
const defaultForm = {
    title: "",
    description: "",
    subjectId: "",
    classId: "",
    dueDate: "",
    maxMarks: "100",
};
function newestFirst(a, b) {
    const bTime = new Date(b.createdAt ?? b.submittedAt ?? 0).getTime();
    const aTime = new Date(a.createdAt ?? a.submittedAt ?? 0).getTime();
    if (bTime !== aTime)
        return bTime - aTime;
    return (b.id ?? 0) - (a.id ?? 0);
}
export default function Assignments() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [filterClass, setFilterClass] = useState("");
    const [page, setPage] = useState(1);
    const [submissionsPage, setSubmissionsPage] = useState(1);
    const PAGE_SIZE = 5;
    const [uploadName, setUploadName] = useState("");
    const [form, setForm] = useState(defaultForm);
    const fileInputRef = useRef(null);
    const [attachFile, setAttachFile] = useState(null);
    const [submitOpen, setSubmitOpen] = useState(null);
    const [submittingFile, setSubmittingFile] = useState(null);
    const [submittingNotes, setSubmittingNotes] = useState("");
    const [isUploading, setIsUploading] = useState(false);
    const [activeTab, setActiveTab] = useState("assignments");
    const params = {};
    if (filterClass)
        params.classId = filterClass;
    const { data: assignments = [], isLoading } = useListAssignments(params, {
        query: { queryKey: getListAssignmentsQueryKey(params), staleTime: 10000 },
    });
    const { data: subjects = [] } = useListSubjects();
    const { data: classes = [] } = useListClasses();
    const { data: staff = [] } = useListStaff(undefined, { query: { staleTime: 30000 } });
    const canCreateAssignment = user?.role === "teacher";
    const isTeacher = user?.role === "teacher";
    const isStudent = user?.role === "student";
    const teacherStaff = staff.find((s) => s.userId === user?.id || s.email === user?.email);
    const teacherClasses = classes.filter((c) => c.teacherId === teacherStaff?.id);
    const resetCreateForm = () => {
        setForm(defaultForm);
        setUploadName("");
        setAttachFile(null);
        if (fileInputRef.current)
            fileInputRef.current.value = "";
    };
    const handleCreateAssignment = async () => {
        setIsUploading(true);
        const body = new FormData();
        body.append("title", form.title);
        body.append("description", form.description);
        body.append("subjectId", form.subjectId);
        body.append("classId", form.classId);
        body.append("dueDate", form.dueDate);
        body.append("maxMarks", form.maxMarks);
        if (attachFile)
            body.append("file", attachFile);
        try {
            const res = await fetch("/api/assignments", { method: "POST", credentials: "include", body });
            if (!res.ok) {
                const err = await res.json().catch(() => ({ error: "Create failed" }));
                throw new Error(err.error || err.details || "Create failed");
            }
            qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey() });
            setOpen(false);
            resetCreateForm();
            toast({ title: attachFile ? "Assignment & attachment saved" : "Assignment created" });
        }
        catch (e) {
            toast({ title: "Create failed", description: e.message, variant: "destructive" });
        }
        finally {
            setIsUploading(false);
        }
    };
    const createMutation = { isPending: isUploading && open, mutate: handleCreateAssignment };
    // Student: which assignments have I already submitted?
    const { data: mySubs = [] } = useQuery({
        queryKey: ["assignments", "my-submissions"],
        queryFn: async () => {
            const r = await fetch("/api/assignments/my-submissions", { credentials: "include" });
            return r.ok ? r.json() : [];
        },
        enabled: user?.role === "student",
        staleTime: 10000,
    });
    const submissionByAssignment = new Map(mySubs.map((s) => [s.assignmentId, s]));
    const submittedIds = new Set(mySubs.map((s) => s.assignmentId));
    const submitMutation = useMutation({
        mutationFn: async ({ id, notes, file }) => {
            const body = new FormData();
            body.append("notes", notes || "");
            if (file)
                body.append("file", file);
            const r = await fetch(`/api/assignments/${id}/submit`, { method: "POST", credentials: "include", body });
            if (!r.ok)
                throw new Error((await r.json().catch(() => ({ error: "Failed" }))).error);
            return r.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["assignments", "my-submissions"] });
            setSubmitOpen(null);
            setSubmittingFile(null);
            setSubmittingNotes("");
            toast({ title: "Submitted", description: "Assignment submitted successfully." });
        },
        onError: (e) => toast({ title: "Submit failed", description: e.message, variant: "destructive" }),
    });

    const withdrawMutation = useMutation({
        mutationFn: async ({ id }) => {
            const r = await fetch(`/api/assignments/${id}/submit`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!r.ok)
                throw new Error("Withdraw failed");
            return r.status === 204 ? null : r.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["assignments", "my-submissions"] });
            toast({ title: "Submission withdrawn", description: "You can now submit a new assignment." });
        },
        onError: (e) => toast({ title: "Withdraw failed", description: e.message, variant: "destructive" }),
    });

    const handleStudentSubmit = async () => {
        if (!submitOpen) return;
        setIsUploading(true);
        submitMutation.mutate({
            id: submitOpen,
            notes: submittingNotes,
            file: submittingFile,
        });
        setIsUploading(false);
    };
    const { data: teacherSubmissions = [] } = useQuery({
        queryKey: ["assignment-submissions"],
        queryFn: async () => {
            const r = await fetch("/api/assignment-submissions", { credentials: "include" });
            if (!r.ok)
                throw new Error("Failed to load submissions");
            return r.json();
        },
        enabled: isTeacher,
        staleTime: 10000,
    });
    const reviewMutation = useMutation({
        mutationFn: async ({ id, status }) => {
            const r = await fetch(`/api/assignment-submissions/${id}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });
            if (!r.ok)
                throw new Error("Review failed");
            return r.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["assignment-submissions"] });
            toast({ title: "Submission updated" });
        },
        onError: (e) => toast({ title: "Review failed", description: e.message, variant: "destructive" }),
    });
    const deleteMutation = useDeleteAssignment({
        mutation: {
            onSuccess: () => qc.invalidateQueries({ queryKey: getListAssignmentsQueryKey() }),
        },
    });
    const today = new Date().toISOString().split("T")[0];
    const overdue = assignments.filter((a) => a.dueDate < today && a.status === "published").length;
    // Filter subjects for selected class
    const filteredSubjects = form.classId
        ? subjects.filter((s) => String(s.classId) === form.classId)
        : subjects;
    const sortedAssignments = [...assignments].sort(newestFirst);
    const totalPages = Math.max(1, Math.ceil(sortedAssignments.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pagedAssignments = sortedAssignments.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    const sortedTeacherSubmissions = [...teacherSubmissions].sort(newestFirst);
    const submissionsTotalPages = Math.max(1, Math.ceil(sortedTeacherSubmissions.length / PAGE_SIZE));
    const safeSubmissionsPage = Math.min(submissionsPage, submissionsTotalPages);
    const pagedTeacherSubmissions = sortedTeacherSubmissions.slice((safeSubmissionsPage - 1) * PAGE_SIZE, safeSubmissionsPage * PAGE_SIZE);
    useEffect(() => {
        if (page !== safePage) {
            setPage(safePage);
        }
    }, [page, safePage]);
    useEffect(() => {
        if (submissionsPage !== safeSubmissionsPage) {
            setSubmissionsPage(safeSubmissionsPage);
        }
    }, [submissionsPage, safeSubmissionsPage]);
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-purple-400">Assignments</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isStudent ? "View and submit assignments" : "Manage and track class assignments"}
          </p>
        </div>
        {canCreateAssignment && (<Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4"/>
                Create Assignment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Assignment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Title *</Label>
                  <Input className="mt-1" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Assignment title"/>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea className="mt-1 resize-none" rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Instructions or details…"/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Class *</Label>
                    <Select value={form.classId} onValueChange={(v) => setForm((f) => ({ ...f, classId: v, subjectId: "" }))} disabled={teacherClasses.length === 0}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select class"/>
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        {teacherClasses.length === 0 ? (<SelectItem value="" disabled>No classes assigned</SelectItem>) : teacherClasses.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
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
                      <SelectContent className="max-h-60">
                        {filteredSubjects.map((s) => (<SelectItem key={s.id} value={String(s.id)}>
                            {s.name}
                          </SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Due Date *</Label>
                    <Input type="date" className="mt-1" value={form.dueDate} min={today} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}/>
                  </div>
                  <div>
                    <Label>Max Marks</Label>
                    <Input type="number" className="mt-1" value={form.maxMarks} onChange={(e) => setForm((f) => ({ ...f, maxMarks: e.target.value }))}/>
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-2">
                    <Upload className="w-4 h-4"/> Attach Document (optional)
                  </Label>
                  <Input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png,.jpeg" className="mt-1 cursor-pointer bg-background" onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setAttachFile(f);
                      setUploadName(f.name);
                    }
                  }}/>
                  {uploadName && (
                    <div className="flex items-center justify-between mt-1 p-2 bg-purple-500/10 border border-purple-500/20 rounded-md text-xs text-purple-400">
                      <span className="truncate">📎 {uploadName}</span>
                      <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-red-400 hover:text-red-300" onClick={() => {
                        setAttachFile(null);
                        setUploadName("");
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                <Button className="w-full" disabled={!form.title ||
                !form.subjectId ||
                !form.classId ||
                !form.dueDate ||
                createMutation.isPending} onClick={() => createMutation.mutate({
                data: {
                    title: form.title,
                    description: form.description || undefined,
                    subjectId: parseInt(form.subjectId),
                    classId: parseInt(form.classId),
                    dueDate: form.dueDate,
                    maxMarks: parseInt(form.maxMarks),
                },
            })}>
                  {createMutation.isPending ? "Creating…" : "Create Assignment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>)}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
            { label: "Total", value: assignments.length, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-t-purple-500/40", icon: FileEdit },
            { label: "Published", value: assignments.filter((a) => a.status === "published").length, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-t-blue-500/40", icon: CheckCircle2 },
            { label: "Overdue", value: overdue, color: "text-red-400", bg: "bg-red-500/10", border: "border-t-red-500/40", icon: Calendar },
            { label: "Graded", value: assignments.filter((a) => a.status === "closed").length, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: CheckCircle2 },
        ].map(s => (<Card key={s.label} className={`glass-card glass-hover border-t-2 ${s.border}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${s.bg} p-2 rounded-lg ${s.color}`}><s.icon className="w-4 h-4"/></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
            </CardContent>
          </Card>))}
      </div>

      {/* Filter */}
      {!isStudent && (<div className="flex gap-3">
        <Select value={filterClass || "all"} onValueChange={(v) => { setFilterClass(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All classes"/>
          </SelectTrigger>
          <SelectContent className="max-h-60">
            <SelectItem value="all">All classes</SelectItem>
            {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                {c.name}
              </SelectItem>))}
          </SelectContent>
        </Select>
        {filterClass && (<Button variant="outline" onClick={() => { setFilterClass(""); setPage(1); } }>
            Clear
          </Button>)}
      </div>)}

      {isTeacher && (<div className="flex flex-wrap gap-2">
        <Button variant={activeTab === "assignments" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("assignments"); setPage(1); }}>
          Assignments
        </Button>
        <Button variant={activeTab === "submissions" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("submissions"); setSubmissionsPage(1); }}>
          Student Submissions
        </Button>
      </div>)}

      {/* List */}
      {isTeacher && activeTab === "submissions" ? (
        sortedTeacherSubmissions.length === 0 ? (<Card className="glass-card border-t-2 border-t-purple-500/30">
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <FileEdit className="w-8 h-8 opacity-30"/>
            <p>No student submissions yet.</p>
          </CardContent>
        </Card>) : (<>
        <div className="space-y-3">
          {pagedTeacherSubmissions.map((s) => (<Card key={s.id} className="glass-card glass-hover border-l-2 border-l-emerald-500/40">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-semibold">{s.assignmentTitle}</h3>
                    <Badge className={`text-xs ${s.status === "approved" ? "bg-emerald-500/10 text-emerald-400" : s.status === "rejected" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"}`}>
                      {s.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {s.studentName}{s.studentAdmissionNo ? ` · ${s.studentAdmissionNo}` : ""} · {s.className} · {s.subjectName}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Submitted: {s.submittedAt}{s.attachmentName ? ` · ${s.attachmentName}` : ""}
                  </p>
                  {s.notes && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {s.fileUrl && (<>
                    <a href={s.fileUrl} target="_blank" rel="noreferrer">
                      <Button size="icon" variant="ghost" className="w-8 h-8 text-purple-400" title="View submission">
                        <Eye className="w-4 h-4"/>
                      </Button>
                    </a>
                    <a href={`${s.fileUrl}?disposition=attachment`} target="_blank" rel="noreferrer">
                      <Button size="icon" variant="ghost" className="w-8 h-8 text-blue-400" title="Download submission">
                        <Download className="w-4 h-4"/>
                      </Button>
                    </a>
                  </>)}
                  <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 gap-1" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: s.id, status: "approved" })}>
                    <CheckCircle2 className="w-3 h-3"/> Approve
                  </Button>
                  <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 gap-1" disabled={reviewMutation.isPending} onClick={() => reviewMutation.mutate({ id: s.id, status: "rejected" })}>
                    <Ban className="w-3 h-3"/> Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>))}
        </div>
        {submissionsTotalPages > 1 && (<div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>{(safeSubmissionsPage - 1) * PAGE_SIZE + 1}-{Math.min(safeSubmissionsPage * PAGE_SIZE, sortedTeacherSubmissions.length)} of {sortedTeacherSubmissions.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={safeSubmissionsPage <= 1} onClick={() => setSubmissionsPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="px-2 text-foreground">Page {safeSubmissionsPage} / {submissionsTotalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={safeSubmissionsPage >= submissionsTotalPages} onClick={() => setSubmissionsPage((p) => Math.min(submissionsTotalPages, p + 1))}>Next</Button>
            </div>
          </div>)}
        </>)
      ) : isLoading ? (<div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 w-full"/>))}
        </div>) : sortedAssignments.length === 0 ? (<Card className="glass-card border-t-2 border-t-purple-500/30">
          <CardContent className="py-16 text-center text-muted-foreground flex flex-col items-center gap-2">
            <FileEdit className="w-8 h-8 opacity-30"/>
            <p>No assignments found.</p>
          </CardContent>
        </Card>) : (<>
        <div className="space-y-3">
          {pagedAssignments.map((a) => {
                const isOver = a.dueDate < today && a.status === "published";
                const mySubmission = submissionByAssignment.get(a.id);
                return (<Card key={a.id} className="glass-card glass-hover border-l-2 border-l-purple-500/40 transition-colors group">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-purple-500/10 shrink-0 mt-0.5">
                        <FileEdit className="w-4 h-4 text-purple-400"/>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold">{a.title}</h3>
                          <Badge className={`text-xs ${statusColors[a.status ?? "draft"]}`}>
                            {a.status}
                          </Badge>
                          {isOver && (<Badge className="text-xs bg-red-500/10 text-red-400">
                              Overdue
                            </Badge>)}
                        </div>
                        {a.description && (<p className="text-sm text-muted-foreground line-clamp-1 mb-1">
                            {a.description}
                          </p>)}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span>
                            {a.className} · {a.subjectName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3"/>
                            Due:{" "}
                            <span className={isOver ? "text-red-400 font-medium" : ""}>
                              {a.dueDate}
                            </span>
                          </span>
                          <span>Max: {a.maxMarks} marks</span>
                          {a.attachmentName && <span>File: {a.attachmentName}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                      {a.attachmentUrl && (<Button asChild size="sm" variant="outline" className="text-purple-400 border-purple-500/30 gap-1">
                          <a href={a.attachmentUrl} target="_blank" rel="noreferrer">
                            <Eye className="w-3 h-3"/>
                            Assignment
                          </a>
                        </Button>)}
                      {a.attachmentUrl && (<Button asChild size="sm" variant="ghost" className="text-blue-400 gap-1">
                          <a href={`${a.attachmentUrl}?disposition=attachment`} target="_blank" rel="noreferrer">
                            <Download className="w-3 h-3"/>
                          </a>
                        </Button>)}
                      {isStudent && a.status === "published" && (submittedIds.has(a.id) ? (
                        <div className="flex items-center gap-2">
                          <Badge className="text-xs bg-emerald-500/10 text-emerald-400 gap-1">
                            <CheckCircle2 className="w-3 h-3"/>
                            Submitted Assignment
                          </Badge>
                          {mySubmission?.status === "approved" && (<Badge className="text-xs bg-emerald-500/10 text-emerald-400">
                            Approved
                          </Badge>)}
                          {mySubmission?.status === "rejected" && (<Badge className="text-xs bg-red-500/10 text-red-400">
                            Rejected
                          </Badge>)}
                          {mySubmission?.status === "submitted" && (<Badge className="text-xs bg-amber-500/10 text-amber-400">
                            Pending Review
                          </Badge>)}
                          {mySubmission?.fileUrl && (<a href={mySubmission.fileUrl} target="_blank" rel="noreferrer" title="View submitted file">
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-emerald-400">
                              <Eye className="w-3.5 h-3.5"/>
                            </Button>
                          </a>)}
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300" disabled={withdrawMutation.isPending} onClick={() => {
                            if (confirm("Withdraw this submission? Your submitted document and notes will be removed.")) {
                              withdrawMutation.mutate({ id: a.id });
                            }
                          }}>
                            Withdraw
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 gap-1" onClick={() => setSubmitOpen(a.id)}>
                          <CheckCircle2 className="w-3 h-3"/>
                          Submit
                        </Button>
                      ))}
                      {isTeacher && (<Button size="icon" variant="ghost" className="w-7 h-7 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate({ id: a.id })}>
                          <Trash2 className="w-3.5 h-3.5"/>
                        </Button>)}
                    </div>
                  </div>
                </CardContent>
              </Card>);
            })}
        </div>
        {totalPages > 1 && (<div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
            <span>{(safePage - 1) * PAGE_SIZE + 1}-{Math.min(safePage * PAGE_SIZE, sortedAssignments.length)} of {sortedAssignments.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
              <span className="px-2 text-foreground">Page {safePage} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>)}
        </>)}

      {/* Student Submit Assignment Dialog */}
      <Dialog open={submitOpen !== null} onOpenChange={(v) => { if(!v) setSubmitOpen(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Assignment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Attach Submission Document *</Label>
              <Input 
                type="file" 
                accept=".pdf,.doc,.docx,.ppt,.pptx,.jpg,.png,.jpeg" 
                className="mt-1 cursor-pointer bg-background" 
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setSubmittingFile(f);
                  }
                }}
              />
              {submittingFile && (
                <div className="flex items-center justify-between mt-1 p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-xs text-emerald-400">
                  <span className="truncate">📎 {submittingFile.name}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-5 w-5 text-red-400 hover:text-red-300" onClick={() => {
                    setSubmittingFile(null);
                  }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea 
                className="mt-1 resize-none" 
                rows={3} 
                value={submittingNotes} 
                onChange={(e) => setSubmittingNotes(e.target.value)} 
                placeholder="Write any additional notes for the teacher..."
              />
            </div>
            <Button 
              className="w-full" 
              disabled={!submittingFile || isUploading || submitMutation.isPending} 
              onClick={handleStudentSubmit}
            >
              {isUploading || submitMutation.isPending ? "Submitting..." : "Submit Assignment"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>);
}
