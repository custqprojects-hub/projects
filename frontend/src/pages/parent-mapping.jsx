import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { 
  Search, Mail, Phone, User, Users, CheckCircle2, 
  AlertCircle, Sparkles, UserPlus, ArrowLeft, 
  Grid, List, Eye, Shield, Info, X, KeyRound, Copy, Check
} from "lucide-react";

export default function ParentMapping() {
    const { user } = useAuth();
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showDemoData, setShowDemoData] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [viewMode, setViewMode] = useState("grid"); // "grid" | "table"
    
    // Modal states
    const [linkOpen, setLinkOpen] = useState(false);
    const [activeParent, setActiveParent] = useState(null);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [parentPhoneInput, setParentPhoneInput] = useState("");
    const [detailParent, setDetailParent] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [createParentForm, setCreateParentForm] = useState({ name: "", email: "", phone: "", address: "", studentId: "" });
    const [parentCredentials, setParentCredentials] = useState(null);
    const [copiedCredential, setCopiedCredential] = useState("");
    
    // Validation error states
    const [validationErrors, setValidationErrors] = useState({
        name: "",
        email: "",
        phone: ""
    });

    const isAdmin = ["admin", "clerk"].includes(user?.role ?? "");

    // Queries
    const parentsQuery = useQuery({
        queryKey: ["students", "parents"],
        queryFn: async () => {
            const r = await fetch("/api/students/parents");
            if (!r.ok) throw new Error("Failed to fetch parents mapping");
            return r.json();
        },
        enabled: isAdmin,
        staleTime: 15000,
    });

    const studentsQuery = useQuery({
        queryKey: ["students"],
        queryFn: async () => {
            const r = await fetch("/api/students");
            if (!r.ok) throw new Error("Failed to fetch students");
            return r.json();
        },
        enabled: isAdmin,
    });

    const dbParents = Array.isArray(parentsQuery.data) ? parentsQuery.data : [];
    const students = Array.isArray(studentsQuery.data) ? studentsQuery.data : [];

    // Mutations
    const linkMutation = useMutation({
        mutationFn: async ({ studentId, parentPhone, parentName }) => {
            const res = await fetch(`/api/students/parents/${activeParent.id}/link`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ studentId: Number(studentId), parentPhone, parentName }),
            });
            if (!res.ok) throw new Error("Failed to link student");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["students", "parents"] });
            queryClient.invalidateQueries({ queryKey: ["students"] });
            toast({ title: "Student linked successfully" });
            setLinkOpen(false);
            setSelectedStudentId("");
            setActiveParent(null);
            setParentPhoneInput("");
        },
        onError: (err) => {
            toast({ title: "Failed to link", description: err.message, variant: "destructive" });
        }
    });
    
    const createParentMutation = useMutation({
        mutationFn: async (payload) => {
            const res = await fetch("/api/students/parents", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: payload.name.trim(),
                    email: payload.email.trim(),
                    phone: payload.phone.trim(),
                    address: payload.address.trim(),
                    studentId: payload.studentId ? Number(payload.studentId) : undefined,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data.error || "Failed to create parent account");
            return data;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["students", "parents"] });
            queryClient.invalidateQueries({ queryKey: ["students"] });
            setCreateOpen(false);
            setCreateParentForm({ name: "", email: "", phone: "", address: "", studentId: "" });
            setValidationErrors({ name: "", email: "", phone: "" });
            setParentCredentials({
                name: data.parent?.name,
                parentId: data.credentials?.parentId,
                username: data.credentials?.username,
                password: data.credentials?.password,
                phone: data.parent?.phone,
                email: data.parent?.email,
                address: data.parent?.address,
                linkedStudent: data.linkedStudent?.name,
            });
            toast({ title: "Parent account created", description: data.linkedStudent ? "Student mapped successfully." : "Credentials are ready to share." });
        },
        onError: (err) => {
            toast({ title: "Failed to create parent", description: err.message, variant: "destructive" });
        },
    });

    const unlinkMutation = useMutation({
        mutationFn: async ({ studentId }) => {
            const res = await fetch(`/api/students/${studentId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ parentPhone: null, parentName: null }),
            });
            if (!res.ok) throw new Error("Failed to unlink student");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["students", "parents"] });
            queryClient.invalidateQueries({ queryKey: ["students"] });
            toast({ title: "Student unlinked successfully" });
        },
        onError: (err) => {
            toast({ title: "Failed to unlink", description: err.message, variant: "destructive" });
        }
    });

    // Validation functions
    const validateName = (name) => {
        if (!name) return "Parent name is required";
        if (!/^[A-Za-z\s]+$/.test(name)) return "Only letters (A-Z, a-z) and spaces are allowed";
        if (name.length < 2 || name.length > 50) return "Name must be between 2-50 characters";
        return "";
    };

    const validateEmail = (email) => {
        if (!email) return "Email is required";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,4}$/;
        if (!emailRegex.test(email)) return "Please enter a valid email address (e.g., name@domain.com)";
        return "";
    };

    const validatePhone = (phone) => {
        if (!phone) return "Phone number is required";
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length !== 10) return "Phone number must be exactly 10 digits";
        if (!/^[6-9]/.test(cleaned)) return "Phone number must start with 6, 7, 8, or 9";
        return "";
    };

    const handleNameChange = (value) => {
        // Only allow letters and spaces
        const filtered = value.replace(/[^A-Za-z\s]/g, '');
        setCreateParentForm((f) => ({ ...f, name: filtered }));
        setValidationErrors((prev) => ({ ...prev, name: validateName(filtered) }));
    };

    const handleEmailChange = (value) => {
        setCreateParentForm((f) => ({ ...f, email: value }));
        setValidationErrors((prev) => ({ ...prev, email: validateEmail(value) }));
    };

    const handlePhoneChange = (value) => {
        // Only allow digits
        const cleaned = value.replace(/\D/g, '');
        // Limit to 10 digits
        const limited = cleaned.slice(0, 10);
        setCreateParentForm((f) => ({ ...f, phone: limited }));
        setValidationErrors((prev) => ({ ...prev, phone: validatePhone(limited) }));
    };

    const isFormValid = () => {
        const nameValid = !validateName(createParentForm.name);
        const emailValid = !validateEmail(createParentForm.email);
        const phoneValid = !validatePhone(createParentForm.phone);
        const hasAddress = createParentForm.address.trim().length > 0;
        return nameValid && emailValid && phoneValid && hasAddress;
    };

    // Simulated/Demo parent mapping data
    const demoParents = [
        {
            id: 991,
            name: "Rajesh Mehta",
            username: "parent",
            phone: "9876543210",
            email: "parent@email.com",
            children: [
                { id: 101, name: "Aarav Mehta", class: "Grade 10-A" },
                { id: 102, name: "Isha Mehta", class: "Grade 8-B" }
            ]
        },
        {
            id: 992,
            name: "Anita Sharma",
            username: "anita_parent",
            phone: "9812345678",
            email: "anita.sharma@email.com",
            children: [
                { id: 103, name: "Rahul Sharma", class: "Grade 12-C" }
            ]
        },
        {
            id: 993,
            name: "Vikram Malhotra",
            username: "vikram_parent",
            phone: "",
            email: "vikram.m@email.com",
            children: []
        }
    ];

    const parents = showDemoData ? demoParents : dbParents;

    if (!user) return null;

    if (!isAdmin) {
        return (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-400 max-w-md mx-auto mt-16 text-center">
                <h1 className="text-2xl font-serif font-bold text-red-400">Access Denied</h1>
                <p className="text-muted-foreground text-sm">Your role does not have permission to view this page.</p>
            </div>
        );
    }

    const handleOpenLinkModal = (parent, e) => {
        if (e) e.stopPropagation();
        if (showDemoData) {
            toast({ title: "Demo Mode Active", description: "Linking actions are disabled in demo mode. Switch to Database view to manage mappings.", variant: "warning" });
            return;
        }
        setActiveParent(parent);
        setSelectedStudentId("");
        setParentPhoneInput(parent.phone || "");
        setLinkOpen(true);
    };

    const handleConfirmLink = async () => {
        if (!selectedStudentId || !activeParent) return;
        const phoneToUse = parentPhoneInput.trim().replace(/[^0-9+\-\s()]/g, "");
        if (!phoneToUse) {
            toast({ title: "Phone number required", description: "Enter parent phone to map relation.", variant: "destructive" });
            return;
        }

        try {
            // Update parent phone on user account if it doesn't match
            if (activeParent.phone !== phoneToUse) {
                const res = await fetch(`/api/students/parents/${activeParent.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ phone: phoneToUse }),
                });
                if (!res.ok) {
                    const errObj = await res.json().catch(() => ({}));
                    throw new Error(errObj.error ?? "Failed to update parent phone");
                }
            }
            
            // Link student record
            linkMutation.mutate({
                studentId: selectedStudentId,
                parentPhone: phoneToUse,
                parentName: activeParent.name
            });
        } catch (err) {
            toast({ title: "Failed to map parent phone", description: err.message, variant: "destructive" });
        }
    };

    const handleUnlinkStudent = (studentId, e) => {
        if (e) e.stopPropagation();
        if (showDemoData) {
            toast({ title: "Demo Mode Active", description: "Unlinking actions are disabled in demo mode.", variant: "warning" });
            return;
        }
        if (confirm("Are you sure you want to unlink this student from their parent account?")) {
            unlinkMutation.mutate({ studentId });
        }
    };

    const handleCopyCredential = (label, value) => {
        if (!value)
            return;
        navigator.clipboard.writeText(value).then(() => {
            setCopiedCredential(label);
            setTimeout(() => setCopiedCredential(""), 1500);
        });
    };

    const handleOpenDetailModal = (parent) => {
        setDetailParent(parent);
    };

    // Filter parents based on search query
    const filteredParents = parents.filter(p => {
        const query = searchQuery.toLowerCase();
        return (
            p.name?.toLowerCase().includes(query) ||
            p.parentId?.toLowerCase().includes(query) ||
            p.username?.toLowerCase().includes(query) ||
            p.phone?.toLowerCase().includes(query) ||
            p.email?.toLowerCase().includes(query) ||
            p.address?.toLowerCase().includes(query) ||
            (p.children && p.children.some(c => c.name?.toLowerCase().includes(query)))
        );
    });

    // Show only students that are not already assigned to a parent in the dropdown.
    const assignedStudentIds = new Set(
        dbParents.flatMap((parent) => (parent.children || []).map((child) => Number(child.id)))
    );

    const availableStudents = students
        .filter((student) => {
            const studentId = Number(student.id);
            const isAlreadyAssigned = assignedStudentIds.has(studentId) || Boolean(student.parentPhone?.trim() || student.parentName?.trim());
            return !isAlreadyAssigned;
        })
        .map((student) => ({
            id: student.id,
            name: student.name,
            rollNumber: student.rollNumber ?? student.roll ?? "N/A",
            className: student.className ?? student.class ?? "",
        }));

    // Summary statistics
    const totalParents = parents.length;
    const activeMappings = parents.filter(p => p.children && p.children.length > 0).length;
    const unmappedParents = totalParents - activeMappings;
    const mappingRate = totalParents > 0 ? Math.round((activeMappings / totalParents) * 100) : 0;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => setLocation("/students")} className="h-8 w-8 p-0">
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <h1 className="text-2xl font-serif font-bold flex items-center gap-2 text-foreground">
                            <Shield className="w-6 h-6 text-sky-400" /> Parents Directory
                        </h1>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 ml-10">
                        Audit, search, and manage Parent-to-Student authoritative data relations.
                    </p>
                </div>

                <div className="flex items-center gap-2 ml-10 sm:ml-0">
                    <Button
                        className="gap-2"
                        onClick={() => setCreateOpen(true)}
                    >
                        <UserPlus className="w-4 h-4" /> Create Parent
                    </Button>
                    <div className="flex items-center bg-muted/40 p-1 rounded-lg border border-border/50">
                        <Button 
                            variant={viewMode === "grid" ? "secondary" : "ghost"} 
                            size="xs"
                            onClick={() => setViewMode("grid")}
                            className="px-2 h-7"
                        >
                            <Grid className="w-3.5 h-3.5 mr-1" /> Grid
                        </Button>
                        <Button 
                            variant={viewMode === "table" ? "secondary" : "ghost"} 
                            size="xs"
                            onClick={() => setViewMode("table")}
                            className="px-2 h-7"
                        >
                            <List className="w-3.5 h-3.5 mr-1" /> List
                        </Button>
                    </div>
                </div>
            </div>

            {/* UX Stats Widgets */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="glass-card border-t-2 border-t-sky-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-3 bg-sky-500/10 text-sky-400 rounded-xl"><Users className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Parents</p>
                            <p className="text-xl font-bold">{totalParents}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card border-t-2 border-t-emerald-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><CheckCircle2 className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Active Mapped</p>
                            <p className="text-xl font-bold">{activeMappings}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card border-t-2 border-t-amber-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl"><AlertCircle className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Unmapped Parents</p>
                            <p className="text-xl font-bold">{unmappedParents}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card border-t-2 border-t-indigo-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl"><Info className="w-5 h-5" /></div>
                        <div>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Mapping Rate</p>
                            <p className="text-xl font-bold">{mappingRate}%</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Info panel */}
            <Card className="glass-card border-l-4 border-l-sky-500 bg-sky-500/5">
                <CardContent className="p-4 flex gap-3">
                    <Info className="w-5 h-5 text-sky-400 shrink-0 mt-0.5" />
                    <div className="space-y-1 text-xs text-muted-foreground">
                        <p className="font-semibold text-white text-sm">Authoritative Parent-Student Mapping System</p>
                        <p>
                            Parent accounts sync automatically with student profiles based on the registered <strong className="text-sky-300">phone number</strong>. Use this panel to audit or manually map students to parents.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search parents by ID, name, username, phone, email, address, or ward..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus-visible:ring-sky-500"
                    />
                </div>
            </div>

            {/* Main Content Area */}
            {parentsQuery.isLoading && !showDemoData ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="h-44 w-full rounded-xl" />
                    ))}
                </div>
            ) : parentsQuery.isError && !showDemoData ? (
                <p className="text-red-400 text-center py-8">Error loading parents: {parentsQuery.error?.message}</p>
            ) : filteredParents.length === 0 ? (
                <div className="text-center py-16 bg-white/5 rounded-xl border border-white/10 space-y-2">
                    <p className="text-muted-foreground text-sm">No parents match your search filters.</p>
                </div>
            ) : viewMode === "grid" ? (
                // GRID VIEW: Parent Cards
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredParents.map((p) => {
                        const hasChildren = p.children && p.children.length > 0;
                        const avatarInitials = p.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
                        return (
                            <Card 
                                key={p.id} 
                                className="glass-card glass-hover border border-white/10 hover:border-sky-500/30 transition-all cursor-pointer flex flex-col justify-between"
                                onClick={() => handleOpenDetailModal(p)}
                            >
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-start gap-3 justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-10 h-10 rounded-full bg-sky-500/15 text-sky-400 flex items-center justify-center font-bold text-sm shrink-0">
                                                {avatarInitials}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-semibold text-white/95 truncate text-sm">{p.name}</p>
                                                <p className="text-[10px] text-sky-300 font-mono">{p.parentId || `#${p.id}`}</p>
                                                <p className="text-xs text-muted-foreground font-mono">@{p.username}</p>
                                            </div>
                                        </div>
                                        <Badge className={hasChildren ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px]" : "bg-red-500/10 text-red-400 border border-red-500/20 text-[10px]"}>
                                            {hasChildren ? "Mapped" : "Unmapped"}
                                        </Badge>
                                    </div>

                                    <div className="space-y-1.5 text-xs text-muted-foreground border-t border-white/5 pt-3">
                                        {p.phone && <p className="flex items-center gap-1.5">📞 {p.phone}</p>}
                                        {p.email && <p className="flex items-center gap-1.5 truncate">✉️ {p.email}</p>}
                                        {p.address && <p className="flex items-center gap-1.5 truncate">Address: {p.address}</p>}
                                    </div>

                                    <div className="space-y-1.5 border-t border-white/5 pt-3 flex-1">
                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Linked Wards</p>
                                        {hasChildren ? (
                                            <div className="flex flex-wrap gap-1.5 mt-1">
                                                {p.children.map((child) => (
                                                    <Badge 
                                                        key={child.id} 
                                                        variant="secondary" 
                                                        className="bg-sky-500/10 text-sky-400 border border-sky-500/20 pr-1.5 pl-2 py-0.5 inline-flex items-center gap-1 text-[11px]"
                                                        onClick={(e) => e.stopPropagation()} // Prevent card detail click
                                                    >
                                                        {child.name} ({child.class})
                                                        <button 
                                                            type="button"
                                                            onClick={(e) => handleUnlinkStudent(child.id, e)}
                                                            className="hover:bg-sky-500/25 rounded-full p-0.5 text-sky-400/80 hover:text-sky-300"
                                                            title="Unlink ward"
                                                        >
                                                            <X className="w-2.5 h-2.5" />
                                                        </button>
                                                    </Badge>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/50 italic">No mapped students</span>
                                        )}
                                    </div>
                                </CardContent>
                                <div className="px-5 pb-5 pt-1 border-t border-white/5 flex gap-2 justify-end">
                                    <Button 
                                        size="xs" 
                                        variant="ghost" 
                                        className="h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
                                        onClick={(e) => { e.stopPropagation(); handleOpenDetailModal(p); }}
                                    >
                                        <Eye className="w-3.5 h-3.5" /> View Profile
                                    </Button>
                                    <Button 
                                        size="xs" 
                                        variant="outline" 
                                        className="h-8 text-xs gap-1 text-sky-400 border-sky-500/20 hover:bg-sky-500/10"
                                        onClick={(e) => handleOpenLinkModal(p, e)}
                                    >
                                        <UserPlus className="w-3.5 h-3.5" /> Link Student
                                    </Button>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                // TABLE VIEW: Listing Layout
                <Card className="glass-card border-t-2 border-t-sky-400/30">
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead>
                                    <tr className="border-b border-border/40 text-xs text-muted-foreground bg-white/5">
                                        <th className="py-3 px-4">Parent Account</th>
                                        <th className="py-3 px-4">Contact Details</th>
                                        <th className="py-3 px-4">Linked Students</th>
                                        <th className="py-3 px-4">Status</th>
                                        <th className="py-3 px-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredParents.map((p) => {
                                        const hasChildren = p.children && p.children.length > 0;
                                        return (
                                            <tr key={p.id} className="border-b border-border/20 hover:bg-white/5 cursor-pointer" onClick={() => handleOpenDetailModal(p)}>
                                                <td className="py-3 px-4">
                                                    <p className="font-semibold text-white/90">{p.name}</p>
                                                    <p className="text-[10px] text-sky-300 font-mono">{p.parentId || `#${p.id}`}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">@{p.username}</p>
                                                </td>
                                                <td className="py-3 px-4 text-xs">
                                                    <p className="text-muted-foreground">📞 {p.phone || "—"}</p>
                                                    <p className="text-muted-foreground">✉️ {p.email || "—"}</p>
                                                    <p className="text-muted-foreground truncate max-w-[16rem]">Address: {p.address || "—"}</p>
                                                </td>
                                                <td className="py-3 px-4">
                                                    {hasChildren ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {p.children.map((child) => (
                                                                <Badge key={child.id} variant="secondary" className="bg-sky-500/10 text-sky-400 border border-sky-500/20 pr-1.5 pl-2 py-0.5 inline-flex items-center gap-1 text-[11px]" onClick={(e) => e.stopPropagation()}>
                                                                    {child.name} ({child.class})
                                                                    <button 
                                                                        type="button"
                                                                        onClick={(e) => handleUnlinkStudent(child.id, e)}
                                                                        className="hover:bg-sky-500/20 rounded-full p-0.5 text-sky-400/70 hover:text-sky-300"
                                                                    >
                                                                        <X className="w-2.5 h-2.5" />
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="text-xs text-muted-foreground/45 italic">No wards linked</span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4">
                                                    <Badge className={hasChildren ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25" : "bg-red-500/10 text-red-400 border border-red-500/25"}>
                                                        {hasChildren ? "Active" : "Unlinked"}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-right">
                                                    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                        <Button size="xs" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={() => handleOpenDetailModal(p)}><Eye className="w-3.5 h-3.5" /></Button>
                                                        <Button size="xs" variant="outline" className="h-7 text-xs gap-1 text-sky-400 border-sky-500/20 hover:bg-sky-500/10" onClick={(e) => handleOpenLinkModal(p, e)}><UserPlus className="w-3.5 h-3.5" /></Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Parent Details Card Modal */}
            <Dialog open={!!detailParent} onOpenChange={(v) => !v && setDetailParent(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-foreground font-serif">
                            <User className="w-5 h-5 text-sky-400" />
                            Parent Account details
                        </DialogTitle>
                    </DialogHeader>
                    {detailParent && (
                        <div className="space-y-4 py-2">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-base shrink-0">
                                    {detailParent.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{detailParent.name}</h3>
                                    <p className="text-[10px] text-sky-300 font-mono">{detailParent.parentId || `#${detailParent.id}`}</p>
                                    <p className="text-xs text-muted-foreground font-mono">@{detailParent.username}</p>
                                </div>
                            </div>
                            
                            <div className="space-y-2 rounded-lg bg-white/5 border border-white/10 p-3 text-xs">
                                <p className="text-muted-foreground"><strong>Registry ID:</strong> {detailParent.id}</p>
                                <p className="text-muted-foreground"><strong>Parent ID:</strong> {detailParent.parentId || "—"}</p>
                                <p className="text-muted-foreground"><strong>Contact Phone:</strong> {detailParent.phone || "—"}</p>
                                <p className="text-muted-foreground"><strong>Email Address:</strong> {detailParent.email || "—"}</p>
                                <p className="text-muted-foreground"><strong>Address:</strong> {detailParent.address || "—"}</p>
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Children Relationships ({detailParent.children?.length ?? 0})</h4>
                                {detailParent.children && detailParent.children.length > 0 ? (
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {detailParent.children.map((child) => (
                                            <div key={child.id} className="flex justify-between items-center bg-white/5 hover:bg-white/10 transition-colors px-3 py-2 rounded-lg border border-white/5 text-xs">
                                                <div>
                                                    <p className="font-semibold text-white">{child.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">{child.class}</p>
                                                </div>
                                                <Button 
                                                    size="xs" 
                                                    variant="ghost" 
                                                    className="h-6 text-[10px] text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                                    onClick={(e) => { setDetailParent(null); handleUnlinkStudent(child.id, e); }}
                                                >
                                                    Unlink
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-xs text-muted-foreground/50 italic">No mapped students for this parent account.</p>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setDetailParent(null)}>Close</Button>
                        {detailParent && (
                            <Button 
                                size="sm" 
                                className="bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30"
                                onClick={() => { setDetailParent(null); handleOpenLinkModal(detailParent); }}
                            >
                                Link Student
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create Parent Modal Dialog with Validation */}
            <Dialog open={createOpen} onOpenChange={(open) => {
                setCreateOpen(open);
                if (!open) {
                    setCreateParentForm({ name: "", email: "", phone: "", address: "", studentId: "" });
                    setValidationErrors({ name: "", email: "", phone: "" });
                }
            }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-sky-400" />
                            Create Parent Account
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2 text-sm">
                        <div className="grid grid-cols-1 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/70">Parent Name *</label>
                                <Input
                                    value={createParentForm.name}
                                    onChange={(e) => handleNameChange(e.target.value)}
                                    placeholder="Enter parent name"
                                    className={`h-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 ${validationErrors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                />
                                {validationErrors.name && (
                                    <p className="text-xs text-red-400">{validationErrors.name}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground">Only letters (A-Z, a-z) and spaces allowed • 2-50 characters</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/70">Email *</label>
                                <Input
                                    type="email"
                                    value={createParentForm.email}
                                    onChange={(e) => handleEmailChange(e.target.value)}
                                    placeholder="parent@example.com"
                                    className={`h-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 ${validationErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                />
                                {validationErrors.email && (
                                    <p className="text-xs text-red-400">{validationErrors.email}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground">Must be a valid email with domain (e.g., .com, .in, .org)</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/70">Phone *</label>
                                <Input
                                    type="tel"
                                    value={createParentForm.phone}
                                    onChange={(e) => handlePhoneChange(e.target.value)}
                                    placeholder="Enter 10-digit phone number"
                                    className={`h-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 ${validationErrors.phone ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                                />
                                {validationErrors.phone && (
                                    <p className="text-xs text-red-400">{validationErrors.phone}</p>
                                )}
                                <p className="text-[10px] text-muted-foreground">10 digits only • Must start with 6, 7, 8, or 9</p>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/70">Address *</label>
                                <Input
                                    value={createParentForm.address}
                                    onChange={(e) => setCreateParentForm((f) => ({ ...f, address: e.target.value }))}
                                    placeholder="Residential address"
                                    className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/25"
                                />
                            </div>
                            <div className="space-y-1.5">
                               
                                <p className="text-[11px] text-muted-foreground">
                                    Provide the same phone number that is registered with the student's profile to establish an automatic link. If the student is not yet linked, you can manually link them after creating the parent account.
                                </p>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => {
                            setCreateOpen(false);
                            setCreateParentForm({ name: "", email: "", phone: "", address: "", studentId: "" });
                            setValidationErrors({ name: "", email: "", phone: "" });
                        }}>Cancel</Button>
                        <Button
                            size="sm"
                            disabled={!isFormValid() || createParentMutation.isPending}
                            onClick={() => createParentMutation.mutate(createParentForm)}
                            className="bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30"
                        >
                            {createParentMutation.isPending ? "Creating..." : "Create & Generate Login"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Parent Credentials Modal */}
            <Dialog open={!!parentCredentials} onOpenChange={(open) => !open && setParentCredentials(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="w-4 h-4 text-emerald-400" />
                            Parent Login Credentials
                        </DialogTitle>
                    </DialogHeader>
                    {parentCredentials && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                                Password is shown only once. Share it securely with {parentCredentials.name}.
                            </div>
                            <div className="space-y-2">
                                {[
                                    ["Parent ID", parentCredentials.parentId],
                                    ["Username", parentCredentials.username],
                                    ["Password", parentCredentials.password],
                                    ["Phone", parentCredentials.phone],
                                    ["Email", parentCredentials.email],
                                    ["Address", parentCredentials.address],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                                        <div>
                                            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
                                            <p className="font-mono text-sm text-white">{value || "-"}</p>
                                        </div>
                                        {value && (
                                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleCopyCredential(label, value)}>
                                                {copiedCredential === label ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {parentCredentials.linkedStudent && (
                                <p className="text-xs text-muted-foreground">
                                    Linked student: <span className="text-sky-300">{parentCredentials.linkedStudent}</span>
                                </p>
                            )}
                        </div>
                    )}
                    <DialogFooter>
                        <Button size="sm" onClick={() => setParentCredentials(null)}>Done</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Link Student Modal Dialog */}
            <Dialog open={linkOpen} onOpenChange={(v) => !v && setLinkOpen(false)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="w-4 h-4 text-sky-400" />
                            Link Student to Parent
                        </DialogTitle>
                    </DialogHeader>
                    
                    {activeParent && (
                        <div className="space-y-4 py-2 text-sm">
                            <div className="rounded-lg bg-muted/20 px-3 py-2 text-xs space-y-1">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Parent Account</span>
                                    <span className="font-semibold text-white">{activeParent.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Username Reference</span>
                                    <span className="font-mono">@{activeParent.username}</span>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/70">Parent Phone Number *</label>
                                <Input 
                                    placeholder="Enter parent's phone number..." 
                                    value={parentPhoneInput} 
                                    onChange={(e) => setParentPhoneInput(e.target.value)} 
                                    className="h-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/50"
                                />
                                <p className="text-[10px] text-muted-foreground">
                                    Required to map and establish the link in the database.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-white/70">Select Student *</label>
                                {availableStudents.length > 0 ? (
                                    <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                                        <SelectTrigger className="w-full">
                                            <SelectValue placeholder="Choose unassigned student..." />
                                        </SelectTrigger>
                                        <SelectContent className="max-h-60">
                                            {availableStudents.map((student) => (
                                                <SelectItem key={student.id} value={String(student.id)}>
                                                    {student.name} (Roll: {student.rollNumber ?? "N/A"})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                ) : (
                                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                                        No unassigned students are currently available.
                                    </div>
                                )}
                                <p className="text-[11px] text-muted-foreground">
                                    Linking will match the parent's phone number on the student's profile.
                                </p>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" size="sm" onClick={() => setLinkOpen(false)}>Cancel</Button>
                        <Button 
                            size="sm" 
                            disabled={!selectedStudentId || linkMutation.isPending} 
                            onClick={handleConfirmLink}
                            className="bg-sky-500/20 text-sky-400 border border-sky-500/30 hover:bg-sky-500/30"
                        >
                            {linkMutation.isPending ? "Linking..." : "Confirm Link"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}