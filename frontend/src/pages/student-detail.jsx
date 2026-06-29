import { useState } from "react";
import { cn } from "@/lib/utils";
import { useParams, useLocation, Link } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useGetStudent, useGetStudentAttendanceSummary, useListFees, useListExamResults, useListHostelApplications, getListFeesQueryKey, getListExamResultsQueryKey, getListHostelApplicationsQueryKey, } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Phone, Mail, MapPin, AlertTriangle, Wallet, Award, Bed, Bus, FileText, Users as UsersIcon, UploadCloud, Download, Trash2, Loader2, } from "lucide-react";
import { IdCard } from "@/components/id-card";
const GRADE_COLORS = {
    "A+": "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    "A": "bg-green-500/10 text-green-400 border-green-500/20",
    "B+": "bg-blue-500/10 text-blue-400 border-blue-500/20",
    "B": "bg-sky-500/10 text-sky-400 border-sky-500/20",
    "C": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    "D": "bg-orange-500/10 text-orange-400 border-orange-500/20",
    "F": "bg-red-500/10 text-red-400 border-red-500/20",
};
export default function StudentDetail() {
    const params = useParams();
    const id = parseInt(params.id ?? "0", 10);
    const [, setLocation] = useLocation();
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();

    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const uploadFile = async (file) => {
        setIsUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("label", file.name);
        try {
            const res = await fetch(`/api/students/${id}/documents`, {
                method: "POST",
                body: formData,
                credentials: "include",
            });
            if (res.ok) {
                qc.invalidateQueries({ queryKey: ["student", id] });
                qc.invalidateQueries({ queryKey: ["students"] });
                toast({ title: "Document uploaded successfully" });
            } else {
                const errJson = await res.json();
                toast({ title: "Upload failed", description: errJson.error || "Failed to upload document", variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDrop = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            await uploadFile(e.dataTransfer.files[0]);
        }
    };

    const handleFileChange = async (e) => {
        if (e.target.files && e.target.files[0]) {
            await uploadFile(e.target.files[0]);
        }
    };

    const deleteFile = async (docId) => {
        try {
            const res = await fetch(`/api/students/${id}/documents/${docId}`, {
                method: "DELETE",
                credentials: "include",
            });
            if (res.ok) {
                qc.invalidateQueries({ queryKey: ["student", id] });
                toast({ title: "Document deleted successfully" });
            } else {
                toast({ title: "Delete failed", variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Delete failed", description: err.message, variant: "destructive" });
        }
    };

    const { data: student, isLoading, error } = useGetStudent(id, {
        query: { enabled: !!id, staleTime: 15000 },
    });
    const { data: attendanceSummary } = useGetStudentAttendanceSummary(id, {
        query: { enabled: !!id, staleTime: 30000 },
    });
    const isLibrarian = user?.role === "librarian";
    const { data: libraryIssues = [] } = useQuery({
        queryKey: ["library", "issues", "student", id],
        queryFn: () => fetch("/api/library/issues", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
        enabled: !!id && isLibrarian,
        staleTime: 15000,
    });
    const studentIssues = libraryIssues.filter((i) => i.borrowerId === id && i.borrowerType === "student");
    const { data: fees = [] } = useListFees({ studentId: id }, { query: { queryKey: getListFeesQueryKey({ studentId: id }), enabled: !!id, staleTime: 15000 } });
    const { data: results = [] } = useListExamResults({ studentId: id }, { query: { queryKey: getListExamResultsQueryKey({ studentId: id }), enabled: !!id, staleTime: 15000 } });
    const { data: hostelApps = [] } = useListHostelApplications({
        query: { queryKey: getListHostelApplicationsQueryKey(), enabled: !!id, staleTime: 30000 },
    });
    const canSeeTransport = ["admin", "clerk", "transport_manager", "teacher"].includes(user?.role ?? "");
    const { data: transportAssignments = [] } = useQuery({
        queryKey: ["transport", "assignments"],
        queryFn: () => fetch("/api/transport/assignments", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
        enabled: !!id && canSeeTransport,
        staleTime: 30000,
    });
    if (isLoading) {
        return (<div className="space-y-6 animate-in fade-in duration-300">
        <Skeleton className="h-32 w-full"/>
        <Skeleton className="h-96 w-full"/>
      </div>);
    }
    if (error || !student) {
        return (<div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-amber-400 opacity-60"/>
        <div className="text-center">
          <h2 className="text-xl font-semibold">Student not found</h2>
          <p className="text-muted-foreground text-sm mt-1">
            The student doesn't exist or you don't have access.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/students">
            <ArrowLeft className="w-4 h-4 mr-2"/>
            Back to Students
          </Link>
        </Button>
      </div>);
    }
    const s = student;
    const dailyAttendance = attendanceSummary?.dailyAttendance ?? null;
    const monthlyAttendance = attendanceSummary?.monthlyAttendance ?? null;
    const attPct = monthlyAttendance?.percentage ?? attendanceSummary?.percentage ?? null;
    const feesPaid = fees
        .filter((f) => f.status === "paid")
        .reduce((sum, f) => sum + Number(f.amount), 0);
    const feesPending = fees
        .filter((f) => f.status !== "paid")
        .reduce((sum, f) => sum + Number(f.amount), 0);
    const myHostelApp = hostelApps.find((h) => h.studentId === id);
    const myTransport = transportAssignments.find((t) => t.studentId === id);
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Back nav */}
      <Button variant="ghost" size="sm" onClick={() => setLocation("/students")} className="gap-2 -ml-2 text-muted-foreground hover:text-foreground">
        <ArrowLeft className="w-4 h-4"/>
        Back to Students
      </Button>

      {/* Header card */}
      <Card className="glass-card border-t-2 border-t-sky-400/40 overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(199 89% 48% / 0.06), transparent)" }}>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-20 w-20 ring-2 ring-sky-400/30 shrink-0">
              <AvatarImage src={s.avatarUrl} />
              <AvatarFallback className="bg-sky-500/15 text-sky-400 text-3xl font-bold">
                {s.name?.charAt(0)?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-serif font-bold truncate text-sky-400">{s.name}</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {s.className || "—"} · Roll:{" "}
                <span className="font-mono text-sky-400">{s.rollNumber}</span>
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Badge className={s.status === "active"
            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
            : "bg-muted text-muted-foreground"}>
                  {s.status}
                </Badge>
                {s.gender && <Badge variant="outline" className="text-xs">{s.gender}</Badge>}
                {s.admissionDate && (<Badge variant="outline" className="text-xs">Admitted {s.admissionDate}</Badge>)}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          {!isLibrarian && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              <div className="text-center p-3 rounded-lg bg-cyan-500/8 border border-cyan-500/20">
                <p className={`text-xl font-bold ${attPct != null && attPct < 75 ? "text-red-400" : "text-cyan-400"}`}>
                  {attPct != null ? `${attPct}%` : "—"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Attendance</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
                <p className="text-xl font-bold text-emerald-400">
                  ₹{(feesPaid / 1000).toFixed(0)}K
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Fees Paid</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/8 border border-amber-500/20">
                <p className="text-xl font-bold text-amber-400">
                  ₹{(feesPending / 1000).toFixed(0)}K
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Pending</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-pink-500/8 border border-pink-500/20">
                <p className="text-xl font-bold text-pink-400">{results.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wider">Results</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue={isLibrarian ? "library" : "profile"}>
        <TabsList className="flex-wrap h-auto">
          {isLibrarian ? (
            <TabsTrigger value="library">Library Logs</TabsTrigger>
          ) : (
            <>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="fees">Fees</TabsTrigger>
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="hostel">Hostel</TabsTrigger>
              <TabsTrigger value="transport">Transport</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="parent">Parent</TabsTrigger>
              <TabsTrigger value="idcard">ID Card</TabsTrigger>
              {["admin", "clerk"].includes(user?.role ?? "") && (
                <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
              )}
            </>
          )}
        </TabsList>

        {/* ── Profile ── */}
        <TabsContent value="profile" className="mt-4">
          <Card className="glass-card border-t-2 border-t-sky-400/30">
            <CardContent className="p-6 space-y-5">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Personal
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Date of Birth" value={s.dateOfBirth || "—"}/>
                  <Field label="Gender" value={s.gender || "—"}/>
                  {s.phone && (<Field label="Phone" value={<span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-muted-foreground"/>
                          {s.phone}
                        </span>}/>)}
                  {s.email && (<Field label="Email" value={<span className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 text-muted-foreground shrink-0"/>
                          <span className="truncate">{s.email}</span>
                        </span>}/>)}
                  {s.address && (<div className="col-span-2 space-y-0.5">
                      <span className="text-xs text-muted-foreground">Address</span>
                      <p className="font-medium flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0"/>
                        {s.address}
                      </p>
                    </div>)}
                </div>
              </div>
              <div className="border-t border-border/50 pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Academic
                </p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="Class" value={s.className || "—"}/>
                  <Field label="Roll Number" value={<span className="font-mono text-sky-400">{s.rollNumber}</span>}/>
                  <Field label="Admission Date" value={s.admissionDate || "—"}/>
                  <Field label="Status" value={s.status}/>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Attendance ── */}
        <TabsContent value="attendance" className="mt-4">
          <Card className="glass-card border-t-2 border-t-cyan-400/30">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Card className="border border-cyan-500/20 bg-cyan-500/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">Today</p>
                        <p className="text-sm font-semibold">{dailyAttendance?.date ?? "—"}</p>
                      </div>
                      <p className={`text-2xl font-bold ${dailyAttendance?.percentage != null && dailyAttendance.percentage < 75 ? "text-red-400" : "text-cyan-400"}`}>
                        {dailyAttendance?.percentage != null ? `${dailyAttendance.percentage}%` : "—"}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Stat label="Periods" value={dailyAttendance?.totalPeriods ?? "—"} color="text-cyan-400"/>
                      <Stat label="Attended" value={dailyAttendance?.attendedPeriods ?? "—"} color="text-emerald-400"/>
                      <Stat label="Missed" value={dailyAttendance?.missedPeriods ?? "—"} color="text-red-400"/>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border border-emerald-500/20 bg-emerald-500/5">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground">This Month</p>
                        <p className="text-sm font-semibold">{monthlyAttendance?.month ?? "—"}</p>
                      </div>
                      <p className={`text-2xl font-bold ${attPct != null && attPct < 75 ? "text-red-400" : "text-emerald-400"}`}>
                        {attPct != null ? `${attPct}%` : "—"}
                      </p>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <Stat label="Periods" value={monthlyAttendance?.totalPeriods ?? "—"} color="text-cyan-400"/>
                      <Stat label="Attended" value={monthlyAttendance?.attendedPeriods ?? "—"} color="text-emerald-400"/>
                      <Stat label="Missed" value={monthlyAttendance?.missedPeriods ?? "—"} color="text-red-400"/>
                    </div>
                  </CardContent>
                </Card>
              </div>
              {attPct != null && (<div className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Attendance Rate</span>
                    <span className={`font-bold ${attPct < 75
                ? "text-red-400"
                : attPct < 85
                    ? "text-amber-400"
                    : "text-emerald-400"}`}>
                      {attPct}%
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${attPct < 75 ? "bg-red-400" : attPct < 85 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${attPct}%` }}/>
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span className="text-amber-400">75% min</span>
                    <span>100%</span>
                  </div>
                </div>)}
              {attPct != null && attPct < 75 && (<div className="rounded-lg bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0"/>
                  Below 75% — student may not be eligible for examinations.
                </div>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fees ── */}
        <TabsContent value="fees" className="mt-4">
          <Card className="glass-card border-t-2 border-t-emerald-400/30">
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Stat label="Paid" value={`₹${feesPaid.toLocaleString("en-IN")}`} color="text-emerald-400"/>
                <Stat label="Pending" value={`₹${feesPending.toLocaleString("en-IN")}`} color="text-amber-400"/>
                <Stat label="Records" value={fees.length} color="text-foreground"/>
              </div>
              {fees.length === 0 ? (<Empty icon={<Wallet className="w-8 h-8 opacity-30"/>} text="No fee records found."/>) : (<div className="space-y-2">
                  {fees.map((fee) => (<div key={fee.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50 text-sm hover:bg-muted/20 transition-colors">
                      <div>
                        <p className="font-medium capitalize">{fee.feeType?.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground">
                          {fee.academicYear} · Due: {fee.dueDate || "—"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">₹{Number(fee.amount).toLocaleString("en-IN")}</p>
                        <Badge className={`text-[10px] border ${fee.status === "paid"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                          {fee.status}
                        </Badge>
                      </div>
                    </div>))}
                </div>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Results ── */}
        <TabsContent value="results" className="mt-4">
          <Card className="glass-card border-t-2 border-t-pink-400/30">
            <CardContent className="p-6 space-y-4">
              {results.length === 0 ? (<Empty icon={<Award className="w-8 h-8 opacity-30"/>} text="No results recorded yet."/>) : (<>
                  <div className="glass-card p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">Overall Average</p>
                        <p className="text-2xl font-bold text-emerald-400">
                          {Math.round(results.reduce((sum, r) => sum + (Number(r.marksObtained) / Number(r.maxMarks)) * 100, 0) / results.length)}
                          %
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400">
                        <Award className="w-6 h-6"/>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {results.map((r) => {
                const pct = Math.round((Number(r.marksObtained) / Number(r.maxMarks)) * 100);
                return (<div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card/50 text-sm hover:bg-muted/20 transition-colors">
                          <div>
                            <p className="font-medium">{r.subjectName || `Subject #${r.subjectId}`}</p>
                            <p className="text-xs text-muted-foreground">
                              {r.examName || `Exam #${r.examId}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="font-semibold">
                                {r.marksObtained}/{r.maxMarks}
                              </p>
                              <p className="text-xs text-muted-foreground">{pct}%</p>
                            </div>
                            {r.grade && (<Badge className={`text-xs border w-8 justify-center ${GRADE_COLORS[r.grade] ?? "bg-muted text-muted-foreground"}`}>
                                {r.grade}
                              </Badge>)}
                          </div>
                        </div>);
            })}
                  </div>
                </>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Hostel ── */}
        <TabsContent value="hostel" className="mt-4">
          <Card className="glass-card border-t-2 border-t-teal-400/30">
            <CardContent className="p-6">
              {myHostelApp ? (<div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-xl bg-teal-500/10 text-teal-400">
                      <Bed className="w-5 h-5"/>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-base">
                        {myHostelApp.roomNumber
                ? `Room ${myHostelApp.roomNumber}`
                : "Hostel Application"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {myHostelApp.roomType || "—"} · Status:{" "}
                        <Badge variant="outline" className="ml-1">
                          {myHostelApp.status}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm border-t border-border/50 pt-4">
                    <Field label="Applied On" value={myHostelApp.appliedAt || "—"}/>
                    <Field label="Preferred Type" value={myHostelApp.preferredType || "—"}/>
                    {myHostelApp.notes && (<div className="col-span-2 space-y-0.5">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <p className="text-sm">{myHostelApp.notes}</p>
                      </div>)}
                  </div>
                </div>) : (<Empty icon={<Bed className="w-8 h-8 opacity-30"/>} text="No hostel allocation."/>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Transport ── */}
        <TabsContent value="transport" className="mt-4">
          <Card className="glass-card border-t-2 border-t-amber-400/30">
            <CardContent className="p-6">
              {!canSeeTransport ? (<Empty icon={<Bus className="w-8 h-8 opacity-30"/>} text="Transport details not available for your role."/>) : myTransport ? (<div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="p-3 rounded-xl bg-amber-500/10 text-amber-400">
                      <Bus className="w-5 h-5"/>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-base">
                        {myTransport.routeName || `Route #${myTransport.routeId}`}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {myTransport.stopName ? `Stop: ${myTransport.stopName}` : "—"}
                      </p>
                    </div>
                    {myTransport.status && (<Badge variant="outline" className="self-start">{myTransport.status}</Badge>)}
                  </div>
                </div>) : (<Empty icon={<Bus className="w-8 h-8 opacity-30"/>} text="No transport assigned."/>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Documents ── */}
        <TabsContent value="documents" className="mt-4">
          <Card className="glass-card border-t-2 border-t-blue-400/30">
            <CardContent className="p-6 space-y-4">
              <div>
                <h3 className="font-serif text-lg font-semibold text-white/90">Student Document Vault</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage and store student onboarding documents, transcripts, and records.</p>
              </div>

              {/* Upload Section */}
              {["admin", "clerk"].includes(user?.role ?? "") && (
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-all relative",
                    dragActive ? "border-primary bg-primary/10" : "border-border hover:border-primary/45 bg-card/30"
                  )}
                >
                  <input
                    type="file"
                    id="student-doc-input"
                    multiple={false}
                    onChange={handleFileChange}
                    className="hidden"
                    disabled={isUploading}
                  />
                  <label htmlFor="student-doc-input" className="cursor-pointer flex flex-col items-center gap-2">
                    {isUploading ? (
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    ) : (
                      <UploadCloud className="w-8 h-8 text-primary/60" />
                    )}
                    <div>
                      <p className="text-sm font-semibold">
                        {isUploading ? "Uploading file..." : "Drag and drop document here"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        or click to browse from computer (PDF, PNG, JPG, DOC up to 10MB)
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {/* Document List */}
              {!student.documents || student.documents.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground flex flex-col items-center gap-2">
                  <FileText className="w-8 h-8 opacity-25" />
                  <p className="text-xs">No onboarding documents uploaded yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  {student.documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/40 hover:bg-muted/10 transition-all">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-white/90">{doc.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatBytes(doc.size)} · {new Date(doc.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-3">
                        <Button asChild variant="ghost" size="icon" className="h-8 w-8 hover:bg-primary/10 hover:text-primary">
                          <a href={`/api/students/${id}/documents/${doc.id}/download`} download target="_blank" rel="noreferrer">
                            <Download className="w-4 h-4" />
                          </a>
                        </Button>
                        {["admin", "clerk"].includes(user?.role ?? "") && (
                          <Button variant="ghost" size="icon" onClick={() => deleteFile(doc.id)} className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Parent ── */}
        <TabsContent value="parent" className="mt-4">
          <Card className="glass-card border-t-2 border-t-violet-400/30">
            <CardContent className="p-6">
              {s.parentName || s.parentPhone ? (<div className="flex items-start gap-4">
                  <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400">
                    <UsersIcon className="w-5 h-5"/>
                  </div>
                  <div className="flex-1 grid grid-cols-2 gap-4 text-sm">
                    <Field label="Name" value={s.parentName || "—"}/>
                    <Field label="Phone" value={s.parentPhone ? (<span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-muted-foreground"/>
                            {s.parentPhone}
                          </span>) : ("—")}/>
                    {s.address && (<div className="col-span-2 space-y-0.5">
                        <span className="text-xs text-muted-foreground">Address</span>
                        <p className="font-medium flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 shrink-0"/>
                          {s.address}
                        </p>
                      </div>)}
                  </div>
                </div>) : (<Empty icon={<UsersIcon className="w-8 h-8 opacity-30"/>} text="No parent contact on file."/>)}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Library Logs ── */}
        <TabsContent value="library" className="mt-4">
          <Card className="glass-card border-t-2 border-t-amber-500/30">
            <CardContent className="p-6">
              <h3 className="font-semibold text-sm mb-4">Book Issuance History</h3>
              {studentIssues.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground text-sm">
                  No library issuances found for this student.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground">
                        <th className="pb-2">Book Title</th>
                        <th className="pb-2">Book ID</th>
                        <th className="pb-2">Issue Date</th>
                        <th className="pb-2">Due Date</th>
                        <th className="pb-2">Return Date</th>
                        <th className="pb-2">Status</th>
                        <th className="pb-2 text-right">Fine</th>
                      </tr>
                    </thead>
                    <tbody>
                      {studentIssues.map((issue) => (
                        <tr key={issue.id} className="border-b border-border/20 hover:bg-muted/10">
                          <td className="py-2.5 font-medium">{issue.bookTitle}</td>
                          <td className="py-2.5 font-mono text-xs text-muted-foreground">#{issue.bookId}</td>
                          <td className="py-2.5 text-muted-foreground">{issue.issueDate}</td>
                          <td className="py-2.5 text-muted-foreground">{issue.dueDate}</td>
                          <td className="py-2.5">
                            {issue.returnDate ? (
                              <span className="text-emerald-400">{issue.returnDate}</span>
                            ) : (
                              <span className="text-amber-400 font-medium">Not Returned</span>
                            )}
                          </td>
                          <td className="py-2.5">
                            <Badge className={issue.status === "issued" ? "bg-amber-500/10 text-amber-400 border-0" : "bg-emerald-500/10 text-emerald-400 border-0"}>
                              {issue.status}
                            </Badge>
                          </td>
                          <td className="py-2.5 text-right font-medium text-red-400">
                            {issue.fine > 0 ? `₹${issue.fine}` : "₹0"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── ID Card ── */}
        <TabsContent value="idcard" className="mt-4">
          <Card className="glass-card border-t-2 border-t-sky-400/30">
            <CardContent className="p-6">
              <IdCard type="student" name={s.name} idNumber={s.rollNumber ?? `STUDENT-${s.id}`} subtitle={`${s.className || "Class Information"}`} meta={[
                ...(s.gender ? [{ label: "Gender", value: s.gender }] : []),
                ...(s.admissionDate ? [{ label: "Admission Date", value: s.admissionDate }] : []),
              ]} photoUrl={s.avatarUrl ?? undefined}/>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Lifecycle & Promotions ── */}
        <TabsContent value="lifecycle" className="mt-4">
          <Card className="glass-card border-t-2 border-t-purple-400/30">
            <CardContent className="p-6 space-y-6">
              <div>
                <h3 className="font-serif text-lg font-semibold text-white/90">Student Lifecycle & Actions</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Manage promotions, transfers, and official exit procedures.</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Promotion Section */}
                <div className="space-y-4 p-4 rounded-xl border border-purple-500/20 bg-purple-500/5">
                  <h4 className="font-semibold text-purple-400 text-sm flex items-center gap-1.5">
                    <UsersIcon className="w-4 h-4"/> Promote Student
                  </h4>
                  <p className="text-xs text-muted-foreground">Advance this student to the next class grade for the upcoming academic year.</p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Target Class ID</label>
                      <input 
                        type="number" 
                        placeholder="e.g. 2" 
                        id="targetClassInput"
                        className="w-full mt-1 bg-background/50 border border-border/80 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-muted-foreground">Academic Year</label>
                      <input 
                        type="text" 
                        placeholder="e.g. 2026-2027" 
                        id="academicYearInput"
                        className="w-full mt-1 bg-background/50 border border-border/80 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                      />
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white"
                      onClick={async () => {
                        const classId = document.getElementById("targetClassInput")?.value;
                        const acYear = document.getElementById("academicYearInput")?.value;
                        if(!classId || !acYear) {
                          toast({ title: "Validation Error", description: "Please enter class ID and academic year.", variant: "destructive" });
                          return;
                        }
                        try {
                          const res = await fetch(`/api/students/${id}/promote`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ toClassId: parseInt(classId), academicYear: acYear }),
                          });
                          if(res.ok) {
                            toast({ title: "Promotion Successful", description: "Student promoted successfully!" });
                            qc.invalidateQueries({ queryKey: ["student", id] });
                          } else {
                            toast({ title: "Promotion Failed", variant: "destructive" });
                          }
                        } catch(e) {
                          toast({ title: "Promotion Failed", description: e.message, variant: "destructive" });
                        }
                      }}
                    >
                      Process Promotion
                    </Button>
                  </div>
                </div>

                {/* Transfer Certificate (TC) Section */}
                <div className="space-y-4 p-4 rounded-xl border border-red-500/20 bg-red-500/5">
                  <h4 className="font-semibold text-red-400 text-sm flex items-center gap-1.5">
                    <FileText className="w-4 h-4"/> Transfer Certificate & Exit
                  </h4>
                  <p className="text-xs text-muted-foreground">Officially issue a Transfer Certificate (TC), change status to Transferred, and log exit clearance.</p>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="text-[11px] text-muted-foreground">Reason for Exit / Remarks</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Completed school education / Relocation" 
                        id="exitReasonInput"
                        className="w-full mt-1 bg-background/50 border border-border/80 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-red-400"
                      />
                    </div>
                    <Button 
                      size="sm" 
                      className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
                      onClick={async () => {
                        const reason = document.getElementById("exitReasonInput")?.value;
                        try {
                          const res = await fetch(`/api/students/${id}/tc`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ reason }),
                          });
                          if(res.ok) {
                            toast({ title: "TC Issued", description: "Student exit processed and certificate logged." });
                            qc.invalidateQueries({ queryKey: ["student", id] });
                          } else {
                            toast({ title: "TC Issue Failed", variant: "destructive" });
                          }
                        } catch(e) {
                          toast({ title: "TC Issue Failed", description: e.message, variant: "destructive" });
                        }
                      }}
                    >
                      Issue TC & Close File
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>);
}
function Field({ label, value }) {
    return (<div className="space-y-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="font-medium">{value}</p>
    </div>);
}
function Stat({ label, value, color }) {
    return (<div className="glass-card p-3 rounded-lg text-center">
      <p className={`text-lg font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>);
}
function Empty({ icon, text }) {
    return (<div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
      {icon}
      <p className="text-sm">{text}</p>
    </div>);
}
function formatBytes(bytes) {
    if (!bytes)
        return "0 Bytes";
    const k = 1024;
    const dm = 1;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
