import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, LogOut as LogOutIcon, Building, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const statusConfig = {
  in: {
    label: "In Hostel",
    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    icon: CheckCircle,
  },
  out: {
    label: "Signed Out",
    color: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    icon: LogOutIcon,
  },
};

export default function HostelAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingStudentId, setSavingStudentId] = useState(null);
  const canManage = user?.role === "admin" || user?.role === "hostel_warden";

  const load = async (selectedDate, { quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const res = await fetch(`/api/hostel/attendance?date=${selectedDate}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch hostel attendance");
      const json = await res.json();
      setRecords(json.records ?? []);
    } catch {
      if (!quiet) toast({ title: "Failed to load hostel attendance", variant: "destructive" });
    } finally {
      if (!quiet) setLoading(false);
    }
  };

  useEffect(() => {
    load(date);
    const timer = setInterval(() => load(date, { quiet: true }), 15000);
    return () => clearInterval(timer);
  }, [date]);

  const markStatus = async (studentId, status) => {
    setSavingStudentId(studentId);
    try {
      const res = await fetch("/api/hostel/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ date, records: [{ studentId, status }] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to save attendance");
      await load(date, { quiet: true });
      toast({ title: status === "in" ? "Marked in hostel" : "Marked signed out" });
    } catch (err) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingStudentId(null);
    }
  };

  const inCount = records.filter((record) => record.status !== "out").length;
  const outCount = records.filter((record) => record.status === "out").length;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-teal-400">Hostel Attendance</h1>
          <p className="text-muted-foreground text-sm mt-1">Live in/out status for approved hostel residents</p>
        </div>
        <div>
          <Label className="text-xs">Date</Label>
          <Input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} className="w-44 mt-1" />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Residents", value: records.length, color: "text-teal-400", bg: "bg-teal-500/10", border: "border-t-teal-500/40", icon: Building },
          { label: "Present (In)", value: inCount, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-t-emerald-500/40", icon: CheckCircle },
          { label: "Signed Out", value: outCount, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-t-amber-500/40", icon: LogOutIcon },
        ].map((summary) => (
          <Card key={summary.label} className={`glass-card glass-hover border-t-2 ${summary.border}`}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`${summary.bg} p-2 rounded-lg ${summary.color}`}><summary.icon className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">{summary.label}</p>
                <p className={`text-2xl font-bold ${summary.color}`}>{summary.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="glass-card border-t-2 border-t-teal-500/30">
        <CardHeader>
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <Users className="w-4 h-4 text-teal-400" />Residents - {records.length}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-12 w-full" />)}</div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No approved hostel residents found.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {records.map((record) => {
                const status = record.status === "out" ? "out" : "in";
                const config = statusConfig[status];
                const Icon = config.icon;
                const saving = savingStudentId === record.studentId;
                return (
                  <button
                    key={record.studentId}
                    onClick={() => canManage && markStatus(record.studentId, status === "in" ? "out" : "in")}
                    disabled={!canManage || saving}
                    className={`text-left p-3 rounded-lg border transition-all ${config.color} ${canManage ? "hover:opacity-90 cursor-pointer" : "cursor-default"} ${saving ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{record.studentName}</p>
                        <p className="text-xs opacity-70">{record.rollNumber ?? `Room ${record.roomId ?? "-"}`}</p>
                      </div>
                      <Badge className={`text-[10px] border ${config.color}`}>
                        <Icon className="w-3 h-3 mr-1" />{saving ? "Saving..." : config.label}
                      </Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {canManage && (
            <p className="text-xs text-muted-foreground mt-4">
              Click a resident card to switch between In Hostel and Signed Out. Counts refresh from the database after every update.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
