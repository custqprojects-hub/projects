import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Clock, CheckCircle, XCircle, Calendar } from "lucide-react";

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
    if (res.status === 204) return null;
    return res.json();
}

const leaveTypes = ["Casual", "Sick", "Earned", "Emergency", "Study", "Maternity/Paternity"];

const statusConfig = {
    pending: { label: "Pending", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
    approved: { label: "Approved", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
    rejected: { label: "Rejected", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
    recommended: { label: "Recommended", color: "bg-sky-500/10 text-sky-400 border-sky-500/20", icon: Clock },
    forwarded: { label: "Forwarded", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", icon: Clock },
};

export default function Leaves() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState("");
    const today = new Date().toISOString().split("T")[0];
    const [form, setForm] = useState({ leaveType: "Casual", startDate: today, endDate: today, reason: "" });

    const { data: leaves = [], isLoading } = useQuery({
        queryKey: ["leaves", filterStatus],
        queryFn: () => {
            const params = new URLSearchParams();
            if (filterStatus) params.set("status", filterStatus);
            return apiFetch(`/api/leaves?${params}`);
        },
        staleTime: 10000,
    });

    const createMutation = useMutation({
        mutationFn: (data) => apiFetch("/api/leaves", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(data) 
        }),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ["leaves"] }); 
            setOpen(false); 
            setForm({ leaveType: "Casual", startDate: today, endDate: today, reason: "" }); 
        },
        onError: (err) => alert(err?.message || "Failed to submit leave application"),
    });

    // Fixed: Proper error handling and better logging
    const updateMutation = useMutation({
        mutationFn: async ({ id, data }) => {
            try {
                console.log("Updating leave:", id, data);
                const response = await apiFetch(`/api/leaves/${id}`, { 
                    method: "PATCH", 
                    headers: { "Content-Type": "application/json" }, 
                    body: JSON.stringify(data) 
                });
                console.log("Update response:", response);
                return response;
            } catch (error) {
                console.error("Update error:", error);
                throw error;
            }
        },
        onSuccess: (data, variables) => {
            console.log("Update successful for leave:", variables.id);
            qc.invalidateQueries({ queryKey: ["leaves"] });
            // Optional: Show success message
            // toast.success(`Leave ${variables.data.status}`);
        },
        onError: (error, variables) => {
            console.error("Update failed for leave:", variables.id, error);
            alert(error?.message || "Failed to update leave status");
        },
    });

    const canApprove = user?.role === "admin";
    const canApply = user?.role !== "admin" && user?.role !== "parent";
    const isTeacher = user?.role === "teacher";
    const role = user?.role ?? "";

    const scope = role === "admin" ? "staff leave requests only"
        : role === "teacher" ? "leaves associated with your classes/self"
        : role === "parent" ? "your children's leaves"
        : role === "student" ? "your own leaves"
        : "your own leaves";

    const total = leaves.length;
    const pending = leaves.filter((l) => l.status === "pending").length;
    const approved = leaves.filter((l) => l.status === "approved").length;
    const rejected = leaves.filter((l) => l.status === "rejected").length;

    const statsList = [
        { label: "Total", value: total, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-t-orange-500/40", icon: Calendar },
        { label: "Pending", value: pending, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-500/40", icon: Clock },
        { label: "Approved", value: approved, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: CheckCircle },
        { label: "Rejected", value: rejected, color: "text-red-400", bg: "bg-red-500/10", border: "border-t-red-500/40", icon: XCircle },
    ];

    // Fixed: Action handlers with proper error handling and loading states
    const handleStatusUpdate = (leaveId, newStatus) => {
        if (!window.confirm(`Are you sure you want to ${newStatus} this leave request?`)) {
            return;
        }
        updateMutation.mutate({ 
            id: leaveId, 
            data: { status: newStatus } 
        });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-orange-400">Leave Management</h1>
                    <p className="text-muted-foreground text-sm mt-1">Showing {scope}</p>
                </div>
                {canApply && (
                    <Dialog open={open} onOpenChange={setOpen}>
                        <DialogTrigger asChild>
                            <Button className="gap-2"><Plus className="w-4 h-4"/>Apply for Leave</Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                            <DialogHeader><DialogTitle>Leave Application — {user?.name}</DialogTitle></DialogHeader>
                            <div className="space-y-4 py-2">
                                <p className="text-xs text-muted-foreground">
                                    Applying as: <span className="font-medium text-foreground">{user?.name}</span> ({user?.role})
                                </p>
                                <div>
                                    <Label>Leave Type</Label>
                                    <Select value={form.leaveType} onValueChange={v => setForm(f => ({ ...f, leaveType: v }))}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>{leaveTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label>Reason</Label>
                                    <textarea 
                                        value={form.reason} 
                                        onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} 
                                        rows={3} 
                                        className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background resize-none" 
                                        placeholder="Reason for leave..."
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label>From</Label>
                                        <input 
                                            type="date" 
                                            min={today} 
                                            value={form.startDate} 
                                            onChange={e => setForm(f => ({ 
                                                ...f, 
                                                startDate: e.target.value, 
                                                endDate: f.endDate < e.target.value ? e.target.value : f.endDate 
                                            }))} 
                                            className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                        />
                                    </div>
                                    <div>
                                        <Label>To</Label>
                                        <input 
                                            type="date" 
                                            min={form.startDate || today} 
                                            value={form.endDate} 
                                            onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} 
                                            className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                        />
                                    </div>
                                </div>
                                <Button 
                                    className="w-full" 
                                    disabled={!form.reason || form.startDate < today || form.endDate < form.startDate || createMutation.isPending} 
                                    onClick={() => createMutation.mutate(form)}
                                >
                                    {createMutation.isPending ? "Submitting..." : "Submit Application"}
                                </Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {statsList.map(s => (
                    <Card key={s.label} className={`glass-card glass-hover border-t-2 ${s.border}`}>
                        <CardContent className="p-4 flex items-center gap-3">
                            <div className={`${s.bg} p-2 rounded-lg ${s.color}`}><s.icon className="w-4 h-4"/></div>
                            <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="flex flex-wrap gap-3">
                <Select value={filterStatus || "all"} onValueChange={v => setFilterStatus(v === "all" ? "" : v)}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="All statuses"/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="rejected">Rejected</SelectItem>
                        <SelectItem value="recommended">Recommended</SelectItem>
                        <SelectItem value="forwarded">Forwarded</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <Card className="glass-card border-t-2 border-t-orange-500/30">
                <CardHeader><CardTitle className="text-base font-serif">Leave Requests · {total}</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full"/>)}</div>
                    ) : total === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">No leave requests found.</div>
                    ) : (
                        <div className="space-y-3">
                            {leaves.map((leave) => {
                                const cfg = statusConfig[leave.status] ?? statusConfig.pending;
                                const Icon = cfg.icon;
                                const days = Math.ceil((new Date(leave.endDate).getTime() - new Date(leave.startDate).getTime()) / 86400000) + 1;
                                const isAdminActionable = canApprove && leave.applicantType === "staff" && leave.status === "pending";
                                const isTeacherActionable = isTeacher && leave.applicantType === "student" && leave.status === "pending";
                                const isLoading = updateMutation.isPending && updateMutation.variables?.id === leave.id;

                                return (
                                    <div key={leave.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors gap-3">
                                        <div className="flex items-start gap-3">
                                            <div className={`p-1.5 rounded-full ${cfg.color} shrink-0 mt-0.5`}>
                                                <Icon className="w-3.5 h-3.5"/>
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <p className="font-semibold text-sm">{leave.applicantName}</p>
                                                    <Badge className="text-xs capitalize bg-muted/50 text-muted-foreground">{leave.applicantType}</Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">{leave.leaveType} · {days} day{days !== 1 ? "s" : ""}</p>
                                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                                                    <Calendar className="w-3 h-3"/>{leave.startDate} → {leave.endDate}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{leave.reason}</p>
                                                {leave.remarks && (
                                                    <p className="text-xs text-amber-300 mt-1 italic font-medium">Remarks: {leave.remarks}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Badge className={`border ${cfg.color}`}>{cfg.label}</Badge>
                                            {isAdminActionable && (
                                                <>
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                                        onClick={() => handleStatusUpdate(leave.id, "approved")}
                                                        disabled={isLoading}
                                                    >
                                                        {isLoading ? "..." : "Approve"}
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                                                        onClick={() => handleStatusUpdate(leave.id, "rejected")}
                                                        disabled={isLoading}
                                                    >
                                                        {isLoading ? "..." : "Reject"}
                                                    </Button>
                                                </>
                                            )}
                                            {isTeacherActionable && (
                                                <>
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                                        onClick={() => handleStatusUpdate(leave.id, "approved")}
                                                        disabled={isLoading}
                                                    >
                                                        {isLoading ? "..." : "Approve"}
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="outline" 
                                                        className="text-red-400 border-red-500/30 hover:bg-red-500/10"
                                                        onClick={() => handleStatusUpdate(leave.id, "rejected")}
                                                        disabled={isLoading}
                                                    >
                                                        {isLoading ? "..." : "Reject"}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}  