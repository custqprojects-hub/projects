import { useState } from "react";
import { useListStaff, getListStaffQueryKey } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Users, Clock, LogIn, LogOut } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

export default function Attendance() {
    const { user } = useAuth();
    const { toast } = useToast();
    const qc = useQueryClient();
    const today = new Date().toISOString().split("T")[0];

    const isStaff = ["admin", "teacher", "clerk", "hostel_warden", "transport_manager", "driver", "store_manager", "librarian"].includes(user?.role || "");

    // Today's Attendance Record (using your GET /api/attendance/checkin)
    const { data: attendance, refetch: refetchAttendance } = useQuery({
        queryKey: ["staffTodayAttendance", user?.id, today],
        queryFn: async () => {
            const res = await fetch("/api/attendance/checkin", { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch attendance");
            return res.json();
        },
        enabled: isStaff,
        staleTime: 1000 * 60 * 5,
    });

    // Staff List
    const { data: allStaff = [], isLoading: staffLoading } = useListStaff({}, { 
        query: { queryKey: getListStaffQueryKey(), staleTime: 30000 } 
    });

    const [showReasonModal, setShowReasonModal] = useState<"in" | "out" | null>(null);
    const [reason, setReason] = useState("");

    const isCheckedIn = !!attendance?.checkInTime;
    const isCheckedOut = !!attendance?.checkOutTime;

    // Check-in Handler (POST /api/attendance/checkin)
    const handleCheckIn = async () => {
        try {
            const res = await fetch("/api/attendance/checkin", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason.trim() || undefined }),
                credentials: "include",
            });

            const data = await res.json();

            if (!res.ok) {
                toast({ title: "Check-in Failed", description: data.error || "Please try again", variant: "destructive" });
                return;
            }

            toast({ title: "✅ Check-in Successful", description: `Checked in at ${new Date().toLocaleTimeString()}` });
            setReason("");
            setShowReasonModal(null);
            refetchAttendance();
            qc.invalidateQueries({ queryKey: getListStaffQueryKey() });
        } catch (err) {
            toast({ title: "Error", description: "Something went wrong", variant: "destructive" });
        }
    };

    // Check-out Handler (Note: You may need to add a checkout endpoint later)
    const handleCheckOut = async () => {
        if (!reason.trim()) {
            toast({ title: "Reason Required", description: "Please provide a reason for early checkout", variant: "destructive" });
            return;
        }
        // TODO: Implement checkout API when you add the backend endpoint
        toast({ title: "Checkout", description: "Checkout functionality coming soon...", variant: "default" });
        // Uncomment and update when you have checkout endpoint
        // await fetch("/api/attendance/checkout", { ... });
        setReason("");
        setShowReasonModal(null);
    };

    const staffPresentToday = allStaff.filter(s => s.status === "active").length;
    const totalStaff = allStaff.length;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div>
                <h1 className="text-3xl font-serif font-bold text-cyan-400">Staff Attendance</h1>
                <p className="text-muted-foreground mt-1">Daily check-in & attendance overview</p>
            </div>

            {/* Teacher Self Check-in / Check-out Card */}
            {isStaff && (
                <Card className="glass-card border-t-2 border-t-emerald-400/40">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Clock className="w-5 h-5" /> Today's Attendance
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex flex-col sm:flex-row gap-4">
                            {!isCheckedIn ? (
                                <Dialog open={showReasonModal === "in"} onOpenChange={(open) => !open && setShowReasonModal(null)}>
                                    <DialogTrigger asChild>
                                        <Button size="lg" className="flex-1 h-14 text-base" onClick={() => setShowReasonModal("in")}>
                                            <LogIn className="mr-2" /> Check In Now
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Check-in Reason (Optional)</DialogTitle>
                                        </DialogHeader>
                                        <Textarea
                                            placeholder="Why are you checking in late? (optional)"
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                        <Button onClick={handleCheckIn}>
                                            Confirm Check-in
                                        </Button>
                                    </DialogContent>
                                </Dialog>
                            ) : (
                                <div className="flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
                                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                                    <div>
                                        <p className="font-medium">
                                            Checked in at {format(new Date(attendance.checkInTime), "hh:mm a")}
                                        </p>
                                        {attendance.checkInReason && (
                                            <p className="text-sm text-muted-foreground">Reason: {attendance.checkInReason}</p>
                                        )}
                                    </div>
                                </div>
                            )}

                            {isCheckedIn && !isCheckedOut && (
                                <Dialog open={showReasonModal === "out"} onOpenChange={(open) => !open && setShowReasonModal(null)}>
                                    <DialogTrigger asChild>
                                        <Button size="lg" variant="destructive" className="flex-1 h-14 text-base" onClick={() => setShowReasonModal("out")}>
                                            <LogOut className="mr-2" /> Check Out Early
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Early Checkout Reason (Required)</DialogTitle>
                                        </DialogHeader>
                                        <Textarea
                                            placeholder="Reason for early checkout..."
                                            value={reason}
                                            onChange={(e) => setReason(e.target.value)}
                                        />
                                        <Button variant="destructive" onClick={handleCheckOut} disabled={!reason.trim()}>
                                            Confirm Early Checkout
                                        </Button>
                                    </DialogContent>
                                </Dialog>
                            )}

                            {isCheckedOut && (
                                <div className="flex-1 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
                                    Checked out at {format(new Date(attendance.checkOutTime), "hh:mm a")}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Staff</p>
                                <p className="text-4xl font-bold mt-1">{totalStaff}</p>
                            </div>
                            <Users className="w-10 h-10 text-muted-foreground" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Present Today</p>
                                <p className="text-4xl font-bold mt-1 text-emerald-400">{staffPresentToday}</p>
                            </div>
                            <CheckCircle className="w-10 h-10 text-emerald-400" />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Attendance Rate</p>
                                <p className="text-4xl font-bold mt-1">
                                    {totalStaff > 0 ? Math.round((staffPresentToday / totalStaff) * 100) : 0}%
                                </p>
                            </div>
                            <Clock className="w-10 h-10 text-amber-400" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Staff List */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Users className="w-5 h-5" /> Staff Attendance Status
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {staffLoading ? (
                        <div className="space-y-3">
                            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                        </div>
                    ) : allStaff.length === 0 ? (
                        <p className="text-center py-12 text-muted-foreground">No staff records found.</p>
                    ) : (
                        <div className="space-y-3">
                            {allStaff.map((staff) => (
                                <div key={staff.id} className="flex items-center justify-between p-4 rounded-lg border border-border/60 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <Avatar className="h-10 w-10">
                                            <AvatarImage src={staff.avatarUrl} />
                                            <AvatarFallback>{staff.name?.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-medium">{staff.name}</p>
                                            <p className="text-sm text-muted-foreground">{staff.role}</p>
                                        </div>
                                    </div>
                                    <Badge className={staff.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "text-red-400"}>
                                        {staff.status === "active" ? "Present" : "Absent"}
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}