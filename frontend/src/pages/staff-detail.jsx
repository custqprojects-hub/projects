import { useState, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetStaff, useListClasses, getListClassesQueryKey } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AdminPasswordField } from "@/components/admin-password-field";
import { ArrowLeft, Phone, Mail, Briefcase, GraduationCap, Calendar, IndianRupee, FileText, Upload, Trash2, AlertTriangle, ClipboardList, Wallet, Award, BookOpen, Save, CheckCircle2, XCircle, Clock, Eye, Pencil, X} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { IdCard } from "@/components/id-card";
// Tailwind purges classes by static string scanning, so dynamic
// `bg-${color}-...` won't survive a production build. Map color → static
// utility strings instead.
const STAT_COLORS = {
    purple: { bg: "bg-purple-500/8", border: "border-purple-500/20", text: "text-purple-400" },
    blue: { bg: "bg-blue-500/8", border: "border-blue-500/20", text: "text-blue-400" },
    cyan: { bg: "bg-cyan-500/8", border: "border-cyan-500/20", text: "text-cyan-400" },
    emerald: { bg: "bg-emerald-500/8", border: "border-emerald-500/20", text: "text-emerald-400" },
};
const DEPARTMENTS = [
    "Science", "Mathematics", "Languages", "Social Studies", "Arts",
    "Physical Education", "Administration", "Hostel", "Transport", "Library",
    "Store", "IT", "English", "Hindi", "Computer Science", "Commerce", "Finance", "Other",
];
const STAFF_ROLES = [
    { value: "teacher", label: "Teacher" },
    { value: "admin", label: "Admin" },
    { value: "clerk", label: "Clerk" },
    { value: "accountant", label: "Accountant" },
    { value: "hostel_warden", label: "Hostel Warden" },
    { value: "transport_manager", label: "Transport Manager" },
    { value: "driver", label: "Driver" },
    { value: "store_manager", label: "Store Manager" },
    { value: "librarian", label: "Librarian" },
];
const STAFF_STATUSES = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "on_leave", label: "On Leave" },
];
const blankEditForm = {
    name: "",
    email: "",
    phone: "",
    role: "teacher",
    department: "",
    qualification: "",
    salary: "",
    yearsOfExperience: "",
    joinDate: "",
    status: "active",
};
function fmtBytes(n) {
    if (!n)
        return "—";
    if (n < 1024)
        return `${n} B`;
    if (n < 1024 * 1024)
        return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
function docDownloadUrl(staffId, docId) {
    // Resource-scoped download endpoint — verifies doc ↔ staff association
    // server-side instead of exposing raw object IDs.
    return `/api/staff/${staffId}/documents/${docId}/download`;
}
export default function StaffDetail() {
    const params = useParams();
    const id = parseInt(params.id ?? "0", 10);
    const [, setLocation] = useLocation();
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const fileInput = useRef(null);
    const [notes, setNotes] = useState("");
    const [notesDirty, setNotesDirty] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editForm, setEditForm] = useState(blankEditForm);
    const isAdmin = user?.role === "admin";
    const { data: staff, isLoading, error } = useGetStaff(id, {
        query: { enabled: !!id, staleTime: 15000 },
    });
    // Initialize notes once staff loads
    if (staff && !notesDirty && notes === "" && staff.performanceNotes) {
        // one-shot prefill (cheap; the input becomes the source of truth after edit)
        setNotes(String(staff.performanceNotes));
    }
    const { data: classes = [] } = useListClasses({
        query: { queryKey: getListClassesQueryKey(), staleTime: 60000 },
    });
    // Attendance records this staff member has marked. `attendance.markedById`
    // stores the marker's user id, so we filter by staff.userId once available.
    const userId = staff?.userId;
    const { data: markedAttendance = [] } = useQuery({
        queryKey: ["attendance", "markedBy", userId],
        queryFn: () => fetch("/api/attendance", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : []))
            .then((rows) => rows.filter((a) => a.markedById === userId)),
        enabled: !!userId,
        staleTime: 30000,
    });
    // Leaves for this staff member. The API keys leave rows by
    // applicantType="staff" + applicantId=staff.id (NOT users.id), so we filter
    // on staff.id from the loaded staff record.
    const { data: leaves = [] } = useQuery({
        queryKey: ["leaves", "staff", id],
        queryFn: () => fetch("/api/leaves?applicantType=staff", { credentials: "include" })
            .then((r) => (r.ok ? r.json() : []))
            .then((rows) => rows.filter((l) => l.applicantId === id)),
        enabled: !!id,
        staleTime: 30000,
    });
    const uploadDoc = useMutation({
        mutationFn: async (file) => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("label", file.name);
            const res = await fetch(`/api/staff/${id}/documents`, {
                method: "POST",
                body: fd,
                credentials: "include",
            });
            if (!res.ok)
                throw new Error((await res.json().catch(() => ({}))).error ?? "Upload failed");
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["/api/staff", id] });
            qc.invalidateQueries({ queryKey: [`/staff/${id}`] });
            qc.invalidateQueries(); // sweeping; staff hook key uses generated key
            toast({ title: "Document uploaded" });
        },
        onError: (err) => toast({ title: "Upload failed", description: err?.message, variant: "destructive" }),
    });
    const deleteDoc = useMutation({
        mutationFn: async (docId) => {
            const res = await fetch(`/api/staff/${id}/documents/${docId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Delete failed");
            return res.json();
        },
        onSuccess: () => {
            qc.invalidateQueries();
            toast({ title: "Document removed" });
        },
        onError: () => toast({ title: "Failed to delete document", variant: "destructive" }),
    });
    const saveNotes = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/staff/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ performanceNotes: notes }),
                credentials: "include",
            });
            if (!res.ok)
                throw new Error("Save failed");
            return res.json();
        },
        onSuccess: () => {
            setNotesDirty(false);
            qc.invalidateQueries();
            toast({ title: "Performance notes saved" });
        },
        onError: () => toast({ title: "Failed to save notes", variant: "destructive" }),
    });
    const openEdit = () => {
        if (!staff)
            return;
        setEditForm({
            name: staff.name ?? "",
            email: staff.email ?? "",
            phone: staff.phone ?? "",
            role: staff.role ?? "teacher",
            department: staff.department ?? "",
            qualification: staff.qualification ?? "",
            salary: staff.salary != null ? String(staff.salary) : "",
            yearsOfExperience: staff.yearsOfExperience != null ? String(staff.yearsOfExperience) : "",
            joinDate: staff.joinDate ?? "",
            status: staff.status ?? "active",
        });
        setEditOpen(true);
    };
    const saveProfile = useMutation({
        mutationFn: async () => {
            const payload = {
                name: editForm.name.trim(),
                email: editForm.email.trim(),
                phone: editForm.phone.trim() || null,
                role: editForm.role,
                department: editForm.department,
                qualification: editForm.qualification.trim() || null,
                salary: editForm.salary === "" ? null : Number(editForm.salary),
                yearsOfExperience: editForm.yearsOfExperience === "" ? null : Number(editForm.yearsOfExperience),
                joinDate: editForm.joinDate,
                status: editForm.status,
            };
            const res = await fetch(`/api/staff/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
                credentials: "include",
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? "Update failed");
            }
            return res.json();
        },
        onSuccess: () => {
            setEditOpen(false);
            qc.invalidateQueries();
            toast({ title: "Staff profile updated" });
        },
        onError: (err) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
    });
    if (isLoading) {
        return (<div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-32 w-full"/>
        <Skeleton className="h-96 w-full"/>
      </div>);
    }
    if (error || !staff) {
        return (<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 opacity-60"/>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Staff member not found</h2>
          <p className="text-muted-foreground text-sm mt-1">
            The staff member doesn't exist or you don't have access.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/staff">
            <ArrowLeft className="w-4 h-4 mr-2"/>
            Back to Staff
          </Link>
        </Button>
      </div>);
    }
    const s = staff;
    const documents = s.documents ?? [];
    const yearsOfService = s.joinDate
        ? Math.floor((Date.now() - new Date(s.joinDate).getTime()) / (1000 * 60 * 60 * 24 * 365))
        : null;
    const monthlySalary = s.salary ? Number(s.salary) : 0;
    const isTeacher = s.role === "teacher";
    // classes.teacher_id references staff.id (NOT users.id) — see classes route.
    const assignedClasses = isTeacher
        ? classes.filter((c) => c.teacherId === s.id)
        : [];
    const approvedLeaves = leaves.filter((l) => l.status === "approved").length;
    const pendingLeaves = leaves.filter((l) => l.status === "pending").length;
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/staff")} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground" data-testid="button-back-to-staff">
        <ArrowLeft className="w-4 h-4"/>
        Back to Staff
      </Button>

      {/* Header card */}
      <Card className="glass-card border-t-2 border-t-purple-400/40 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(271 91% 65% / 0.06), transparent)" }}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-purple-400/30 shrink-0">
              <AvatarImage src={s.avatarUrl || ""}/>
              <AvatarFallback className="bg-purple-500/15 text-purple-400 text-3xl font-bold">
                {s.name?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-serif font-bold truncate text-purple-400">{s.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5 capitalize">
                {String(s.role ?? "").replace(/_/g, " ")} · {s.department}
                {s.staffId && (<> · ID: <span className="font-mono text-purple-400">{s.staffId}</span></>)}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge className={s.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground"}>
                  {s.status}
                </Badge>
                {s.qualification && (<Badge variant="outline" className="text-xs text-purple-400 border-purple-500/20">
                    {s.qualification}
                  </Badge>)}
                {s.yearsOfExperience != null && (<Badge variant="outline" className="text-xs">{s.yearsOfExperience} yrs exp</Badge>)}
              </div>
            </div>
            {isAdmin && (<Button size="sm" variant="outline" className="gap-2 shrink-0" onClick={openEdit} data-testid="button-edit-staff-profile">
              <Pencil className="w-3.5 h-3.5"/>
              Edit
            </Button>)}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            <Stat label="Monthly Salary" value={monthlySalary ? `₹${Math.round(monthlySalary / 1000)}K` : "—"} color="purple"/>
            <Stat label="Service" value={yearsOfService != null ? `${yearsOfService}y` : "—"} color="blue"/>
            <Stat label="Documents" value={documents.length} color="cyan"/>
            <Stat label="Leaves Approved" value={approvedLeaves} color="emerald"/>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="profile">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="leaves">Leaves</TabsTrigger>
          <TabsTrigger value="payroll">Payroll</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          {isTeacher && <TabsTrigger value="classes">Classes</TabsTrigger>}
          <TabsTrigger value="idcard">ID Card</TabsTrigger>
        </TabsList>

        {/* ── Profile ── */}
        <TabsContent value="profile" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6 space-y-5">
              <Section title="Personal">
                <Field label="Full Name" value={s.name}/>
                <Field label="Status" value={String(s.status ?? "—")} className="capitalize"/>
                {s.email && (<Field label="Email" value={<span className="flex items-center gap-1 truncate">
                      <Mail className="w-3 h-3 text-muted-foreground shrink-0"/>
                      <span className="truncate">{s.email}</span>
                    </span>}/>)}
                {s.phone && (<Field label="Phone" value={<span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-muted-foreground"/>{s.phone}
                    </span>}/>)}
              </Section>
              <Section title="Employment">
                <Field label="Role" value={<span className="flex items-center gap-1.5 capitalize">
                    <Briefcase className="w-3.5 h-3.5 text-purple-400"/>{String(s.role).replace(/_/g, " ")}
                  </span>}/>
                <Field label="Department" value={s.department}/>
                {s.qualification && (<Field label="Qualification" value={<span className="flex items-center gap-1.5">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-400"/>{s.qualification}
                    </span>}/>)}
                {s.joinDate && (<Field label="Join Date" value={<span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-400"/>{s.joinDate}
                    </span>}/>)}
                {s.yearsOfExperience != null && (<Field label="Years of Experience" value={`${s.yearsOfExperience} yrs`}/>)}
                {monthlySalary > 0 && (<Field label="Monthly Salary" value={<span className="flex items-center gap-1 font-bold text-purple-400">
                      <IndianRupee className="w-3.5 h-3.5"/>
                      {monthlySalary.toLocaleString("en-IN")}
                    </span>}/>)}
              </Section>
              {isAdmin && (
                <Section title="Admin Controls">
                  <AdminPasswordField 
                    userId={s.id} 
                    username={s.name}
                    onPasswordChanged={() => qc.invalidateQueries({ queryKey: ["staff", id] })}
                  />
                </Section>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Uploaded Documents</p>
                  <p className="text-xs text-muted-foreground">
                    Certificates, ID proof and other supporting files
                  </p>
                </div>
                {isAdmin && (<>
                    <input ref={fileInput} type="file" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f)
                    uploadDoc.mutate(f);
                if (fileInput.current)
                    fileInput.current.value = "";
            }}/>
                    <Button size="sm" onClick={() => fileInput.current?.click()} disabled={uploadDoc.isPending} className="gap-2" data-testid="button-upload-document">
                      <Upload className="w-3.5 h-3.5"/>
                      {uploadDoc.isPending ? "Uploading…" : "Upload"}
                    </Button>
                  </>)}
              </div>
              {documents.length === 0 ? (<div className="text-center py-10 text-muted-foreground text-sm">
                  <FileText className="w-10 h-10 mx-auto opacity-30 mb-2"/>
                  No documents uploaded yet
                </div>) : (<div className="divide-y divide-border/40 rounded-lg border border-border/40">
                  {documents.map((d) => (<div key={d.id} className="flex items-center gap-3 p-3" data-testid={`document-${d.id}`}>
                      <div className="p-2 rounded-md bg-purple-500/10 text-purple-400 shrink-0">
                        <FileText className="w-4 h-4"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{d.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtBytes(d.size)} · {new Date(d.uploadedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Button asChild size="icon" variant="ghost" className="h-8 w-8">
                        <a href={docDownloadUrl(id, d.id)} target="_blank" rel="noreferrer">
                          <Eye className="w-4 h-4"/>
                        </a>
                      </Button>
                      {isAdmin && (<Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={deleteDoc.isPending} onClick={() => {
                        if (confirm("Delete this document?"))
                            deleteDoc.mutate(d.id);
                    }}>
                          <Trash2 className="w-3.5 h-3.5"/>
                        </Button>)}
                    </div>))}
                </div>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Attendance (records marked BY this staff member) ── */}
        <TabsContent value="attendance" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-purple-400"/>
                  Attendance Marked by {s.name?.split(" ")[0]}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Student attendance records this staff member has entered.
                </p>
              </div>

              {markedAttendance.length === 0 ? (<div className="text-center py-10 text-sm text-muted-foreground">
                  <ClipboardList className="w-10 h-10 mx-auto opacity-30 mb-2"/>
                  No attendance records marked yet.
                </div>) : (<>
                  <div className="grid grid-cols-3 gap-3">
                    <MarkStat label="Present" value={markedAttendance.filter((a) => a.status === "present").length} icon={<CheckCircle2 className="w-3.5 h-3.5"/>} color="emerald"/>
                    <MarkStat label="Absent" value={markedAttendance.filter((a) => a.status === "absent").length} icon={<XCircle className="w-3.5 h-3.5"/>} color="red"/>
                    <MarkStat label="Late" value={markedAttendance.filter((a) => a.status === "late").length} icon={<Clock className="w-3.5 h-3.5"/>} color="amber"/>
                  </div>
                  <div className="divide-y divide-border/40 rounded-lg border border-border/40 max-h-96 overflow-y-auto">
                    {markedAttendance.slice(0, 50).map((a) => (<div key={a.id} className="flex items-center justify-between p-3 text-sm">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{a.studentName}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.date} {a.className && `· ${a.className}`}
                          </p>
                        </div>
                        <Badge variant="outline" className={a.status === "present" ? "text-emerald-400 border-emerald-500/20" :
                    a.status === "absent" ? "text-red-400 border-red-500/20" :
                        "text-amber-400 border-amber-500/20"}>
                          {a.status}
                        </Badge>
                      </div>))}
                  </div>
                  {markedAttendance.length > 50 && (<p className="text-xs text-muted-foreground text-center">
                      Showing 50 of {markedAttendance.length} records.
                    </p>)}
                </>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Leaves ── */}
        <TabsContent value="leaves" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between text-sm">
                <p className="font-semibold">Leave History</p>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-emerald-400 border-emerald-500/20">
                    {approvedLeaves} approved
                  </Badge>
                  <Badge variant="outline" className="text-amber-400 border-amber-500/20">
                    {pendingLeaves} pending
                  </Badge>
                </div>
              </div>
              {leaves.length === 0 ? (<p className="text-center py-8 text-sm text-muted-foreground">
                  No leave requests on record.
                </p>) : (<div className="divide-y divide-border/40 rounded-lg border border-border/40">
                  {leaves.map((l) => (<div key={l.id} className="p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {l.startDate ?? "—"}
                          {l.endDate && l.endDate !== l.startDate ? ` → ${l.endDate}` : ""}
                          {l.leaveType && (<span className="ml-2 text-xs text-muted-foreground capitalize">
                              ({l.leaveType.replace(/_/g, " ")})
                            </span>)}
                        </span>
                        <Badge variant="outline" className={l.status === "approved" ? "text-emerald-400 border-emerald-500/20" :
                    l.status === "rejected" ? "text-red-400 border-red-500/20" :
                        "text-amber-400 border-amber-500/20"}>
                          {l.status}
                        </Badge>
                      </div>
                      {l.reason && (<p className="text-xs text-muted-foreground mt-1">{l.reason}</p>)}
                    </div>))}
                </div>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Payroll ── */}
        <TabsContent value="payroll" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6 space-y-4">
              <Section title="Payroll Snapshot">
                <Field label="Monthly Salary" value={monthlySalary > 0 ? (<span className="flex items-center gap-1 font-bold text-purple-400">
                      <IndianRupee className="w-3.5 h-3.5"/>
                      {monthlySalary.toLocaleString("en-IN")}
                    </span>) : "—"}/>
                <Field label="Annual" value={monthlySalary > 0 ? (<span className="flex items-center gap-1">
                      <Wallet className="w-3.5 h-3.5 text-emerald-400"/>
                      ₹{(monthlySalary * 12).toLocaleString("en-IN")}
                    </span>) : "—"}/>
              </Section>
              <p className="text-xs text-muted-foreground">
                Full payroll history will be available when the payroll module is rolled out.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Performance ── */}
        <TabsContent value="performance" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-purple-400"/>
                <p className="text-sm font-semibold">Performance Notes</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">
                  Observations, commendations and review notes
                </Label>
                <Textarea rows={6} value={notes} onChange={(e) => { setNotes(e.target.value); setNotesDirty(true); }} placeholder={isAdmin ? "Add a note about this staff member's performance…" : "No notes recorded."} disabled={!isAdmin}/>
                {isAdmin && (<div className="flex justify-end">
                    <Button size="sm" className="gap-2" disabled={!notesDirty || saveNotes.isPending} onClick={() => saveNotes.mutate()}>
                      <Save className="w-3.5 h-3.5"/>
                      {saveNotes.isPending ? "Saving…" : "Save Notes"}
                    </Button>
                  </div>)}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Assigned Classes (teachers only) ── */}
        {isTeacher && (<TabsContent value="classes" className="mt-4">
            <Card className="glass-card border-t-2 border-t-purple-400/30">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4 text-purple-400"/>
                  <p className="text-sm font-semibold">Assigned as Class Teacher</p>
                </div>
                {assignedClasses.length === 0 ? (<p className="text-center py-8 text-sm text-muted-foreground">
                    Not assigned to any class.
                  </p>) : (<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {assignedClasses.map((c) => (<div key={c.id} className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
                        <p className="text-sm font-semibold">{c.grade}-{c.section}</p>
                        <p className="text-xs text-muted-foreground">{c.academicYear}</p>
                        {c.room && <p className="text-xs text-muted-foreground">{c.room}</p>}
                      </div>))}
                  </div>)}
              </CardContent>
            </Card>
          </TabsContent>)}

        {/* ── ID Card ── */}
        <TabsContent value="idcard" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6">
              <IdCard type="staff" name={s.name} idNumber={s.staffId ?? `STAFF-${s.id}`} subtitle={`${String(s.role).replace(/_/g, " ")} · ${s.department}`} meta={[
            ...(s.qualification ? [{ label: "Qualification", value: s.qualification }] : []),
            ...(s.yearsOfExperience != null ? [{ label: "Experience", value: `${s.yearsOfExperience} yrs` }] : []),
        ]} photoUrl={s.avatarUrl ?? undefined}/>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Staff Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-5">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EditField label="Full Name *">
                  <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value.replace(/[^A-Za-z\s]/g, "") }))}/>
                </EditField>
                <EditField label="Status *">
                  <Select value={editForm.status} onValueChange={(value) => setEditForm((f) => ({ ...f, status: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAFF_STATUSES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                  </Select>
                </EditField>
                <EditField label="Email *">
                  <Input type="email" value={editForm.email} onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}/>
                </EditField>
                <EditField label="Phone">
                  <Input value={editForm.phone} maxLength={10} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))}/>
                </EditField>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Employment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <EditField label="Role *">
                  <Select value={editForm.role} onValueChange={(value) => setEditForm((f) => ({ ...f, role: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STAFF_ROLES.map((role) => <SelectItem key={role.value} value={role.value}>{role.label}</SelectItem>)}</SelectContent>
                  </Select>
                </EditField>
                <EditField label="Department *">
                  <Select value={editForm.department} onValueChange={(value) => setEditForm((f) => ({ ...f, department: value }))}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>{DEPARTMENTS.map((department) => <SelectItem key={department} value={department}>{department}</SelectItem>)}</SelectContent>
                  </Select>
                </EditField>
                <EditField label="Qualification">
                  <Input value={editForm.qualification} onChange={(e) => setEditForm((f) => ({ ...f, qualification: e.target.value }))}/>
                </EditField>
                <EditField label="Join Date *">
                  <Input type="date" value={editForm.joinDate} onChange={(e) => setEditForm((f) => ({ ...f, joinDate: e.target.value }))}/>
                </EditField>
                <EditField label="Monthly Salary">
                  <Input type="number" min="0" value={editForm.salary} onChange={(e) => setEditForm((f) => ({ ...f, salary: e.target.value }))}/>
                </EditField>
                <EditField label="Years of Experience">
                  <Input type="number" min="0" value={editForm.yearsOfExperience} onChange={(e) => setEditForm((f) => ({ ...f, yearsOfExperience: e.target.value }))}/>
                </EditField>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" className="gap-2" onClick={() => setEditOpen(false)}>
                <X className="w-3.5 h-3.5"/>
                Cancel
              </Button>
              <Button type="button" className="gap-2" disabled={saveProfile.isPending || !editForm.name.trim() || !editForm.email.trim() || !editForm.role || !editForm.department || !editForm.joinDate} onClick={() => saveProfile.mutate()}>
                <Save className="w-3.5 h-3.5"/>
                {saveProfile.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>);
}
function MarkStat({ label, value, icon, color, }) {
    const cls = {
        emerald: "bg-emerald-500/8 border-emerald-500/20 text-emerald-400",
        red: "bg-red-500/8 border-red-500/20 text-red-400",
        amber: "bg-amber-500/8 border-amber-500/20 text-amber-400",
    }[color];
    return (<div className={`rounded-lg border p-3 text-center ${cls}`}>
      <div className="flex items-center justify-center gap-1.5 text-xs font-medium">
        {icon}<span>{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>);
}
function Stat({ label, value, color }) {
    const c = STAT_COLORS[color] ?? STAT_COLORS.purple;
    return (<div className={`text-center p-3 rounded-lg ${c.bg} border ${c.border}`}>
      <p className={`text-xl font-bold ${c.text}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">{label}</p>
    </div>);
}
function Section({ title, children }) {
    return (<div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">{title}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">{children}</div>
    </div>);
}
function Field({ label, value, className }) {
    return (<div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className={`font-medium ${className ?? ""}`}>{value}</div>
    </div>);
}
function EditField({ label, children }) {
    return (<div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>);
}
