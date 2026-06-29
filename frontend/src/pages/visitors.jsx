import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, UserCheck, LogOut, Clock, Users, Phone, Inbox, Truck, Check, FileText, AlertCircle } from "lucide-react";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";

async function apiFetch(url, init) {
    const res = await fetch(url, init);
    if (!res.ok)
        throw new Error(await res.text());
    if (res.status === 204)
        return null;
    return res.json();
}

// Validation functions
const validateName = (name) => {
    const cleaned = name.replace(/[^A-Za-z\s]/g, '');
    const errors = [];
    if (!cleaned || cleaned.trim().length === 0) {
        errors.push("Name is required");
    } else if (cleaned.trim().length < 2) {
        errors.push("Name must be at least 2 characters");
    } else if (cleaned.trim().length > 50) {
        errors.push("Name must be less than 50 characters");
    }
    return { cleaned, errors };
};

const validatePhone = (phone) => {
    const cleaned = phone.replace(/\D/g, '');
    const errors = [];
    if (cleaned && cleaned.length > 0) {
        if (cleaned.length !== 10) {
            errors.push("Phone number must be exactly 10 digits");
        } else if (!/^[6-9]/.test(cleaned)) {
            errors.push("Phone number must start with 6, 7, 8, or 9");
        }
    }
    return { cleaned, errors };
};

const validateIDNumber = (idType, idNumber) => {
    const cleaned = idNumber.replace(/\s/g, '');
    const errors = [];
    
    if (cleaned && cleaned.length > 0) {
        switch(idType) {
            case "Aadhar":
                if (!/^\d{12}$/.test(cleaned)) {
                    errors.push("Aadhar must be exactly 12 digits");
                }
                break;
            case "PAN":
                if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleaned.toUpperCase())) {
                    errors.push("PAN must be 10 characters (5 letters, 4 digits, 1 letter)");
                }
                break;
            case "DL":
                if (cleaned.length < 8 || cleaned.length > 16) {
                    errors.push("Driving License must be 8-16 characters");
                }
                break;
            case "Passport":
                if (cleaned.length < 8 || cleaned.length > 9) {
                    errors.push("Passport must be 8-9 characters");
                }
                break;
            case "VoterID":
                if (!/^[A-Z]{3}[0-9]{7}$/.test(cleaned.toUpperCase())) {
                    errors.push("Voter ID must be 10 characters (3 letters, 7 digits)");
                }
                break;
            default:
                if (cleaned.length < 2) {
                    errors.push("ID number must be at least 2 characters");
                }
        }
    }
    return { cleaned, errors };
};

export default function Visitors() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [tab, setTab] = useState("visitors");

    // Visitor Dialog & Form
    const [openVisitor, setOpenVisitor] = useState(false);
    const [filterStatus, setFilterStatus] = useState("inside");
    const [visitorForm, setVisitorForm] = useState({ 
        visitorName: "", 
        visitorPhone: "", 
        purpose: "", 
        personToMeet: "", 
        department: "", 
        idType: "Aadhar", 
        idNumber: "" 
    });
    
    // Validation errors state
    const [validationErrors, setValidationErrors] = useState({
        visitorName: [],
        visitorPhone: [],
        idNumber: []
    });

    // Call Dialog & Form
    const [openCall, setOpenCall] = useState(false);
    const [callForm, setCallForm] = useState({ 
        contactName: "", 
        phoneNumber: "", 
        callType: "incoming", 
        purpose: "", 
        followUpDate: "", 
        remarks: "" 
    });

    // Postal Dialog & Form
    const [openPostal, setOpenPostal] = useState(false);
    const [postalForm, setPostalForm] = useState({ 
        type: "incoming", 
        referenceNumber: "", 
        senderName: "", 
        receiverName: "", 
        courierService: "", 
        date: "", 
        remarks: "" 
    });

    // Queries
    const { data: visitors = [], isLoading: loadingVisitors } = useQuery({
        queryKey: ["visitors"],
        queryFn: () => apiFetch("/api/visitors"),
        staleTime: 10000,
    });

    const { data: calls = [], isLoading: loadingCalls } = useQuery({
        queryKey: ["visitors", "calls"],
        queryFn: () => apiFetch("/api/visitors/calls"),
        staleTime: 10000,
        enabled: tab === "calls",
    });

    const { data: postalLogs = [], isLoading: loadingPostal } = useQuery({
        queryKey: ["visitors", "postal"],
        queryFn: () => apiFetch("/api/visitors/postal"),
        staleTime: 10000,
        enabled: tab === "postal",
    });

    // Mutations
    const createVisitorMutation = useMutation({
        mutationFn: (data) => apiFetch("/api/visitors", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(data) 
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["visitors"] });
            setOpenVisitor(false);
            setVisitorForm({ 
                visitorName: "", 
                visitorPhone: "", 
                purpose: "", 
                personToMeet: "", 
                department: "", 
                idType: "Aadhar", 
                idNumber: "" 
            });
            setValidationErrors({
                visitorName: [],
                visitorPhone: [],
                idNumber: []
            });
            toast({ title: "Visitor logged", description: "Entry recorded successfully." });
        },
        onError: (err) => toast({ 
            title: "Failed to log visitor", 
            description: err?.message ?? "Please try again.", 
            variant: "destructive" 
        }),
    });

    const checkoutVisitorMutation = useMutation({
        mutationFn: (id) => apiFetch(`/api/visitors/${id}`, { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ status: "departed" }) 
        }),
        onSuccess: () => { 
            qc.invalidateQueries({ queryKey: ["visitors"] }); 
            toast({ title: "Visitor checked out" }); 
        },
        onError: (err) => toast({ 
            title: "Check-out failed", 
            description: err?.message, 
            variant: "destructive" 
        }),
    });

    const createCallMutation = useMutation({
        mutationFn: (data) => apiFetch("/api/visitors/calls", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(data) 
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["visitors", "calls"] });
            setOpenCall(false);
            setCallForm({ 
                contactName: "", 
                phoneNumber: "", 
                callType: "incoming", 
                purpose: "", 
                followUpDate: "", 
                remarks: "" 
            });
            toast({ title: "Phone call logged", description: "Call record created successfully." });
        },
        onError: (err) => toast({ 
            title: "Failed to log call", 
            description: err?.message ?? "Please try again.", 
            variant: "destructive" 
        }),
    });

    const createPostalMutation = useMutation({
        mutationFn: (data) => apiFetch("/api/visitors/postal", { 
            method: "POST", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify(data) 
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["visitors", "postal"] });
            setOpenPostal(false);
            setPostalForm({ 
                type: "incoming", 
                referenceNumber: "", 
                senderName: "", 
                receiverName: "", 
                courierService: "", 
                date: "", 
                remarks: "" 
            });
            toast({ title: "Postal mail/courier logged", description: "Courier record created successfully." });
        },
        onError: (err) => toast({ 
            title: "Failed to log postal", 
            description: err?.message ?? "Please try again.", 
            variant: "destructive" 
        }),
    });

    const updatePostalStatusMutation = useMutation({
        mutationFn: ({ id, status }) => apiFetch(`/api/visitors/postal/${id}`, { 
            method: "PATCH", 
            headers: { "Content-Type": "application/json" }, 
            body: JSON.stringify({ dispatchStatus: status }) 
        }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["visitors", "postal"] });
            toast({ title: "Dispatch status updated" });
        },
        onError: (err) => toast({ 
            title: "Update failed", 
            description: err?.message, 
            variant: "destructive" 
        }),
    });

    // Handlers for visitor form with validation
    const handleNameChange = (e) => {
        const raw = e.target.value;
        const { cleaned, errors } = validateName(raw);
        setVisitorForm(f => ({ ...f, visitorName: cleaned }));
        setValidationErrors(prev => ({ ...prev, visitorName: errors }));
    };

    const handlePhoneChange = (e) => {
        const raw = e.target.value;
        const { cleaned, errors } = validatePhone(raw);
        setVisitorForm(f => ({ ...f, visitorPhone: cleaned }));
        setValidationErrors(prev => ({ ...prev, visitorPhone: errors }));
    };

    const handleIDNumberChange = (e) => {
        const raw = e.target.value;
        const { cleaned, errors } = validateIDNumber(visitorForm.idType, raw);
        setVisitorForm(f => ({ ...f, idNumber: cleaned }));
        setValidationErrors(prev => ({ ...prev, idNumber: errors }));
    };

    const handleIDTypeChange = (value) => {
        setVisitorForm(f => ({ ...f, idType: value, idNumber: '' }));
        setValidationErrors(prev => ({ ...prev, idNumber: [] }));
    };

    const isFormValid = () => {
        return (
            visitorForm.visitorName.trim().length >= 2 &&
            visitorForm.visitorName.trim().length <= 50 &&
            visitorForm.purpose.trim().length > 0 &&
            visitorForm.personToMeet.trim().length > 0 &&
            validationErrors.visitorName.length === 0 &&
            validationErrors.visitorPhone.length === 0 &&
            validationErrors.idNumber.length === 0 &&
            (!visitorForm.visitorPhone || visitorForm.visitorPhone.length === 0 || visitorForm.visitorPhone.length === 10)
        );
    };

    const isAdmin = user?.role === "admin" || user?.role === "clerk" || user?.role === "hostel_warden";
    const inside = visitors.filter((v) => v.status === "inside").length;

    // Visitors Table Columns
    const visitorColumns = [
        {
            key: "visitor",
            header: "Visitor",
            cell: (v) => (<div className="flex items-start gap-3">
          <div className={`p-2 rounded-full shrink-0 ${v.status === "inside" ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
            {v.status === "inside" ? <UserCheck className="w-4 h-4"/> : <LogOut className="w-4 h-4"/>}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-sm truncate">{v.visitorName}</p>
              {v.badge && <Badge className="text-xs bg-primary/10 text-primary border-primary/20">{v.badge}</Badge>}
            </div>
            {v.visitorPhone && <p className="text-xs text-muted-foreground">{v.visitorPhone}</p>}
          </div>
        </div>),
        },
        { key: "purpose", header: "Purpose", cell: (v) => <span className="text-sm">{v.purpose}</span> },
        { key: "meeting", header: "Meeting", cell: (v) => <span className="text-sm text-muted-foreground">{v.personToMeet}{v.department ? ` (${v.department})` : ""}</span> },
        {
            key: "checkin",
            header: "Check-in",
            cell: (v) => (<div className="text-xs">
          <div className="flex items-center gap-1 text-foreground"><Clock className="w-3 h-3"/>{new Date(v.checkIn).toLocaleTimeString()}</div>
          {v.checkOut && <div className="text-muted-foreground mt-0.5">Out: {new Date(v.checkOut).toLocaleTimeString()}</div>}
        </div>),
        },
        {
            key: "status",
            header: "Status",
            cell: (v) => (<Badge className={`border ${v.status === "inside" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted/50 text-muted-foreground border-border"}`}>
          {v.status === "inside" ? "Inside" : "Departed"}
        </Badge>),
        },
        {
            key: "actions",
            header: "Actions",
            align: "right",
            cell: (v) => isAdmin && v.status === "inside" ? (<Button size="sm" variant="outline" disabled={checkoutVisitorMutation.isPending} onClick={() => checkoutVisitorMutation.mutate(v.id)}>
            {checkoutVisitorMutation.isPending && checkoutVisitorMutation.variables === v.id ? "..." : "Check Out"}
          </Button>) : null,
        },
    ];

    // Calls Table Columns
    const callColumns = [
        {
            key: "contact",
            header: "Contact Details",
            cell: (c) => (
                <div className="flex items-start gap-2">
                    <div className={`p-1.5 rounded-full shrink-0 ${c.callType === "incoming" ? "bg-cyan-500/10 text-cyan-400" : "bg-amber-500/10 text-amber-400"}`}>
                        <Phone className="w-3.5 h-3.5"/>
                    </div>
                    <div>
                        <p className="font-semibold text-sm">{c.contactName}</p>
                        <p className="text-xs text-muted-foreground">{c.phoneNumber}</p>
                    </div>
                </div>
            )
        },
        {
            key: "callType",
            header: "Type",
            cell: (c) => (
                <Badge className={`capitalize border ${c.callType === "incoming" ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}`}>
                    {c.callType}
                </Badge>
            )
        },
        { key: "purpose", header: "Purpose", cell: (c) => <span className="text-sm">{c.purpose || "—"}</span> },
        { key: "followUpDate", header: "Follow Up", cell: (c) => <span className="text-sm text-cyan-400 font-mono">{c.followUpDate || "None"}</span> },
        { key: "remarks", header: "Remarks", cell: (c) => <span className="text-sm text-muted-foreground">{c.remarks || "—"}</span> },
        { key: "createdAt", header: "Logged At", cell: (c) => <span className="text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span> },
    ];

    // Postal Table Columns
    const postalColumns = [
        {
            key: "postal",
            header: "Reference & Courier",
            cell: (p) => (
                <div>
                    <p className="font-semibold text-sm">{p.referenceNumber || "No Ref #"}</p>
                    <p className="text-xs text-muted-foreground">{p.courierService || "Hand delivered"}</p>
                </div>
            )
        },
        {
            key: "type",
            header: "Direction",
            cell: (p) => (
                <Badge className={`capitalize border ${p.type === "incoming" ? "bg-purple-500/10 text-purple-400 border-purple-500/20" : "bg-orange-500/10 text-orange-400 border-orange-500/20"}`}>
                    {p.type}
                </Badge>
            )
        },
        {
            key: "parties",
            header: "Sender / Receiver",
            cell: (p) => (
                <div className="text-xs space-y-0.5">
                    <div><span className="text-muted-foreground">From:</span> {p.senderName}</div>
                    <div><span className="text-muted-foreground">To:</span> {p.receiverName}</div>
                </div>
            )
        },
        { key: "date", header: "Date", cell: (p) => <span className="text-sm font-mono">{p.date || "—"}</span> },
        {
            key: "dispatchStatus",
            header: "Status",
            cell: (p) => {
                const colors = {
                    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
                    dispatched: "bg-blue-500/10 text-blue-400 border-blue-500/20",
                    delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                };
                return (
                    <Badge className={`capitalize border ${colors[p.dispatchStatus] || "bg-muted text-muted-foreground border-border"}`}>
                        {p.dispatchStatus}
                    </Badge>
                );
            }
        },
        {
            key: "actions",
            header: "Actions",
            align: "right",
            cell: (p) => isAdmin && p.dispatchStatus !== "delivered" ? (
                <div className="flex gap-1 justify-end">
                    {p.dispatchStatus === "pending" && (
                        <Button size="xs" variant="outline" className="h-7 text-blue-400 border-blue-500/20 hover:bg-blue-500/10 text-xs px-2" onClick={() => updatePostalStatusMutation.mutate({ id: p.id, status: "dispatched" })}>
                            Dispatch
                        </Button>
                    )}
                    <Button size="xs" variant="outline" className="h-7 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10 text-xs px-2" onClick={() => updatePostalStatusMutation.mutate({ id: p.id, status: "delivered" })}>
                        Deliver
                    </Button>
                </div>
            ) : null,
        },
    ];

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-slate-400">Front Office Hub</h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        Manage visitors, call logs, complaints, and postal dispatches
                    </p>
                </div>

                <div className="flex gap-2">
                    {tab === "visitors" && isAdmin && (
                        <Dialog open={openVisitor} onOpenChange={setOpenVisitor}>
                            <DialogTrigger asChild>
                                <Button className="gap-2"><Plus className="w-4 h-4"/>Log Visitor</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>Log New Visitor</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div>
                                        <Label>Visitor Name *</Label>
                                        <input 
                                            value={visitorForm.visitorName} 
                                            onChange={handleNameChange}
                                            className={`w-full border ${validationErrors.visitorName.length > 0 ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2 text-sm mt-1 bg-background`} 
                                            placeholder="Full name (letters only)"
                                        />
                                        {validationErrors.visitorName.map((error, idx) => (
                                            <div key={idx} className="flex items-center gap-1 text-red-500 text-xs mt-1">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>{error}</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div>
                                        <Label>Phone Number</Label>
                                        <input 
                                            value={visitorForm.visitorPhone} 
                                            onChange={handlePhoneChange}
                                            className={`w-full border ${validationErrors.visitorPhone.length > 0 ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2 text-sm mt-1 bg-background`} 
                                            placeholder="10-digit mobile number"
                                            maxLength={10}
                                        />
                                        {validationErrors.visitorPhone.map((error, idx) => (
                                            <div key={idx} className="flex items-center gap-1 text-red-500 text-xs mt-1">
                                                <AlertCircle className="w-3 h-3" />
                                                <span>{error}</span>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    <div>
                                        <Label>Purpose of Visit *</Label>
                                        <input 
                                            value={visitorForm.purpose} 
                                            onChange={e => setVisitorForm(f => ({ ...f, purpose: e.target.value }))} 
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                            placeholder="e.g. Meeting, Admission inquiry..."
                                        />
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Person to Meet *</Label>
                                            <input 
                                                value={visitorForm.personToMeet} 
                                                onChange={e => setVisitorForm(f => ({ ...f, personToMeet: e.target.value }))} 
                                                className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                                placeholder="Contact person"
                                            />
                                        </div>
                                        <div>
                                            <Label>Department</Label>
                                            <input 
                                                value={visitorForm.department} 
                                                onChange={e => setVisitorForm(f => ({ ...f, department: e.target.value }))} 
                                                className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" 
                                                placeholder="Admin, Principal..."
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>ID Type</Label>
                                            <Select value={visitorForm.idType} onValueChange={handleIDTypeChange}>
                                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Aadhar">Aadhar Card</SelectItem>
                                                    <SelectItem value="PAN">PAN Card</SelectItem>
                                                    <SelectItem value="DL">Driving License</SelectItem>
                                                    <SelectItem value="Passport">Passport</SelectItem>
                                                    <SelectItem value="VoterID">Voter ID</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <Label>ID Number</Label>
                                            <input 
                                                value={visitorForm.idNumber} 
                                                onChange={handleIDNumberChange}
                                                className={`w-full border ${validationErrors.idNumber.length > 0 ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2 text-sm mt-1 bg-background`} 
                                                placeholder="Enter ID number"
                                            />
                                            {validationErrors.idNumber.map((error, idx) => (
                                                <div key={idx} className="flex items-center gap-1 text-red-500 text-xs mt-1">
                                                    <AlertCircle className="w-3 h-3" />
                                                    <span>{error}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <Button 
                                        className="w-full" 
                                        disabled={!isFormValid() || createVisitorMutation.isPending} 
                                        onClick={() => createVisitorMutation.mutate(visitorForm)}
                                    >
                                        {createVisitorMutation.isPending ? "Logging..." : "Log Visitor"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {tab === "calls" && isAdmin && (
                        <Dialog open={openCall} onOpenChange={setOpenCall}>
                            <DialogTrigger asChild>
                                <Button className="gap-2"><Plus className="w-4 h-4"/>Log Phone Call</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>Log Call Entry</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div><Label>Contact Name *</Label><input value={callForm.contactName} onChange={e => setCallForm(f => ({ ...f, contactName: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="Contact person name"/></div>
                                    <div><Label>Phone Number *</Label><input value={callForm.phoneNumber} onChange={e => setCallForm(f => ({ ...f, phoneNumber: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="Phone number"/></div>
                                    <div>
                                        <Label>Call Direction *</Label>
                                        <Select value={callForm.callType} onValueChange={v => setCallForm(f => ({ ...f, callType: v }))}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="incoming">Incoming</SelectItem>
                                                <SelectItem value="outgoing">Outgoing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div><Label>Purpose of Call</Label><input value={callForm.purpose} onChange={e => setCallForm(f => ({ ...f, purpose: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="e.g. Admission inquiry details"/></div>
                                    <div><Label>Follow Up Date / Time</Label><input value={callForm.followUpDate} onChange={e => setCallForm(f => ({ ...f, followUpDate: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="e.g. Next Monday 10am"/></div>
                                    <div><Label>Remarks</Label><textarea value={callForm.remarks} onChange={e => setCallForm(f => ({ ...f, remarks: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="Any additional notes..."/></div>
                                    <Button className="w-full" disabled={!callForm.contactName || !callForm.phoneNumber || createCallMutation.isPending} onClick={() => createCallMutation.mutate(callForm)}>
                                        {createCallMutation.isPending ? "Logging..." : "Log Phone Call"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}

                    {tab === "postal" && isAdmin && (
                        <Dialog open={openPostal} onOpenChange={setOpenPostal}>
                            <DialogTrigger asChild>
                                <Button className="gap-2"><Plus className="w-4 h-4"/>Log Courier</Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader><DialogTitle>Log Postal / Courier Mail</DialogTitle></DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div>
                                        <Label>Mail Type *</Label>
                                        <Select value={postalForm.type} onValueChange={v => setPostalForm(f => ({ ...f, type: v }))}>
                                            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="incoming">Incoming</SelectItem>
                                                <SelectItem value="outgoing">Outgoing</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div><Label>Sender Name *</Label><input value={postalForm.senderName} onChange={e => setPostalForm(f => ({ ...f, senderName: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"/></div>
                                    <div><Label>Receiver Name *</Label><input value={postalForm.receiverName} onChange={e => setPostalForm(f => ({ ...f, receiverName: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"/></div>
                                    <div><Label>Courier Reference / Tracking Number</Label><input value={postalForm.referenceNumber} onChange={e => setPostalForm(f => ({ ...f, referenceNumber: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="e.g. Tracking ID"/></div>
                                    <div><Label>Courier Service Name</Label><input value={postalForm.courierService} onChange={e => setPostalForm(f => ({ ...f, courierService: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="e.g. DHL, BlueDart"/></div>
                                   <div>
  <Label>Date</Label>
  <input
    type="date"
    value={postalForm.date}
    onChange={e => setPostalForm(f => ({ ...f, date: e.target.value }))}
    className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-white text-black"
  />
</div>  <div><Label>Remarks</Label><textarea value={postalForm.remarks} onChange={e => setPostalForm(f => ({ ...f, remarks: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="Any additional notes..."/></div>
                                    <Button className="w-full" disabled={!postalForm.senderName || !postalForm.receiverName || createPostalMutation.isPending} onClick={() => createPostalMutation.mutate(postalForm)}>
                                        {createPostalMutation.isPending ? "Logging..." : "Log Postal/Courier"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    )}
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border/50 pb-px">
                <Button variant={tab === "visitors" ? "default" : "ghost"} onClick={() => setTab("visitors")} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" data-state={tab === "visitors" ? "active" : ""}>
                    <Users className="w-4 h-4 mr-2"/> Visitor Log
                </Button>
                <Button variant={tab === "calls" ? "default" : "ghost"} onClick={() => setTab("calls")} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" data-state={tab === "calls" ? "active" : ""}>
                    <Phone className="w-4 h-4 mr-2"/> Call Logs
                </Button>
                <Button variant={tab === "postal" ? "default" : "ghost"} onClick={() => setTab("postal")} className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary" data-state={tab === "postal" ? "active" : ""}>
                    <Truck className="w-4 h-4 mr-2"/> Postal & Courier
                </Button>
            </div>

            {/* Tab: Visitors */}
            {tab === "visitors" && (
                <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { label: "Currently Inside", value: inside, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: UserCheck },
                            { label: "Total Logged Today", value: visitors.length, color: "text-slate-400", bg: "bg-slate-500/10", border: "border-t-slate-500/40", icon: Users },
                            { label: "Departed", value: visitors.filter((v) => v.status === "departed").length, color: "text-muted-foreground", bg: "bg-muted/30", border: "border-t-border", icon: LogOut },
                            { label: "Pass Issued", value: visitors.filter((v) => v.badge).length, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-t-cyan-500/40", icon: Clock },
                        ].map(s => (<Card key={s.label} className={`glass-card glass-hover border-t-2 ${s.border}`}>
                            <CardContent className="p-4 flex items-center gap-3">
                                <div className={`${s.bg} p-2 rounded-lg ${s.color}`}><s.icon className="w-4 h-4"/></div>
                                <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
                            </CardContent>
                        </Card>))}
                    </div>

                    <Card className="glass-card border-t-2 border-t-slate-500/30">
                        <CardHeader><CardTitle className="text-base font-serif">Active Visitors</CardTitle></CardHeader>
                        <CardContent>
                            <DataTable data={visitors} columns={visitorColumns} rowKey={(v) => v.id} isLoading={loadingVisitors} searchPlaceholder="Search by name, purpose, person..." searchKeys={["visitorName", "purpose", "personToMeet", "visitorPhone"]} filters={[
                                {
                                    key: "status",
                                    placeholder: "All visitors",
                                    value: filterStatus,
                                    onChange: setFilterStatus,
                                    options: [
                                        { value: "inside", label: "Currently Inside" },
                                        { value: "departed", label: "Departed" },
                                    ],
                                    predicate: (v, val) => v.status === val,
                                    width: "w-44",
                                },
                            ]} emptyTitle="No visitor records found" emptyDescription="Logged visitors will appear here."/>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Tab: Calls */}
            {tab === "calls" && (
                <Card className="glass-card border-t-2 border-t-cyan-500/30">
                    <CardHeader><CardTitle className="text-base font-serif">Phone & Call logs</CardTitle></CardHeader>
                    <CardContent>
                        <DataTable 
                            data={calls} 
                            columns={callColumns} 
                            rowKey={(c) => c.id} 
                            isLoading={loadingCalls} 
                            searchPlaceholder="Search by caller, number, purpose..." 
                            searchKeys={["contactName", "phoneNumber", "purpose"]} 
                            emptyTitle="No call logs found" 
                            emptyDescription="Telephone records will be listed here."
                        />
                    </CardContent>
                </Card>
            )}

            {/* Tab: Postal */}
            {tab === "postal" && (
                <Card className="glass-card border-t-2 border-t-purple-500/30">
                    <CardHeader><CardTitle className="text-base font-serif">Postal & Courier Register</CardTitle></CardHeader>
                    <CardContent>
                        <DataTable 
                            data={postalLogs} 
                            columns={postalColumns} 
                            rowKey={(p) => p.id} 
                            isLoading={loadingPostal} 
                            searchPlaceholder="Search by reference, sender, receiver..." 
                            searchKeys={["referenceNumber", "senderName", "receiverName", "courierService"]} 
                            emptyTitle="No postal records found" 
                            emptyDescription="Dispatched and received couriers will appear here."
                        />
                    </CardContent>
                </Card>
            )}
        </div>
    );
}