import { useEffect, useMemo, useState } from "react";
import { useListAnnouncements, useDeleteAnnouncement, getListAnnouncementsQueryKey } from "@/api-client";
import { customFetch } from "@/api-client/custom-fetch";
import { useAuth } from "@/lib/auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Bell, AlertTriangle, Info, Search, Paperclip, CalendarClock, Clock3, X, Eye, Download } from "lucide-react";
import { Link } from "wouter";

function AnnouncementContent({ text }) {
    const parts = text.split(/(\/[\w/-]+(?:\?[\w=&%-]+)?)/g);
    return (<>
      {parts.map((part, i) => /^\/[\w/-]+/.test(part) ? (<Link key={i} href={part} className="text-blue-400 underline-offset-2 hover:underline">
            {part}
          </Link>) : (<span key={i}>{part}</span>))}
    </>);
}

const audienceOptions = [
    { value: "all", label: "Everyone" },
    { value: "teachers", label: "Teachers", adminOnly: true },
    { value: "students", label: "Students" },
    { value: "staff", label: "Staff" },
    { value: "parents", label: "Parents" },
    { value: "hostel", label: "Hostel" },
    { value: "transport", label: "Transport" },
    { value: "store", label: "Store" },
    { value: "vendors", label: "Vendors" },
    { value: "accounts", label: "Accounts" },
    { value: "library", label: "Library" },
];

const priorityOptions = [
    { value: "urgent", label: "Urgent" },
    { value: "high", label: "High" },
    { value: "normal", label: "Normal" },
    { value: "low", label: "Low" },
];

const stateOptions = [
    { value: "active", label: "Active" },
    { value: "scheduled", label: "Scheduled" },
    { value: "expired", label: "Expired" },
];

const priorityConfig = {
    urgent: { color: "bg-red-500/10 text-red-400 border-red-500/20", icon: AlertTriangle },
    high: { color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Bell },
    normal: { color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Info },
    low: { color: "bg-muted/50 text-muted-foreground border-border", icon: Info },
};

const stateConfig = {
    active: { label: "Active", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: Bell },
    scheduled: { label: "Scheduled", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", icon: CalendarClock },
    expired: { label: "Expired", color: "bg-muted/50 text-muted-foreground border-border", icon: Clock3 },
};

const defaultForm = {
    title: "",
    content: "",
    audience: "all",
    priority: "normal",
    publishAt: "",
    expiresAt: "",
    attachmentUrl: "",
    attachmentName: "",
    attachmentFile: null,
};

const PAGE_SIZE = 5;

function formatDateTime(value) {
    if (!value)
        return "";
    return new Date(value).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });
}

function toDateTimeInputValue(date) {
    const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return offsetDate.toISOString().slice(0, 16);
}

function addMinutes(value, minutes) {
    return toDateTimeInputValue(new Date(new Date(value).getTime() + minutes * 60000));
}

function normalizeDateTimeInputYear(value) {
    return value.replace(/^(\d{4})\d+(-.*)?$/, (_match, year, rest = "") => `${year}${rest}`);
}

export default function Announcements() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [filterAudience, setFilterAudience] = useState("all");
    const [filterPriority, setFilterPriority] = useState("all");
    const [filterState, setFilterState] = useState("all");
    const [page, setPage] = useState(1);
    const [form, setForm] = useState(defaultForm);
    const [formError, setFormError] = useState("");
    const canFilterAudience = user?.role === "admin" || user?.role === "teacher";
    const availableAudienceOptions = audienceOptions.filter((option) => !option.adminOnly || user?.role === "admin");
    const filterAudienceOptions = availableAudienceOptions.filter((option) => option.value !== "all");
    const minDateTime = toDateTimeInputValue(new Date());
    const minExpiryDateTime = form.publishAt ? addMinutes(form.publishAt, 1) : minDateTime;
    const maxDateTime = "9999-12-31T23:59";

    const listParams = {};
    if (search.trim())
        listParams.q = search.trim();
    if (canFilterAudience && filterAudience !== "all")
        listParams.audience = filterAudience;
    if (filterPriority !== "all")
        listParams.priority = filterPriority;
    if (filterState !== "all")
        listParams.state = filterState;

    const { data: announcements = [], isLoading } = useListAnnouncements(listParams, {
        query: {
            queryKey: getListAnnouncementsQueryKey(listParams),
            staleTime: 10000,
        },
    });

    const sortedAnnouncements = useMemo(() => {
        return [...announcements].sort((a, b) => {
            const bTime = new Date(b.createdAt ?? 0).getTime();
            const aTime = new Date(a.createdAt ?? 0).getTime();
            if (bTime !== aTime)
                return bTime - aTime;
            return (b.id ?? 0) - (a.id ?? 0);
        });
    }, [announcements]);
    const totalPages = Math.max(1, Math.ceil(sortedAnnouncements.length / PAGE_SIZE));
    const paginatedAnnouncements = sortedAnnouncements.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [search, filterAudience, filterPriority, filterState]);

    useEffect(() => {
        setPage((current) => Math.min(current, totalPages));
    }, [totalPages]);

    const createMutation = useMutation({
        mutationFn: async (payload) => customFetch("/api/announcements", {
            method: "POST",
            body: payload,
            responseType: "json",
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() });
            setOpen(false);
            setForm(defaultForm);
            setFormError("");
        },
    });

    const deleteMutation = useDeleteAnnouncement({
        mutation: {
            onSuccess: () => qc.invalidateQueries({ queryKey: getListAnnouncementsQueryKey() }),
        },
    });

    // const canCreate = user?.role === "admin" || user?.role === "teacher";
    // Allow all roles except parent, student, and vendor to create announcements
const canCreate = user?.role && !["parent", "student", "vendor"].includes(user?.role);
    const canDelete = user?.role === "admin";

    function handleAttachmentChange(event) {
        const file = event.target.files?.[0];
        if (!file)
            return;
        setForm((current) => ({
            ...current,
            attachmentUrl: "",
            attachmentName: file.name,
            attachmentFile: file,
        }));
        event.target.value = "";
    }

    function clearAttachment() {
        setForm((current) => ({
            ...current,
            attachmentUrl: "",
            attachmentName: "",
            attachmentFile: null,
        }));
    }

    function handlePublishAtChange(value) {
        setFormError("");
        setForm((current) => ({ ...current, publishAt: normalizeDateTimeInputYear(value) }));
    }

    function handleExpiresAtChange(value) {
        setFormError("");
        setForm((current) => ({ ...current, expiresAt: normalizeDateTimeInputYear(value) }));
    }

    function handleCreateAnnouncement() {
        const now = new Date(minDateTime);
        const publishAt = form.publishAt ? new Date(form.publishAt) : null;
        const expiresAt = form.expiresAt ? new Date(form.expiresAt) : null;
        if (publishAt && publishAt < now) {
            setFormError("Schedule publish cannot be in the past.");
            return;
        }
        if (expiresAt && expiresAt < now) {
            setFormError("Expiry date cannot be in the past.");
            return;
        }
        if (publishAt && expiresAt && expiresAt <= publishAt) {
            setFormError("Expiry date must be later than the schedule publish date.");
            return;
        }
        setFormError("");
        const payload = new FormData();
        payload.append("title", form.title);
        payload.append("content", form.content);
        payload.append("audience", form.audience);
        payload.append("priority", form.priority);
        if (form.publishAt)
            payload.append("publishAt", form.publishAt);
        if (form.expiresAt)
            payload.append("expiresAt", form.expiresAt);
        if (form.attachmentFile)
            payload.append("file", form.attachmentFile);
        createMutation.mutate(payload);
    }

    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-blue-400">Announcements</h1>
          <p className="text-muted-foreground text-sm mt-1">School-wide notices and updates · {sortedAnnouncements.length} shown</p>
        </div>
        {canCreate && (<Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4"/>New Announcement</Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Announcement</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Title</Label>
                  <Input value={form.title} onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))} className="mt-1" placeholder="Announcement title"/>
                </div>
                <div>
                  <Label>Content</Label>
                  <textarea value={form.content} onChange={(e) => setForm((current) => ({ ...current, content: e.target.value }))} rows={4} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background resize-none" placeholder="Write your announcement..."/>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Audience</Label>
                    <Select value={form.audience} onValueChange={(value) => setForm((current) => ({ ...current, audience: value }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableAudienceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority</Label>
                    <Select value={form.priority} onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {priorityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Schedule Publish</Label>
                    <Input type="datetime-local" min={minDateTime} max={maxDateTime} value={form.publishAt} onInput={(e) => { e.currentTarget.value = normalizeDateTimeInputYear(e.currentTarget.value); }} onChange={(e) => handlePublishAtChange(e.target.value)} className="mt-1 [&::-webkit-calendar-picker-indicator]:invert"/>
                    <p className="text-xs text-muted-foreground mt-1">Leave blank to publish immediately.</p>
                  </div>
                  <div>
                    <Label>Expiry Date</Label>
                    <Input type="datetime-local" min={minExpiryDateTime} max={maxDateTime} value={form.expiresAt} onInput={(e) => { e.currentTarget.value = normalizeDateTimeInputYear(e.currentTarget.value); }} onChange={(e) => handleExpiresAtChange(e.target.value)} className="mt-1 [&::-webkit-calendar-picker-indicator]:invert"/>
                    <p className="text-xs text-muted-foreground mt-1">Announcement auto-hides after this time.</p>
                  </div>
                </div>
                {formError && <p className="text-sm text-destructive">{formError}</p>}
                <div className="space-y-2">
                  <Label>Attachment</Label>
                  <Input type="file" onChange={handleAttachmentChange} disabled={createMutation.isPending}/>
                  {form.attachmentName && (<div className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-muted/20 px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Paperclip className="w-4 h-4 text-blue-400 shrink-0"/>
                        <span className="text-sm text-blue-400 truncate">{form.attachmentName || "Attached file"}</span>
                      </div>
                      <Button type="button" size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={clearAttachment}>
                        <X className="w-4 h-4"/>
                      </Button>
                    </div>)}
                </div>
                <Button className="w-full" disabled={!form.title || !form.content || createMutation.isPending} onClick={handleCreateAnnouncement}>
                  {createMutation.isPending ? "Saving..." : "Publish Announcement"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>)}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"/>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" placeholder="Search title or content"/>
        </div>
        {canFilterAudience && (<Select value={filterAudience} onValueChange={setFilterAudience}>
            <SelectTrigger><SelectValue placeholder="Audience"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All audiences</SelectItem>
              {filterAudienceOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>)}
        <div className="grid grid-cols-2 gap-3">
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger><SelectValue placeholder="Priority"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {priorityOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger><SelectValue placeholder="State"/></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {stateOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (<div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full"/>)}</div>) : sortedAnnouncements.length === 0 ? (<Card className="glass-card border-t-2 border-t-blue-500/30"><CardContent className="py-16 text-center text-muted-foreground">No announcements match the current search or filters.</CardContent></Card>) : (<div className="space-y-4">
          {paginatedAnnouncements.map((announcement) => {
                const priority = priorityConfig[announcement.priority ?? "normal"] ?? priorityConfig.normal;
                const state = stateConfig[announcement.state ?? "active"] ?? stateConfig.active;
                const PriorityIcon = priority.icon;
                const StateIcon = state.icon;
                const borderColor = announcement.priority === "urgent" ? "border-t-red-500/40" : announcement.priority === "high" ? "border-t-amber-500/40" : "border-t-blue-500/30";
                return (<Card key={announcement.id} className={`glass-card glass-hover border-t-2 ${borderColor}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-lg mt-0.5 shrink-0 ${priority.color}`}><PriorityIcon className="w-4 h-4"/></div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-semibold">{announcement.title}</h3>
                          <Badge className={`text-xs border capitalize ${priority.color}`}>{announcement.priority}</Badge>
                          <Badge variant="outline" className="text-xs capitalize">{announcement.audience}</Badge>
                          <Badge className={`text-xs border capitalize ${state.color}`}>
                            <StateIcon className="w-3 h-3 mr-1"/>
                            {state.label}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap"><AnnouncementContent text={announcement.content}/></p>
                        {announcement.attachmentUrl && (<div className="mt-3 flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-2 text-sm text-blue-400">
                              <Paperclip className="w-4 h-4"/>
                              {announcement.attachmentName || "Open attachment"}
                            </span>
                            <Button asChild size="sm" variant="outline" className="h-8 gap-1.5 text-blue-400 border-blue-500/30">
                              <a href={announcement.attachmentUrl} target="_blank" rel="noreferrer">
                                <Eye className="w-3.5 h-3.5"/>
                                View
                              </a>
                            </Button>
                            <Button asChild size="sm" variant="ghost" className="h-8 gap-1.5 text-emerald-400">
                              <a href={`${announcement.attachmentUrl}?disposition=attachment`} target="_blank" rel="noreferrer" download>
                                <Download className="w-3.5 h-3.5"/>
                                Download
                              </a>
                            </Button>
                          </div>)}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                          <span>{announcement.authorName} · {new Date(announcement.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                          {announcement.publishAt && <span>Publishes: {formatDateTime(announcement.publishAt)}</span>}
                          {announcement.expiresAt && <span>Expires: {formatDateTime(announcement.expiresAt)}</span>}
                        </div>
                      </div>
                    </div>
                    {canDelete && (<Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => deleteMutation.mutate({ id: announcement.id })}>
                        <Trash2 className="w-4 h-4"/>
                      </Button>)}
                  </div>
                </CardContent>
              </Card>);
            })}
          {totalPages > 1 && (<div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <p className="text-xs text-muted-foreground">
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, sortedAnnouncements.length)} of {sortedAnnouncements.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>
                  Next
                </Button>
              </div>
            </div>)}
        </div>)}
    </div>);
}
