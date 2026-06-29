import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useGetStudent, useGetStaff, useListStaff, useListVendors, useUpdateVendor, getListVendorsQueryKey, getGetCurrentUserQueryKey, getListStudentsQueryKey, getListStaffQueryKey } from "@/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { readProfilePhotoAsDataUrl } from "@/lib/profile-photo";
import { Link } from "wouter";
import { User, Mail, Phone, Calendar, Shield, Building, Award, Users, CreditCard, FileText, CheckCircle, Edit, MapPin, Trash2, Download, File, BookOpen } from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openEdit, setOpenEdit] = useState(false);

  // Queries depending on role
  // Role checks - Define ALL first
  const role = user?.role ?? "";

  const isStudent = role === "student";
  const isParent = role === "parent";
  const isVendor = role === "vendor";
  const isAdmin = role === "admin";
  const isStaff = [
  "teacher", "clerk", "librarian", "hostel_warden", "accountant",
  "transport_manager", "driver", "store_manager", "admin"
].includes(user?.role ?? "");
  

  const { data: student, isLoading: studentLoading } = useGetStudent(user?.studentId ?? 0, {
    query: { enabled: isStudent && !!user?.studentId, staleTime: 30000 }
  });

  const { data: staffList = [], isLoading: staffLoading } = useListStaff({
    query: { enabled: isStaff, staleTime: 30000 }
  });

  const { data: vendorsList = [], isLoading: vendorLoading } = useListVendors({
    query: { enabled: isVendor, staleTime: 30000 }
  });

  const updateVendorMutation = useUpdateVendor({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
        setOpenEdit(false);
        toast({ title: "Profile updated successfully!" });
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err?.message || "Please check your inputs.", variant: "destructive" });
      }
    }
  });

  // Find exact records
  const matchedStaff = isStaff ? staffList.find(s => s.userId === user?.id || s.email === user?.email) : null;
  const matchedVendor = isVendor ? vendorsList.find(v => v.userId === user?.id || v.email === user?.email) : null;
  const { data: staffProfile, isLoading: staffProfileLoading } = useGetStaff(matchedStaff?.id ?? 0, {
    query: { enabled: isStaff && !!matchedStaff?.id, staleTime: 30000 }
  });
  const activeStaff = staffProfile ?? matchedStaff;

  // Edit fields state
  const [editForm, setEditForm] = useState({
    contactPerson: matchedVendor?.contactPerson ?? "",
    phone: matchedVendor?.phone ?? "",
    address: matchedVendor?.address ?? "",
    bankAccount: matchedVendor?.bankAccount ?? "",
  });

  const handleOpenEdit = () => {
    if (matchedVendor) {
      setEditForm({
        contactPerson: matchedVendor.contactPerson || "",
        phone: matchedVendor.phone || "",
        address: matchedVendor.address || "",
        bankAccount: matchedVendor.bankAccount || "",
      });
    }
    setOpenEdit(true);
  };

  const handleSaveVendorProfile = () => {
    if (!matchedVendor) return;
    updateVendorMutation.mutate({
      id: matchedVendor.id,
      data: {
        contactPerson: editForm.contactPerson,
        phone: editForm.phone,
        address: editForm.address,
        bankAccount: editForm.bankAccount,
      }
    });
  };

  // Remove profile picture handler
  const handleRemovePhoto = async () => {
    if (!user?.avatarUrl) return;

    try {
      const profileRes = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });

      if (profileRes.ok) {
        const updatedUser = await profileRes.json();
        qc.setQueryData(getGetCurrentUserQueryKey(), updatedUser);
        qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
        qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
        qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
        toast({ title: "Profile picture removed successfully!" });
      } else {
        toast({ title: "Failed to remove profile picture", variant: "destructive" });
      }
    } catch {
      toast({ title: "Remove failed", variant: "destructive" });
    }
  };

  // Safe document parser
  const parseDocuments = (docs) => {
    if (!docs) return [];
    if (Array.isArray(docs)) return docs;
    if (typeof docs === "string") {
      try {
        const parsed = JSON.parse(docs);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };

  const { data: profileDocuments = [] } = useQuery({
    queryKey: ["auth", "documents"],
    queryFn: async () => {
      const res = await fetch("/api/auth/documents", { credentials: "include" });
      if (!res.ok) {
        throw new Error("Failed to load documents");
      }
      return res.json();
    },
    staleTime: 30_000,
  });

  const allDocuments = profileDocuments.map((doc) => ({
    ...doc,
    uniqueKey: `${doc.source ?? "legacy"}-${doc.ownerId ?? "self"}-${doc.id}`,
  }));
 const openDocumentBlob = async (url, action = "open", fileName = "document.pdf") => {
  if (!url || url === "#") {
    toast({ title: "Invalid document URL", variant: "destructive" });
    return;
  }

  try {
    const response = await fetch(url, { 
      credentials: "include"   // Important for auth
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);

    if (action === "download") {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 100);
      return;
    }

    const tab = window.open(downloadUrl, "_blank", "noopener,noreferrer");
    if (!tab) {
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
    window.setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 10_000);
  } catch (err) {
    console.error(err);
    toast({
      title: "Document open failed",
      description: "Please try again.",
      variant: "destructive",
    });
  }
};
// Helper to get correct download/view URL
const getDocumentAccessUrl = (doc) => {
  if (!doc?.id) return "#";

  if (doc.source === "student" && doc.ownerId) {
    return `/api/students/${doc.ownerId}/documents/${doc.id}/download`;
  }

  if (doc.source === "staff" && doc.ownerId) {
    return `/api/staff/${doc.ownerId}/documents/${doc.id}/download`;
  }

  if (doc.url && doc.url.startsWith("http")) {
    return doc.url;
  }

  return `/api/documents/${doc.id}/download`;
};
  // Remove duplicate documents by id + source/owner
  const uniqueDocuments = allDocuments.filter((doc, index, self) =>
    index === self.findIndex(d => d.uniqueKey === doc.uniqueKey)
  );

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground text-sm">Loading user account...</p>
      </div>
    );
  }

  // Choose display name initials
  const initials = user.name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  // Border accents based on role
  const roleColors = {
    admin: "border-t-violet-500 text-violet-400",
    teacher: "border-t-emerald-500 text-emerald-400",
    student: "border-t-cyan-500 text-cyan-400",
    parent: "border-t-orange-500 text-orange-400",
    accountant: "border-t-yellow-500 text-yellow-400",
    clerk: "border-t-teal-500 text-teal-400",
    hostel_warden: "border-t-rose-500 text-rose-400",
    transport_manager: "border-t-blue-500 text-blue-400",
    vendor: "border-t-purple-500 text-purple-400",
  };
  const borderAccent = roleColors[user.role] || "border-t-slate-500 text-slate-400";

  const hasAvatar = !!user.avatarUrl;
  const classTeacherAssignment = activeStaff?.classTeacherAssignment ?? null;
  const hasClassTeacherAssignment = !!classTeacherAssignment;
  const formatAssignedClass = (cls) => {
    if (!cls) return "Not assigned";
    const pieces = [cls.grade, cls.section].filter(Boolean);
    return pieces.length > 0 ? pieces.join("-") : cls.label || `Class ${cls.id}`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div>
        <h1 className="text-2xl font-serif font-bold text-foreground">My Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage and view your school credentials and profile information.</p>
      </div>

      {/* Main Account Details Card */}
      <Card className={`glass-card border-t-2 ${borderAccent.split(" ")[0]} overflow-hidden`}>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="relative group shrink-0">
              <Avatar className="h-24 w-24 ring-2 ring-primary/20">
                <AvatarImage src={user.avatarUrl} />
                <AvatarFallback className="bg-primary/10 text-primary text-3xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Hover Overlay - Update + Remove */}
              <div className="absolute inset-0 bg-black/70 rounded-full flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="flex flex-col items-center gap-2 text-white text-[10px] font-semibold">
                  <label className="flex flex-col items-center cursor-pointer hover:text-primary-foreground transition-colors">
                    <Edit className="w-4 h-4 mb-0.5" />
                    UPDATE PHOTO
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          const avatarUrl = await readProfilePhotoAsDataUrl(file);
                          const profileRes = await fetch("/api/auth/profile", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ avatarUrl }),
                          });
                          const updatedUser = await profileRes.json().catch(() => null);
                          if (profileRes.ok && updatedUser) {
                            qc.setQueryData(getGetCurrentUserQueryKey(), updatedUser);
                            qc.invalidateQueries({ queryKey: getListStudentsQueryKey() });
                            qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
                            qc.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
                            toast({ title: "Profile picture updated!" });
                          } else {
                            toast({ title: "Failed to update profile", description: updatedUser?.error, variant: "destructive" });
                          }
                        } catch (err) {
                          toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                        } finally {
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>

                  {hasAvatar && (
                    <button
                      onClick={handleRemovePhoto}
                      className="flex flex-col items-center hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4 mb-0.5" />
                      REMOVE PHOTO
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h2 className="text-2xl font-serif font-bold text-foreground flex items-center justify-center sm:justify-start gap-2">
                  {user.name}
                  <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold border-primary/20 bg-primary/5 text-primary">
                    {user.role}
                  </Badge>
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">@{user.username}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm pt-2">
                <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{user.email || "No email linked"}</span>
                </div>
                {user.phone && (
                  <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span>{user.phone}</span>
                  </div>
                )}
                <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>Member since {new Date(user.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center justify-center sm:justify-start gap-2 text-muted-foreground">
                  <Shield className="w-4 h-4 shrink-0" />
                  <span className="capitalize">Role privileges: {user.role}</span>
                </div>
              </div>
            </div>

            {isVendor && matchedVendor && (
              <Button onClick={handleOpenEdit} className="sm:self-start gap-2" variant="outline">
                <Edit className="w-4 h-4" /> Edit Profile
              </Button>
            )}
          </div>
        </CardContent>
      </Card>


      {/* Rest of your components remain unchanged */}
      {isStudent && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-cyan-400">
              <Award className="w-5 h-5" /> Student Academic File
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {studentLoading ? (
              <p className="text-muted-foreground text-sm">Fetching student record...</p>
            ) : student ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <Field label="Roll Number" value={<span className="font-mono text-cyan-400">{student.rollNumber}</span>} />
                  <Field label="Current Class" value={student.className || "Not assigned"} />
                  <Field label="Academic Year" value={student.academicYear || "Not available"} />
                  <Field label="Gender" value={student.gender} />
                  <Field label="Date of Birth" value={student.dateOfBirth || "—"} />
                  <Field label="Father/Guardian Name" value={student.parentName || "—"} />
                  <Field label="Parent Phone" value={student.parentPhone || "—"} />
                  <div className="col-span-2">
                    <Field label="Address" value={<span className="flex items-center gap-1"><MapPin className="w-4 h-4 text-muted-foreground" />{student.address || "—"}</span>} />
                  </div>
                </div>
                <div className="mt-6 border-t border-border/40 pt-6 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Academic Metrics Summary</p>
                  <div className="grid grid-cols-2 gap-3 text-center text-xs">
                    <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg">
                      <p className="text-lg font-bold text-cyan-400">Class {student.className || "N/A"}</p>
                      <p className="text-[9px] text-muted-foreground uppercase mt-0.5">Primary Enrollment</p>
                    </div>
                    <div className="p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg">
                      <p className="text-lg font-bold text-emerald-400">Active</p>
                      <p className="text-[9px] text-muted-foreground uppercase mt-0.5">Student Status</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Student academic profile details not found.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ... (All other role-specific cards remain the same) ... */}

      {isStaff && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-400">
              <Building className="w-5 h-5" /> Employment & Staff Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {staffLoading || staffProfileLoading ? (
              <p className="text-muted-foreground text-sm">Loading staff file...</p>
            ) : activeStaff ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <Field label="Staff Registry ID" value={<span className="font-mono text-emerald-400">{activeStaff.staffId}</span>} />
                  <Field label="Assigned Department" value={activeStaff.department} />
                  <Field
                    label="Class Teacher Assignment"
                    value={
                      hasClassTeacherAssignment ? (
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                          {formatAssignedClass(classTeacherAssignment)}{classTeacherAssignment.academicYear ? ` - ${classTeacherAssignment.academicYear}` : ""}
                        </Badge>
                      ) : "No Class Teacher Assignment"
                    }
                    className="sm:col-span-2"
                  />
                  <Field label="Qualification" value={activeStaff.qualification || "—"} />
                  <Field label="Experience" value={`${activeStaff.yearsOfExperience || 0} Years`} />
                  <Field label="Joined Date" value={activeStaff.joinDate} />
                  <Field label="Contract/Employment Status" value={<Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{activeStaff.status}</Badge>} />
                  {activeStaff.performanceNotes && (
                    <div className="col-span-2 border-t border-border/40 pt-3 mt-2">
                      <Field label="Performance/Academic Notes" value={activeStaff.performanceNotes} />
                    </div>
                  )}
                </div>
                {user.role === "teacher" && (
                  <div className="mt-6 border-t border-border/40 pt-6 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Teaching Load</p>
                    {hasClassTeacherAssignment ? (
                      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold text-foreground">{formatAssignedClass(classTeacherAssignment)}</p>
                          <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Academic Year: {classTeacherAssignment.academicYear || "Not available"}
                        </p>
                        {classTeacherAssignment.room && <p className="text-xs text-muted-foreground mt-1">Room: {classTeacherAssignment.room}</p>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No Class Teacher Assignment</p>
                    )}
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground text-sm">No matched staff record found. Please verify with HR.</p>
            )}
          </CardContent>
        </Card>
      )}

      {user.role === "admin" && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-violet-400">
              <Shield className="w-5 h-5" /> Administrator Dashboard Overview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                <p className="text-lg font-bold text-violet-400">System Admin</p>
                <p className="text-[9px] text-muted-foreground uppercase mt-0.5">Privilege Tier</p>
              </div>
              <div className="p-3 bg-fuchsia-500/5 border border-fuchsia-500/20 rounded-lg">
                <p className="text-lg font-bold text-fuchsia-400">Full Access</p>
                <p className="text-[9px] text-muted-foreground uppercase mt-0.5">Data Scope</p>
              </div>
              <div className="p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <p className="text-lg font-bold text-purple-400">Active</p>
                <p className="text-[9px] text-muted-foreground uppercase mt-0.5">Operation Status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isParent && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-orange-400">
              <Users className="w-5 h-5" /> Ward Mapping (Linked Children)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {user.children && user.children.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {user.children.map((child) => (
                  <Card key={child.id} className="border border-border bg-card/40 hover:bg-card/75 transition-colors">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-foreground">{child.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Linked Student ID: {child.id}</p>
                      </div>
                      <Button asChild size="sm" variant="outline" className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10">
                        <Link href={`/students/${child.id}`}>View Ward Detail</Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No child record mappings found on this parent account. Contact the registrar.</p>
            )}
          </CardContent>
        </Card>
      )}

      {isVendor && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-purple-400">
              <CreditCard className="w-5 h-5" /> Vendor Business Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {vendorLoading ? (
              <p className="text-muted-foreground text-sm">Fetching vendor profile...</p>
            ) : matchedVendor ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <Field label="Category" value={matchedVendor.category || "—"} />
                <Field label="GST Registration Number" value={<span className="font-mono text-purple-400">{matchedVendor.gstNumber || "Not Provided"}</span>} />
                <Field label="Primary Contact Person" value={matchedVendor.contactPerson} />
                <Field label="Business Status" value={<Badge variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{matchedVendor.status}</Badge>} />
                <Field label="Contract Renewal Status" value={<Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">{matchedVendor.renewalStatus || "Active"}</Badge>} />
                <Field label="Contract Renewal Date" value={matchedVendor.renewalDate || "—"} />
                <div className="col-span-2 border-t border-border/40 pt-3">
                  <Field label="Linked Bank Account Details" value={<div className="font-mono p-3 bg-muted/30 rounded-lg text-foreground border border-border/50">{matchedVendor.bankAccount || "No bank account registered."}</div>} />
                </div>
                {matchedVendor.address && (
                  <div className="col-span-2">
                    <Field label="Office Address" value={matchedVendor.address} />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">No linked vendor registry record found. Contact procurement manager.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Edit Vendor Dialog */}
      {isVendor && matchedVendor && (
        <Dialog open={openEdit} onOpenChange={setOpenEdit}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Vendor Profile</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Primary Contact Person</Label>
                <Input value={editForm.contactPerson} onChange={e => setEditForm(f => ({ ...f, contactPerson: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Business Phone</Label>
                <Input value={editForm.phone} onChange={e => setEditForm(f => ({ ...f, phone: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Business Address</Label>
                <Input value={editForm.address} onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <Label>Bank Account Details (Bank Name, A/C No, IFSC)</Label>
                <textarea value={editForm.bankAccount} onChange={e => setEditForm(f => ({ ...f, bankAccount: e.target.value }))} rows={3} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background resize-none" placeholder="e.g. State Bank of India, A/C: 123456789, IFSC: SBIN0001234" />
              </div>
              <Button className="w-full" disabled={updateVendorMutation.isPending} onClick={handleSaveVendorProfile}>
                {updateVendorMutation.isPending ? "Saving changes..." : "Save Details"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ==================== DOCUMENTS SECTION ==================== */}
      {/* ==================== DOCUMENTS SECTION ==================== */}
<Card className="glass-card">
  <CardHeader>
    <CardTitle className="text-lg flex items-center gap-2">
      <FileText className="w-5 h-5" /> Uploaded Documents
    </CardTitle>
  </CardHeader>
  <CardContent>
    {uniqueDocuments.length > 0 ? (
      <div className="space-y-3">
        {uniqueDocuments.map((doc) => {
          const viewUrl = getDocumentAccessUrl(doc);
          return (
            <div
              key={doc.uniqueKey}
              className="flex items-center justify-between p-4 border border-border rounded-xl hover:bg-muted/50 transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="p-3 bg-muted rounded-lg">
                  <File className="w-6 h-6 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {doc.label || doc.fileName || "Document"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.uploadedAt
                      ? new Date(doc.uploadedAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                    {doc.size && (
                      <span className="ml-2">
                        • {(doc.size / 1024).toFixed(1)} KB
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* View Button */}
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={viewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      e.preventDefault();
                      openDocumentBlob(viewUrl, "open", doc.label || doc.fileName || "document");
                    }}
                  >
                    View
                  </a>
                </Button>

                {/* Download Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openDocumentBlob(viewUrl, "download", doc.label || doc.fileName || "document")}
                >
                  <Download className="w-4 h-4 mr-1" />
                  Download
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="w-16 h-16 mx-auto mb-4 opacity-30" />
        <p className="text-lg">No documents uploaded yet</p>
        <p className="text-sm mt-1">Documents you upload will appear here automatically.</p>
      </div>
    )}
  </CardContent>
</Card>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">{label}</span>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  );
}
