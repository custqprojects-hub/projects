import { useEffect, useState } from "react";
import { useListMaterials, useDeleteMaterial, useListSubjects, useListClasses, getListMaterialsQueryKey, getListSubjectsQueryKey, getListClassesQueryKey } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, FileText, Video, Image, Download, Search, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const typeConfig = {
    pdf: { icon: FileText, color: "text-red-400" },
    video: { icon: Video, color: "text-blue-400" },
    image: { icon: Image, color: "text-green-400" },
    document: { icon: FileText, color: "text-amber-400" },
    other: { icon: FileText, color: "text-muted-foreground" },
};
function newestFirst(a, b) {
    const bTime = new Date(b.createdAt ?? b.uploadedAt ?? 0).getTime();
    const aTime = new Date(a.createdAt ?? a.uploadedAt ?? 0).getTime();
    if (bTime !== aTime)
        return bTime - aTime;
    return (b.id ?? 0) - (a.id ?? 0);
}
export default function Materials() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [filterSubject, setFilterSubject] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [filterType, setFilterType] = useState("");
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 9;
    const [form, setForm] = useState({ title: "", description: "", type: "pdf", subjectId: "", classId: "" });
    const [selectedFile, setSelectedFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [previewMaterial, setPreviewMaterial] = useState(null);
    const { data: materials = [], isLoading } = useListMaterials({}, { query: { queryKey: getListMaterialsQueryKey(), staleTime: 10000 } });
    const { data: subjects = [] } = useListSubjects({ query: { queryKey: getListSubjectsQueryKey(), staleTime: 30000 } });
    const { data: classes = [] } = useListClasses({ query: { queryKey: getListClassesQueryKey(), staleTime: 30000 } });
    const selectedClassId = form.classId ? Number(form.classId) : null;
    const availableSubjects = selectedClassId ? Array.from(new Map(subjects.filter((s) => Number(s.classId) === selectedClassId).map((s) => [s.id, s])).values()) : [];
    const selectedFilterClassId = filterClass ? Number(filterClass) : null;
    const filterAvailableSubjects = selectedFilterClassId
        ? Array.from(new Map(subjects.filter((s) => Number(s.classId) === selectedFilterClassId).map((s) => [s.id, s])).values())
        : [];
    const resetUploadForm = () => {
        setForm({ title: "", description: "", type: "pdf", subjectId: "", classId: "" });
        setSelectedFile(null);
    };
    const handleUploadMaterial = async () => {
        if (!selectedFile)
            return;
        setIsUploading(true);
        const body = new FormData();
        body.append("title", form.title);
        body.append("description", form.description);
        body.append("type", form.type);
        body.append("subjectId", form.subjectId);
        body.append("classId", form.classId);
        body.append("file", selectedFile);
        try {
            const res = await fetch("/api/materials/upload", {
                method: "POST",
                credentials: "include",
                body,
            });
            if (!res.ok) {
                const error = await res.json().catch(() => ({}));
                throw new Error(error?.details || error?.error || "Upload failed");
            }
            qc.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
            setOpen(false);
            resetUploadForm();
            toast({ title: "Material uploaded" });
        }
        catch (err) {
            toast({ title: "Upload failed", description: err?.message, variant: "destructive" });
        }
        finally {
            setIsUploading(false);
        }
    };
    const deleteMutation = useDeleteMaterial({
        mutation: {
            onSuccess: () => { qc.invalidateQueries({ queryKey: getListMaterialsQueryKey() }); toast({ title: "Material deleted" }); },
            onError: (err) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
        },
    });
    const canUploadMaterial = user?.role === "teacher" || user?.role === "store_manager";
    const canDeleteMaterial = user?.role === "admin" || user?.role === "teacher" || user?.role === "store_manager";
    const hideClassFilter = user?.role === "student";
    useEffect(() => {
        if (!form.subjectId)
            return;
        if (!selectedClassId)
            return;
        if (!availableSubjects.some((s) => String(s.id) === form.subjectId)) {
            setForm((f) => ({ ...f, subjectId: "" }));
        }
    }, [availableSubjects, form.subjectId, selectedClassId]);
    useEffect(() => {
        if (!filterClass) {
            if (filterSubject)
                setFilterSubject("");
            return;
        }
        if (filterSubject && !filterAvailableSubjects.some((s) => String(s.id) === filterSubject)) {
            setFilterSubject("");
        }
    }, [filterAvailableSubjects, filterClass, filterSubject]);
    const filtered = materials.filter((m) => {
        if (filterSubject && String(m.subjectId) !== filterSubject)
            return false;
        if (filterClass && String(m.classId) !== filterClass)
            return false;
        if (filterType && m.type !== filterType)
            return false;
        if (search) {
            const q = search.toLowerCase();
            if (!m.title?.toLowerCase().includes(q) && !(m.description ?? "").toLowerCase().includes(q) && !((m.uploadedBy ?? "").toLowerCase().includes(q)))
                return false;
        }
        return true;
    }).sort(newestFirst);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
    useEffect(() => {
        if (page !== safePage) {
            setPage(safePage);
        }
    }, [page, safePage]);
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-green-400">Study Materials</h1>
          <p className="text-muted-foreground text-sm mt-1">Learning resources and reference documents</p>
        </div>
        {canUploadMaterial && (<Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="w-4 h-4"/>Upload Material</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Upload Study Material</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div><Label>Title</Label><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background"/></div>
                <div><Label>Description</Label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="w-full border rounded-md px-3 py-2 text-sm mt-1 bg-background resize-none"/></div>
                <div>
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-50 max-h-60 overflow-y-auto border-border bg-popover text-popover-foreground shadow-xl"><SelectItem value="pdf">PDF</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="document">Document</SelectItem><SelectItem value="image">Image</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Attach File / Document</Label>
                  <Input type="file" accept=".pdf,.doc,.docx,image/*,video/*" className="mt-1 cursor-pointer bg-background" disabled={isUploading} onChange={async (e) => {
                    setSelectedFile(e.target.files?.[0] ?? null);
                  }} />
                  {selectedFile && <p className="text-xs text-muted-foreground mt-1">{selectedFile.name}</p>}
                  {isUploading && <p className="text-xs text-muted-foreground mt-1">Uploading file...</p>}
                </div>
                <div>
                  <Label>Class</Label>
                  <Select value={form.classId} onValueChange={v => setForm(f => ({ ...f, classId: v, subjectId: "" }))}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder="Select class"/></SelectTrigger>
                    <SelectContent className="z-50 max-h-60 overflow-y-auto border-border bg-popover text-popover-foreground shadow-xl">{classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Subject</Label>
                  <Select value={form.subjectId} onValueChange={v => setForm(f => ({ ...f, subjectId: v }))} disabled={!form.classId}>
                    <SelectTrigger className="mt-1 bg-background border-border"><SelectValue placeholder={form.classId ? "Select subject" : "Select class first"}/></SelectTrigger>
                    <SelectContent className="z-50 max-h-60 overflow-y-auto border-border bg-popover text-popover-foreground shadow-xl">
                      {availableSubjects.length === 0 ? (
                        <SelectItem value="__no_subjects__" disabled>
                          {form.classId ? "No subjects for this class" : "Select a class first"}
                        </SelectItem>
                      ) : (
                        availableSubjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={!form.title || !form.subjectId || !form.classId || !selectedFile || isUploading} onClick={handleUploadMaterial}>
                  {isUploading ? "Uploading file..." : "Upload Material"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>)}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"/>
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search materials..." className="pl-9 h-9"/>
        </div>
        <Select value={filterSubject || "all"} onValueChange={v => { setFilterSubject(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-44 h-9 bg-background border-border"><SelectValue placeholder={filterClass ? "All subjects" : "All subjects"}/></SelectTrigger>
          <SelectContent className="z-50 max-h-60 overflow-y-auto border-border bg-popover text-popover-foreground shadow-xl">
            <SelectItem value="all">All subjects</SelectItem>
            {filterClass ? (
              filterAvailableSubjects.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)
            ) : (
              <SelectItem value="__select_class__" disabled>Select a class to filter subjects</SelectItem>
            )}
          </SelectContent>
        </Select>
        {!hideClassFilter && (<Select value={filterClass || "all"} onValueChange={v => { setFilterClass(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-40 h-9 bg-background border-border"><SelectValue placeholder="All classes"/></SelectTrigger>
          <SelectContent className="z-50 max-h-60 overflow-y-auto border-border bg-popover text-popover-foreground shadow-xl">
            <SelectItem value="all">All classes</SelectItem>
            {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>)}
        <Select value={filterType || "all"} onValueChange={v => { setFilterType(v === "all" ? "" : v); setPage(1); }}>
          <SelectTrigger className="w-36 h-9 bg-background border-border"><SelectValue placeholder="All types"/></SelectTrigger>
          <SelectContent className="z-50 max-h-60 overflow-y-auto border-border bg-popover text-popover-foreground shadow-xl">
            <SelectItem value="all">All types</SelectItem>
            {Object.keys(typeConfig).map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-36 rounded-lg bg-muted/20 animate-pulse"/>)}</div>) : filtered.length === 0 ? (<Card><CardContent className="py-16 text-center text-muted-foreground">No materials match your filters.</CardContent></Card>) : (<>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {paged.map(m => {
                const cfg = typeConfig[m.type] ?? typeConfig.other;
                const Icon = cfg.icon;
                return (<Card key={m.id} className="glass-card glass-hover border-t-2 border-t-green-500/30 group">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2.5 rounded-lg bg-green-500/10`}><Icon className={`w-5 h-5 ${cfg.color}`}/></div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {m.fileUrl && (
                          <>
                            <Button size="icon" variant="ghost" className="w-7 h-7" title="Preview" onClick={() => setPreviewMaterial(m)}>
                              <Eye className="w-3.5 h-3.5"/>
                            </Button>
                            <a href={`${m.fileUrl}?disposition=attachment`} target="_blank" rel="noopener noreferrer">
                              <Button size="icon" variant="ghost" className="w-7 h-7" title="Download">
                                <Download className="w-3.5 h-3.5"/>
                              </Button>
                            </a>
                          </>
                        )}
                        {canDeleteMaterial && (<Button size="icon" variant="ghost" className="w-7 h-7 text-destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate({ id: m.id })}>
                            <Trash2 className="w-3.5 h-3.5"/>
                          </Button>)}
                      </div>
                    </div>
                    <h3 className="font-semibold text-sm mb-1 line-clamp-2">{m.title}</h3>
                    {m.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{m.description}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{m.subjectName}</Badge>
                      <Badge variant="outline" className="text-xs">{m.className}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">By {m.uploadedBy} · {m.viewCount || 0} views · {m.downloadCount || 0} downloads</p>
                  </CardContent>
                </Card>);
            })}
          </div>
          {totalPages > 1 && (<div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              <span>{(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                <span className="px-2 text-foreground">Page {safePage} / {totalPages}</span>
                <Button variant="outline" size="sm" className="h-7 px-2" disabled={safePage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>)}
        </>)}

      <Dialog open={!!previewMaterial} onOpenChange={(v) => { if(!v) setPreviewMaterial(null); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewMaterial?.title}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-auto p-1 flex items-center justify-center bg-black/20 rounded-md min-h-[50vh]">
            {previewMaterial && (
              previewMaterial.type === "video" || previewMaterial.fileUrl?.match(/\.(mp4|webm|ogg)$/i) ? (
                <video src={previewMaterial.fileUrl} controls className="w-full max-h-[60vh] rounded-md" />
              ) : previewMaterial.type === "image" || previewMaterial.fileUrl?.match(/\.(jpg|jpeg|png|webp|gif)$/i) ? (
                <img src={previewMaterial.fileUrl} className="max-w-full max-h-[60vh] object-contain rounded-md mx-auto" alt={previewMaterial.title}/>
              ) : previewMaterial.type === "pdf" || previewMaterial.fileUrl?.match(/\.pdf$/i) ? (
                <iframe src={previewMaterial.fileUrl} className="w-full h-[60vh] rounded-md border bg-white" title="PDF Preview"/>
              ) : (
                <iframe 
                  src={`https://docs.google.com/viewer?url=${encodeURIComponent(previewMaterial.fileUrl)}&embedded=true`} 
                  className="w-full h-[60vh] rounded-md border bg-white" 
                  title="Document Preview"
                />
              )
            )}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="ghost" onClick={() => setPreviewMaterial(null)}>Close</Button>
            {previewMaterial?.fileUrl && (
              <a href={`${previewMaterial.fileUrl}?disposition=attachment`} download target="_blank" rel="noopener noreferrer">
                <Button className="gap-2">
                  <Download className="w-4 h-4" /> Download
                </Button>
              </a>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>);
}
