import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { useListStaff, useCreateStaff, useUpdateStaff, useDeleteStaff, getListStaffQueryKey } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, KeyRound, Copy, CheckCircle, Eye, Users, Upload, FileText, X, AlertCircle, Loader2, Calendar } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { IdCard } from "@/components/id-card";
import { DataTable } from "@/components/ui/data-table";
import { ProfileHoverCard } from "@/components/profile-hover-card";
import { readProfilePhotoAsDataUrl } from "@/lib/profile-photo";

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

const defaultForm = {
  name: "",
  role: "teacher",
  department: "",
  email: "",
  phone: "",
  dob: "",
  qualification: "",
  salary: "",
  yearsOfExperience: "",
  joinDate: new Date().toISOString().split("T")[0],
  avatarUrl: "",
};

// ─── Validation Functions ──────────────────────────────────────────────────────
const validateName = (name) => {
  const cleaned = name.replace(/[^A-Za-z\s]/g, '');
  if (cleaned !== name) return { valid: false, message: "Only letters and spaces are allowed" };
  if (cleaned.length < 2) return { valid: false, message: "Name must be at least 2 characters" };
  if (cleaned.length > 50) return { valid: false, message: "Name cannot exceed 50 characters" };
  return { valid: true, message: "" };
};

const validateEmail = (email) => {
  if (!email) return { valid: false, message: "Email is required" };
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/;
  if (!emailRegex.test(email)) {
    return { valid: false, message: "Please enter a valid email address (e.g., name@domain.com)" };
  }
  return { valid: true, message: "" };
};

const validatePhone = (phone) => {
  if (!phone) return { valid: true, message: "" };
  const phoneRegex = /^[6-9]\d{9}$/;
  if (!phoneRegex.test(phone)) {
    return { valid: false, message: "Phone must be exactly 10 digits starting with 6, 7, 8, or 9" };
  }
  return { valid: true, message: "" };
};

const validateDOB = (dob) => {
  if (!dob) return { valid: false, message: "Date of birth is required" };

  const dobDate = new Date(dob);
  const today = new Date();
  const age = today.getFullYear() - dobDate.getFullYear();
  const monthDiff = today.getMonth() - dobDate.getMonth();

  // Calculate exact age
  let exactAge = age;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dobDate.getDate())) {
    exactAge -= 1;
  }

  if (exactAge < 18) {
    return { valid: false, message: "Staff must be at least 18 years old" };
  }

  if (exactAge > 65) {
    return { valid: false, message: "Staff must be under 65 years old" };
  }

  return { valid: true, message: "" };
};

const validateQualification = (qualification) => {
  if (!qualification || qualification.trim() === "") {
    return { valid: false, message: "Qualification is required" };
  }
  return { valid: true, message: "" };
};

const validateSalary = (salary) => {
  if (!salary || salary.trim() === "") {
    return { valid: false, message: "Monthly Salary is required" };
  }
  const num = Number(salary);
  if (isNaN(num) || num <= 0) {
    return { valid: false, message: "Please enter a valid salary amount" };
  }
  return { valid: true, message: "" };
};

const validateYearsOfExperience = (years) => {
  if (!years || years.trim() === "") {
    return { valid: false, message: "Years of experience is required" };
  }
  const num = Number(years);
  if (isNaN(num) || num < 0) {
    return { valid: false, message: "Please enter a valid number" };
  }
  return { valid: true, message: "" };
};

// ─── Email Duplication Check ──────────────────────────────────────────────────
const checkEmailExists = async (email, excludeId = null) => {
  try {
    console.log(`[Frontend] Checking email: ${email}`);

    const response = await fetch("/api/staff/check-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        excludeId: excludeId || null,
        excludeTable: 'staff'
      }),
    });

    console.log(`[Frontend] Response status: ${response.status}`);

    // Handle non-OK responses
    if (!response.ok) {
      console.error(`[Frontend] Email check failed with status: ${response.status}`);

      let errorMessage = "Unable to verify email. Please try again.";
      try {
        const errorData = await response.json();
        if (errorData.message) {
          errorMessage = errorData.message;
        }
      } catch (parseErr) {
        console.error("[Frontend] Could not parse error response:", parseErr);
      }

      return {
        available: true,
        message: null
      };
    }

    const result = await response.json();
    console.log("[Frontend] Email check result:", result);

    return {
      available: result.available ?? true,
      message: result.message || null,
      table: result.table || null,
      tableLabel: result.tableLabel || null
    };
  } catch (error) {
    console.error("[Frontend] Email check network error:", error);
    return {
      available: true,
      message: null
    };
  }
};

// ─── Main Component ──────────────────────────────────────────────────────────
export default function Staff() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [, setLocation] = useLocation();
  const [filterRole, setFilterRole] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [createdInfo, setCreatedInfo] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingStaffPhotoId, setUploadingStaffPhotoId] = useState(null);

  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [emailAvailable, setEmailAvailable] = useState(false);
  const filesInputRef = useRef(null);

  const [validationErrors, setValidationErrors] = useState({
    name: "",
    email: "",
    phone: "",
    dob: "",
    qualification: "",
    salary: "",
    yearsOfExperience: "",
  });

  const { data: staff = [], isLoading } = useListStaff({}, { query: { queryKey: getListStaffQueryKey(), staleTime: 15000 } });

  const createMutation = useCreateStaff({
    mutation: {
      onSuccess: async (created) => {
        qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
        const creds = created?.credentials;
        if (!creds) {
          toast({ title: "Staff added", description: `${form.name} has been added.` });
          setForm(defaultForm);
          setPendingFiles([]);
          setAddOpen(false);
          setEmailAvailable(false);
          setValidationErrors({
            name: "",
            email: "",
            phone: "",
            dob: "",
            qualification: "",
            salary: "",
            yearsOfExperience: "",
          });
          return;
        }

        if (pendingFiles.length > 0) {
          setUploading(true);
          let failed = 0;
          for (const f of pendingFiles) {
            const fd = new FormData();
            fd.append("file", f);
            fd.append("label", f.name);
            const res = await fetch(`/api/staff/${created.id}/documents`, {
              method: "POST", body: fd, credentials: "include",
            }).catch(() => null);
            if (!res || !res.ok) failed += 1;
          }
          setUploading(false);
          if (failed > 0) {
            toast({ title: `${failed} document(s) failed to upload`, variant: "destructive" });
          } else if (pendingFiles.length > 0) {
            toast({ title: `Uploaded ${pendingFiles.length} document(s)` });
          }
        }
        setCreatedInfo({
          id: created.id,
          staffId: creds.staffId,
          username: creds.username,
          password: creds.password,
          name: form.name,
          role: form.role,
          department: form.department,
          avatarUrl: created.avatarUrl ?? form.avatarUrl ?? "",
        });
        setForm(defaultForm);
        setPendingFiles([]);
        setEmailAvailable(false);
        setValidationErrors({
          name: "",
          email: "",
          phone: "",
          dob: "",
          qualification: "",
          salary: "",
          yearsOfExperience: "",
        });
      },
      onError: (err) => {
        toast({
          title: "Failed to create staff",
          description: err?.message ?? "Check name, email and department are filled.",
          variant: "destructive",
        });
      },
    },
  });

  const updateMutation = useUpdateStaff({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListStaffQueryKey() }); toast({ title: "Staff updated" }); },
      onError: (err) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
    },
  });

  const deleteMutation = useDeleteStaff({
    mutation: {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListStaffQueryKey() }); toast({ title: "Staff removed" }); },
      onError: (err) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
    },
  });

  const isAdmin = user?.role === "admin";
  const handleStaffPhotoChange = async (staffMember, file, resetInput) => {
    if (!file) return;
    setUploadingStaffPhotoId(staffMember.id);
    try {
      const avatarUrl = await readProfilePhotoAsDataUrl(file);
      updateMutation.mutate({
        id: staffMember.id,
        data: { avatarUrl },
      });
    } catch (err) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingStaffPhotoId(null);
      if (resetInput) resetInput();
    }
  };
  // ─── Email Validation with Duplicate Check ──────────────────────────────────
  const handleEmailChange = async (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, email: value }));
    setEmailAvailable(false);

    // Validate email format first
    const validation = validateEmail(value);
    setValidationErrors((prev) => ({ ...prev, email: validation.message }));

    // If email format is invalid or empty, don't check for duplicates
    if (!validation.valid || !value) {
      return;
    }

    // Check for duplicates
    setIsCheckingEmail(true);
    const result = await checkEmailExists(value);
    setIsCheckingEmail(false);

    if (!result.available && result.message) {
      setValidationErrors((prev) => ({
        ...prev,
        email: result.message
      }));
      setEmailAvailable(false);
    } else if (result.available) {
      setValidationErrors((prev) => ({ ...prev, email: "" }));
      setEmailAvailable(true);
    } else {
      setEmailAvailable(true);
    }
  };

  const handleNameChange = (e) => {
    const value = e.target.value;
    const cleaned = value.replace(/[^A-Za-z\s]/g, '');
    setForm((f) => ({ ...f, name: cleaned }));
    const validation = validateName(cleaned);
    setValidationErrors((prev) => ({ ...prev, name: validation.message }));
  };

  const handlePhoneChange = (e) => {
    const value = e.target.value.replace(/\D/g, '');
    const limited = value.slice(0, 10);
    setForm((f) => ({ ...f, phone: limited }));
    const validation = validatePhone(limited);
    setValidationErrors((prev) => ({ ...prev, phone: validation.message }));
  };

  const handleDOBChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, dob: value }));
    const validation = validateDOB(value);
    setValidationErrors((prev) => ({ ...prev, dob: validation.message }));
  };

  const handleQualificationChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, qualification: value }));
    const validation = validateQualification(value);
    setValidationErrors((prev) => ({ ...prev, qualification: validation.message }));
  };

  const handleSalaryChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, salary: value }));
    const validation = validateSalary(value);
    setValidationErrors((prev) => ({ ...prev, salary: validation.message }));
  };

  const handleYearsOfExperienceChange = (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, yearsOfExperience: value }));
    const validation = validateYearsOfExperience(value);
    setValidationErrors((prev) => ({ ...prev, yearsOfExperience: validation.message }));
  };

  const isFormValid = () => {
    const nameValid = validateName(form.name).valid;
    const emailValid = validateEmail(form.email).valid && emailAvailable;
    const phoneValid = validatePhone(form.phone).valid;
    const dobValid = validateDOB(form.dob).valid;
    const qualificationValid = validateQualification(form.qualification).valid;
    const salaryValid = validateSalary(form.salary).valid;
    const yearsValid = validateYearsOfExperience(form.yearsOfExperience).valid;

    return nameValid && emailValid && phoneValid && dobValid && qualificationValid && salaryValid && yearsValid && form.department;
  };

  const getEmailStatusIcon = () => {
    if (isCheckingEmail) return <Loader2 className="w-4 h-4 animate-spin text-blue-400" />;
    if (validationErrors.email) return <AlertCircle className="w-4 h-4 text-red-500" />;
    if (emailAvailable && form.email) return <CheckCircle className="w-4 h-4 text-green-500" />;
    return null;
  };

  const getEmailStatusText = () => {
    if (isCheckingEmail) return "Checking availability...";
    if (validationErrors.email) return validationErrors.email;
    if (emailAvailable && form.email) return "✓ Email is available";
    return null;
  };

  const columns = [
    {
      key: "staff",
      header: "Staff Member",
      cell: (s) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 ring-1 ring-border group-hover:ring-purple-400/40 transition-all">
            <AvatarImage src={s.avatarUrl || ""} />
            <AvatarFallback className="bg-purple-500/10 text-purple-400 text-xs font-semibold">
              {s.name?.charAt(0)?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="font-medium text-sm">
            <ProfileHoverCard kind={s.role === "teacher" ? "teacher" : "staff"} id={s.id} name={s.name} />
          </div>
        </div>
      ),
    },
    { key: "staffId", header: "Staff ID", cell: (s) => <span className="text-xs font-mono text-purple-400">{s.staffId ?? "—"}</span> },
    { key: "role", header: "Role", cell: (s) => <span className="capitalize text-sm">{s.role?.replace(/_/g, " ")}</span> },
    { key: "dept", header: "Department", cell: (s) => <span className="text-sm">{s.department}</span> },
    { key: "email", header: "Email", cell: (s) => <span className="text-sm text-muted-foreground">{s.email}</span> },
    {
      key: "status",
      header: "Status",
      cell: (s) => (
        <Badge variant="outline" className={s.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-muted text-muted-foreground"}>
          {s.status}
        </Badge>
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (s) => (
        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-purple-500/10 hover:text-purple-400" onClick={() => setLocation(`/staff/${s.id}`)}>
            <Eye className="h-4 w-4" />
          </Button>
          {isAdmin && (
            <Button asChild size="icon" variant="ghost" className="h-8 w-8 hover:bg-sky-500/10 hover:text-sky-400" disabled={uploadingStaffPhotoId === s.id || updateMutation.isPending}>
              <label title="Update profile photo">
                <Upload className={`h-4 w-4 ${uploadingStaffPhotoId === s.id ? "animate-pulse" : ""}`} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingStaffPhotoId === s.id || updateMutation.isPending}
                  onChange={(e) => handleStaffPhotoChange(s, e.target.files?.[0], () => { e.target.value = ""; })}
                />
              </label>
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="ghost" className="text-xs text-muted-foreground" disabled={updateMutation.isPending} onClick={() => updateMutation.mutate({
              id: s.id,
              data: { status: s.status === "active" ? "inactive" : "active" },
            })}>
              {s.status === "active" ? "Deactivate" : "Activate"}
            </Button>
          )}
          {isAdmin && (
            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-red-500/10 hover:text-red-400" disabled={deleteMutation.isPending} onClick={() => { if (confirm(`Remove ${s.name}?`)) deleteMutation.mutate({ id: s.id }); }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: "Copied to clipboard" }));
  };

  const addFiles = (list) => {
    if (!list) return;
    const next = Array.from(list).filter((f) => f.size <= 10 * 1024 * 1024);
    if (next.length !== list.length) {
      toast({ title: "Some files were skipped (max 10MB each)", variant: "destructive" });
    }
    setPendingFiles((cur) => [...cur, ...next]);
    if (filesInputRef.current) filesInputRef.current.value = "";
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-purple-400">Staff</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage staff directory and employment records · {staff.length} members
          </p>
        </div>
        {isAdmin && (
          <Dialog open={addOpen} onOpenChange={(o) => {
            setAddOpen(o);
            if (!o) {
              setCreatedInfo(null);
              setPendingFiles([]);
              setEmailAvailable(false);
              setValidationErrors({
                name: "",
                email: "",
                phone: "",
                dob: "",
                qualification: "",
                salary: "",
                yearsOfExperience: "",
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2" data-testid="button-add-staff">
                <Plus className="w-4 h-4" />
                Add Staff
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {createdInfo ? "Staff Member Created" : "Add New Staff Member"}
                </DialogTitle>
              </DialogHeader>

              {createdInfo ? (
                <div className="space-y-4 py-2">
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-5 h-5 text-emerald-400" />
                      <p className="font-medium text-emerald-400">Account Created</p>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Share these credentials securely. The password is shown only once.
                    </p>
                    <div className="space-y-3">
                      {[
                        { label: "Staff ID", value: createdInfo.staffId },
                        { label: "Username", value: createdInfo.username },
                        { label: "Password", value: createdInfo.password },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between p-3 bg-muted rounded-md">
                          <div>
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <p className="font-mono font-medium" data-testid={`text-${item.label.toLowerCase().replace(/\s/g, "-")}`}>{item.value}</p>
                          </div>
                          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => copyToClipboard(item.value)}>
                            <Copy className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="pt-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Staff ID Card</p>
                    <IdCard type="staff" name={createdInfo.name} idNumber={createdInfo.staffId} subtitle={`${createdInfo.role.replace(/_/g, " ")} · ${createdInfo.department}`} photoUrl={createdInfo.avatarUrl} meta={[{ label: "Username", value: createdInfo.username }]} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={() => { setAddOpen(false); setCreatedInfo(null); }}>
                      Done
                    </Button>
                    <Button onClick={() => setLocation(`/staff/${createdInfo.id}`)}>
                      View Profile
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-2">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Personal</p>
                    <div className="flex items-center gap-4 border-b pb-3 mb-3">
                      <Avatar className="h-16 w-16 ring-2 ring-primary/20">
                        <AvatarImage src={form.avatarUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                          {form.name?.charAt(0)?.toUpperCase() || "S"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <Label className="text-xs">Profile Image</Label>
                        <Input type="file" accept="image/*" className="mt-1 max-w-xs cursor-pointer" onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          try {
                            const avatarUrl = await readProfilePhotoAsDataUrl(file);
                            setForm(f => ({ ...f, avatarUrl }));
                            toast({ title: "Image added" });
                          } catch (err) {
                            toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                          } finally {
                            setUploading(false);
                            e.target.value = "";

                          }
                        }} />
                      </div>
                    </div>

                    <div>
                      <Label>Full Name *</Label>
                      <Input
                        className="mt-1"
                        value={form.name}
                        onChange={handleNameChange}
                        placeholder="Staff member's full name"
                        data-testid="input-name"
                      />
                      {validationErrors.name && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.name}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-3">
                      <div>
                        <Label>Email *</Label>
                        <div className="relative">
                          <Input
                            type="email"
                            className={`mt-1 ${validationErrors.email ? 'border-red-500 pr-10' : emailAvailable && form.email ? 'border-green-500 pr-10' : 'pr-10'}`}
                            value={form.email}
                            onChange={handleEmailChange}
                            data-testid="input-email"
                            placeholder="name@domain.com"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            {getEmailStatusIcon()}
                          </div>
                        </div>
                        {getEmailStatusText() && (
                          <p className={`text-xs mt-1 flex items-center gap-1 ${validationErrors.email ? 'text-red-500' : emailAvailable && form.email ? 'text-green-500' : 'text-blue-500'}`}>
                            {isCheckingEmail && <Loader2 className="w-3 h-3 animate-spin" />}
                            {!isCheckingEmail && validationErrors.email && <AlertCircle className="w-3 h-3" />}
                            {!isCheckingEmail && !validationErrors.email && emailAvailable && form.email && <CheckCircle className="w-3 h-3" />}
                            {getEmailStatusText()}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          className="mt-1"
                          value={form.phone}
                          onChange={handlePhoneChange}
                          placeholder="Enter 10 digit number"
                          maxLength={10}
                        />
                        {validationErrors.phone && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.phone}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <Label>Date of Birth *</Label>
                      <div className="relative">
                        <Input
                          type="date"
                          className={`mt-1 ${validationErrors.dob ? 'border-red-500' : ''}`}
                          value={form.dob}
                          onChange={handleDOBChange}
                          max={new Date(new Date().setFullYear(new Date().getFullYear() - 18)).toISOString().split("T")[0]}
                          min={new Date(new Date().setFullYear(new Date().getFullYear() - 65)).toISOString().split("T")[0]}
                        />
                        <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                      </div>
                      {validationErrors.dob && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.dob}
                        </p>
                      )}
                      {!validationErrors.dob && form.dob && (
                        <p className="text-xs text-green-500 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Age: {new Date().getFullYear() - new Date(form.dob).getFullYear()} years
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Professional</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Role *</Label>
                        <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {STAFF_ROLES.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Department *</Label>
                        <Select value={form.department} onValueChange={(v) => setForm((f) => ({ ...f, department: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                          <SelectContent>
                            {DEPARTMENTS.map((d) => (
                              <SelectItem key={d} value={d}>{d}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="mt-3">
                      <Label>Qualification *</Label>
                      <Input
                        className="mt-1"
                        value={form.qualification}
                        onChange={handleQualificationChange}
                        placeholder="e.g. B.Ed, M.Sc"
                      />
                      {validationErrors.qualification && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {validationErrors.qualification}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                      <div>
                        <Label>Monthly Salary (₹) *</Label>
                        <Input
                          type="number"
                          className="mt-1"
                          value={form.salary}
                          onChange={handleSalaryChange}
                          placeholder="Enter amount"
                          min="0"
                        />
                        {validationErrors.salary && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.salary}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Years of Exp. *</Label>
                        <Input
                          type="number"
                          min="0"
                          className="mt-1"
                          value={form.yearsOfExperience}
                          onChange={handleYearsOfExperienceChange}
                          placeholder="e.g. 5"
                        />
                        {validationErrors.yearsOfExperience && (
                          <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {validationErrors.yearsOfExperience}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label>Join Date *</Label>

                        <Input
                          type="date"
                          className="mt-1"
                          value={form.joinDate}
                          min={new Date().toISOString().split("T")[0]}
                          onChange={(e) => {
                            setForm((f) => ({
                              ...f,
                              joinDate: e.target.value,
                            }));
                          }}
                          onKeyDown={(e) => e.preventDefault()} // Disable manual typing
                          onPaste={(e) => e.preventDefault()} // Disable paste
                          style={{
                            colorScheme: "dark", // White calendar icon in dark mode
                            cursor: "pointer",
                            minHeight: "44px",
                          }}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Certificates &amp; ID Proofs
                      </p>
                      <input ref={filesInputRef} type="file" multiple className="hidden" onChange={(e) => addFiles(e.target.files)} />
                      <Button type="button" size="sm" variant="outline" className="gap-2 h-7" onClick={() => filesInputRef.current?.click()}>
                        <Upload className="w-3 h-3" /> Attach
                      </Button>
                    </div>
                    {pendingFiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Optional — up to 10MB each. Uploaded after the account is created.
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        {pendingFiles.map((f, i) => (
                          <div key={i} className="flex items-center gap-2 p-2 rounded border border-border/40 text-xs">
                            <FileText className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span className="flex-1 truncate">{f.name}</span>
                            <span className="text-muted-foreground">{(f.size / 1024).toFixed(0)}KB</span>
                            <Button type="button" size="icon" variant="ghost" className="h-5 w-5" onClick={() => setPendingFiles((cur) => cur.filter((_, j) => j !== i))}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                    <div className="flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-blue-400" />
                      <p className="text-xs text-blue-400">
                        Staff ID, username and password are auto-generated by the server.
                      </p>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    data-testid="button-create-staff"
                    disabled={!isFormValid() || createMutation.isPending || uploading || isCheckingEmail}
                    onClick={() => {
                      const createData = {
                        name: form.name,
                        role: form.role,
                        department: form.department,
                        email: form.email,
                        phone: form.phone || undefined,
                        dob: form.dob,
                        qualification: form.qualification || undefined,
                        salary: form.salary ? Number(form.salary) : undefined,
                        yearsOfExperience: form.yearsOfExperience ? Number(form.yearsOfExperience) : undefined,
                        joinDate: form.joinDate,
                        avatarUrl: form.avatarUrl || undefined,
                      };
                      console.log("[Frontend] Creating staff with data:", createData);
                      createMutation.mutate({ data: createData });
                    }}
                  >
                    {createMutation.isPending
                      ? "Creating…"
                      : uploading
                        ? "Uploading documents…"
                        : isCheckingEmail
                          ? "Checking email…"
                          : "Create Staff Member"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {STAFF_ROLES.slice(0, 4).map(({ value, label }) => (
          <Card key={value} className="glass-card glass-hover border-t-2 border-t-purple-400/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-purple-400">
                  {staff.filter((s) => s.role === value).length}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-t-2 border-t-purple-400/30">
        <CardContent className="pt-4">
          <DataTable
            data={staff}
            columns={columns}
            isLoading={isLoading}
            rowKey={(s) => s.id}
            onRowClick={(s) => setLocation(`/staff/${s.id}`)}
            rowClassName={() => "cursor-pointer hover:bg-purple-500/5 transition-colors border-border/40 group"}
            searchKeys={["name", "department", "role", (s) => s.staffId]}
            searchPlaceholder="Search staff…"
            emptyTitle="No staff found."
            filters={[
              {
                key: "role",
                placeholder: "All roles",
                value: filterRole,
                onChange: setFilterRole,
                options: STAFF_ROLES.map((r) => ({ value: r.value, label: r.label })),
                predicate: (s, v) => s.role === v,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}