import { useState } from "react";
import { useLocation } from "wouter";
import { useListStudents, useCreateStudent, useUpdateStudent, useDeleteStudent, useListClasses, getListStudentsQueryKey, getListClassesQueryKey, UserRole, } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Plus, Eye, KeyRound, Copy, Check, X, Printer, Pencil, Users, CalendarDays, AlertCircle, Trash2, Upload  } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { IdCard } from "@/components/id-card";
import { DataTable } from "@/components/ui/data-table";
import { ProfileHoverCard } from "@/components/profile-hover-card";
import { readProfilePhotoAsDataUrl } from "@/lib/profile-photo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const getTodayDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
};

const defaultForm = {
    name: "",
    classId: "",
    gender: "Male",
    dateOfBirth: "",
    rollNumber: "",
    phone: "",
    email: "",
    parentName: "",
    parentPhone: "",
    address: "",
    admissionDate: getTodayDate(),
    needsHostel: false,
    needsTransport: false,
    avatarUrl: "",
};

// Validation functions
const validateName = (name) => {
    const trimmed = name.trim();
    if (!trimmed) return { isValid: false, message: "Name is required" };
    if (!/^[A-Za-z\s]+$/.test(trimmed)) return { isValid: false, message: "Only letters and spaces allowed" };
    if (trimmed.length < 2 || trimmed.length > 50) return { isValid: false, message: "Name must be between 2-50 characters" };
    return { isValid: true, message: "" };
};

const validatePhone = (phone) => {
    const trimmed = phone.trim();
    if (!trimmed) return { isValid: true, message: "" }; // Optional field
    if (!/^\d{10}$/.test(trimmed)) return { isValid: false, message: "Phone must be exactly 10 digits" };
    if (!/^[6-9]/.test(trimmed)) return { isValid: false, message: "Phone must start with 6, 7, 8, or 9" };
    return { isValid: true, message: "" };
};

const validateEmail = (email) => {
    const trimmed = email.trim();
    if (!trimmed) return { isValid: true, message: "" }; // Optional field
    const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,4}$/;
    if (!emailRegex.test(trimmed)) return { isValid: false, message: "Please enter a valid email (e.g., user@domain.com)" };
    return { isValid: true, message: "" };
};

const validateAddress = (address) => {
    const trimmed = address.trim();
    if (!trimmed) return { isValid: false, message: "Address is required" };
    if (trimmed.length < 5) return { isValid: false, message: "Address must be at least 5 characters" };
    return { isValid: true, message: "" };
};

function printCredentialSlip(c) {
    const w = window.open("", "_blank", "width=720,height=900");
    if (!w) return;
    const safe = (s) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
    w.document.write(`<!doctype html>
<html><head><meta charset="utf-8" /><title>Credential Slip - ${safe(c.name)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#fff;color:#0a0a0a}
  .slip{max-width:560px;margin:0 auto;border:2px solid #0284c7;border-radius:12px;overflow:hidden}
  header{background:#0284c7;color:#fff;padding:18px 24px;display:flex;align-items:center;justify-content:space-between}
  header h1{margin:0;font-size:20px;font-weight:700;letter-spacing:.5px}
  header p{margin:2px 0 0;font-size:11px;opacity:.85;letter-spacing:1px;text-transform:uppercase}
  .body{padding:28px 24px}
  .body h2{margin:0 0 4px;font-size:18px}
  .body .sub{color:#64748b;font-size:13px;margin-bottom:24px}
  .row{display:flex;justify-content:space-between;padding:12px 16px;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:10px}
  .row .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px}
  .row .val{font-family:'Courier New',monospace;font-weight:700;font-size:15px;color:#0c4a6e}
  .notice{margin-top:20px;padding:12px 16px;background:#fef3c7;border-left:3px solid #f59e0b;border-radius:4px;font-size:12px;color:#78350f}
  footer{padding:14px 24px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center}
  @media print{ body{padding:0} .slip{border:1px solid #000} }
</style></head><body>
<div class="slip">
  <header>
    <div><h1>Nexus Academy</h1><p>Student Credential Slip</p></div>
    <div style="text-align:right;font-size:10px;opacity:.9">Issued ${new Date().toLocaleDateString()}</div>
  </header>
  <div class="body">
    <h2>${safe(c.name)}</h2>
    <p class="sub">${safe(c.className || "")}</p>
    <div class="row"><span class="label">Student ID</span><span class="val">${safe(c.studentId)}</span></div>
    <div class="row"><span class="label">Username</span><span class="val">${safe(c.username)}</span></div>
    <div class="row"><span class="label">Initial Password</span><span class="val">${safe(c.password)}</span></div>
    <div class="notice"><strong>Important:</strong> Please change your password on first login. Keep these credentials confidential.</div>
  </div>
  <footer>This slip was generated by Nexus Academy School Management System.</footer>
</div>
<script>window.onload=function(){setTimeout(function(){window.print();},250);};</script>
</body></html>`);
    w.document.close();
}

export default function Students() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [filterClass, setFilterClass] = useState("");
    const [open, setOpen] = useState(false);
    const [admissionDateOpen, setAdmissionDateOpen] = useState(false);
    const [credModal, setCredModal] = useState(null);
    const [form, setForm] = useState(defaultForm);
    const [copied, setCopied] = useState(false);
    const [editStudent, setEditStudent] = useState(null);
    const [editAdmissionDateOpen, setEditAdmissionDateOpen] = useState(false);
    const [editForm, setEditForm] = useState(defaultForm);
    const [isUploading, setIsUploading] = useState(false);
    const [isEditUploading, setIsEditUploading] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [studentToDelete, setStudentToDelete] = useState(null);

    // Validation states for form fields
    const [nameError, setNameError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const [emailError, setEmailError] = useState("");
    const [addressError, setAddressError] = useState("");
    const [parentNameError, setParentNameError] = useState("");
    const [parentPhoneError, setParentPhoneError] = useState("");
    const [dobError, setDobError] = useState("");

    const { data: students = [], isLoading } = useListStudents(filterClass ? { classId: parseInt(filterClass) } : undefined, { query: { queryKey: getListStudentsQueryKey(filterClass ? { classId: parseInt(filterClass) } : undefined), staleTime: 15000 } });
    const { data: classes = [] } = useListClasses({ query: { queryKey: getListClassesQueryKey(), staleTime: 30000 } });

    const updateMutation = useUpdateStudent({
        mutation: {
            onSuccess: (_updated, variables) => {
                qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
                setEditStudent(null);
                toast({
                    title: "Student updated successfully",
                    description: variables?.data?.name ? `${variables.data.name} was saved.` : "Changes were saved.",
                });
            },
            onError: (err) => {
                toast({ title: "Failed to update student", description: err?.message, variant: "destructive" });
            },
        },
    });

    const deleteMutation = useDeleteStudent({
        mutation: {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
                setDeleteDialogOpen(false);
                setStudentToDelete(null);
                toast({
                    title: "Student deleted",
                    description: "The student has been removed from the system.",
                });
            },
            onError: (err) => {
                toast({ 
                    title: "Failed to delete student", 
                    description: err?.message || "An error occurred while deleting the student.", 
                    variant: "destructive" 
                });
            },
        },
    });

    const createMutation = useCreateStudent({
        mutation: {
            onSuccess: (created) => {
                qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
                const creds = created?.credentials;
                if (creds?.username && creds?.password && creds?.studentId) {
                    setCredModal({
                        studentId: creds.studentId,
                        username: creds.username,
                        password: creds.password,
                        name: created.name ?? form.name,
                        className: created.className ?? classes.find(c => String(c.id) === form.classId)?.name,
                    });
                } else {
                    toast({
                        title: "Student created",
                        description: "But no credentials were returned by the server.",
                        variant: "destructive",
                    });
                }
                setForm(defaultForm);
                setOpen(false);
                toast({ title: "Student added", description: `${created?.name ?? form.name} has been added successfully.` });
            },
            onError: (err) => {
                toast({ title: "Failed to create student", description: err?.message ?? "Check all required fields and try again.", variant: "destructive" });
            },
        },
    });

    const isAdmin = ["admin", "clerk"].includes(user?.role ?? "");
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const scopedStudents = user?.role === UserRole.student
        ? students?.filter(s => s.id === user.id) ?? []
        : students ?? [];

    const handleDeleteClick = (student) => {
        setStudentToDelete(student);
        setDeleteDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (studentToDelete) {
            deleteMutation.mutate({ id: studentToDelete.id });
        }
    };

    const columns = [
        {
            key: "student",
            header: "Student",
            cell: (s) => (<div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 ring-1 ring-border group-hover:ring-sky-400/40 transition-all">
            <AvatarImage src={s.avatarUrl}/>
            <AvatarFallback className="bg-sky-500/10 text-sky-400 text-xs font-semibold">{s.name?.charAt(0)?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm">
              <ProfileHoverCard kind="student" id={s.id} name={s.name}/>
            </div>
            {s.email && <div className="text-xs text-muted-foreground">{s.email}</div>}
          </div>
        </div>),
        },
        { key: "roll", header: "Roll No.", cell: (s) => <span className="font-mono text-xs text-muted-foreground">{s.rollNumber}</span> },
        { key: "class", header: "Class", cell: (s) => <Badge variant="outline" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 text-xs">{s.className || "N/A"}</Badge> },
        { key: "gender", header: "Gender", cell: (s) => <span className="text-sm text-muted-foreground">{s.gender}</span> },
        { key: "parent", header: "Parent", cell: (s) => <span className="text-sm">{s.parentName || "—"}</span> },
        {
            key: "status",
            header: "Status",
            cell: (s) => (<Badge variant="outline" className={s.status === 'active' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-muted text-muted-foreground'}>
          {s.status}
        </Badge>),
        },
        {
            key: "actions",
            header: "Actions",
            align: "right",
            cell: (s) => (<div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {isAdmin && (
            <>
              <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-sky-500/10 hover:text-sky-400" onClick={() => {
                setEditAdmissionDateOpen(false);
                setEditStudent(s);
                setEditForm({
                    name: s.name ?? "",
                    classId: String(s.classId ?? ""),
                    gender: s.gender ?? "Male",
                    dateOfBirth: s.dateOfBirth ?? "",
                    rollNumber: s.rollNumber ?? "",
                    phone: s.phone ?? "",
                    email: s.email ?? "",
                    parentName: s.parentName ?? "",
                    parentPhone: s.parentPhone ?? "",
                    address: s.address ?? "",
                    admissionDate: s.admissionDate ?? getTodayDate(),
                    needsHostel: false,
                    needsTransport: false,
                    avatarUrl: s.avatarUrl ?? "",
                });
              }}>
                <Pencil className="h-4 w-4"/>
              </Button>
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400"
                onClick={() => handleDeleteClick(s)}
              >
                <Trash2 className="h-4 w-4"/>
              </Button>
            </>
          )}
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-sky-500/10 hover:text-sky-400" onClick={() => setLocation(`/students/${s.id}`)}>
            <Eye className="h-4 w-4"/>
          </Button>
        </div>),
        },
    ];

    const handleCopy = async (text) => {
        try {
            if (navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(text);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = text;
                textarea.setAttribute("readonly", "true");
                textarea.style.position = "fixed";
                textarea.style.left = "-9999px";
                document.body.appendChild(textarea);
                textarea.select();
                const copiedOk = document.execCommand("copy");
                document.body.removeChild(textarea);
                if (!copiedOk) {
                    throw new Error("Copy failed");
                }
            }
            setCopied(true);
            toast({ title: "Copied", description: "Student details copied to clipboard." });
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Copy student details failed", err);
            toast({
                title: "Copy failed",
                description: "Your browser blocked clipboard access. Please copy manually.",
                variant: "destructive",
            });
        }
    };

    // Handle form field changes with validation
    const handleNameChange = (value) => {
        const cleaned = value.replace(/[^A-Za-z\s]/g, '');
        setForm(f => ({ ...f, name: cleaned }));
        const validation = validateName(cleaned);
        setNameError(validation.isValid ? "" : validation.message);
    };

    const handleParentNameChange = (value) => {
        const cleaned = value.replace(/[^A-Za-z\s]/g, '');
        setForm(f => ({ ...f, parentName: cleaned }));
        const validation = validateName(cleaned);
        setParentNameError(validation.isValid ? "" : validation.message);
    };

    const handlePhoneChange = (value) => {
        const cleaned = value.replace(/[^0-9]/g, '').slice(0, 10);
        setForm(f => ({ ...f, phone: cleaned }));
        const validation = validatePhone(cleaned);
        setPhoneError(validation.isValid ? "" : validation.message);
    };

    const handleParentPhoneChange = (value) => {
        const cleaned = value.replace(/[^0-9]/g, '').slice(0, 10);
        setForm(f => ({ ...f, parentPhone: cleaned }));
        const validation = validatePhone(cleaned);
        setParentPhoneError(validation.isValid ? "" : validation.message);
    };

    const handleEmailChange = (value) => {
        setForm(f => ({ ...f, email: value }));
        const validation = validateEmail(value);
        setEmailError(validation.isValid ? "" : validation.message);
    };

    const handleAddressChange = (value) => {
        setForm(f => ({ ...f, address: value }));
        const validation = validateAddress(value);
        setAddressError(validation.isValid ? "" : validation.message);
    };

    const handleDateOfBirthChange = (value) => {
        setForm(f => ({ ...f, dateOfBirth: value }));
        if (value) {
            const birthDate = new Date(value);
            const today = new Date();
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
            }
            if (age < 4) {
                setDobError("Student must be at least 4 years old");
            } else {
                setDobError("");
            }
        } else {
            setDobError("");
        }
    };

    const handleAvatarUpload = async (e, isEdit = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const setUploading = isEdit ? setIsEditUploading : setIsUploading;
    const setFormState = isEdit ? setEditForm : setForm;

    setUploading(true);

    try {
      const avatarUrl = await readProfilePhotoAsDataUrl(file);
      setFormState(f => ({ ...f, avatarUrl }));
      toast({ title: "Profile photo added successfully" });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };


    const isFormValid = () => {
        const nameValid = validateName(form.name).isValid;
        const parentNameValid = validateName(form.parentName).isValid || !form.parentName;
        const phoneValid = validatePhone(form.phone).isValid || !form.phone;
        const parentPhoneValid = validatePhone(form.parentPhone).isValid || !form.parentPhone;
        const emailValid = validateEmail(form.email).isValid || !form.email;
        const addressValid = validateAddress(form.address).isValid;
        const dobValid = !dobError;
        const classSelected = !!form.classId;
        
        return nameValid && parentNameValid && phoneValid && parentPhoneValid && 
               emailValid && addressValid && dobValid && classSelected;
    };

    const handleSubmit = () => {
        if (!isFormValid()) return;
        
        if (form.admissionDate < getTodayDate()) {
            toast({
                title: "Invalid admission date",
                description: "Please choose today or a future date.",
                variant: "destructive",
            });
            return;
        }

        createMutation.mutate({
            data: {
                name: form.name,
                rollNumber: form.rollNumber || undefined,
                classId: parseInt(form.classId),
                gender: form.gender,
                dateOfBirth: form.dateOfBirth || undefined,
                phone: form.phone || undefined,
                email: form.email || undefined,
                parentName: form.parentName || undefined,
                parentPhone: form.parentPhone || undefined,
                address: form.address || undefined,
                admissionDate: form.admissionDate,
                avatarUrl: form.avatarUrl || undefined,
            },
        });
    };

    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-sky-400">Students</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage student directory and profiles · {students.length} total
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setLocation("/parent-mapping")}>
              <Users className="w-4 h-4"/>
              Add Parent
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="w-4 h-4"/>
                    Add Student
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                  <DialogHeader><DialogTitle>Add New Student</DialogTitle></DialogHeader>
                  <div className="space-y-4 py-2">
                 <div className="flex items-center gap-4 border-b pb-3">
                  <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                      <AvatarImage src={form.avatarUrl} />
                      <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                        {isUploading ? "…" : (form.name?.charAt(0)?.toUpperCase() || "S")}
                      </AvatarFallback>
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                          <Upload className="w-5 h-5 animate-pulse" />
                        </div>
                      )}
                    </Avatar>
                  <div>
                      <Label className="text-xs">Profile Image</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        className="mt-1 max-w-xs cursor-pointer"
                        disabled={isUploading}
                        onChange={(e) => handleAvatarUpload(e, false)}
                      />
                      <p className="text-xs text-muted-foreground mt-1">Recommended: Square photo, max 5MB</p>
                    </div>
                </div>
                
                {/* Full Name */}
                <div>
                  <Label>Full Name *</Label>
                  <Input 
                    className={`mt-1 ${nameError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                    value={form.name} 
                    onChange={e => handleNameChange(e.target.value)} 
                    placeholder="Student's full name"
                  />
                  {nameError && (
                    <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      <span>{nameError}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Class *</Label>
                    <Select value={form.classId} onValueChange={v => setForm(f => ({ ...f, classId: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select class"/></SelectTrigger>
                      <SelectContent className="max-h-60 overflow-y-auto">
                        {classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Gender *</Label>
                    <Select value={form.gender} onValueChange={v => setForm(f => ({ ...f, gender: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date of Birth</Label>
                    <div className="relative mt-1">
                      <Input 
                        type="date" 
                        className={`w-full ${dobError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                        value={form.dateOfBirth} 
                        onChange={e => handleDateOfBirthChange(e.target.value)}
                      />
                      {dobError && (
                        <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          <span>{dobError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label>Roll Number</Label>
                    <Input className="mt-1" value={form.rollNumber} onChange={e => setForm(f => ({ ...f, rollNumber: e.target.value }))} placeholder="Auto-generated if empty"/>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Admission Date *</Label>
                    <Popover open={admissionDateOpen} onOpenChange={setAdmissionDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className="mt-1 w-full justify-between text-left font-normal hover:bg-primary/5 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                            {form.admissionDate ? (
                              <span className="text-sm">{format(new Date(`${form.admissionDate}T00:00:00`), "dd MMM yyyy")}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">Select admission date</span>
                            )}
                          </div>
                          <CalendarDays className="h-4 w-4 opacity-50 shrink-0" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 overflow-hidden rounded-xl shadow-xl border border-border z-50" align="start" side="bottom" sideOffset={6} avoidCollisions={true}>
                        <div className="bg-primary/5 border-b px-4 py-3">
                          <p className="text-sm font-medium">Admission Date</p>
                          <p className="text-xs text-muted-foreground">Select today or a future date</p>
                        </div>
                        <div className="p-4 flex justify-center">
                          <Calendar
                            mode="single"
                            selected={form.admissionDate ? new Date(`${form.admissionDate}T00:00:00`) : undefined}
                            onSelect={(date) => {
                              if (date) {
                                const year = date.getFullYear();
                                const month = String(date.getMonth() + 1).padStart(2, "0");
                                const day = String(date.getDate()).padStart(2, "0");
                                setForm((f) => ({ ...f, admissionDate: `${year}-${month}-${day}` }));
                                setAdmissionDateOpen(false);
                              }
                            }}
                            disabled={(date) => date < todayStart}
                            initialFocus
                            className="rounded-md"
                          />
                        </div>
                        <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-end">
                          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setAdmissionDateOpen(false)} disabled={!form.admissionDate}>
                            Done
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input 
                      type="tel" 
                      className={`mt-1 ${phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                      value={form.phone} 
                      onChange={e => handlePhoneChange(e.target.value)} 
                      placeholder="10-digit phone number"
                      maxLength={10}
                    />
                    {phoneError && (
                      <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                        <AlertCircle className="h-3 w-3" />
                        <span>{phoneError}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Email</Label>
                  <Input 
                    type="email" 
                    className={`mt-1 ${emailError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                    value={form.email} 
                    onChange={e => handleEmailChange(e.target.value)} 
                    placeholder="student@email.com"
                  />
                  {emailError && (
                    <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                      <AlertCircle className="h-3 w-3" />
                      <span>{emailError}</span>
                    </div>
                  )}
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Facilities</p>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors">
                      <input type="checkbox" className="rounded border-primary/30" checked={form.needsHostel} onChange={e => setForm(f => ({ ...f, needsHostel: e.target.checked }))}/>
                      Needs Hostel
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:text-primary transition-colors">
                      <input type="checkbox" className="rounded border-primary/30" checked={form.needsTransport} onChange={e => setForm(f => ({ ...f, needsTransport: e.target.checked }))}/>
                      Needs Transport
                    </label>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Allocation will be done from the respective module after creation.</p>
                </div>

                <div className="border-t pt-3">
                  <p className="text-sm font-medium mb-3 text-muted-foreground">Parent / Guardian</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Parent Name</Label>
                      <Input 
                        className={`mt-1 ${parentNameError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                        value={form.parentName} 
                        onChange={e => handleParentNameChange(e.target.value)}
                        placeholder="Parent's full name"
                      />
                      {parentNameError && (
                        <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          <span>{parentNameError}</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <Label>Parent Phone</Label>
                      <Input 
                        type="tel" 
                        className={`mt-1 ${parentPhoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                        value={form.parentPhone} 
                        onChange={e => handleParentPhoneChange(e.target.value)} 
                        placeholder="10-digit phone number"
                        maxLength={10}
                      />
                      {parentPhoneError && (
                        <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                          <AlertCircle className="h-3 w-3" />
                          <span>{parentPhoneError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label>Address *</Label>
                    <Textarea 
                      className={`mt-1 resize-none ${addressError ? 'border-red-500 focus-visible:ring-red-500' : ''}`} 
                      rows={2} 
                      value={form.address} 
                      onChange={e => handleAddressChange(e.target.value)} 
                      placeholder="Residential address"
                    />
                    {addressError && (
                      <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                        <AlertCircle className="h-3 w-3" />
                        <span>{addressError}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Button 
                  className="w-full" 
                  disabled={!isFormValid() || createMutation.isPending} 
                  onClick={handleSubmit}
                >
                  {createMutation.isPending ? "Adding..." : "Add Student & Generate Credentials"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>)}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Student</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <span className="font-semibold text-foreground">{studentToDelete?.name}</span>? 
              This action cannot be undone and will permanently remove the student from the system.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credential Modal */}
      {credModal && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-5xl overflow-hidden rounded-3xl border border-sky-500/20 bg-gradient-to-br from-slate-950 via-card to-slate-900 shadow-[0_30px_100px_rgba(0,0,0,0.65)]">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-400" />
            <div className="flex items-start justify-between gap-4 border-b border-white/8 px-5 py-4 md:px-7">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15 ring-1 ring-sky-400/20">
                  <KeyRound className="h-5 w-5 text-sky-300" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-300/80">Student Created</p>
                  <h3 className="text-lg font-semibold text-white">Credentials ready to share</h3>
                </div>
              </div>
              <button
                onClick={() => setCredModal(null)}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/5 hover:text-white"
                aria-label="Close credentials panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-0 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6 px-5 py-6 md:px-7 md:py-7">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-sky-300">
                      Roll No. {credModal.studentId}
                    </span>
                    {credModal.className && (
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium text-white/75">
                        {credModal.className}
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Student account has been created for</p>
                    <h2 className="mt-1 text-3xl font-serif font-bold text-white md:text-4xl">{credModal.name}</h2>
                  </div>
                  <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                    Share these credentials privately with the student. They can use them to sign in for the first time and should change the password immediately after login.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Student ID</p>
                    <p className="mt-2 break-all font-mono text-lg font-semibold text-sky-300">{credModal.studentId}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Username</p>
                    <p className="mt-2 break-all font-mono text-lg font-semibold text-white">{credModal.username}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 shadow-inner shadow-black/20">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Password</p>
                    <p className="mt-2 break-all font-mono text-lg font-semibold text-emerald-300">{credModal.password}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-amber-500/15 bg-amber-500/8 px-4 py-3 text-sm text-amber-100/90">
                  <strong className="font-semibold">Important:</strong> keep these credentials secure and prompt the student to change the password on first login.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button
                    variant="outline"
                    className="h-11 flex-1 gap-2 border-white/10 bg-white/5 text-white hover:bg-white/10 hover:text-white"
                    onClick={() => handleCopy(`Student ID: ${credModal.studentId}\nName: ${credModal.name}\nClass: ${credModal.className ?? "N/A"}\nUsername: ${credModal.username}\nPassword: ${credModal.password}`)}
                  >
                    {copied ? <><Check className="h-4 w-4 text-emerald-400" />Copied!</> : <><Copy className="h-4 w-4" />Copy details</>}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 flex-1 gap-2 border-sky-500/20 bg-sky-500/10 text-sky-200 hover:bg-sky-500/15 hover:text-white"
                    onClick={() => printCredentialSlip(credModal)}
                  >
                    <Printer className="h-4 w-4" />
                    Print slip
                  </Button>
                </div>
              </div>

              <div className="border-t border-white/8 bg-black/20 px-5 py-6 lg:border-l lg:border-t-0 md:px-7 md:py-7">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Preview</p>
                    <h4 className="text-sm font-medium text-white">Student ID card</h4>
                  </div>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                  <div className="flex justify-center">
                    <IdCard
                      type="student"
                      name={credModal.name}
                      idNumber={credModal.studentId}
                      subtitle={credModal.className}
                      meta={[{ label: "Username", value: credModal.username }]}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-white/8 px-5 py-4 md:px-7">
              <Button className="h-11 min-w-28 bg-sky-500 text-slate-950 hover:bg-sky-400" onClick={() => setCredModal(null)}>
                Done
              </Button>
            </div>
          </div>
        </div>)}

      {/* Edit Student Dialog */}
      {editStudent && isAdmin && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full shadow-2xl my-8">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2"><Pencil className="w-4 h-4 text-sky-400"/>Edit Student</h3>
              <button onClick={() => setEditStudent(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4"/></button>
            </div>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex items-center gap-4 border-b pb-3">
                <Avatar className="h-16 w-16 ring-2 ring-primary/20 relative">
                <AvatarImage src={editForm.avatarUrl} />
                <AvatarFallback>{isEditUploading ? "…" : editForm.name?.charAt(0)?.toUpperCase() || "S"}</AvatarFallback>
                {isEditUploading && <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center"><Upload className="w-5 h-5 animate-pulse" /></div>}
              </Avatar>
                <div>
                  <Label className="text-xs">Profile Image</Label>
                   <Input
                  type="file"
                  accept="image/*"
                  disabled={isEditUploading}
                  onChange={(e) => handleAvatarUpload(e, true)}
                />
                </div>
              </div>
              <div>
                <Label>Full Name *</Label>
                <Input className="mt-1" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Class *</Label>
                  <Select value={editForm.classId} onValueChange={v => setEditForm(f => ({ ...f, classId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select class"/></SelectTrigger>
                    <SelectContent className="max-h-60 overflow-y-auto">{classes.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Gender *</Label>
                  <Select value={editForm.gender} onValueChange={v => setEditForm(f => ({ ...f, gender: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                    </Select>
                  </div>
                </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Admission Date *</Label>
                  <Popover open={editAdmissionDateOpen} onOpenChange={setEditAdmissionDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="mt-1 w-full justify-between text-left font-normal"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                          {editForm.admissionDate ? (
                            <span>{format(new Date(`${editForm.admissionDate}T00:00:00`), "dd MMM yyyy")}</span>
                          ) : (
                            <span className="text-muted-foreground">Select admission date</span>
                          )}
                        </div>
                        <CalendarDays className="h-4 w-4 opacity-50 shrink-0" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 overflow-hidden rounded-xl shadow-xl border border-border z-50" align="start" side="bottom" sideOffset={6} avoidCollisions={true}>
                      <div className="bg-primary/5 border-b px-4 py-3">
                        <p className="text-sm font-medium">Admission Date</p>
                        <p className="text-xs text-muted-foreground">Pick the student&apos;s admission date</p>
                      </div>
                      <div className="p-4 flex justify-center">
                        <Calendar
                          mode="single"
                          selected={editForm.admissionDate ? new Date(`${editForm.admissionDate}T00:00:00`) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, "0");
                              const day = String(date.getDate()).padStart(2, "0");
                              setEditForm((f) => ({ ...f, admissionDate: `${year}-${month}-${day}` }));
                              setEditAdmissionDateOpen(false);
                            }
                          }}
                          initialFocus
                          className="rounded-md"
                        />
                      </div>
                      <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-end">
                        <Button size="sm" onClick={() => setEditAdmissionDateOpen(false)} disabled={!editForm.admissionDate}>
                          Done
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Date of Birth</Label>
                  <Input type="date" className="mt-1" value={editForm.dateOfBirth} onChange={e => setEditForm(f => ({ ...f, dateOfBirth: e.target.value }))}/>
                </div>
                <div>
                  <Label>Roll Number</Label>
                  <Input className="mt-1" value={editForm.rollNumber} onChange={e => setEditForm(f => ({ ...f, rollNumber: e.target.value }))}/>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone</Label>
                  <Input type="tel" className="mt-1" value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value.replace(/[^0-9+\-\s()]/g, "") }))}/>
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" className="mt-1" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}/>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-3 text-muted-foreground">Parent / Guardian</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Parent Name</Label>
                    <Input className="mt-1" value={editForm.parentName} onChange={e => setEditForm(f => ({ ...f, parentName: e.target.value }))}/>
                  </div>
                  <div>
                    <Label>Parent Phone</Label>
                    <Input type="tel" className="mt-1" value={editForm.parentPhone} onChange={e => setEditForm(f => ({ ...f, parentPhone: e.target.value.replace(/[^0-9+\-\s()]/g, "") }))}/>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => { setEditStudent(null); setEditAdmissionDateOpen(false); }}>Cancel</Button>
              <Button className="flex-1" disabled={!editForm.name || !editForm.classId || updateMutation.isPending} onClick={() => updateMutation.mutate({ id: editStudent.id, data: { name: editForm.name, classId: parseInt(editForm.classId), gender: editForm.gender, admissionDate: editForm.admissionDate || undefined, dateOfBirth: editForm.dateOfBirth || undefined, rollNumber: editForm.rollNumber || undefined, phone: editForm.phone || undefined, email: editForm.email || undefined, parentName: editForm.parentName || undefined, parentPhone: editForm.parentPhone || undefined, avatarUrl: editForm.avatarUrl || undefined } })}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>)}

      <Card className="glass-card border-t-2 border-t-sky-400/30">
        <CardContent className="p-4">
          <DataTable data={scopedStudents} columns={columns} rowKey={(s) => s.id} isLoading={isLoading} searchPlaceholder="Search by name, roll, class, parent..." searchKeys={["name", "rollNumber", "className", "parentName", "email"]} filters={[
            {
                key: "class",
                placeholder: "All Classes",
                value: filterClass,
                onChange: setFilterClass,
                options: classes.map((c) => ({ value: String(c.id), label: c.name })),
                predicate: (s, v) => String(s.classId) === v,
                width: "w-40",
                contentClassName: "max-h-60 overflow-y-auto",
            },
        ]} onRowClick={(s) => setLocation(`/students/${s.id}`)} rowClassName={() => "hover:bg-sky-500/5"} emptyTitle="No students found" emptyDescription="Try adjusting your search or filters."/>
        </CardContent>
      </Card>
    </div>);
}
