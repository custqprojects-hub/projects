import { useEffect, useState } from "react";
import { useCreateComplaint, useListComplaints, useUpdateComplaint, getListComplaintsQueryKey } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Clock, CheckCircle2, AlertTriangle, Search, Trash2, PlusCircle } from "lucide-react";

const statusColors = {
    open: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    in_progress: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    resolved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    closed: "bg-muted/50 text-muted-foreground border-border",
};

const priorityColors = {
    low: "bg-muted/50 text-muted-foreground",
    medium: "bg-blue-500/10 text-blue-400",
    high: "bg-amber-500/10 text-amber-400",
    urgent: "bg-red-500/10 text-red-400",
};

const categoryOptions = [
    { value: "academic", label: "Academic" },
    { value: "facility", label: "Facility" },
    { value: "transport", label: "Transport" },
    { value: "hostel", label: "Hostel" },
    { value: "staff", label: "Staff" },
    { value: "fees", label: "Fees" },
    { value: "other", label: "Other" },
];

const initialForm = {
    title: "",
    description: "",
    category: "academic",
    priority: "medium",
};

export default function Complaints() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [filter, setFilter] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [resolutionMap, setResolutionMap] = useState({});
    const [raiseOpen, setRaiseOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const params = {};
    if (filter)
        params.status = filter;

    const { data: complaints = [], isLoading } = useListComplaints(params, { query: { queryKey: getListComplaintsQueryKey(params), staleTime: 5000 } });
    const invalidateComplaints = () => qc.invalidateQueries({ queryKey: getListComplaintsQueryKey() });
    const createMutation = useCreateComplaint({
        mutation: {
            onSuccess: () => {
                invalidateComplaints();
                setForm(initialForm);
                setRaiseOpen(false);
                toast({ title: "Complaint raised", description: "You can track the status here." });
            },
            onError: (err) => toast({ title: "Failed to raise complaint", description: err?.message, variant: "destructive" }),
        },
    });
    const updateMutation = useUpdateComplaint({
        mutation: {
            onSuccess: () => {
                invalidateComplaints();
                toast({ title: "Complaint status updated" });
            },
            onError: (err) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
        },
    });
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
            const res = await fetch(`/api/complaints/${id}`, { method: "DELETE" });
            if (!res.ok)
                throw new Error((await res.json())?.error ?? "Delete failed");
            return res.json();
        },
        onSuccess: () => {
            invalidateComplaints();
            toast({ title: "Complaint deleted" });
        },
        onError: (err) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
    });

    const role = user?.role;
    const canRaise = !!user && role !== "admin";
    const canManage = role === "admin" || role === "clerk" || role === "hostel_warden";
    const listTitle = role === "hostel_warden" ? "Hostel Complaints" : canManage ? "All Complaints" : "My Complaints";
    const searchedComplaints = complaints.filter(c => {
        const term = search.trim().toLowerCase();
        if (!term)
            return true;
        return c.title.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term);
    });
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(searchedComplaints.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pagedComplaints = searchedComplaints.slice((safePage - 1) * pageSize, safePage * pageSize);
    useEffect(() => {
        if (page > totalPages)
            setPage(totalPages);
    }, [page, totalPages]);
    useEffect(() => {
        setPage(1);
    }, [filter, search]);
    const openCount = complaints.filter(c => c.status === "open").length;
    const resolvedCount = complaints.filter(c => c.status === "resolved").length;

    const submitComplaint = (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.description.trim()) {
            toast({ title: "Missing details", description: "Title and description are required.", variant: "destructive" });
            return;
        }
        createMutation.mutate({
            data: {
                title: form.title.trim(),
                description: form.description.trim(),
                category: form.category,
                priority: form.priority,
            },
        });
    };

    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-red-400">Complaints</h1>
          <p className="text-muted-foreground text-sm mt-1">{canManage ? "Review and track grievances" : "Raise and track your grievances"}</p>
        </div>
        {canRaise && (<Dialog open={raiseOpen} onOpenChange={setRaiseOpen}>
          <DialogTrigger asChild>
            {/* <Button className="bg-red-500 text-white hover:bg-red-600">
              <PlusCircle className="w-4 h-4 mr-2"/>Raise Complaint
            </Button> */}
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="font-serif text-red-400">Raise Complaint</DialogTitle>
            </DialogHeader>
            <form className="space-y-4" onSubmit={submitComplaint}>
              <div className="space-y-2">
                <Label htmlFor="complaint-title">Title</Label>
                <Input id="complaint-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Short complaint title"/>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Category</Label>
                  <Select value={form.category} onValueChange={value => setForm(f => ({ ...f, category: value }))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      {categoryOptions.map(option => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={value => setForm(f => ({ ...f, priority: value }))}>
                    <SelectTrigger><SelectValue/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="complaint-description">Description</Label>
                <Textarea id="complaint-description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the issue clearly" rows={4}/>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setRaiseOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={createMutation.isPending} className="bg-red-500 text-white hover:bg-red-600">
                  {createMutation.isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>)}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
            { label: "Total", value: complaints.length, color: "text-red-400", bg: "bg-red-500/10", border: "border-t-red-500/40", icon: MessageSquare },
            { label: "Open", value: openCount, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-t-blue-500/40", icon: AlertTriangle },
            { label: "In Progress", value: complaints.filter(c => c.status === "in_progress").length, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-500/40", icon: Clock },
            { label: "Resolved", value: resolvedCount, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: CheckCircle2 },
        ].map(s => (<Card key={s.label} className={`glass-card glass-hover border-t-2 ${s.border}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${s.bg} p-2 rounded-lg ${s.color}`}><s.icon className="w-4 h-4"/></div>
              <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
            </CardContent>
          </Card>))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
          <Input placeholder="Search complaints..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)}/>
        </div>
        <Select value={filter || "all"} onValueChange={v => setFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All statuses"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="glass-card border-t-2 border-t-red-500/30">
        <CardHeader><CardTitle className="text-base font-serif">{listTitle} - {searchedComplaints.length}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (<div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full"/>)}</div>) : searchedComplaints.length === 0 ? (<div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
              <MessageSquare className="w-8 h-8 opacity-30"/>
              <p>No complaints found.</p>
            </div>) : (<div className="space-y-3">
              {pagedComplaints.map(c => (<div key={c.id} className="p-4 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors glass-hover">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-1.5 rounded-lg mt-0.5 shrink-0 ${priorityColors[c.priority ?? "medium"]}`}><MessageSquare className="w-4 h-4"/></div>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{c.title}</p>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{c.description}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge className={`text-xs border ${statusColors[c.status ?? "open"]}`}>{c.status?.replace("_", " ")}</Badge>
                          <Badge className={`text-xs border ${priorityColors[c.priority ?? "medium"]}`} variant="outline">{c.priority}</Badge>
                          <span className="text-xs text-muted-foreground capitalize bg-muted/30 px-2 py-0.5 rounded">{c.category}</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5">{c.submittedBy} - {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</p>
                        {c.resolution && <p className="text-xs text-emerald-400 mt-1.5">Resolution: {c.resolution}</p>}
                        {canManage && (role !== "hostel_warden" || c.category === "hostel") && c.status === "in_progress" && (<div className="mt-3">
                            <Input placeholder="Resolution notes (optional)..." className="text-xs h-8" value={resolutionMap[c.id] ?? ""} onChange={e => setResolutionMap(m => ({ ...m, [c.id]: e.target.value }))}/>
                          </div>)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {canManage && (role !== "hostel_warden" || c.category === "hostel") && c.status !== "resolved" && c.status !== "closed" && (<>
                        {c.status === "open" && (<Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10" onClick={() => updateMutation.mutate({ id: c.id, data: { status: "in_progress" } })}>
                            Start Review
                          </Button>)}
                        {c.status === "in_progress" && (<Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => updateMutation.mutate({ id: c.id, data: { status: "resolved", resolution: resolutionMap[c.id] || "Issue resolved." } })}>
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1"/>Resolve
                          </Button>)}
                      </>)}
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 shrink-0" onClick={() => { if (window.confirm("Delete this complaint?")) deleteMutation.mutate(c.id); }}>
                        <Trash2 className="w-4 h-4"/>
                      </Button>
                    </div>
                  </div>
                </div>))}
            {searchedComplaints.length > pageSize && (<div className="flex items-center justify-between gap-3 pt-4">
                <p className="text-xs text-muted-foreground">
                  Showing {(safePage - 1) * pageSize + 1}-{Math.min(safePage * pageSize, searchedComplaints.length)} of {searchedComplaints.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                </div>
              </div>)}
          </div>)}
        </CardContent>
      </Card>
    </div>);
}