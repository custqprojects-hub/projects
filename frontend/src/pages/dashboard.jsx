import { useAuth } from "@/lib/auth";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetAttendanceOverview,
  useGetFeeCollectionStats,
  useListTransportRoutes,
  useListVehicles,
  useListHostelRooms,
  useGetHostelSummary,
  useListMaterials,
  useListVendors,
  useListPurchaseOrders,
  useGetStudentAttendanceSummary,
  useListFees,
  useListAnnouncements,
  UserRole,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivityQueryKey,
  getGetAttendanceOverviewQueryKey,
  getGetFeeCollectionStatsQueryKey,
  useGetTodayCheckIn,
  useCheckIn,
  useCheckOut
} from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, GraduationCap, Wallet, Building, Bell, UserPlus, CheckCircle, Clock, Bus, MapPin, Package, BedDouble, ShoppingCart, AlertTriangle, ArrowDownToLine, BookOpen, FileText, TrendingUp, TrendingDown, Award, CalendarCheck, ArrowRight, Activity, Zap, MessageSquare, CalendarDays, UserCheck, Library, UserCog, Navigation, LogIn, LogOut, X, AlertCircle, Flag, CheckCircle2, XCircle, Clock as ClockIcon } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Link, useLocation } from "wouter";
import { useState, useCallback } from "react";
import { toast } from "sonner";

// â”€â”€â”€ Animation Variants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const itemVariants = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } } };

// â”€â”€â”€ Role welcome messages â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const roleWelcomes = {
  [UserRole.admin]: { title: "Admin Command Center", subtitle: "Full system overview and control.", accent: "from-violet-500 to-purple-600" },
  [UserRole.teacher]: { title: "Teacher Dashboard", subtitle: "Manage your classes, students, and lessons.", accent: "from-emerald-500 to-teal-600" },
  [UserRole.student]: { title: "Student Portal", subtitle: "Track your academics, attendance, and assignments.", accent: "from-cyan-500 to-sky-600" },
  [UserRole.parent]: { title: "Parent Portal", subtitle: "Monitor your child's progress and school activities.", accent: "from-orange-500 to-amber-600" },
  [UserRole.accountant]: { title: "Finance Dashboard", subtitle: "Fee collection, payments, and financial reports.", accent: "from-yellow-500 to-amber-600" },
  [UserRole.clerk]: { title: "Office Dashboard", subtitle: "Admissions, student records, and visitors.", accent: "from-teal-500 to-cyan-600" },
  [UserRole.hostel_warden]: { title: "Hostel Dashboard", subtitle: "Room management, occupancy, and applications.", accent: "from-rose-500 to-pink-600" },
  [UserRole.transport_manager]: { title: "Transport Dashboard", subtitle: "Routes, vehicles, and student assignments.", accent: "from-blue-500 to-indigo-600" },
  [UserRole.driver]: { title: "Driver Portal", subtitle: "Your assigned routes and schedule.", accent: "from-sky-500 to-blue-600" },
  [UserRole.store_manager]: { title: "Store Dashboard", subtitle: "Inventory, purchase orders, and vendors.", accent: "from-lime-500 to-green-600" },
  [UserRole.vendor]: { title: "Vendor Portal", subtitle: "Orders, deliveries, and payment history.", accent: "from-purple-500 to-violet-600" },
  [UserRole.librarian]: { title: "Library Dashboard", subtitle: "Book catalogue, issuances, and overdue tracking.", accent: "from-amber-500 to-yellow-600" },
};

// â”€â”€â”€ QuickActions Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function QuickActions({ items }) {
  return (
    <div className={`grid grid-cols-3 sm:grid-cols-${Math.min(items.length, 6)} gap-3`}>
      {items.map(a => (
        <div key={a.label + a.href}>
          {a.onClick ? (
            <div 
              onClick={a.onClick}
              className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 ${a.color}`}
            >
              <a.icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold text-center leading-tight">{a.label}</span>
            </div>
          ) : (
            <Link href={a.href}>
              <div className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-pointer transition-all duration-200 hover:scale-105 hover:-translate-y-0.5 ${a.color}`}>
                <a.icon className="w-5 h-5" />
                <span className="text-[10px] font-semibold text-center leading-tight">{a.label}</span>
              </div>
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

// â”€â”€â”€ CheckInOutCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CHECK_IN_START = { h: 10, m: 0 };
const CHECK_OUT_END = { h: 17, m: 30 };

function nowMinutes() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function toMinutes({ h, m }) { return h * 60 + m; }
function formatTime(date) { return format(date, "hh:mm a"); }

function ReasonModal({ type, onConfirm, onCancel }) {
  const [reason, setReason] = useState("");
  const isLate = type === "late";
  const title = isLate ? "Late Check-In" : "Early Check-Out";
  const icon = isLate ? <LogIn className="w-5 h-5 text-amber-400" /> : <LogOut className="w-5 h-5 text-rose-400" />;
  const accent = isLate ? "border-t-amber-400/50 from-amber-500/10" : "border-t-rose-400/50 from-rose-500/10";
  const btnCls = isLate ? "bg-amber-500 hover:bg-amber-600 text-white" : "bg-rose-500 hover:bg-rose-600 text-white";
  const desc = isLate
    ? "You're checking in after 10:00 AM. Please provide a reason for the late arrival."
    : "You're checking out before 5:30 PM. Please provide a reason for the early departure.";

  return (
    <AnimatePresence>
      <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
        <motion.div 
          className={`relative w-full max-w-md rounded-2xl glass-card border-t-2 ${accent} bg-linear-to-br to-transparent p-6 shadow-2xl`}
          initial={{ scale: 0.95, opacity: 0, y: 12 }} 
          animate={{ scale: 1, opacity: 1, y: 0 }} 
          exit={{ scale: 0.95, opacity: 0, y: 12 }}
        >
          <button onClick={onCancel} className="absolute top-4 right-4 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2.5 rounded-xl ${isLate ? "bg-amber-500/15" : "bg-rose-500/15"}`}>{icon}</div>
            <div>
              <p className="font-serif font-semibold text-lg">{title}</p>
              <p className="text-xs text-muted-foreground">Action required</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{desc}</p>
          <textarea 
            className="w-full rounded-xl border border-border/60 bg-muted/30 text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 min-h-25" 
            placeholder="Enter your reason hereâ€¦" 
            value={reason} 
            onChange={e => setReason(e.target.value)} 
            autoFocus 
          />
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
            <Button size="sm" className={btnCls} disabled={!reason.trim()} onClick={() => onConfirm(reason.trim())}>Confirm {isLate ? "Check-In" : "Check-Out"}</Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function CheckInOutCard() {
  const { user } = useAuth();
  const canCheckIn = user && [
    "teacher", "clerk", "hostel_warden",
    "transport_manager", "driver", "store_manager",
    "librarian"
  ].includes(user.role);

  const queryClient = useQueryClient();
  const [modal, setModal] = useState(null);

  const queryKey = ["today-checkin"];

  const { 
    data: todayRecord = null, 
  } = useGetTodayCheckIn({
    query: { 
      enabled: !!canCheckIn,
      staleTime: 0,
      gcTime: 1000 * 60 * 10,
    }
  });

  const checkInMutation = useCheckIn({
    onSuccess: (newRecord) => {
      queryClient.setQueryData(queryKey, newRecord);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
      }, 300);
    },
    onError: (err) => {
      console.error("Check-in error:", err);
      toast.error("Check-in failed: " + (err?.message || err?.error || "Please try again"));
    }
  });

  const checkOutMutation = useCheckOut({
    onSuccess: (newRecord) => {
      queryClient.setQueryData(queryKey, newRecord);
      setTimeout(() => queryClient.invalidateQueries({ queryKey }), 300);
    },
    onError: (err) => {
      console.error("Check-out error:", err);
      toast.error("Check-out failed: " + (err?.message || err?.error || "Please try again"));
    }
  });

  const hasCheckedIn = !!todayRecord?.checkInTime;
  const hasCheckedOut = !!todayRecord?.checkOutTime;

  const checkInTime = todayRecord?.checkInTime ? new Date(todayRecord.checkInTime) : null;
  const checkOutTime = todayRecord?.checkOutTime ? new Date(todayRecord.checkOutTime) : null;

  const commitCheckIn = async (reason) => {
    try {
      const payload = { reason: reason?.trim() || null };
      const result = await checkInMutation.mutateAsync(payload);
      if (result) {
        queryClient.setQueryData(queryKey, result);
      }
      setModal(null);
    } catch (err) {
      // Error handled in onError
    }
  };

  const commitCheckOut = async (reason) => {
    try {
      const payload = { reason: reason?.trim() || null };
      const result = await checkOutMutation.mutateAsync(payload);
      if (result) {
        queryClient.setQueryData(queryKey, result);
      }
      setModal(null);
    } catch (err) {
      // Error handled in onError
    }
  };

  const handleCheckIn = () => {
    const mins = nowMinutes();
    if (mins > toMinutes(CHECK_IN_START)) {
      setModal("late");
    } else {
      commitCheckIn(null);
    }
  };

  const handleCheckOut = () => {
    const mins = nowMinutes();
    if (mins < toMinutes(CHECK_OUT_END)) {
      setModal("early");
    } else {
      commitCheckOut(null);
    }
  };

  const duration = checkInTime && checkOutTime
    ? `${Math.floor((checkOutTime - checkInTime) / 60000 / 60)}h ${Math.floor((checkOutTime - checkInTime) / 60000 % 60)}m`
    : null;

  if (!canCheckIn)
    return null;

  return (
    <>
      {modal && (
        <ReasonModal
          type={modal}
          onConfirm={modal === "late" ? commitCheckIn : commitCheckOut}
          onCancel={() => setModal(null)}
        />
      )}

      <motion.div variants={fadeUp}>
        <Card className="glass-card border-t-2 border-t-primary/30 overflow-hidden">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="w-4 h-4 text-primary/70" />
                  <p className="font-serif font-semibold text-sm">Attendance Â· Today</p>
                  <Badge variant="outline" className="text-[10px]">
                    {format(new Date(), "EEE, MMM d")}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Working hours <span className="font-medium">10:00 AM â€“ 5:30 PM</span>
                </p>

                {(hasCheckedIn || hasCheckedOut) && (
                  <div className="flex flex-wrap gap-4 mt-3">
                    {hasCheckedIn && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="text-xs">
                          In <span className="font-semibold text-emerald-400">{formatTime(checkInTime)}</span>
                        </span>
                        {todayRecord?.checkInReason && <Badge className="text-[9px] bg-amber-500/10 text-amber-400">Late</Badge>}
                      </div>
                    )}
                    {hasCheckedOut && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-rose-400" />
                        <span className="text-xs">
                          Out <span className="font-semibold text-rose-400">{formatTime(checkOutTime)}</span>
                        </span>
                        {todayRecord?.checkOutReason && <Badge className="text-[9px] bg-rose-500/10 text-rose-400">Early</Badge>}
                      </div>
                    )}
                    {duration && (
                      <span className="text-xs text-muted-foreground">
                        Duration: <span className="font-semibold">{duration}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={hasCheckedIn || checkInMutation.isPending}
                  onClick={handleCheckIn}
                  className={hasCheckedIn ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-emerald-500 hover:bg-emerald-600"}
                >
                  <LogIn className="w-4 h-4 mr-1" />
                  {hasCheckedIn ? "Checked In" : "Check In"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={!hasCheckedIn || hasCheckedOut || checkOutMutation.isPending}
                  onClick={handleCheckOut}
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  {hasCheckedOut ? "Checked Out" : "Check Out"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}

// â”€â”€â”€ Leave Application Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function LeaveApplicationModal({ isOpen, onClose, applicantType = "staff" }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    leaveType: "casual",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      leaveType: "casual",
      startDate: "",
      endDate: "",
      reason: "",
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Get today's date at midnight for comparison
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Validate start date
    if (!formData.startDate) {
      newErrors.startDate = "Start date is required";
    } else {
      const startDateObj = new Date(formData.startDate);
      startDateObj.setHours(0, 0, 0, 0);
      
      // Check if start date is in the past
      if (startDateObj < today) {
        newErrors.startDate = "Start date cannot be in the past";
      }
    }
    
    // Validate end date
    if (!formData.endDate) {
      newErrors.endDate = "End date is required";
    } else if (formData.startDate && formData.endDate) {
      const startDateObj = new Date(formData.startDate);
      const endDateObj = new Date(formData.endDate);
      startDateObj.setHours(0, 0, 0, 0);
      endDateObj.setHours(0, 0, 0, 0);
      
      if (endDateObj < startDateObj) {
        newErrors.endDate = "End date cannot be before start date";
      }
    }
    
    // Validate reason
    if (!formData.reason || formData.reason.length < 10) {
      newErrors.reason = "Please provide a detailed reason (minimum 10 characters)";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          ...formData,
          applicantType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to apply for leave");
      }

      toast.success("Leave Applied Successfully", {
        description: "Your leave request has been submitted for approval.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      onClose();
      resetForm();
    } catch (error) {
      toast.error("Error", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-gray-900 rounded-xl shadow-2xl border border-gray-700"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Apply for Leave</h2>
                <p className="text-sm text-gray-400">Submit a leave request for approval</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Leave Type</label>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.leaveType}
                  onChange={(e) => setFormData({ ...formData, leaveType: e.target.value })}
                >
                  <option value="casual">Casual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="earned">Earned Leave</option>
                  <option value="emergency">Emergency Leave</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Start Date</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    className={`w-full rounded-lg border ${errors.startDate ? 'border-red-500' : 'border-gray-700'} bg-gray-800 text-white p-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    value={formData.startDate}
                    onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                    min={new Date().toISOString().split("T")[0]}
                  />
                </div>
                {errors.startDate && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {errors.startDate}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">End Date</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="date"
                    className={`w-full rounded-lg border ${errors.endDate ? 'border-red-500' : 'border-gray-700'} bg-gray-800 text-white p-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    value={formData.endDate}
                    onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                    min={formData.startDate || new Date().toISOString().split("T")[0]}
                  />
                </div>
                {errors.endDate && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {errors.endDate}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Reason</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    className={`w-full rounded-lg border ${errors.reason ? 'border-red-500' : 'border-gray-700'} bg-gray-800 text-white p-3 pl-10 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[100px]`}
                    placeholder="Please provide a detailed reason for your leave request..."
                    value={formData.reason}
                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                  />
                </div>
                {errors.reason && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {errors.reason}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Apply for Leave"}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// â”€â”€â”€ Complaint Modal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ComplaintModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    category: "general",
    title: "",
    description: "",
    priority: "medium",
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFormData({
      category: "general",
      title: "",
      description: "",
      priority: "medium",
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title || formData.title.length < 5) {
      newErrors.title = "Title must be at least 5 characters";
    }
    if (!formData.description || formData.description.length < 20) {
      newErrors.description = "Description must be at least 20 characters";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit complaint");
      }

      toast.success("Complaint Submitted", {
        description: "Your complaint has been registered and will be addressed shortly.",
      });
      
      queryClient.invalidateQueries({ queryKey: ["complaints"] });
      onClose();
      resetForm();
    } catch (error) {
      toast.error("Error", {
        description: error.message,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/70" onClick={onClose} />
        <motion.div
          className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-gray-900 rounded-xl shadow-2xl border border-gray-700"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Raise a Complaint</h2>
                <p className="text-sm text-gray-400">Submit your concern for resolution</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Category</label>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="general">General</option>
                  <option value="academic">Academic</option>
                  <option value="hostel">Hostel</option>
                  <option value="transport">Transport</option>
                  <option value="faculty">Faculty</option>
                  <option value="infrastructure">Infrastructure</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Priority</label>
                <select
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 text-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Title</label>
                <div className="relative">
                  <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    className={`w-full rounded-lg border ${errors.title ? 'border-red-500' : 'border-gray-700'} bg-gray-800 text-white p-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent`}
                    placeholder="Brief title of your complaint..."
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                {errors.title && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {errors.title}
                  </p>
                )}
              </div>

              <div>
                <label className="text-sm font-medium text-gray-300 mb-1.5 block">Description</label>
                <div className="relative">
                  <AlertTriangle className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <textarea
                    className={`w-full rounded-lg border ${errors.description ? 'border-red-500' : 'border-gray-700'} bg-gray-800 text-white p-3 pl-10 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent min-h-[120px]`}
                    placeholder="Please provide a detailed description of your complaint..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
                {errors.description && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> {errors.description}
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    "Submitting..."
                  ) : (
                    <>
                      <MessageSquare className="w-4 h-4 mr-1.5" /> Submit Complaint
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// â”€â”€â”€ StatCard Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function StatCard({ title, value, icon: Icon, loading, color, bg, glow, down, href, onClick }) {
  const cardContent = (
    <Card className={`glass-card glass-hover ${href ? "cursor-pointer" : "cursor-default"} group transition-all duration-200 hover:shadow-lg ${glow ? `hover:${glow}` : ""}`}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className={`${bg} p-2.5 rounded-xl ${color} group-hover:scale-110 transition-transform duration-200`}>
            <Icon className="w-4 h-4" />
          </div>
          {down != null && <div className={`text-xs font-medium ${down ? "text-red-400" : "text-emerald-400"}`}>
            {down ? <TrendingDown className="w-3.5 h-3.5" /> : <TrendingUp className="w-3.5 h-3.5" />}
          </div>}
        </div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{title}</p>
        {loading ? <Skeleton className="h-8 w-24 mt-1" /> : <p className={`text-2xl font-bold tracking-tight ${color}`}>{value ?? "â€”"}</p>}
        {href && <p className="text-[10px] text-muted-foreground/50 mt-1">Click to view â†’</p>}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{cardContent}</Link>;
  return cardContent;
}

// â”€â”€â”€ Main Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [showComplaintModal, setShowComplaintModal] = useState(false);
  
  const isAdmin = user?.role === UserRole.admin;
  const isTeacher = user?.role === UserRole.teacher;
  const isAccountant = user?.role === UserRole.accountant;
  const isWarden = user?.role === UserRole.hostel_warden;
  const isTransportManager = user?.role === UserRole.transport_manager;
  const isDriver = user?.role === UserRole.driver;
  const isTransport = isTransportManager;
  const isStore = user?.role === UserRole.store_manager;
  const isVendor = user?.role === UserRole.vendor;
  const isStudent = user?.role === UserRole.student;
  const isParent = user?.role === UserRole.parent;
  const isClerk = user?.role === UserRole.clerk;
  const isLibrarian = user?.role === UserRole.librarian;
  
  // Check if user can access leave and complaint features (excluding driver)
  const canAccessLeaveComplaint =  isTeacher  || isClerk || isWarden || isTransportManager || isStore || isLibrarian || isVendor || isDriver || isAccountant;
   
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), enabled: !!user },
  });
  const { data: activity, isLoading: loadingActivity } = useGetRecentActivity({
    query: { queryKey: getGetRecentActivityQueryKey(), enabled: !!user },
  });
  const { data: feeData, isLoading: loadingFees } = useGetFeeCollectionStats({
    query: { queryKey: getGetFeeCollectionStatsQueryKey(), enabled: !!user && (isAdmin || isAccountant) },
  });
  const { data: routes = [] } = useListTransportRoutes({ query: { enabled: isTransport } });
  const { data: vehicles = [] } = useListVehicles({ query: { enabled: isTransport } });
  const { data: hostelSummary } = useGetHostelSummary({ query: { enabled: isWarden || isAdmin } });
  const { data: rooms = [] } = useListHostelRooms({ query: { enabled: isWarden, staleTime: 30000 } });
  const { data: materials = [] } = useListMaterials(undefined, { query: { enabled: isAdmin } });
  const { data: vendors = [] } = useListVendors({ query: { enabled: isStore || isVendor || isAdmin } });
  const { data: purchaseOrders = [] } = useListPurchaseOrders({}, { query: { enabled: isVendor || isStore || isAdmin } });
  const { data: inventorySummary } = useQuery({ 
    queryKey: ["inventory", "reports", "summary"], 
    queryFn: async () => { const r = await fetch("/api/inventory/reports/summary", { credentials: "include" }); return r.json(); }, 
    enabled: isStore || isAdmin, 
    staleTime: 10000 
  });
  const { data: lowStockProducts = [] } = useQuery({ 
    queryKey: ["inventory", "low-stock"], 
    queryFn: async () => { const r = await fetch("/api/inventory/low-stock", { credentials: "include" }); return r.json(); }, 
    enabled: isStore || isAdmin, 
    staleTime: 10000 
  });
  const { data: studentAttendance } = useGetStudentAttendanceSummary(user?.studentId ?? 0, { 
    query: { enabled: isStudent && !!user?.studentId, staleTime: 30000 } 
  });
  const { data: studentFees = [] } = useListFees({}, { 
    query: { enabled: isStudent || isParent, staleTime: 30000 } 
  });
  const { data: announcements = [] } = useListAnnouncements(undefined, { 
    query: { enabled: isStudent || isParent, staleTime: 30000 } 
  });
  const { data: books = [] } = useQuery({
    queryKey: ["library", "books"],
    queryFn: async () => {
      const res = await fetch("/api/library/books", { credentials: "include" });
      return res.ok ? res.json() : [];
    },
    enabled: isLibrarian,
    staleTime: 30000,
  });
  const { data: attendanceData, isLoading: loadingAttendance } = useGetAttendanceOverview({
    query: { queryKey: getGetAttendanceOverviewQueryKey(), enabled: !!user && (isAdmin || isTeacher) },
  });
  
  const bookCategoryStats = Object.entries(
    books.reduce((acc, book) => {
      const cat = book.category || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {})
  ).map(([name, count]) => ({ name, count }));
  // â”€â”€â”€ Leave Applications Query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: myLeaves = [] } = useQuery({
    queryKey: ["leaves"],
    queryFn: async () => {
      const res = await fetch("/api/leaves", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch leaves");
      const data = await res.json();
      return data;
    },
    enabled: !!user && !isDriver && (isAdmin || isTeacher || isStudent || isParent || isClerk || isWarden || isTransportManager || isStore || isLibrarian || isVendor),
    staleTime: 30000,
  });

  // â”€â”€â”€ Complaints Query â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: complaintsData = [] } = useQuery({
    queryKey: ["complaints"],
    queryFn: async () => {
      const res = await fetch("/api/complaints", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch complaints");
      const data = await res.json();
      return data;
    },
    enabled: !!user && !isDriver && (isAdmin || isTeacher || isStudent || isParent || isClerk || isWarden || isTransportManager || isStore || isLibrarian || isVendor),
    staleTime: 30000,
  });

  // For non-admin users, filter complaints to show only their own
  const myComplaints = isAdmin ? complaintsData : complaintsData.filter(c => {
    // If user is student, show complaints where they are the complainant
    if (isStudent) {
      return c.complainantType === "student" && c.complainantId === user?.studentId;
    }
    // For staff, show complaints they created
    return c.complainantType === "staff" || c.complainantType === "user";
  });

  // â”€â”€â”€ Complaint Stats (Admin only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const { data: complaintStats } = useQuery({
    queryKey: ["complaints", "stats"],
    queryFn: async () => {
      const res = await fetch("/api/complaints/stats", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch complaint stats");
      return res.json();
    },
    enabled: !!user && isAdmin,
    staleTime: 30000,
  });

  if (!user) return null;
  
  const welcome = roleWelcomes[user.role] ?? { title: "Dashboard", subtitle: "Welcome back.", accent: "from-primary to-blue-600" };
  const pendingFeeCount = studentFees.filter((f) => f.status === "pending").length;

  // â”€â”€â”€ Quick Action Items with onClick handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const quickActionItems = [
    { 
      label: "Apply Leave", 
      href: "#", 
      icon: CalendarCheck, 
      color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15",
      onClick: (e) => { e.preventDefault(); setShowLeaveModal(true); }
    },
    { 
      label: "Raise Complaint", 
      href: "#", 
      icon: MessageSquare, 
      color: "text-rose-400 bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15",
      onClick: (e) => { e.preventDefault(); setShowComplaintModal(true); }
    },
  ];

  // Helper function to get status color
  const getStatusColor = (status) => {
    const colors = {
      pending: "bg-amber-500/10 text-amber-400",
      in_progress: "bg-blue-500/10 text-blue-400",
      resolved: "bg-emerald-500/10 text-emerald-400",
      closed: "bg-muted/50 text-muted-foreground",
    };
    return colors[status] || colors.pending;
  };

  // Helper function to get priority color
  const getPriorityColor = (priority) => {
    const colors = {
      low: "bg-muted/50 text-muted-foreground",
      medium: "bg-blue-500/10 text-blue-400",
      high: "bg-amber-500/10 text-amber-400",
      urgent: "bg-red-500/10 text-red-400",
    };
    return colors[priority] || colors.medium;
  };

  return (
    <motion.div className="space-y-8" variants={containerVariants} initial="hidden" animate="show">
      {/* â”€â”€â”€ Welcome Header â”€â”€â”€ */}
      <motion.div variants={fadeUp} className="relative overflow-hidden rounded-2xl p-6 glass-card">
        <div className={`absolute inset-0 bg-linear-to-r ${welcome.accent} opacity-[0.06] pointer-events-none`} />
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full bg-linear-to-br from-white/5 to-transparent -translate-y-1/2 translate-x-1/4 pointer-events-none" />
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight">{welcome.title}</h1>
              <p className="text-muted-foreground mt-1">{welcome.subtitle}</p>
              <div className="flex items-center gap-2 mt-3">
                <Badge className="capitalize bg-primary/10 text-primary border-primary/25 text-xs">
                  {user.role.replace(/_/g, " ")}
                </Badge>
                <Badge variant="outline" className="text-xs text-muted-foreground border-border/50">
                  {format(new Date(), "EEEE, MMM d")}
                </Badge>
              </div>
            </div>
            <div className="text-right sm:shrink-0">
              <p className="text-xs text-muted-foreground">Signed in as</p>
              <p className="font-semibold text-sm">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* â”€â”€â”€ Check-In / Check-Out Card â”€â”€â”€ */}
      <CheckInOutCard />

      {/* â”€â”€â”€ Quick Action Buttons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {/* Only show for users who can apply leave/raise complaints (excluding driver) */}
      {canAccessLeaveComplaint && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-3">
          <Button 
            onClick={() => setShowLeaveModal(true)} 
            className="h-auto py-4 flex flex-col items-center gap-1.5 bg-gradient-to-br from-blue-500/90 to-blue-600/90 hover:from-blue-600/90 hover:to-blue-700/90 border-0 shadow-lg shadow-blue-500/25"
          >
            <CalendarCheck className="w-6 h-6" />
            <span className="text-sm font-semibold">Apply Leave</span>
            <span className="text-[10px] opacity-80">Submit a leave request</span>
          </Button>
          
          <Button 
            onClick={() => setShowComplaintModal(true)} 
            className="h-auto py-4 flex flex-col items-center gap-1.5 bg-gradient-to-br from-rose-500/90 to-rose-600/90 hover:from-rose-600/90 hover:to-rose-700/90 border-0 shadow-lg shadow-rose-500/25"
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-sm font-semibold">Raise Complaint</span>
            <span className="text-[10px] opacity-80">Report an issue</span>
          </Button>
        </motion.div>
      )}

      {/* â”€â”€â”€ Modals â”€â”€â”€ */}
      <LeaveApplicationModal 
        isOpen={showLeaveModal}
        onClose={() => setShowLeaveModal(false)}
        applicantType={isStudent || isParent ? "student" : "staff"}
      />

      <ComplaintModal 
        isOpen={showComplaintModal}
        onClose={() => setShowComplaintModal(false)}
      />

      {/* â”€â”€â”€ ADMIN / TEACHER / CLERK: Stats Grid â”€â”€â”€ */}
      {(isAdmin || isTeacher || isClerk  || isLibrarian  ) && (
        <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {[
            { title: "Total Students", value: summary?.totalStudents, icon: Users, color: "text-sky-400", bg: "bg-sky-500/10", glow: "shadow-sky-500/20", href: "/students", show: true },
            { title: "Total Staff", value: summary?.totalStaff, icon: GraduationCap, color: "text-purple-400", bg: "bg-purple-500/10", glow: "shadow-purple-500/20", href: "/staff", show: isAdmin },
            { title: "Present Today", value: summary?.presentToday != null ? `${summary.presentToday}%` : undefined, icon: CheckCircle, color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "shadow-emerald-500/20", href: "/attendance", show: isAdmin || isTeacher },
            { title: "Pending Fees", value: summary?.pendingFees ? `${(summary.pendingFees / 1000).toFixed(0)}K` : undefined, icon: Wallet, color: "text-amber-400", bg: "bg-amber-500/10", glow: "shadow-amber-500/20", href: "/fees", show: isAdmin, down: true },
            { title: "Pending Admissions", value: summary?.pendingAdmissions, icon: UserPlus, color: "text-violet-400", bg: "bg-violet-500/10", glow: "shadow-violet-500/20", href: "/admissions", show: isAdmin || isClerk },
            { title: "Announcements", value: summary?.activeAnnouncements, icon: Bell, color: "text-cyan-400", bg: "bg-cyan-500/10", glow: "shadow-cyan-500/20", href: "/announcements", show: true },
            { title: "Hostel Occupancy", value: summary?.hostelOccupancy != null ? `${summary.hostelOccupancy}%` : undefined, icon: Building, color: "text-teal-400", bg: "bg-teal-500/10", glow: "shadow-teal-500/20", href: "/hostel", show: isAdmin },
          ].filter(s => s.show).map((s, i) => (
            <motion.div key={s.title} variants={itemVariants} style={{ animationDelay: `${i * 0.05}s` }}>
              <StatCard {...s} loading={loadingSummary} onClick={() => setLocation(s.href)} />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* â”€â”€â”€ TEACHER quick actions â”€â”€â”€ */}
      {isTeacher && (
        <motion.div variants={itemVariants} className="space-y-4">
          <QuickActions items={[
            { label: "Attendance", href: "/attendance", icon: CalendarCheck, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500/15" },
            { label: "Grade Results", href: "/exam-results", icon: Award, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15" },
            { label: "Timetable", href: "/timetable", icon: CalendarDays, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            { label: "Assignments", href: "/assignments", icon: BookOpen, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            { label: "Lesson Plans", href: "/lesson-plans", icon: FileText, color: "text-amber-400 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15" },
             ]} />
          
          {attendanceData?.byClass && attendanceData.byClass.length > 0 && (
            <Card className="glass-card border-t-2 border-t-emerald-400/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-serif">Class Attendance Health</CardTitle>
                <CardDescription>Classes needing attention (below 75%)</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {attendanceData.byClass.map((cls) => {
                    const pct = cls.percentage ?? 0;
                    const color = pct >= 85 ? "bg-emerald-400" : pct >= 75 ? "bg-amber-400" : "bg-red-400";
                    const textColor = pct >= 85 ? "text-emerald-400" : pct >= 75 ? "text-amber-400" : "text-red-400";
                    return (
                      <div key={cls.className} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{cls.className}</span>
                          <span className={`font-bold text-xs ${textColor}`}>{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* â”€â”€â”€ ACCOUNTANT panel â”€â”€â”€ */}
      {isAccountant && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard title="Pending Fees" value={summary?.pendingFees ? `â‚¹${summary.pendingFees.toLocaleString("en-IN")}` : undefined} icon={Wallet} color="text-amber-400" bg="bg-amber-500/10" glow="shadow-amber-500/20" loading={loadingSummary} down href="/fees" onClick={() => setLocation("/fees")} />
            <StatCard title="Active Announcements" value={summary?.activeAnnouncements} icon={Bell} color="text-cyan-400" bg="bg-cyan-500/10" glow="shadow-cyan-500/20" loading={loadingSummary} href="/announcements" onClick={() => setLocation("/announcements")} />
            <StatCard title="Total Students" value={summary?.totalStudents} icon={Users} color="text-sky-400" bg="bg-sky-500/10" glow="shadow-sky-500/20" loading={loadingSummary} href="/students" onClick={() => setLocation("/students")} />
          </div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
          <QuickActions items={[
            { label: "Fee Records", href: "/fees", icon: Wallet, color: "text-amber-400 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15" },
            { label: "Vendors", href: "/vendors", icon: ShoppingCart, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25 hover:bg-yellow-500/15" },
            { label: "Purchase Orders", href: "/inventory/orders", icon: Package, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            { label: "Announcements", href: "/announcements", icon: Bell, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
                 ]} />
        </motion.div>
      )}

      {/* â”€â”€â”€ HOSTEL WARDEN panel â”€â”€â”€ */}
      {isWarden && (
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-lg font-serif font-semibold flex items-center gap-2"><Building className="w-5 h-5 text-rose-400" /> Hostel Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Total Rooms", value: hostelSummary?.totalRooms ?? rooms.length, icon: Building, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-t-rose-400/40", href: "/hostel" },
              { label: "Total Beds", value: hostelSummary?.totalBeds, icon: BedDouble, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-t-cyan-400/40", href: "/hostel" },
              { label: "Occupied", value: hostelSummary?.occupied, icon: Users, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-400/40", href: "/hostel" },
              { label: "Occupancy Rate", value: `${hostelSummary?.occupancyRate ?? 0}%`, icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-400/40", href: "/hostel" },
            ].map(s => (
              <Link key={s.label} href={s.href}>
                <Card className={`glass-card glass-hover border-t-2 ${s.border} cursor-pointer`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`${s.bg} p-2.5 rounded-lg ${s.color}`}><s.icon className="w-4 h-4" /></div>
                    <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value ?? "â€”"}</p></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <QuickActions items={[
            { label: "Hostel Rooms", href: "/hostel", icon: Building, color: "text-rose-400 bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15" },
            { label: "Hostel Roll", href: "/hostel-attendance", icon: CalendarCheck, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15" },
            { label: "Visitor Log", href: "/visitors", icon: UserCheck, color: "text-teal-400 bg-teal-500/10 border-teal-500/25 hover:bg-teal-500/15" },
            { label: "Leave Req", href: "/leaves", icon: CalendarCheck, color: "text-orange-400 bg-orange-500/10 border-orange-500/25 hover:bg-orange-500/15" },
            { label: "Announcements", href: "/announcements", icon: Bell, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
               ]} />
          
          {rooms.length > 0 && (
            <Card className="glass-card border-t-2 border-t-rose-500/30">
              <CardHeader><CardTitle className="text-base font-serif">Room Status at a Glance</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {rooms.slice(0, 8).map((room) => {
                    const pct = Math.round((room.occupied / room.capacity) * 100);
                    return (
                      <Link key={room.id} href="/hostel">
                        <div className="p-3 rounded-lg border border-border/50 glass-hover bg-card/50 cursor-pointer">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-medium text-sm">Room {room.roomNumber}</p>
                            <span className="text-xs text-muted-foreground">{pct}%</span>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">Block {room.block} Â· {room.occupied}/{room.capacity}</p>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div className="h-full bg-rose-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {rooms.length > 0 && (
            <Card className="glass-card border-t-2 border-t-rose-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-serif">Hostel Room Occupancy Rates</CardTitle>
                    <CardDescription>Current utilization percentage per room</CardDescription>
                  </div>
                  <Link href="/hostel"><Button variant="outline" size="sm" className="gap-1.5">View All <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rooms.slice(0, 10).map(r => ({ name: `Room ${r.roomNumber}`, rate: Math.round((r.occupied / r.capacity) * 100) }))} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} domain={[0, 100]} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                    <Bar dataKey="rate" name="Occupancy %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* â”€â”€â”€ TRANSPORT panel â”€â”€â”€ */}
      {isTransport && (
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-lg font-serif font-semibold flex items-center gap-2"><Bus className="w-5 h-5 text-blue-400" /> Transport Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: "Active Routes", value: routes.filter(r => r.status === "active").length, icon: MapPin, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-t-blue-400/40", href: "/transport/routes" },
              { label: "Vehicles", value: vehicles.length, icon: Bus, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-t-cyan-400/40", href: "/transport/vehicles" },
              { label: "Total Routes", value: routes.length, icon: Activity, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-t-sky-400/40", href: "/transport/routes" },
              { label: "Active Vehicles", value: vehicles.filter(v => v.status === "active").length, icon: Zap, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-400/40", href: "/transport/vehicles" },
            ].map(s => (
              <Link key={s.label} href={s.href}>
                <Card className={`glass-card glass-hover border-t-2 ${s.border} cursor-pointer`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`${s.bg} p-2.5 rounded-lg ${s.color}`}><s.icon className="w-4 h-4" /></div>
                    <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value}</p></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <QuickActions items={[
            { label: "Routes", href: "/transport/routes", icon: MapPin, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            { label: "Vehicles", href: "/transport/vehicles", icon: Bus, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500/15" },
            { label: "Drivers", href: "/transport/drivers", icon: UserCog, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/25 hover:bg-indigo-500/15" },
            { label: "Students", href: "/transport/assignments", icon: Users, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            ...(isDriver ? [{ label: "My Route", href: "/my-route", icon: Navigation, color: "text-sky-400 bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/15" }] : []),
            { label: "Announcements", href: "/announcements", icon: Bell, color: "text-sky-400 bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/15" },
          ]} />
          
          {routes.length > 0 && (
            <Card className="glass-card border-t-2 border-t-blue-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-serif">Today's Routes Â· {routes.length}</CardTitle>
                  <Link href="/transport/routes"><Button variant="outline" size="sm" className="gap-1.5">Manage <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {routes.slice(0, 5).map((route) => (
                    <Link key={route.id} href="/transport/routes">
                      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 hover:bg-muted/20 transition-colors cursor-pointer">
                        <div>
                          <p className="font-medium text-sm">{route.name}</p>
                          <p className="text-xs text-muted-foreground">{route.startPoint} â†’ {route.endPoint}</p>
                        </div>
                        <div className="text-xs text-muted-foreground text-right">
                          {route.morningTime && <p>AM: {route.morningTime}</p>}
                          {route.eveningTime && <p>PM: {route.eveningTime}</p>}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* â”€â”€â”€ STORE MANAGER panel â”€â”€â”€ */}
      {isStore && (
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-lg font-serif font-semibold flex items-center gap-2"><Package className="w-5 h-5 text-yellow-400" /> Inventory Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Link href="/inventory/products"><Card className="glass-card glass-hover border-t-2 border-t-yellow-500/40 cursor-pointer"><CardContent className="p-4 flex items-center gap-3"><div className="bg-yellow-500/10 p-2.5 rounded-lg text-yellow-400"><Package className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Products</p><p className="text-xl font-bold text-yellow-400">{inventorySummary?.totalProducts ?? 0}</p></div></CardContent></Card></Link>
            <Link href="/inventory/stock"><Card className="glass-card glass-hover border-t-2 border-t-green-500/40 cursor-pointer"><CardContent className="p-4 flex items-center gap-3"><div className="bg-green-500/10 p-2.5 rounded-lg text-green-400"><Package className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Total Stock</p><p className="text-xl font-bold text-green-400">{inventorySummary?.totalStock ?? 0}</p></div></CardContent></Card></Link>
            <Link href="/inventory/reports"><Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40 cursor-pointer"><CardContent className="p-4 flex items-center gap-3"><div className="bg-emerald-500/10 p-2.5 rounded-lg text-emerald-400"><Wallet className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Inventory Value</p><p className="text-xl font-bold text-emerald-400">{inventorySummary ? `â‚¹${inventorySummary.inventoryValue.toLocaleString("en-IN")}` : "â‚¹0"}</p></div></CardContent></Card></Link>
            <Link href="/inventory/orders"><Card className="glass-card glass-hover border-t-2 border-t-amber-500/40 cursor-pointer"><CardContent className="p-4 flex items-center gap-3"><div className="bg-amber-500/10 p-2.5 rounded-lg text-amber-400"><ShoppingCart className="w-4 h-4" /></div><div><p className="text-xs text-muted-foreground">Purchase Orders</p><p className="text-xl font-bold text-amber-400">{purchaseOrders.length}</p></div></CardContent></Card></Link>
          </div>

          <Card className={`glass-card border-t-2 ${(inventorySummary?.lowStockCount ?? 0) > 0 ? "border-t-red-500/40" : "border-t-green-500/30"}`}>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${(inventorySummary?.lowStockCount ?? 0) > 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"}`}>
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="font-serif font-semibold">Low-Stock Alerts</p>
                    {(inventorySummary?.lowStockCount ?? 0) > 0 ? (
                      <p className="text-sm text-muted-foreground"><span className="text-red-400 font-bold">{inventorySummary?.lowStockCount}</span> products at or below their reorder threshold. Create POs to refill.</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">All products are above their reorder threshold.</p>
                    )}
                  </div>
                </div>
                <Link href="/inventory/low-stock"><Button variant="outline" size="sm" className="gap-1.5 shrink-0">View low-stock items <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
              </div>
              {lowStockProducts.length > 0 && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lowStockProducts.slice(0, 4).map((p) => (
                    <Link key={p.id} href="/inventory/low-stock">
                      <div className="flex items-center justify-between text-sm bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2 hover:bg-red-500/10 cursor-pointer transition-colors">
                        <span className="font-medium truncate">{p.name}</span>
                        <span className="text-xs"><span className="text-red-400 font-bold">{p.currentStock}</span><span className="text-muted-foreground"> / {p.reorderThreshold}</span></span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <QuickActions items={[
            { label: "Products", href: "/inventory/products", icon: Package, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25 hover:bg-yellow-500/15" },
            { label: "Stock", href: "/inventory/stock", icon: ArrowDownToLine, color: "text-green-400 bg-green-500/10 border-green-500/25 hover:bg-green-500/15" },
            { label: "Purchase Orders", href: "/inventory/orders", icon: ShoppingCart, color: "text-amber-400 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15" },
            { label: "Suppliers", href: "/inventory/suppliers", icon: Building, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25 hover:bg-yellow-500/15" },
            { label: "Vendors", href: "/vendors", icon: Users, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            { label: "Reports", href: "/inventory/reports", icon: FileText, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15" },
               ]} />

          {inventorySummary?.byCategory && inventorySummary.byCategory.length > 0 && (
            <Card className="glass-card border-t-2 border-t-yellow-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-serif">Stock Levels by Category</CardTitle>
                    <CardDescription>Visual breakdown of items currently in stock</CardDescription>
                  </div>
                  <Link href="/inventory/reports"><Button variant="outline" size="sm" className="gap-1.5">Full Report <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={inventorySummary.byCategory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                    <Bar dataKey="stock" fill="hsl(var(--primary))" name="Items in Stock" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* â”€â”€â”€ VENDOR panel â”€â”€â”€ */}
      {isVendor && (
        <motion.div variants={itemVariants} className="space-y-4">
          {(() => {
            const myProfile = vendors.find((v) => v.email === user?.email);
            const myOrders = purchaseOrders.filter((o) => String(o.vendorId) === String(myProfile?.id ?? -1));
            const pending = myOrders.filter((o) => o.status === "sent" || o.status === "draft").length;
            const delivered = myOrders.filter((o) => o.status === "delivered" || o.status === "paid").length;
            const totalValue = myOrders.reduce((a, o) => a + Number(o.totalAmount ?? 0), 0);
            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Orders", value: myOrders.length, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-t-yellow-500/40", icon: ShoppingCart, href: "/vendor-finance" },
                    { label: "Pending", value: pending, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-500/40", icon: Clock, href: "/vendor-finance" },
                    { label: "Delivered", value: delivered, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: CheckCircle, href: "/vendor-finance" },
                    { label: "Order Value", value: totalValue > 0 ? `â‚¹${(totalValue / 1000).toFixed(0)}k` : "â‚¹0", color: "text-violet-400", bg: "bg-violet-500/10", border: "border-t-violet-500/40", icon: Wallet, href: "/vendor-finance" },
                  ].map(s => (
                    <Link key={s.label} href={s.href}>
                      <Card className={`glass-card glass-hover border-t-2 ${s.border} cursor-pointer`}>
                        <CardContent className="p-4 flex items-center gap-3">
                          <div className={`${s.bg} p-2 rounded-lg ${s.color}`}><s.icon className="w-4 h-4" /></div>
                          <div><p className="text-xs text-muted-foreground">{s.label}</p><p className={`text-2xl font-bold ${s.color}`}>{s.value}</p></div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
                <QuickActions items={[
                  { label: "My Orders", href: "/vendor-finance", icon: ShoppingCart, color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/25 hover:bg-yellow-500/15" },
                  { label: "Vendor Profile", href: "/vendors", icon: Building, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
                  { label: "Raise Complaint", href: "#", icon: MessageSquare, color: "text-rose-400 bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15", onClick: (e) => { e.preventDefault(); setShowComplaintModal(true); } },
                  { label: "Announcements", href: "/announcements", icon: Bell, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
                          ]} />
                {myProfile && (
                  <Card className="glass-card border-t-2 border-t-yellow-500/30">
                    <CardContent className="p-5">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="bg-yellow-500/10 p-3 rounded-xl text-yellow-400 shrink-0"><Building className="w-6 h-6" /></div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate">{myProfile.name}</p>
                          <p className="text-sm text-muted-foreground">{myProfile.category} Â· {myProfile.contactPerson}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{myProfile.email}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge className={`text-xs ${(myProfile.status ?? "active") === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{myProfile.status ?? "active"}</Badge>
                          <Link href="/vendor-finance">
                            <Button variant="outline" size="sm" className="gap-1.5">My Finance <ArrowRight className="w-3.5 h-3.5" /></Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            );
          })()}
        </motion.div>
      )}

      {/* â”€â”€â”€ STUDENT panel â”€â”€â”€ */}
      {isStudent && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "My Attendance", value: studentAttendance ? `${studentAttendance.percentage ?? "â€”"}%` : "â€”", icon: CheckCircle, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-t-cyan-500/50", href: "/attendance" },
              { label: "Fee Status", value: pendingFeeCount > 0 ? `${pendingFeeCount} Due` : "Clear", icon: Wallet, color: pendingFeeCount > 0 ? "text-amber-400" : "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-green-500/50", href: "/fees" },
              { label: "Announcements", value: String(announcements.length), icon: Bell, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-t-purple-500/50", href: "/announcements" },
            ].map(s => (
              <Link key={s.label} href={s.href}>
                <Card className={`glass-card glass-hover border-t-2 ${s.border} cursor-pointer`}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`${s.bg} p-3 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                      <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <QuickActions items={[
            { label: "Attendance", href: "/attendance", icon: CalendarCheck, color: "text-orange-400 bg-orange-500/10 border-orange-500/25 hover:bg-orange-500/15" },
            { label: "My Results", href: "/exam-results", icon: Award, color: "text-pink-400 bg-pink-500/10 border-pink-500/25 hover:bg-pink-500/15" },
            { label: "Timetable", href: "/timetable", icon: CalendarDays, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            { label: "Assignments", href: "/assignments", icon: BookOpen, color: "text-rose-400 bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15" },
            { label: "Fees", href: "/fees", icon: Wallet, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15" },
            { label: "Library", href: "/library", icon: Library, color: "text-amber-400 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15" },
            { label: "Materials", href: "/materials", icon: Package, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            { label: "Raise Complaint", href: "#", icon: MessageSquare, color: "text-rose-400 bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15", onClick: (e) => { e.preventDefault(); setShowComplaintModal(true); } },
            { label: "Announcements", href: "/announcements", icon: Bell, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500/15" },
                ]} />
          
          {announcements.length > 0 && (
            <Card className="glass-card border-t-2 border-t-purple-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-serif">Latest Announcements</CardTitle>
                  <Link href="/announcements"><Button variant="outline" size="sm" className="gap-1.5">View All <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {announcements.slice(0, 4).map((a) => (
                    <Link key={a.id} href="/announcements">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="bg-purple-500/10 p-1.5 rounded text-purple-400 shrink-0"><Bell className="w-3.5 h-3.5" /></div>
                        <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground mt-0.5">{a.content?.slice(0, 80)}{(a.content?.length ?? 0) > 80 ? "â€¦" : ""}</p></div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* â”€â”€â”€ PARENT panel â”€â”€â”€ */}
      {isParent && (
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[
              { label: "Announcements", value: String(announcements.length), icon: Bell, color: "text-purple-400", bg: "bg-purple-500/10", border: "border-t-purple-500/50", href: "/announcements" },
              { label: "Pending Fees", value: String(studentFees.filter((f) => f.status === "pending").length), icon: Wallet, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-green-500/50", href: "/fees" },
              { label: "Applications", value: "View", icon: UserPlus, color: "text-pink-400", bg: "bg-pink-500/10", border: "border-t-pink-500/50", href: "/admissions" },
            ].map(s => (
              <Link key={s.label} href={s.href}>
                <Card className={`glass-card glass-hover border-t-2 ${s.border} cursor-pointer`}>
                  <CardContent className="p-5 flex items-center gap-4">
                    <div className={`${s.bg} p-3 rounded-lg ${s.color}`}><s.icon className="w-5 h-5" /></div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{s.label}</p>
                      <p className={`text-2xl font-bold mt-0.5 ${s.color}`}>{s.value}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <QuickActions items={[
            { label: "Attendance", href: "/attendance", icon: CalendarCheck, color: "text-orange-400 bg-orange-500/10 border-orange-500/25 hover:bg-orange-500/15" },
            { label: "Fees", href: "/fees", icon: Wallet, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15" },
            { label: "Exam Results", href: "/exam-results", icon: Award, color: "text-pink-400 bg-pink-500/10 border-pink-500/25 hover:bg-pink-500/15" },
            { label: "Timetable", href: "/timetable", icon: CalendarDays, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            { label: "Admissions", href: "/admissions", icon: UserPlus, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            { label: "Raise Complaint", href: "#", icon: MessageSquare, color: "text-rose-400 bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15", onClick: (e) => { e.preventDefault(); setShowComplaintModal(true); } },
            { label: "Announcements", href: "/announcements", icon: Bell, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500/15" },
            ]} />
          
          {announcements.length > 0 && (
            <Card className="glass-card border-t-2 border-t-purple-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-serif">Latest Announcements</CardTitle>
                  <Link href="/announcements"><Button variant="outline" size="sm" className="gap-1.5">View All <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {announcements.slice(0, 4).map((a) => (
                    <Link key={a.id} href="/announcements">
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="bg-purple-500/10 p-1.5 rounded text-purple-400 shrink-0"><Bell className="w-3.5 h-3.5" /></div>
                        <div><p className="text-sm font-medium">{a.title}</p><p className="text-xs text-muted-foreground mt-0.5">{a.content?.slice(0, 80)}{(a.content?.length ?? 0) > 80 ? "â€¦" : ""}</p></div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* â”€â”€â”€ CLERK quick actions â”€â”€â”€ */}
      {isClerk && (
        <motion.div variants={itemVariants} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
          <QuickActions items={[
            { label: "Admissions", href: "/admissions", icon: UserPlus, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            { label: "Students", href: "/students", icon: Users, color: "text-sky-400 bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/15" },
            { label: "Parents", href: "/parent-mapping", icon: UserCheck, color: "text-orange-400 bg-orange-500/10 border-orange-500/25 hover:bg-orange-500/15" },
            { label: "Visitors", href: "/visitors", icon: Building, color: "text-teal-400 bg-teal-500/10 border-teal-500/25 hover:bg-teal-500/15" },
             { label: "Announcements", href: "/announcements", icon: Bell, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            { label: "Timetable", href: "/timetable", icon: CalendarDays, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            ]} />
        </motion.div>
      )}

      {/* â”€â”€â”€ LIBRARIAN panel â”€â”€â”€ */}
      {isLibrarian && (
        <motion.div variants={itemVariants} className="space-y-4">
          <h2 className="text-lg font-serif font-semibold flex items-center gap-2"><BookOpen className="w-5 h-5 text-amber-400" /> Library Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Books", value: books.length, icon: BookOpen, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-400/40", href: "/library" },
              { label: "Categories", value: bookCategoryStats.length, icon: FileText, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-400/40", href: "/library" },
              { label: "Students", value: "View", icon: Users, color: "text-sky-400", bg: "bg-sky-500/10", border: "border-t-sky-400/40", href: "/students" },
              { label: "Announcements", value: "Post", icon: Bell, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-t-blue-400/40", href: "/announcements" },
            ].map(s => (
              <Link key={s.label} href={s.href}>
                <Card className={`glass-card glass-hover border-t-2 ${s.border} cursor-pointer`}>
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className={`${s.bg} p-2.5 rounded-lg ${s.color}`}><s.icon className="w-4 h-4" /></div>
                    <div><p className="text-xs text-muted-foreground">{s.label}</p><p className="text-xl font-bold">{s.value ?? "â€”"}</p></div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <QuickActions items={[
            { label: "Book Catalogue", href: "/library", icon: BookOpen, color: "text-amber-400 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15" },
            { label: "Issue Book", href: "/library", icon: ArrowRight, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15" },
            { label: "Students", href: "/students", icon: Users, color: "text-sky-400 bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/15" },
            { label: "Announcements", href: "/announcements", icon: Bell, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
               ]} />
          
          <Card className="glass-card border-t-2 border-t-amber-500/30">
            <CardContent className="p-5 flex items-center gap-4">
              <div className="bg-amber-500/10 p-3 rounded-xl text-amber-400"><BookOpen className="w-6 h-6" /></div>
              <div>
                <p className="font-semibold">Library Management</p>
                <p className="text-sm text-muted-foreground">Manage book catalogue, issue/return books, and track overdue items in the Library section.</p>
              </div>
              <Link href="/library" className="ml-auto shrink-0">
                <Button variant="outline" size="sm" className="gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10">Go to Library <ArrowRight className="w-3.5 h-3.5" /></Button>
              </Link>
            </CardContent>
          </Card>

          {bookCategoryStats.length > 0 && (
            <Card className="glass-card border-t-2 border-t-amber-500/30">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-serif">Books Catalogue by Category</CardTitle>
                    <CardDescription>Visual distribution of book categories available in the library</CardDescription>
                  </div>
                  <Link href="/library"><Button variant="outline" size="sm" className="gap-1.5">Manage <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={bookCategoryStats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                    <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                    <Bar dataKey="count" name="Books Count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </motion.div>
      )}

      {/* â”€â”€â”€ ADMIN quick actions â”€â”€â”€ */}
      {isAdmin && (
        <motion.div variants={itemVariants} className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Actions</h2>
          <QuickActions items={[
            { label: "Students", href: "/students", icon: Users, color: "text-sky-400 bg-sky-500/10 border-sky-500/25 hover:bg-sky-500/15" },
            { label: "Staff", href: "/staff", icon: GraduationCap, color: "text-purple-400 bg-purple-500/10 border-purple-500/25 hover:bg-purple-500/15" },
            { label: "Admissions", href: "/admissions", icon: UserPlus, color: "text-violet-400 bg-violet-500/10 border-violet-500/25 hover:bg-violet-500/15" },
            { label: "Fees", href: "/fees", icon: Wallet, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/25 hover:bg-emerald-500/15" },
            { label: "Attendance", href: "/attendance", icon: CalendarCheck, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/25 hover:bg-cyan-500/15" },
            { label: "Hostel", href: "/hostel", icon: Building, color: "text-rose-400 bg-rose-500/10 border-rose-500/25 hover:bg-rose-500/15" },
            { label: "Transport", href: "/transport", icon: Bus, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            { label: "Library", href: "/library", icon: Library, color: "text-amber-400 bg-amber-500/10 border-amber-500/25 hover:bg-amber-500/15" },
            { label: "Exam Results", href: "/exam-results", icon: Award, color: "text-pink-400 bg-pink-500/10 border-pink-500/25 hover:bg-pink-500/15" },
            { label: "Announcements", href: "/announcements", icon: Bell, color: "text-blue-400 bg-blue-500/10 border-blue-500/25 hover:bg-blue-500/15" },
            { label: "Complaints", href: "/complaints", icon: MessageSquare, color: "text-red-400 bg-red-500/10 border-red-500/25 hover:bg-red-500/15" },
            { label: "Visitors", href: "/visitors", icon: UserCheck, color: "text-teal-400 bg-teal-500/10 border-teal-500/25 hover:bg-teal-500/25" },
              ]} />
        </motion.div>
      )}

      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(isAdmin || isTeacher) && (
          <Card className="glass-card border-t-2 border-t-cyan-400/30">
            <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-serif">Class Attendance Overview</CardTitle>
                    <CardDescription>Classes 1-5 are daily. Classes 6+ are period-wise.</CardDescription>
                  </div>
                  <Link href="/attendance"><Button variant="outline" size="sm" className="gap-1.5">View Details <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
                </div>
              </CardHeader>
              <CardContent>
              {loadingAttendance ? <Skeleton className="h-60 w-full" /> :
                attendanceData?.byClass && attendanceData.byClass.length > 0 ? (
                  <div className="h-60 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={attendanceData.byClass} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="className" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} dy={8} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} domain={[0, 100]} />
                        <Tooltip cursor={{ fill: 'hsl(var(--muted))' }} contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }} />
                        <Bar dataKey="percentage" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                      </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-60 flex flex-col items-center justify-center text-muted-foreground bg-muted/10 rounded-lg border border-dashed gap-2">
                      <Activity className="w-8 h-8 opacity-30" />
                      <p className="text-sm">No attendance data yet</p>
                      <Link href="/attendance"><Button variant="outline" size="sm" className="mt-2">Mark Attendance</Button></Link>
                    </div>
                  )}
              </CardContent>
            </Card>
          )}

        {(isAdmin || isAccountant) && (
          <Card className="glass-card border-t-2 border-t-emerald-400/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-serif">Fee Collection Trend</CardTitle>
                  <CardDescription>Monthly collection performance</CardDescription>
                </div>
                <Link href="/fees"><Button variant="outline" size="sm" className="gap-1.5">View Fees <ArrowRight className="w-3.5 h-3.5" /></Button></Link>
              </div>
            </CardHeader>
            <CardContent>
              {loadingFees ? (<Skeleton className="h-60 w-full" />) : feeData?.collectionByMonth && feeData.collectionByMonth.length > 0 ? (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={feeData.collectionByMonth} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="feeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(v) => `â‚¹${v / 1000}k`} />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))" }} formatter={(v) => [`â‚¹${v.toLocaleString("en-IN")}`, "Amount"]} />
                      <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#feeGrad)" dot={{ r: 4, fill: "hsl(var(--card))", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-60 flex flex-col items-center justify-center text-muted-foreground bg-muted/20 rounded-md border border-dashed gap-2">
                  <Wallet className="w-8 h-8 opacity-30" />
                  <p className="text-sm">No fee data available</p>
                  <Link href="/fees"><Button variant="outline" size="sm" className="mt-2">Manage Fees</Button></Link>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </motion.div>

   

      {/* â”€â”€â”€ Recent Activity â”€â”€â”€ */}
      <motion.div variants={itemVariants}>
        <Card className="glass-card border-t-2 border-t-violet-400/30">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-serif">Recent Activity</CardTitle>
              <CardDescription>Latest actions across the system</CardDescription>
            </div>
            <div className="p-2 rounded-lg bg-violet-500/10 text-violet-400">
              <Activity className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            {loadingActivity ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="w-10 h-10 rounded-full shrink-0" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="relative">
                <div className="absolute left-4.75 top-5 bottom-5 w-px bg-border/50" />
                <div className="space-y-5">
                  {activity.map((item, index) => {
                    const colors = ["bg-sky-500/20 text-sky-400 border-sky-500/30", "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", "bg-violet-500/20 text-violet-400 border-violet-500/30", "bg-amber-500/20 text-amber-400 border-amber-500/30", "bg-pink-500/20 text-pink-400 border-pink-500/30", "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"];
                    const c = colors[index % colors.length];
                    const activityHref = item.type === "student" ? "/students" : item.type === "fee" ? "/fees" : item.type === "attendance" ? "/attendance" : item.type === "hostel" ? "/hostel" : item.type === "admission" ? "/admissions" : item.type === "complaint" ? "/complaints" : item.type === "leave" ? "/leaves" : "/dashboard";
                    return (
                      <Link key={item.id} href={activityHref}>
                        <div className="flex gap-4 relative hover:bg-muted/20 rounded-lg p-1 -m-1 transition-colors cursor-pointer">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border z-10 ${c}`}>
                            <Clock className="w-4 h-4" />
                          </div>
                          <div className="flex-1 pb-1 pt-1">
                            <p className="text-sm font-medium">
                              {item.title}
                              {item.actor && <span className="text-muted-foreground font-normal ml-1">by {item.actor}</span>}
                            </p>
                            <p className="text-sm text-muted-foreground mt-0.5">{item.description}</p>
                            <p className="text-xs text-muted-foreground/60 mt-1">{format(new Date(item.timestamp), "MMM d, h:mm a")}</p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground flex flex-col items-center gap-2">
                <Activity className="w-8 h-8 opacity-30" />
                <p className="text-sm">No recent activity found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
