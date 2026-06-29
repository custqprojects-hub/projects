import { useEffect, useState } from "react";
import { useListHostelRooms, useListHostelApplications, useGetHostelSummary, useApplyForHostel, useCreateHostelRoom, useUpdateHostelApplication, useListStudents, getListHostelRoomsQueryKey, getListHostelApplicationsQueryKey, getGetHostelSummaryQueryKey, UserRole } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Plus, BedDouble, Users, UtensilsCrossed, Bell, ClipboardList, Building, CheckCircle, XCircle, Clock, X, Eye, Phone, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
const roomTypeConfig = {
  single: { label: "Single", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", capacity: 1 },
  double: { label: "Double", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", capacity: 2 },
  triple: { label: "Triple", color: "bg-sky-500/10 text-sky-400 border-sky-500/20", capacity: 3 },
  dormitory: { label: "Dormitory", color: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20", capacity: 8 },
  standard: { label: "Standard", color: "bg-slate-500/10 text-slate-400 border-slate-500/20", capacity: 4 },
  deluxe: { label: "Deluxe", color: "bg-purple-500/10 text-purple-400 border-purple-500/20", capacity: 2 },
};
const applicationStatusConfig = {
  pending: { label: "Pending", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
  approved: { label: "Approved", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
  rejected: { label: "Rejected", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
  waitlisted: { label: "Waitlisted", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
};
export default function Hostel() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState("rooms");
  const [roomOpen, setRoomOpen] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [roomForm, setRoomForm] = useState({ roomNumber: "", block: "A", floor: "1", capacity: "4", type: "standard", monthlyFee: "", hostelId: "" });
  const [applyForm, setApplyForm] = useState({ preferredBlock: "", preferredRoomType: "", reason: "", joiningDate: "", rulesAccepted: false });
  // Notice form state
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ title: "", body: "", urgent: false });
  // Meal edit state
  const [editMeal, setEditMeal] = useState(null);
  const [mealForm, setMealForm] = useState({ breakfast: "", lunch: "", dinner: "" });

  // Multiple hostels and block filtering
  const [selectedHostelId, setSelectedHostelId] = useState("all");
  const [hostelDialogOpen, setHostelDialogOpen] = useState(false);
  const [hostelForm, setHostelForm] = useState({ name: "", type: "boys", capacity: "" });
  const [creatingHostel, setCreatingHostel] = useState(false);

  // Maintenance & Visitor states
  const [maintForm, setMaintForm] = useState({ studentId: "", issueDescription: "", category: "electrical" });
  const [submittingMaint, setSubmittingMaint] = useState(false);
  const [workerAssign, setWorkerAssign] = useState({});
  const [visitorForm, setVisitorForm] = useState({ studentId: "", visitorName: "", relationship: "", purpose: "", checkInTime: "" });
  const [submittingVisitor, setSubmittingVisitor] = useState(false);
  const [checkOutMap, setCheckOutMap] = useState({});
  const [allocationOpen, setAllocationOpen] = useState(false);
  const [allocatingApp, setAllocatingApp] = useState(null);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [bedName, setBedName] = useState("");

  const { data: rooms = [], isLoading: roomsLoading } = useListHostelRooms({ query: { queryKey: getListHostelRoomsQueryKey(), staleTime: 10000 } });
  const { data: apps = [], isLoading: appsLoading } = useListHostelApplications({ query: { queryKey: getListHostelApplicationsQueryKey(), staleTime: 10000 } });
  const { data: summary } = useGetHostelSummary({ query: { queryKey: getGetHostelSummaryQueryKey(), staleTime: 30000 } });
  const { data: students = [] } = useListStudents({}, { query: { staleTime: 30000 } });
  const { data: meals = [], isLoading: mealsLoading } = useQuery({
    queryKey: ["hostel-meals"],
    queryFn: async () => {
      const res = await fetch("/api/hostel/meals", { credentials: "include" });
      if (!res.ok)
        throw new Error("Failed to fetch meals");
      return res.json();
    },
    staleTime: 60000,
  });
  const { data: notices = [], isLoading: noticesLoading } = useQuery({
    queryKey: ["hostel-notices"],
    queryFn: async () => {
      const res = await fetch("/api/hostel/notices", { credentials: "include" });
      if (!res.ok)
        throw new Error("Failed to fetch notices");
      return res.json();
    },
    staleTime: 30000,
  });
  const { data: allocations = [], isLoading: allocationsLoading } = useQuery({
    queryKey: ["hostel-allocations"],
    queryFn: async () => {
      const res = await fetch("/api/hostel/allocations", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch allocations");
      return res.json();
    },
    staleTime: 30000,
  });
  const createRoomMutation = useCreateHostelRoom({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListHostelRoomsQueryKey() });
        setRoomOpen(false);
        setRoomForm({ roomNumber: "", block: "A", floor: "1", capacity: "4", type: "standard", monthlyFee: "" });
        toast({ title: "Room added successfully" });
      },
      onError: (err) => toast({ title: "Failed to add room", description: err?.message, variant: "destructive" }),
    },
  });
  const deleteRoomMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/hostel/rooms/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Failed to delete room");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListHostelRoomsQueryKey() });
      qc.invalidateQueries({ queryKey: ["hostels"] });
      toast({ title: "Room deleted successfully" });
    },
    onError: (err) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });
  const deleteHostelMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/hostels/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error || "Failed to delete hostel block");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hostels"] });
      qc.invalidateQueries({ queryKey: getListHostelRoomsQueryKey() });
      toast({ title: "Hostel block deleted successfully" });
    },
    onError: (err) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });
  const applyMutation = useApplyForHostel({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListHostelApplicationsQueryKey() });
        setApplyOpen(false);
        setApplyForm({ preferredBlock: "", preferredRoomType: "", reason: "", joiningDate: "", rulesAccepted: false });
        toast({ title: "Application submitted! Awaiting warden approval." });
      },
      onError: (err) => toast({ title: "Application failed", description: err?.message, variant: "destructive" }),
    },
  });
  const updateAppMutation = useUpdateHostelApplication({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListHostelApplicationsQueryKey() });
        qc.invalidateQueries({ queryKey: ["hostel-allocations"] });
        qc.invalidateQueries({ queryKey: getListHostelRoomsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetHostelSummaryQueryKey() });
        toast({ title: "Application status updated" });
      },
      onError: (err) => toast({ title: "Update failed", description: err?.message, variant: "destructive" }),
    },
  });
  const deleteAppMutation = useMutation({
    mutationFn: async ({ id, status }) => {
      const res = await fetch(`/api/hostel/applications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to delete hostel application");
      return { ...data, status };
    },
    onSuccess: (_, deletedApplication) => {
      qc.invalidateQueries({ queryKey: getListHostelApplicationsQueryKey() });
      qc.invalidateQueries({ queryKey: ["hostel-allocations"] });
      qc.invalidateQueries({ queryKey: getListHostelRoomsQueryKey() });
      qc.invalidateQueries({ queryKey: getGetHostelSummaryQueryKey() });
      setSelectedApp(null);
      toast({
        title: deletedApplication.status === "approved"
          ? "Hostel resident removed"
          : "Hostel application deleted",
      });
    },
    onError: (err) => toast({ title: "Delete failed", description: err?.message, variant: "destructive" }),
  });
  const updateMealMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`/api/hostel/meals/${encodeURIComponent(data.day)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ breakfast: data.breakfast, lunch: data.lunch, dinner: data.dinner }),
      });
      if (!res.ok)
        throw new Error("Failed to update meal");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hostel-meals"] });
      setEditMeal(null);
      toast({ title: "Meal schedule updated" });
    },
    onError: (err) => toast({ title: "Failed to update meal", description: err?.message, variant: "destructive" }),
  });
  const createNoticeMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch("/api/hostel/notices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok)
        throw new Error("Failed to post notice");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hostel-notices"] });
      setNoticeOpen(false);
      setNoticeForm({ title: "", body: "", urgent: false });
      toast({ title: "Notice posted successfully" });
    },
    onError: (err) => toast({ title: "Failed to post notice", description: err?.message, variant: "destructive" }),
  });
  const deleteNoticeMutation = useMutation({
    mutationFn: async (id) => {
      const res = await fetch(`/api/hostel/notices/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok)
        throw new Error("Failed to delete notice");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hostel-notices"] });
      toast({ title: "Notice removed" });
    },
    onError: (err) => toast({ title: "Failed to delete notice", description: err?.message, variant: "destructive" }),
  });

  const { data: hostels = [], refetch: refetchHostels } = useQuery({
    queryKey: ["hostels"],
    queryFn: async () => {
      const res = await fetch("/api/hostels", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch hostels");
      return res.json();
    },
    staleTime: 30000,
  });

  const handleCreateHostel = async () => {
    if (!hostelForm.name || !hostelForm.capacity) return;
    setCreatingHostel(true);
    try {
      const res = await fetch("/api/hostels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: hostelForm.name,
          type: hostelForm.type,
          capacity: parseInt(hostelForm.capacity),
        }),
        credentials: "include",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create hostel");
      }
      toast({ title: "Success", description: "Hostel created successfully!" });
      setHostelDialogOpen(false);
      setHostelForm({ name: "", type: "boys", capacity: "" });
      refetchHostels();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingHostel(false);
    }
  };

  const { data: maintenanceLogs = [], refetch: refetchMaintenance } = useQuery({
    queryKey: ["hostel-maintenance"],
    queryFn: async () => {
      const res = await fetch("/api/hostel/maintenance", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch maintenance logs");
      return res.json();
    },
    enabled: tab === "maintenance",
    staleTime: 30000,
  });

  const { data: visitorLogs = [], refetch: refetchVisitors } = useQuery({
    queryKey: ["hostel-visitors"],
    queryFn: async () => {
      const res = await fetch("/api/hostel/visitors", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch visitor logs");
      return res.json();
    },
    enabled: tab === "visitors",
    staleTime: 30000,
  });

  const handleMaintSubmit = async () => {
    if (!maintForm.issueDescription || (!isStudent && !maintForm.studentId)) {
      toast({ title: "Validation Error", description: "Please enter issue description and select a student", variant: "destructive" });
      return;
    }
    setSubmittingMaint(true);
    try {
      const res = await fetch("/api/hostel/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: isStudent ? myStudentRecord?.id : Number(maintForm.studentId),
          issueDescription: maintForm.issueDescription,
          category: maintForm.category
        }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit maintenance log");
      }
      toast({ title: "Success", description: "Maintenance complaint registered" });
      setMaintForm({ studentId: "", issueDescription: "", category: "electrical" });
      refetchMaintenance();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingMaint(false);
    }
  };

  const handleMaintUpdate = async (logId, status, assignedTo) => {
    try {
      const res = await fetch(`/api/hostel/maintenance/${logId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, assignedTo }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to update maintenance log");
      toast({ title: "Success", description: "Maintenance log updated" });
      refetchMaintenance();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleVisitorSubmit = async () => {
    if (!visitorForm.visitorName || !visitorForm.relationship || !visitorForm.purpose || (!isStudent && !visitorForm.studentId)) {
      toast({ title: "Validation Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }
    setSubmittingVisitor(true);
    try {
      const res = await fetch("/api/hostel/visitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: isStudent ? myStudentRecord?.id : Number(visitorForm.studentId),
          visitorName: visitorForm.visitorName,
          relationship: visitorForm.relationship,
          purpose: visitorForm.purpose,
          checkInTime: visitorForm.checkInTime || new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toISOString().split("T")[0]
        }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit visitor log");
      }
      toast({ title: "Success", description: "Visitor log registered" });
      setVisitorForm({ studentId: "", visitorName: "", relationship: "", purpose: "", checkInTime: "" });
      refetchVisitors();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingVisitor(false);
    }
  };

  const handleVisitorUpdate = async (visitorId, status, checkOutTime) => {
    try {
      const res = await fetch(`/api/hostel/visitors/${visitorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, checkOutTime }),
        credentials: "include"
      });
      if (!res.ok) throw new Error("Failed to update visitor status");
      toast({ title: "Success", description: "Visitor log updated" });
      refetchVisitors();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const isWarden = ["admin", "hostel_warden"].includes(user?.role ?? "");
  const isAdmin = user?.role === "admin";
  const canApproveApplications = isAdmin;
  const canDeleteApplications = ["admin", "hostel_warden"].includes(user?.role ?? "");
  const isStudent = user?.role === UserRole.student;
  const myStudentRecord = isStudent
    ? students.find((s) => s.userId === user?.id)
    : null;
  const currentApplication = isStudent && myStudentRecord
    ? apps.find((a) => a.studentId === myStudentRecord.id && ["pending", "approved", "waitlisted"].includes(a.status))
    : null;
  const availableRooms = rooms.filter((room) => room.status === "available" && room.occupied < room.capacity);
  const selectedPreferredHostel = hostels.find((hostel) => String(hostel.id) === applyForm.preferredBlock);
  const availablePreferredRoomTypes = [...new Set(
    availableRooms
      .filter((room) => String(room.hostelId) === applyForm.preferredBlock)
      .map((room) => room.type)
  )];
  const approvalRooms = allocatingApp
    ? availableRooms.filter((room) =>
      String(room.hostelId) === String(allocatingApp.preferredBlock) &&
      room.type === allocatingApp.preferredRoomType
    )
    : [];
  const selectedHostel = hostels.find((hostel) => String(hostel.id) === roomForm.hostelId);
  const usedBedsForSelectedHostel = selectedHostel ? rooms.filter((room) => room.hostelId === Number(roomForm.hostelId)).reduce((sum, room) => sum + Number(room.capacity), 0) : 0;
  const remainingBeds = selectedHostel ? Math.max(Number(selectedHostel.capacity) - usedBedsForSelectedHostel, 0) : 0;
  const existingRoomNumbersInBlock = selectedHostel ? rooms.filter((room) => room.hostelId === Number(roomForm.hostelId)).map((room) => String(room.roomNumber).trim().toLowerCase()) : [];
  const roomNumberExists = existingRoomNumbersInBlock.includes(String(roomForm.roomNumber).trim().toLowerCase());
  const filteredRooms = rooms.filter((r) => selectedHostelId === "all" || r.hostelId === parseInt(selectedHostelId));
  const submitApplication = () => {
    if (!applyForm.preferredBlock) {
      toast({ title: "Select a preferred block", variant: "destructive" });
      return;
    }
    if (!applyForm.preferredRoomType) {
      toast({ title: "Select a preferred room type", variant: "destructive" });
      return;
    }
    if (!applyForm.rulesAccepted) {
      toast({ title: "Accept the hostel rules before submitting", variant: "destructive" });
      return;
    }
    applyMutation.mutate({
      data: {
        studentId: myStudentRecord?.id ?? user?.id ?? 0,
        preferredBlock: applyForm.preferredBlock,
        preferredRoomType: applyForm.preferredRoomType,
        remarks: applyForm.reason || undefined,
        rulesAccepted: true,
      },
    });
  };
  const statusColors = {
    available: "bg-emerald-500/10 text-emerald-400",
    full: "bg-red-500/10 text-red-400",
    maintenance: "bg-amber-500/10 text-amber-400",
    pending: "bg-amber-500/10 text-amber-400",
    approved: "bg-emerald-500/10 text-emerald-400",
    rejected: "bg-red-500/10 text-red-400",
    waitlisted: "bg-blue-500/10 text-blue-400",
  };
  const occupancyPct = summary && Number(summary.totalBeds) > 0 ? Math.round((Number(summary.occupied) / Number(summary.totalBeds)) * 100) : 0;
  const availableRoomsCount = rooms.filter(r => r.status === "available").length;
  const todayDay = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
  return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-teal-400">Hostel Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isWarden ? "Rooms, occupancy, and applications" : "Your hostel information"}
        </p>
      </div>
      <div className="flex gap-2">
        {isStudent && !currentApplication && (<Dialog open={applyOpen} onOpenChange={setApplyOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">
              <Plus className="w-4 h-4" />Apply for Hostel
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Apply for Hostel Accommodation</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Preferred Block</Label>
                <Select value={applyForm.preferredBlock} onValueChange={v => setApplyForm(f => ({ ...f, preferredBlock: v, preferredRoomType: "" }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select eligible hostel block" /></SelectTrigger>
                  <SelectContent>
                    {hostels.map((hostel) => (
                      <SelectItem key={hostel.id} value={String(hostel.id)}>
                        {hostel.name} ({hostel.type === "boys" ? "Boys" : hostel.type === "girls" ? "Girls" : hostel.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hostels.length === 0 && <p className="text-xs text-amber-400 mt-1">No eligible hostel blocks are available for your profile.</p>}
              </div>
              <div>
                <Label>Preferred Room Type</Label>
                <Select value={applyForm.preferredRoomType} onValueChange={v => setApplyForm(f => ({ ...f, preferredRoomType: v }))}>
                  <SelectTrigger className="mt-1" disabled={!applyForm.preferredBlock}><SelectValue placeholder={applyForm.preferredBlock ? "Select available room type" : "Select a block first"} /></SelectTrigger>
                  <SelectContent>
                    {availablePreferredRoomTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {roomTypeConfig[type]?.label ?? type} ({availableRooms.filter((room) => String(room.hostelId) === applyForm.preferredBlock && room.type === type).length} room(s))
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedPreferredHostel && availablePreferredRoomTypes.length === 0 && <p className="text-xs text-amber-400 mt-1">No rooms are currently available in {selectedPreferredHostel.name}.</p>}
              </div>
              <div>
                <Label>Preferred Joining Date</Label>
                <input type="date" value={applyForm.joiningDate} min={new Date().toISOString().split("T")[0]} onChange={e => setApplyForm(f => ({ ...f, joiningDate: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" />
              </div>
              <div>
                <Label>Reason / Remarks</Label>
                <textarea value={applyForm.reason} onChange={e => setApplyForm(f => ({ ...f, reason: e.target.value }))} rows={3} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background resize-none" placeholder="Any special requirements..." />
              </div>
              <div className="border border-border rounded-md bg-muted/30 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <h3 className="text-sm font-semibold">Hostel Rules and Undertaking</h3>
                </div>
                <ol className="list-decimal pl-5 space-y-1.5 text-xs leading-5 text-muted-foreground">
                  <li>Maintain discipline, respectful conduct, and quiet hours within the hostel premises.</li>
                  <li>Follow hostel attendance, entry, exit, and sign-out procedures at all times.</li>
                  <li>Visitors are allowed only with permission and in designated visitor areas.</li>
                  <li>Keep rooms and common areas clean; damage to hostel property will be chargeable.</li>
                  <li>Smoking, alcohol, drugs, weapons, gambling, and other prohibited items are strictly forbidden.</li>
                  <li>Pay hostel and mess fees within the prescribed due dates.</li>
                  <li>Follow safety instructions and all directions issued by the hostel warden or institution.</li>
                  <li>Serious or repeated violations may result in disciplinary action or cancellation of accommodation.</li>
                </ol>
              </div>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="hostel-rules-accepted"
                  checked={applyForm.rulesAccepted}
                  onCheckedChange={(checked) => setApplyForm(f => ({ ...f, rulesAccepted: checked === true }))}
                  className="mt-0.5"
                />
                <Label htmlFor="hostel-rules-accepted" className="text-sm leading-5 cursor-pointer">
                  I have read and agree to follow the hostel rules and regulations.
                </Label>
              </div>
              <Button className="w-full" disabled={!applyForm.preferredBlock || !applyForm.preferredRoomType || !applyForm.rulesAccepted || applyMutation.isPending} onClick={submitApplication}>
                {applyMutation.isPending ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>)}
        {isStudent && currentApplication && (<div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm">
          <span className="text-muted-foreground">My application:</span>
          <Badge className={`text-xs ${statusColors[currentApplication.status ?? "pending"]}`}>
            {currentApplication.status}
          </Badge>
        </div>)}
        {isWarden && tab === "notices" && (<Dialog open={noticeOpen} onOpenChange={setNoticeOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">
              <Plus className="w-4 h-4" />Post Notice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Post Hostel Notice</DialogTitle></DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Title *</Label>
                <Input className="mt-1" value={noticeForm.title} onChange={e => setNoticeForm(f => ({ ...f, title: e.target.value }))} placeholder="Notice title" />
              </div>
              <div>
                <Label>Message *</Label>
                <Textarea className="mt-1 resize-none" rows={4} value={noticeForm.body} onChange={e => setNoticeForm(f => ({ ...f, body: e.target.value }))} placeholder="Notice content..." />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={noticeForm.urgent} onCheckedChange={v => setNoticeForm(f => ({ ...f, urgent: v }))} id="urgent-switch" />
                <Label htmlFor="urgent-switch" className="flex items-center gap-1.5 cursor-pointer">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-400" />Mark as Urgent
                </Label>
              </div>
              <Button className="w-full" disabled={!noticeForm.title || !noticeForm.body || createNoticeMutation.isPending} onClick={() => createNoticeMutation.mutate(noticeForm)}>
                {createNoticeMutation.isPending ? "Posting..." : "Post Notice"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>)}
        {isAdmin && tab !== "notices" && (<div className="flex gap-2">
          <Dialog open={hostelDialogOpen} onOpenChange={setHostelDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-purple-500/10 text-purple-400 border border-purple-500/30 hover:bg-purple-500/20">
                <Plus className="w-4 h-4" />Add Hostel Block
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add New Hostel Building Block</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Block Name *</Label>
                  <Input value={hostelForm.name} onChange={e => setHostelForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. Aryabhata Block" />
                </div>
                <div>
                  <Label>Type</Label>
                  <Select value={hostelForm.type} onValueChange={v => setHostelForm(f => ({ ...f, type: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boys">Boys Hostel</SelectItem>
                      <SelectItem value="girls">Girls Hostel</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Capacity *</Label>
                  <Input type="number" value={hostelForm.capacity} onChange={e => setHostelForm(f => ({ ...f, capacity: e.target.value }))} className="mt-1" placeholder="Total number of beds" />
                </div>
                <Button className="w-full" disabled={!hostelForm.name || !hostelForm.capacity || creatingHostel} onClick={handleCreateHostel}>
                  {creatingHostel ? "Creating..." : "Create Hostel Block"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={roomOpen} onOpenChange={setRoomOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">
                <Plus className="w-4 h-4" />Add Room
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>Add Hostel Room</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div>
                  <Label>Hostel Building Block *</Label>
                  <Select value={roomForm.hostelId} onValueChange={v => setRoomForm(f => ({ ...f, hostelId: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select building block" /></SelectTrigger>
                    <SelectContent>
                      {hostels.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.name} ({h.type})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Room Number *</Label>
                    <Input value={roomForm.roomNumber} onChange={e => setRoomForm(f => ({ ...f, roomNumber: e.target.value }))} className="mt-1" placeholder="e.g. A-101" />
                    {roomNumberExists && <p className="text-xs mt-1 text-red-400">Room {roomForm.roomNumber} already exists in this block</p>}
                  </div>
                  <div>
                    <Label>Block / Wing</Label>
                    <Input value={roomForm.block} onChange={e => setRoomForm(f => ({ ...f, block: e.target.value }))} className="mt-1" placeholder="e.g. Block A" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Floor</Label>
                    <Input value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value }))} className="mt-1" placeholder="e.g. Ground" />
                  </div>
                  <div>
                    <Label>Room Type *</Label>
                    <Select value={roomForm.type} onValueChange={v => setRoomForm(f => ({ ...f, type: v, capacity: roomTypeConfig[v]?.capacity ? String(roomTypeConfig[v].capacity) : f.capacity }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(roomTypeConfig).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Room Capacity</Label>
                  <Input
                    type="number"
                    min={1}
                    value={roomForm.capacity}
                    onChange={e => setRoomForm(f => ({ ...f, capacity: e.target.value }))}
                    className="mt-1"
                    placeholder="Number of beds in room"
                  />
                  {selectedHostel && (
                    <p className="text-xs mt-1 text-muted-foreground">
                      Remaining beds in {selectedHostel.name}: {remainingBeds} / {selectedHostel.capacity}
                    </p>
                  )}
                  {selectedHostel && remainingBeds <= 0 && (
                    <p className="text-xs mt-1 text-red-400">This hostel block has reached its capacity. Remove a room or choose another block.</p>
                  )}
                </div>
                <div>
                  <Label>Monthly Fee (₹)</Label>
                  <Input type="number" value={roomForm.monthlyFee} onChange={e => setRoomForm(f => ({ ...f, monthlyFee: e.target.value }))} className="mt-1" placeholder="0" />
                </div>
                <Button
                  className="w-full"
                  disabled={
                    !roomForm.roomNumber || !roomForm.type || !roomForm.hostelId || createRoomMutation.isPending || !roomForm.capacity || Number(roomForm.capacity) > remainingBeds || roomNumberExists
                  }
                  onClick={() => createRoomMutation.mutate({ data: { roomNumber: roomForm.roomNumber, floor: parseInt(roomForm.floor) || 1, type: roomForm.type, block: roomForm.block || "A", capacity: parseInt(roomForm.capacity) || (roomTypeConfig[roomForm.type]?.capacity ?? 2), hostelId: parseInt(roomForm.hostelId), monthlyFee: roomForm.monthlyFee || "3000.00" } })}
                >
                  {createRoomMutation.isPending ? "Creating..." : "Create Room"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>)}
      </div>
    </div>

    {isStudent && currentApplication && (<Card className={`border ${applicationStatusConfig[currentApplication.status]?.color ?? "border-border"}`}>
      <CardContent className="p-4">
        <p className="font-medium text-sm">My Application Status</p>
        <div className="flex items-center gap-2 mt-1">
          <Badge className={`border ${applicationStatusConfig[currentApplication.status]?.color}`}>{currentApplication.status}</Badge>
          <span className="text-xs text-muted-foreground">Applied for {currentApplication.preferredRoomType} room</span>
        </div>
        {currentApplication.remarks && <p className="text-xs text-muted-foreground mt-1">{currentApplication.remarks}</p>}
      </CardContent>
    </Card>)}

    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      <Card className="glass-card glass-hover border-t-2 border-t-teal-400/30"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-teal-500/10 text-teal-400"><Building className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Total Rooms</p><p className="text-xl font-bold text-teal-400">{summary?.totalRooms ?? rooms.length}</p></div></CardContent></Card>
      <Card className="glass-card glass-hover border-t-2 border-t-emerald-400/30"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><BedDouble className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Available</p><p className="text-xl font-bold text-emerald-400">{availableRoomsCount}</p></div></CardContent></Card>
      <Card className="glass-card glass-hover border-t-2 border-t-blue-400/30"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Users className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Occupied</p><p className="text-xl font-bold text-blue-400">{Number(summary?.occupied ?? 0)}</p></div></CardContent></Card>
      <Card className="glass-card glass-hover border-t-2 border-t-violet-400/30"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-violet-500/10 text-violet-400"><Building className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Occupancy</p><p className="text-xl font-bold text-violet-400">{occupancyPct}%</p></div></CardContent></Card>
    </div>

    {isWarden && (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="glass-card border border-teal-500/20 bg-teal-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-teal-400 text-sm">Hostel Attendance (Roll Call)</p>
              <p className="text-xs text-muted-foreground mt-0.5">Record daily student attendance in the hostel.</p>
            </div>
            <Button asChild size="sm" className="bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20">
              <Link href="/hostel-attendance">Go to Hostel Roll</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="glass-card border border-blue-500/20 bg-blue-500/5">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-semibold text-blue-400 text-sm">Visitor Log Management</p>
              <p className="text-xs text-muted-foreground mt-0.5">Track entries and exits of visitors.</p>
            </div>
            <Button asChild size="sm" className="bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20">
              <Link href="/visitors">Go to Visitor Logs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )}

    <div className="flex flex-wrap gap-2">
      <Button variant={tab === "rooms" ? "default" : "outline"} size="sm" className={tab === "rooms" ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : ""} onClick={() => setTab("rooms")}>
        <BedDouble className="w-3.5 h-3.5 mr-1.5" />Rooms
      </Button>
      <Button variant={tab === "applications" ? "default" : "outline"} size="sm" className={tab === "applications" ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : ""} onClick={() => setTab("applications")}>
        <ClipboardList className="w-3.5 h-3.5 mr-1.5" />Applications {apps.filter(a => a.status === "pending").length > 0 && <span className="ml-1 bg-amber-500 text-white text-xs rounded-full px-1.5">{apps.filter(a => a.status === "pending").length}</span>}
      </Button>
      <Button variant={tab === "profiles" ? "default" : "outline"} size="sm" className={tab === "profiles" ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : ""} onClick={() => setTab("profiles")}>
        <Users className="w-3.5 h-3.5 mr-1.5" />Hostel Profiles
      </Button>
      <Button variant={tab === "meals" ? "default" : "outline"} size="sm" className={tab === "meals" ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : ""} onClick={() => setTab("meals")}>
        <UtensilsCrossed className="w-3.5 h-3.5 mr-1.5" />Meal Schedule
      </Button>
      <Button variant={tab === "notices" ? "default" : "outline"} size="sm" className={tab === "notices" ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : ""} onClick={() => setTab("notices")}>
        <Bell className="w-3.5 h-3.5 mr-1.5" />Notices {notices.filter(n => n.urgent).length > 0 && <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5">{notices.filter(n => n.urgent).length}</span>}
      </Button>
      <Button variant={tab === "maintenance" ? "default" : "outline"} size="sm" className={tab === "maintenance" ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : ""} onClick={() => setTab("maintenance")}>
        <ClipboardList className="w-3.5 h-3.5 mr-1.5" />Maintenance
      </Button>
     {isWarden && (
  <Button variant={tab === "visitors" ? "default" : "outline"} size="sm" className={tab === "visitors" ? "bg-teal-500/20 text-teal-400 border-teal-500/30" : ""} onClick={() => setTab("visitors")}>
    <Users className="w-3.5 h-3.5 mr-1.5" />Visitors
  </Button>
)}
    </div>

    {/* Rooms Tab */}
    {tab === "rooms" && (
      <div className="space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Label className="text-sm text-muted-foreground shrink-0">Filter Hostel Block:</Label>
          <Select value={selectedHostelId} onValueChange={setSelectedHostelId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All Hostel Blocks" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Hostel Blocks</SelectItem>
              {hostels.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.name} ({h.type})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomsLoading
            ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
            : hostels.length === 0
              ? <p className="text-muted-foreground col-span-3 text-center py-8">No hostel blocks found. Add a block to begin room management.</p>
              : hostels.map((hostel) => {
                const blockRooms = rooms.filter((r) => r.hostelId === hostel.id);
                const totalBeds = blockRooms.reduce((sum, room) => sum + room.capacity, 0);
                const occupiedBeds = blockRooms.reduce((sum, room) => sum + room.occupied, 0);
                return (
                  <Card key={hostel.id} className="glass-card glass-hover border-border/40">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold">{hostel.name}</p>
                          <p className="text-xs text-muted-foreground">{hostel.type === "boys" ? "Boys" : hostel.type === "girls" ? "Girls" : "Co-ed"} hostel</p>
                        </div>
                        {isAdmin && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            disabled={deleteHostelMutation.isPending}
                            onClick={() => {
                              if (!window.confirm(`Delete hostel block ${hostel.name}? Remove all rooms first.`)) return;
                              deleteHostelMutation.mutate(hostel.id);
                            }}
                            title="Delete hostel block"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                        <div>
                          <p className="font-semibold text-foreground">{blockRooms.length}</p>
                          <p>Room{blockRooms.length !== 1 ? "s" : ""}</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{occupiedBeds}/{totalBeds}</p>
                          <p>Beds occupied</p>
                        </div>
                      </div>
                      {blockRooms.length === 0 && <p className="text-xs text-amber-400 mt-3">This block has no rooms yet.</p>}
                    </CardContent>
                  </Card>
                );
              })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {roomsLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            : filteredRooms.length === 0
              ? <p className="text-muted-foreground col-span-3 text-center py-8">No rooms found. {isAdmin && "Add rooms using the button above."}</p>
              : filteredRooms.map((room) => {
                const tCfg = roomTypeConfig[room.type] ?? roomTypeConfig.standard;
                const isAvailable = room.status === "available";
                const hostelName = hostels.find(h => h.id === room.hostelId)?.name || "Default Block";
                return (<Card key={room.id} className={`glass-card glass-hover transition-all ${isAvailable ? "border-emerald-500/20 hover:border-emerald-400/40" : "border-border/50"}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="font-semibold">Room {room.roomNumber}</p>
                          <div className={`w-2 h-2 rounded-full ${isAvailable ? "bg-emerald-400" : "bg-red-400"}`} />
                        </div>
                        <p className="text-[10px] text-teal-400 font-medium">{hostelName}</p>
                        <p className="text-xs text-muted-foreground">{room.block ? `Block ${room.block} · ` : ""}Floor {room.floor}</p>
                      </div>
                      <Badge className={`text-xs ${tCfg.color}`}>{tCfg.label}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm mb-2">
                      <span className="text-muted-foreground capitalize">{room.type}</span>
                      <span className="text-xs">
                        <span className="font-medium">{room.occupied}</span>
                        <span className="text-muted-foreground">/{room.capacity}</span>
                      </span>
                    </div>
                    <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${room.capacity > 0 && room.occupied >= room.capacity ? "bg-red-400" : room.capacity > 0 && room.occupied / room.capacity >= 0.8 ? "bg-amber-400" : "bg-teal-400"}`} style={{ width: `${room.capacity > 0 ? (room.occupied / room.capacity) * 100 : 0}%` }} />
                    </div>
                    {room.monthlyFee && <p className="text-xs text-muted-foreground mt-2">₹{Number(room.monthlyFee).toLocaleString("en-IN")}/month</p>}
                    {isAdmin && (
                      <div className="mt-3 flex justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          disabled={deleteRoomMutation.isPending}
                          onClick={() => {
                            if (!window.confirm(`Delete room ${room.roomNumber}? This action cannot be undone.`)) return;
                            deleteRoomMutation.mutate(room.id);
                          }}
                          title="Delete room"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>);
              })}
        </div>
      </div>
    )}

    {/* Applications Tab */}
    {tab === "applications" && (<Card className="border-t-2 border-t-teal-400/30">
      <CardHeader>
        <CardTitle className="text-base">Hostel Applications</CardTitle>
      </CardHeader>
      <CardContent>
        {appsLoading
          ? <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          : apps.length === 0
            ? <div className="text-center py-12 text-muted-foreground">No applications yet.</div>
            : <div className="space-y-2">
              {apps.map((app) => {
                const cfg = applicationStatusConfig[app.status] ?? applicationStatusConfig.pending;
                const Icon = cfg.icon;
                const isSelected = selectedApp?.id === app.id;
                return (<div key={app.id} className="rounded-lg border border-border/50 overflow-hidden transition-all">
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-teal-500/5 transition-colors gap-3 ${isSelected ? "bg-teal-500/8 border-l-2 border-l-teal-400" : ""}`} onClick={() => setSelectedApp(isSelected ? null : app)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-7 h-7 rounded-full bg-teal-500/15 border border-teal-500/25 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-teal-400">{(app.studentName ?? "S").charAt(0).toUpperCase()}</span>
                        </div>
                        <p className="font-medium text-sm">{app.studentName ?? `Student #${app.studentId}`}</p>
                        <Badge className={`border ${cfg.color} flex items-center gap-1 text-xs`}><Icon className="w-2.5 h-2.5" />{cfg.label}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground pl-9">
                        {app.preferredBlockName ? `${app.preferredBlockName} · ` : ""}{app.preferredRoomType} room · Applied: {app.appliedAt ? app.appliedAt.split("T")[0] : new Date().toLocaleDateString()}
                      </p>
                      {app.roomNumber && <p className="text-xs text-emerald-400 pl-9">Assigned: Room {app.roomNumber}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${isSelected ? "bg-teal-500/15 text-teal-400" : "hover:bg-teal-500/10 hover:text-teal-400"}`} onClick={() => setSelectedApp(isSelected ? null : app)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {canApproveApplications && app.status === "pending" && (<>
                        <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs h-7" onClick={() => { setAllocatingApp(app); setSelectedRoomId(""); setBedName(""); setAllocationOpen(true); }}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10 text-xs h-7" onClick={() => updateAppMutation.mutate({ id: app.id, data: { status: "rejected" } })}>Reject</Button>
                      </>)}
                      {canDeleteApplications && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          title={app.status === "approved" ? "Remove hostel resident" : "Delete application"}
                          disabled={deleteAppMutation.isPending}
                          onClick={() => {
                            const message = app.status === "approved"
                              ? `Remove ${app.studentName} from the hostel and delete this application?`
                              : `Delete ${app.studentName}'s hostel application?`;
                            if (window.confirm(message)) {
                              deleteAppMutation.mutate({ id: app.id, status: app.status });
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {isSelected && (<div className="px-4 pb-4 bg-muted/20 border-t border-border/30">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-3 text-sm">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student Info</p>
                        <div><span className="text-xs text-muted-foreground block">Name</span><p className="font-medium">{app.studentName}</p></div>
                        {app.rollNumber && <div><span className="text-xs text-muted-foreground block">Roll No.</span><p className="font-medium">{app.rollNumber}</p></div>}
                        {app.phone && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" /><p className="font-medium">{app.phone}</p></div>}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Preferences</p>
                        <div><span className="text-xs text-muted-foreground block">Block</span><p className="font-medium">{app.preferredBlockName || app.preferredBlock || "Any"}</p></div>
                        <div><span className="text-xs text-muted-foreground block">Room Type</span><p className="font-medium capitalize">{app.preferredRoomType}</p></div>
                        {app.roomNumber && <div><span className="text-xs text-muted-foreground block">Assigned Room</span><p className="font-medium text-emerald-400">Room {app.roomNumber}</p></div>}
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</p>
                        <div><span className="text-xs text-muted-foreground block">Applied</span><p className="font-medium">{app.appliedAt ? app.appliedAt.split("T")[0] : "—"}</p></div>
                        {app.joiningDate && <div><span className="text-xs text-muted-foreground block">Joining Date</span><p className="font-medium">{app.joiningDate}</p></div>}
                        {app.reason && <div><span className="text-xs text-muted-foreground block">Reason</span><p className="font-medium">{app.reason}</p></div>}
                      </div>
                    </div>
                  </div>)}
                </div>);
              })}
            </div>}
      </CardContent>
    </Card>)}

    {/* Meals Tab */}
    {tab === "meals" && (<div className="space-y-4">
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400 flex items-center gap-2">
        <UtensilsCrossed className="w-4 h-4 shrink-0" />
        Today is <strong>{todayDay}</strong>
        {isWarden && <span className="ml-auto text-xs text-muted-foreground">Click the edit icon to update any day's menu</span>}
      </div>
      {mealsLoading ? (<div className="space-y-2">{Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>) : (<div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              <th className="text-left px-4 py-3 font-medium w-28">Day</th>
              <th className="text-left px-4 py-3 font-medium">Breakfast (7–9 AM)</th>
              <th className="text-left px-4 py-3 font-medium">Lunch (12–2 PM)</th>
              <th className="text-left px-4 py-3 font-medium">Dinner (7–9 PM)</th>
              {isWarden && <th className="px-4 py-3 w-10" />}
            </tr>
          </thead>
          <tbody>
            {meals.map((meal, i) => (<tr key={meal.day} className={`${meal.day === todayDay ? "bg-primary/5 border-l-2 border-l-primary" : i % 2 === 0 ? "bg-background" : "bg-muted/20"}`}>
              <td className="px-4 py-3 font-semibold whitespace-nowrap">{meal.day}</td>
              <td className="px-4 py-3 text-muted-foreground">{meal.breakfast || <span className="italic opacity-50">Not set</span>}</td>
              <td className="px-4 py-3 text-muted-foreground">{meal.lunch || <span className="italic opacity-50">Not set</span>}</td>
              <td className="px-4 py-3 text-muted-foreground">{meal.dinner || <span className="italic opacity-50">Not set</span>}</td>
              {isWarden && (<td className="px-4 py-3">
                <button className="p-1.5 rounded hover:bg-teal-500/10 text-muted-foreground hover:text-teal-400 transition-colors" onClick={() => { setEditMeal(meal); setMealForm({ breakfast: meal.breakfast, lunch: meal.lunch, dinner: meal.dinner }); }}>
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </td>)}
            </tr>))}
            {meals.length === 0 && (<tr><td colSpan={isWarden ? 5 : 4} className="px-4 py-8 text-center text-muted-foreground">No meal schedule found.</td></tr>)}
          </tbody>
        </table>
      </div>)}
      <p className="text-xs text-muted-foreground">* Menu may change on special occasions. Check the notice board for updates.</p>
    </div>)}

    {/* Notices Tab */}
    {tab === "notices" && (<div className="space-y-3">
      {noticesLoading ? (<div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}</div>) : notices.length === 0 ? (<div className="rounded-lg border border-dashed border-muted p-8 text-center text-muted-foreground">
        <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No notices posted yet.</p>
        {isWarden && <p className="text-xs mt-1">Click "Post Notice" above to add one.</p>}
      </div>) : (notices
        .slice()
        .sort((a, b) => (a.urgent === b.urgent ? 0 : a.urgent ? -1 : 1))
        .map((notice) => (<Card key={notice.id} className={`transition-colors ${notice.urgent ? "border-red-500/30 bg-red-500/5" : ""}`}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {notice.urgent && (<span className="text-xs font-semibold text-red-400 uppercase tracking-wide flex items-center gap-1 shrink-0">
                  <AlertTriangle className="w-3 h-3" />Urgent
                </span>)}
                <h3 className="font-semibold truncate">{notice.title}</h3>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {new Date(notice.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {isWarden && (<button className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors" onClick={() => deleteNoticeMutation.mutate(notice.id)} disabled={deleteNoticeMutation.isPending}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>)}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{notice.body}</p>
          </CardContent>
        </Card>)))}
    </div>)}

    {/* Meal Edit Dialog */}
    {editMeal && (<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2"><UtensilsCrossed className="w-4 h-4 text-teal-400" />Edit {editMeal.day} Menu</h3>
          <button onClick={() => setEditMeal(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <Label>Breakfast (7–9 AM)</Label>
            <Input className="mt-1" value={mealForm.breakfast} onChange={e => setMealForm(f => ({ ...f, breakfast: e.target.value }))} placeholder="e.g. Idli Sambar, Coffee" />
          </div>
          <div>
            <Label>Lunch (12–2 PM)</Label>
            <Input className="mt-1" value={mealForm.lunch} onChange={e => setMealForm(f => ({ ...f, lunch: e.target.value }))} placeholder="e.g. Rice, Dal, Sabzi, Roti" />
          </div>
          <div>
            <Label>Dinner (7–9 PM)</Label>
            <Input className="mt-1" value={mealForm.dinner} onChange={e => setMealForm(f => ({ ...f, dinner: e.target.value }))} placeholder="e.g. Roti, Paneer Curry, Salad" />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => setEditMeal(null)}>Cancel</Button>
            <Button className="flex-1" disabled={updateMealMutation.isPending} onClick={() => updateMealMutation.mutate({ day: editMeal.day, ...mealForm })}>
              {updateMealMutation.isPending ? "Saving..." : "Save Menu"}
            </Button>
          </div>
        </div>
      </div>
    </div>)}
    {/* Maintenance Complaints Tab */}
    {tab === "maintenance" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
        {/* File Complaint Form */}
        <Card className="glass-card border-t-2 border-t-teal-400/30 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">File Maintenance Complaint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isStudent && (
              <div>
                <Label>Student *</Label>
                <Select value={maintForm.studentId} onValueChange={v => setMaintForm(f => ({ ...f, studentId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.rollNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Category *</Label>
              <Select value={maintForm.category} onValueChange={v => setMaintForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="electrical">Electrical</SelectItem>
                  <SelectItem value="plumbing">Plumbing</SelectItem>
                  <SelectItem value="carpentry">Carpentry</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Issue Description *</Label>
              <Textarea
                value={maintForm.issueDescription}
                onChange={e => setMaintForm(f => ({ ...f, issueDescription: e.target.value }))}
                className="mt-1 resize-none"
                rows={4}
                placeholder="Describe the maintenance issue in detail..."
              />
            </div>
            <Button
              onClick={handleMaintSubmit}
              disabled={submittingMaint || (!isStudent && !maintForm.studentId) || !maintForm.issueDescription}
              className="w-full bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20"
            >
              {submittingMaint ? "Submitting..." : "Submit Complaint"}
            </Button>
          </CardContent>
        </Card>

        {/* Complaints List */}
        <Card className="glass-card border-t-2 border-t-teal-400/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Maintenance Log</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {maintenanceLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">No maintenance logs found.</p>
            ) : (
              <div className="space-y-4">
                {maintenanceLogs.map(log => (
                  <div key={log.id} className="p-4 rounded-lg border border-border/50 bg-background/30 flex flex-col gap-3">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-sm">Room {log.roomId} · {log.studentName || `Student #${log.studentId}`}</p>
                        <p className="text-xs text-muted-foreground">Category: <span className="capitalize text-foreground font-medium">{log.category}</span></p>
                      </div>
                      <Badge className={`text-xs capitalize ${log.status === "resolved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          log.status === "in_progress" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                            "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>{log.status?.replace("_", " ")}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground bg-muted/20 p-2.5 rounded">{log.issueDescription}</p>

                    {log.assignedTo && (
                      <p className="text-xs text-muted-foreground">Assigned to: <strong className="text-foreground">{log.assignedTo}</strong></p>
                    )}
                    {log.resolvedAt && (
                      <p className="text-xs text-emerald-400 font-medium">Resolved: {new Date(log.resolvedAt).toLocaleDateString("en-IN")}</p>
                    )}

                    {/* Warden Action triggers */}
                    {isWarden && log.status !== "resolved" && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/30">
                        <Input
                          placeholder="Assign worker..."
                          size="sm"
                          className="h-8 max-w-[200px]"
                          value={workerAssign[log.id] ?? ""}
                          onChange={(e) => setWorkerAssign(prev => ({ ...prev, [log.id]: e.target.value }))}
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                          onClick={() => handleMaintUpdate(log.id, "in_progress", workerAssign[log.id] || "Maintenance Staff")}
                        >
                          Assign
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-8 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 ml-auto"
                          onClick={() => handleMaintUpdate(log.id, "resolved", log.assignedTo || "Maintenance Staff")}
                        >
                          Resolve
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )}

    {/* Visitor Logs Tab */}
    {tab === "visitors" && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
        {/* Log Visitor Form */}
        <Card className="glass-card border-t-2 border-t-teal-400/30 lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Register Visitor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isStudent && (
              <div>
                <Label>Visiting Student *</Label>
                <Select value={visitorForm.studentId} onValueChange={v => setVisitorForm(f => ({ ...f, studentId: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Select student" /></SelectTrigger>
                  <SelectContent>
                    {students.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} ({s.rollNumber})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>Visitor Name *</Label>
              <Input
                value={visitorForm.visitorName}
                onChange={e => setVisitorForm(f => ({ ...f, visitorName: e.target.value }))}
                className="mt-1"
                placeholder="Full name of visitor"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Relationship *</Label>
                <Input
                  value={visitorForm.relationship}
                  onChange={e => setVisitorForm(f => ({ ...f, relationship: e.target.value }))}
                  className="mt-1"
                  placeholder="e.g. Father, Mother"
                />
              </div>
              <div>
                <Label>Check-in Time</Label>
                <Input
                  value={visitorForm.checkInTime}
                  onChange={e => setVisitorForm(f => ({ ...f, checkInTime: e.target.value }))}
                  className="mt-1"
                  placeholder="e.g. 04:30 PM"
                />
              </div>
            </div>
            <div>
              <Label>Purpose of Visit *</Label>
              <Textarea
                value={visitorForm.purpose}
                onChange={e => setVisitorForm(f => ({ ...f, purpose: e.target.value }))}
                className="mt-1 resize-none"
                rows={3}
                placeholder="e.g. Submitting laundry, family emergency..."
              />
            </div>
            <Button
              onClick={handleVisitorSubmit}
              disabled={submittingVisitor || (!isStudent && !visitorForm.studentId) || !visitorForm.visitorName || !visitorForm.relationship || !visitorForm.purpose}
              className="w-full bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20"
            >
              {submittingVisitor ? "Registering..." : "Log Visitor"}
            </Button>
          </CardContent>
        </Card>

        {/* Visitor List */}
        <Card className="glass-card border-t-2 border-t-teal-400/30 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Visitor Logbook</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {visitorLogs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8 text-sm">No visitor logs found.</p>
            ) : (
              <div className="space-y-4">
                {visitorLogs.map(visitor => (
                  <div key={visitor.id} className="p-4 rounded-lg border border-border/50 bg-background/30 flex flex-col gap-3">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-sm">{visitor.visitorName} ({visitor.relationship})</p>
                        <p className="text-xs text-muted-foreground">Visiting: <span className="text-foreground font-medium">{visitor.studentName}</span></p>
                      </div>
                      <Badge className={`text-xs capitalize ${visitor.status === "approved" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          visitor.status === "rejected" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                            "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                        }`}>{visitor.status}</Badge>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-muted/20 p-2.5 rounded text-muted-foreground">
                      <div><span className="block text-[10px] text-muted-foreground/70 font-semibold uppercase">Date</span><span className="text-foreground font-medium">{visitor.date}</span></div>
                      <div><span className="block text-[10px] text-muted-foreground/70 font-semibold uppercase">Purpose</span><span className="text-foreground font-medium">{visitor.purpose}</span></div>
                      <div><span className="block text-[10px] text-muted-foreground/70 font-semibold uppercase">Check-in</span><span className="text-foreground font-medium">{visitor.checkInTime || "—"}</span></div>
                      <div><span className="block text-[10px] text-muted-foreground/70 font-semibold uppercase">Check-out</span><span className="text-foreground font-medium">{visitor.checkOutTime || "—"}</span></div>
                    </div>

                    {/* Warden Action triggers */}
                    {isWarden && (
                      <div className="flex items-center gap-2 mt-1 pt-2 border-t border-border/30">
                        {visitor.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                              onClick={() => handleVisitorUpdate(visitor.id, "approved", null)}
                            >
                              Approve Entry
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7 text-red-400 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => handleVisitorUpdate(visitor.id, "rejected", null)}
                            >
                              Deny Entry
                            </Button>
                          </>
                        )}
                        {visitor.status === "approved" && !visitor.checkOutTime && (
                          <div className="flex items-center gap-2 w-full">
                            <Input
                              placeholder="Log check-out time..."
                              size="sm"
                              className="h-8 max-w-[200px]"
                              value={checkOutMap[visitor.id] ?? ""}
                              onChange={(e) => setCheckOutMap(prev => ({ ...prev, [visitor.id]: e.target.value }))}
                            />
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-8 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                              onClick={() => handleVisitorUpdate(visitor.id, "approved", checkOutMap[visitor.id] || new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' }))}
                            >
                              Log Exit
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )}
    {/* Hostel Profiles Tab */}
    {tab === "profiles" && (
      <Card className="border-t-2 border-t-teal-400/30">
        <CardHeader>
          <CardTitle className="text-base">Hostel Profiles (Active Allocations)</CardTitle>
        </CardHeader>
        <CardContent>
          {allocationsLoading ? (
            <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : allocations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">No active hostel allocations found.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="w-full text-sm">
                <TableHeader>
                  <TableRow className="text-left text-xs text-muted-foreground border-b border-border/40">
                    <TableHead className="py-2 px-2">Student</TableHead>
                    <TableHead className="py-2 px-2">Building/Block</TableHead>
                    <TableHead className="py-2 px-2">Room Number</TableHead>
                    <TableHead className="py-2 px-2">Bed Designation</TableHead>
                    <TableHead className="py-2 px-2">Monthly Fee</TableHead>
                    <TableHead className="py-2 px-2">Allocated Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map(al => (
                    <TableRow key={al.id} className="border-b border-border/20 hover:bg-white/5">
                      <TableCell className="py-2 px-2 font-medium">
                        {al.studentName} <span className="text-xs text-muted-foreground">({al.studentRoll})</span>
                      </TableCell>
                      <TableCell className="py-2 px-2 text-muted-foreground text-xs">{al.hostelName} / {al.block}</TableCell>
                      <TableCell className="py-2 px-2 font-semibold text-teal-400">{al.roomNumber} <span className="text-xs font-normal text-muted-foreground">({al.roomType})</span></TableCell>
                      <TableCell className="py-2 px-2 text-muted-foreground font-mono text-xs">{al.bed}</TableCell>
                      <TableCell className="py-2 px-2 text-muted-foreground text-xs">₹{al.monthlyFee.toLocaleString("en-IN")}/mo</TableCell>
                      <TableCell className="py-2 px-2 text-xs text-muted-foreground">{al.appliedAt ? al.appliedAt.split("T")[0] : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    )}

    {/* Room Allocation Dialog */}
    <Dialog open={allocationOpen} onOpenChange={setAllocationOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Allocate Room & Bed</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <p className="text-sm font-semibold mb-1">Student: <span className="text-teal-400">{allocatingApp?.studentName}</span></p>
            <p className="text-xs text-muted-foreground">Preferred Block: {allocatingApp?.preferredBlockName || allocatingApp?.preferredBlock} - Type: {allocatingApp?.preferredRoomType}</p>
          </div>
          <div>
            <Label>Select Room *</Label>
            <Select value={selectedRoomId} onValueChange={setSelectedRoomId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select available room" /></SelectTrigger>
              <SelectContent className="max-h-60">
                {approvalRooms.map(r => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    Room {r.roomNumber} ({r.block} Block) - {r.occupied}/{r.capacity} occupied - INR {Number(r.monthlyFee).toLocaleString("en-IN")}/mo
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {allocatingApp && approvalRooms.length === 0 && <p className="text-xs text-amber-400 mt-1">No available {allocatingApp.preferredRoomType} rooms remain in {allocatingApp.preferredBlockName || "the selected block"}.</p>}
          </div>
          <div>
            <Label>Bed Designation / Code (e.g. Bed A, Bed 1) *</Label>
            <Input className="mt-1" value={bedName} onChange={e => setBedName(e.target.value)} placeholder="e.g. Bed A" />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setAllocationOpen(false)}>Cancel</Button>
            <Button className="flex-1" disabled={!selectedRoomId || !bedName || updateAppMutation.isPending} onClick={() => {
              updateAppMutation.mutate({
                id: allocatingApp.id,
                data: {
                  status: "approved",
                  roomId: parseInt(selectedRoomId),
                  bed: bedName || undefined
                }
              }, {
                onSuccess: () => {
                  setAllocationOpen(false);
                  setAllocatingApp(null);
                }
              });
            }}>
              {updateAppMutation.isPending ? "Confirming..." : "Confirm & Approve"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>);
}
