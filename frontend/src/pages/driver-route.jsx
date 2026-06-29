import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Bus, MapPin, Clock, Users, Navigation, Phone, IdCard as IdCardIcon, AlertTriangle } from "lucide-react";
import DriverLiveTracker from "@/pages/DriverLiveTracker";   // ← Add this
import { motion } from "framer-motion"; // If not already present

async function fetchMyRoute() {
    const res = await fetch("/api/transport/my-route", { credentials: "include" });
    if (!res.ok)
        throw new Error(`Failed to load route (${res.status})`);
    return res.json();
}

async function fetchLogs() {
    const res = await fetch("/api/transport/logs", { credentials: "include" });
    if (!res.ok) throw new Error("Failed to load logs");
    return res.json();
}

async function postLog(data) {
    const res = await fetch("/api/transport/logs", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? `Request failed (${res.status})`);
    }
    return res.json();
}

export default function DriverRoute() {
    const { toast } = useToast();
    const qc = useQueryClient();

    const { data, isLoading, error } = useQuery({
        queryKey: ["transport", "my-route"],
        queryFn: fetchMyRoute,
        staleTime: 30000,
    });

    const { data: logs = [] } = useQuery({
        queryKey: ["transport", "logs"],
        queryFn: fetchLogs,
        staleTime: 5000,
    });

    const logMutation = useMutation({
        mutationFn: postLog,
        onSuccess: (newLog) => {
            qc.invalidateQueries({ queryKey: ["transport", "logs"] });
            toast({ title: `Logged ${newLog.action} successfully` });
        },
        onError: (err) => {
            toast({ title: "Failed to log event", description: err.message, variant: "destructive" });
        }
    });

    if (isLoading) {
        return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
        <Skeleton className="h-12 w-1/3"/>
        <Skeleton className="h-32 w-full"/>
        <Skeleton className="h-48 w-full"/>
      </div>);
    }

    if (error) {
        return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-red-400 font-medium">Could not load your route</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
        </div>
      </div>);
    }

    const stops = (data?.route?.stops ?? "").split(",").map(s => s.trim()).filter(Boolean);
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><Navigation className="w-5 h-5"/></div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-amber-400">My Route Today</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.driver?.name ?? "Driver"} · today's manifest and route map</p>
        </div>
      </div>

      {!data?.vehicle ? (<Card className="glass-card border-t-2 border-t-yellow-500/40">
          <CardContent className="p-6 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5"/>
            <div>
              <p className="font-semibold">No vehicle assigned yet</p>
              <p className="text-xs text-muted-foreground mt-1">Ask the Transport Manager to assign a vehicle to your account.</p>
            </div>
          </CardContent>
        </Card>) : (<>
          {/* Vehicle + Driver card */}
          <Card className="glass-card border-t-2 border-t-amber-500/40">
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400"><Bus className="w-5 h-5"/></div>
                <div>
                  <p className="text-xs text-muted-foreground">Assigned Vehicle</p>
                  <p className="font-bold text-lg">{data.vehicle.vehicleNumber}</p>
                  <p className="text-xs text-muted-foreground capitalize">{data.vehicle.type} · {data.vehicle.capacity} seats {data.vehicle.model ? `· ${data.vehicle.model}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400"><Phone className="w-5 h-5"/></div>
                <div>
                  <p className="text-xs text-muted-foreground">Contact</p>
                  <p className="font-medium">{data.driver?.phone ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><IdCardIcon className="w-5 h-5"/></div>
                <div>
                  <p className="text-xs text-muted-foreground">License</p>
                  <p className="font-mono text-sm">{data.driver?.licenseNo ?? "—"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

         <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="space-y-4"
          >
            <h2 className="text-lg font-serif font-semibold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-400" /> Live Route Tracking
            </h2>
            
            {/* Live GPS for the logged-in driver */}
            <DriverLiveTracker driverId={data?.driver?.id} />

            {/* Additional route map info if needed */}
            <Card className="glass-card border-t-2 border-t-blue-500/30">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-medium">Current Location</p>
                    <p className="text-xs text-muted-foreground">Updated in real-time via GPS</p>
                  </div>
                  <Badge variant="outline" className="text-emerald-400">LIVE</Badge>
                </div>
                {/* You can add more map controls or info here if DriverLiveTracker doesn't cover everything */}
              </CardContent>
            </Card>
          </motion.div>

          {/* Route + Stops */}
          {data.route ? (<Card className="glass-card border-t-2 border-t-amber-500/40">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Route</p>
                    <p className="font-bold text-lg text-amber-400">{data.route.name}</p>
                  </div>
                  <div className="flex gap-2">
                    {data.route.morningTime && <Badge className="bg-emerald-500/10 text-emerald-400 text-xs"><Clock className="w-3 h-3 mr-1"/>AM {data.route.morningTime}</Badge>}
                    {data.route.eveningTime && <Badge className="bg-blue-500/10 text-blue-400 text-xs"><Clock className="w-3 h-3 mr-1"/>PM {data.route.eveningTime}</Badge>}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="w-4 h-4"/>
                  <span className="font-medium text-foreground">{data.route.startPoint}</span> → <span className="font-medium text-foreground">{data.route.endPoint}</span>
                </div>
                {stops.length > 0 && (<div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Stops</p>
                    <ol className="space-y-2">
                      {stops.map((stop, i) => (<li key={i} className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-amber-500/10 text-amber-400 text-xs flex items-center justify-center font-bold shrink-0">{i + 1}</span>
                          <span className="text-sm">{stop}</span>
                          <span className="text-xs text-muted-foreground ml-auto">{data.manifest.filter(m => m.pickupStop === stop).length} students</span>
                        </li>))}
                    </ol>
                  </div>)}
              </CardContent>
            </Card>) : (<Card className="glass-card border-t-2 border-t-yellow-500/40">
              <CardContent className="p-6 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5"/>
                <div>
                  <p className="font-semibold">No route linked to your vehicle</p>
                  <p className="text-xs text-muted-foreground mt-1">Ask the Transport Manager to attach a route to vehicle {data.vehicle.vehicleNumber}.</p>
                </div>
              </CardContent>
            </Card>)}

          {/* Student Manifest */}
          <Card className="glass-card border-t-2 border-t-amber-500/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-amber-400"/>
                <h2 className="font-semibold">Student Manifest</h2>
                <Badge className="bg-amber-500/10 text-amber-400 text-xs ml-auto">{data.manifest.length} students</Badge>
              </div>
              {data.manifest.length === 0 ? (<p className="text-muted-foreground text-center py-8 text-sm">No students assigned to this route yet.</p>) : (<div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                      <th className="py-2 px-2">#</th>
                      <th className="py-2 px-2">Student</th>
                      <th className="py-2 px-2">Roll</th>
                      <th className="py-2 px-2">Class</th>
                      <th className="py-2 px-2">Pickup Stop</th>
                      <th className="py-2 px-2">Latest Status</th>
                      <th className="py-2 px-2 text-right">Actions</th>
                    </tr></thead>
                    <tbody>
                      {data.manifest.map((m, i) => {
                          const latestLog = logs.find(l => l.studentId === m.studentId);
                          return (
                            <tr key={m.assignmentId} className="border-b border-border/20 hover:bg-white/5">
                              <td className="py-2 px-2 text-muted-foreground text-xs">{i + 1}</td>
                              <td className="py-2 px-2 font-medium flex items-center gap-2">
                                <Avatar className="h-6 w-6 shrink-0">
                                  {m.studentAvatarUrl && <AvatarImage src={m.studentAvatarUrl} />}
                                  <AvatarFallback className="text-[10px]">{m.studentName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                                <span>{m.studentName}</span>
                              </td>
                              <td className="py-2 px-2 text-muted-foreground text-xs">{m.rollNumber ?? "—"}</td>
                              <td className="py-2 px-2 text-muted-foreground text-xs">{m.className ?? "—"}</td>
                              <td className="py-2 px-2"><Badge className="bg-amber-500/10 text-amber-400 text-xs">{m.pickupStop ?? "—"}</Badge></td>
                              <td className="py-2 px-2">
                                {latestLog ? (
                                  <Badge className={latestLog.action === "boarded" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-blue-500/10 text-blue-400 border border-blue-500/30"}>
                                    {latestLog.action === "boarded" ? "Boarded" : "Deboarded"} ({latestLog.location ?? "Stop"})
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right space-x-1">
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                                  onClick={() => logMutation.mutate({ studentId: m.studentId, routeId: data.route.id, action: "boarded", location: m.pickupStop })}
                                  disabled={logMutation.isPending}
                                >
                                  Board
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                                  onClick={() => logMutation.mutate({ studentId: m.studentId, routeId: data.route.id, action: "deboarded", location: m.dropStop || m.pickupStop })}
                                  disabled={logMutation.isPending}
                                >
                                  Deboard
                                </Button>
                              </td>
                            </tr>
                          );
                      })}
                    </tbody>
                  </table>
                </div>)}
            </CardContent>
          </Card>
        </>)}
    </div>);
}
