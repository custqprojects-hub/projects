import { useEffect, useState } from "react";
import { useListTransportRoutes, useListVehicles, useCreateTransportRoute, useUpdateTransportRoute, useCreateVehicle, useListStudents, getListTransportRoutesQueryKey, getListVehiclesQueryKey, getListStudentsQueryKey, UserRole, useGetMyTransportAssignment, useBoardStudent } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Bus, MapPin, Clock, Navigation, AlertTriangle, UserCog, Users, Trash2, Edit3, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import DriverLiveTracker from "@/pages/DriverLiveTracker";   // ← Import Live Tracker
import { motion } from "framer-motion"; // For smooth animation

async function fetchJson(url, init) {
  const res = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}
export default function Transport({ forceTab, hideTabs } = {}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tabState, setTab] = useState(forceTab ?? "routes");
  const tab = forceTab ?? tabState;
  const [openRoute, setOpenRoute] = useState(false);
  const [openVehicle, setOpenVehicle] = useState(false);
  const [openDriver, setOpenDriver] = useState(false);
  const [openAssign, setOpenAssign] = useState(false);
  const [editingRouteId, setEditingRouteId] = useState(null);
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editingDriverId, setEditingDriverId] = useState(null);
  const [routeForm, setRouteForm] = useState({ name: "", startPoint: "", endPoint: "", stops: "", morningTime: "", eveningTime: "", vehicleId: "", distance: "", fare: "" });
  const [vehicleForm, setVehicleForm] = useState({ vehicleNumber: "", model: "", capacity: "", type: "bus", driverId: "" });
  const [driverForm, setDriverForm] = useState({ name: "", phone: "", email: "", licenseNo: "", username: "", password: "", assignedVehicleId: "" });
  const [assignForm, setAssignForm] = useState({ studentId: "", routeId: "", pickupStop: "", dropStop: "" });
  const isManager = ["admin", "transport_manager"].includes(user?.role ?? "");
  const isAdmin = user?.role === "admin";
  const isDriver = user?.role === UserRole.driver;
  const isStudentOrParent = user?.role === "student" || user?.role === "parent";
  const { data: routes = [], isLoading: routesLoading } = useListTransportRoutes({ query: { queryKey: getListTransportRoutesQueryKey(), staleTime: 10000 } });
  const { data: vehicles = [], isLoading: vehiclesLoading } = useListVehicles({ query: { queryKey: getListVehiclesQueryKey(), staleTime: 10000 } });
  const { data: students = [] } = useListStudents({}, { query: { queryKey: getListStudentsQueryKey(), staleTime: 30000, enabled: isManager } });

  const [openLiveTrack, setOpenLiveTrack] = useState(false);
  const [selectedDriverForTracking, setSelectedDriverForTracking] = useState(null);

  const [selectedTrip, setSelectedTrip] = useState("morning"); // "morning" | "evening"
  const [studentsOnBus, setStudentsOnBus] = useState(new Set());

  // ==================== BOARDING MUTATIONS ====================
  // Use this instead of your old mutations
  const boardMutation = useBoardStudent({
    onSuccess: (_, { studentId }) => {
      setStudentsOnBus(prev => new Set([...prev, studentId]));
      qc.invalidateQueries({ queryKey: ["transport", "logs"] });
      toast({ title: "Student boarded successfully ✅" });
    },
    onError: (err) => {
      toast({
        title: "Boarding Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  });

  const unboardMutation = useBoardStudent({
    onSuccess: (_, { studentId }) => {
      setStudentsOnBus(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
      qc.invalidateQueries({ queryKey: ["transport", "logs"] });
      toast({ title: "Student deboarded" });
    }
  });


  // Manager-only data via fetch (no codegen hooks for these endpoints)
  const driversQuery = useQuery({
    queryKey: ["transport", "drivers"],
    queryFn: () => fetchJson("/api/transport/drivers"),
    enabled: isManager,
    staleTime: 10000,
  });
  const assignmentsQuery = useQuery({
    queryKey: ["transport", "assignments"],
    queryFn: () => fetchJson("/api/transport/assignments"),
    enabled: isManager || isDriver,
    staleTime: 10000,
  });
  const logsQuery = useQuery({
    queryKey: ["transport", "logs"],
    queryFn: () => fetchJson("/api/transport/logs"),
    staleTime: 10000,
  });
  const drivers = driversQuery.data ?? [];
  const assignments = assignmentsQuery.data ?? [];
  const logs = logsQuery.data ?? [];
  // Redirect driver-tab clicks to My Route page
  useEffect(() => {
    if (isDriver)
      setTab("routes");
  }, [isDriver]);
  const resetRouteForm = () => {
    setEditingRouteId(null);
    setRouteForm({ name: "", startPoint: "", endPoint: "", stops: "", morningTime: "", eveningTime: "", vehicleId: "", distance: "", fare: "" });
  };
  const resetVehicleForm = () => {
    setEditingVehicleId(null);
    setVehicleForm({ vehicleNumber: "", model: "", capacity: "", type: "bus", driverId: "" });
  };
  const resetDriverForm = () => {
    setEditingDriverId(null);
    setDriverForm({ name: "", phone: "", email: "", licenseNo: "", username: "", password: "", assignedVehicleId: "" });
  };
  const openEditRoute = (route) => {
    setEditingRouteId(route.id);
    setRouteForm({
      name: route.name ?? "",
      startPoint: route.startPoint ?? "",
      endPoint: route.endPoint ?? "",
      stops: route.stops ?? "",
      morningTime: route.morningTime ?? "",
      eveningTime: route.eveningTime ?? "",
      vehicleId: route.vehicleId ? String(route.vehicleId) : "none",
      distance: route.distance ?? "",
      fare: route.fare ?? "",
    });
    setOpenRoute(true);
  };
  const openEditVehicle = (vehicle) => {
    setEditingVehicleId(vehicle.id);
    setVehicleForm({
      vehicleNumber: vehicle.vehicleNumber ?? "",
      model: vehicle.model ?? "",
      capacity: vehicle.capacity != null ? String(vehicle.capacity) : "",
      type: vehicle.type ?? "bus",
      driverId: vehicle.driverId ? String(vehicle.driverId) : "none",
    });
    setOpenVehicle(true);
  };
  const openEditDriver = (driver) => {
    setEditingDriverId(driver.id);
    setDriverForm({
      name: driver.name ?? "",
      phone: driver.phone ?? "",
      email: driver.email ?? "",
      licenseNo: driver.licenseNo ?? "",
      username: driver.username ?? "",
      password: "",
      assignedVehicleId: driver.assignedVehicleId ? String(driver.assignedVehicleId) : "none",
    });
    setOpenDriver(true);
  };
  const createRouteMutation = useCreateTransportRoute({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTransportRoutesQueryKey() });
        setOpenRoute(false);
        resetRouteForm();
        toast({ title: "Route added successfully" });
      },
      onError: (err) => toast({ title: "Failed to add route", description: err?.message, variant: "destructive" }),
    },
  });
  const updateRouteMutation = useUpdateTransportRoute({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTransportRoutesQueryKey() });
        setOpenRoute(false);
        resetRouteForm();
        toast({ title: "Route updated successfully" });
      },
      onError: (err) => toast({ title: "Failed to update route", description: err?.message, variant: "destructive" }),
    },
  });
  const deleteRouteMutation = useMutation({
    mutationFn: (id) => fetchJson(`/api/transport/routes/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListTransportRoutesQueryKey() });
      toast({ title: "Route deleted" });
    },
    onError: (err) => toast({ title: "Failed to delete route", description: err?.message, variant: "destructive" }),
  });
  const createVehicleMutation = useCreateVehicle({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
        setOpenVehicle(false);
        resetVehicleForm();
        toast({ title: "Vehicle added successfully" });
      },
      onError: (err) => toast({ title: "Failed to add vehicle", description: err?.message, variant: "destructive" }),
    },
  });
  const updateVehicleMutation = useMutation({
    mutationFn: ({ id, data }) => fetchJson(`/api/transport/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
      setOpenVehicle(false);
      resetVehicleForm();
      toast({ title: "Vehicle updated successfully" });
    },
    onError: (err) => toast({ title: "Failed to update vehicle", description: err?.message, variant: "destructive" }),
  });
  const deleteVehicleMutation = useMutation({
    mutationFn: (id) => fetchJson(`/api/transport/vehicles/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
      toast({ title: "Vehicle deleted" });
    },
    onError: (err) => toast({ title: "Failed to delete vehicle", description: err?.message, variant: "destructive" }),
  });
  const createDriverMutation = useMutation({
    mutationFn: (data) => fetchJson("/api/transport/drivers", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport", "drivers"] });
      qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
      setOpenDriver(false);
      resetDriverForm();
      toast({ title: "Driver added", description: "User account created with role 'driver'." });
    },
    onError: (err) => toast({ title: "Failed to add driver", description: err?.message, variant: "destructive" }),
  });
  const updateDriverMutation = useMutation({
    mutationFn: ({ id, data }) => fetchJson(`/api/transport/drivers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport", "drivers"] });
      qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
      setOpenDriver(false);
      resetDriverForm();
      toast({ title: "Driver updated successfully" });
    },
    onError: (err) => toast({ title: "Failed to update driver", description: err?.message, variant: "destructive" }),
  });
  const deleteDriverMutation = useMutation({
    mutationFn: (id) => fetchJson(`/api/transport/drivers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport", "drivers"] });
      qc.invalidateQueries({ queryKey: getListVehiclesQueryKey() });
      toast({ title: "Driver deleted" });
    },
    onError: (err) => toast({ title: "Failed to delete driver", description: err?.message, variant: "destructive" }),
  });
  const createAssignmentMutation = useMutation({
    mutationFn: (data) => fetchJson("/api/transport/assignments", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport", "assignments"] });
      qc.invalidateQueries({ queryKey: getListTransportRoutesQueryKey() });
      setOpenAssign(false);
      setAssignForm({ studentId: "", routeId: "", pickupStop: "", dropStop: "" });
      toast({ title: "Student assigned to route" });
    },
    onError: (err) => toast({ title: "Failed to assign student", description: err?.message, variant: "destructive" }),
  });
  const removeAssignmentMutation = useMutation({
    mutationFn: (id) => fetchJson(`/api/transport/assignments/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transport", "assignments"] });
      qc.invalidateQueries({ queryKey: getListTransportRoutesQueryKey() });
      toast({ title: "Assignment removed" });
    },
    onError: (err) => toast({ title: "Failed to remove", description: err?.message, variant: "destructive" }),
  });
  const activeRoutes = routes.filter(r => r.status === "active");
  const totalCapacity = vehicles.reduce((a, v) => a + (v.capacity ?? 0), 0);
  const assignedSeats = assignments.length;
  // Pickup options derived from selected route's stops
  const selectedRoute = routes.find(r => String(r.id) === assignForm.routeId);
  const pickupOptions = (selectedRoute?.stops ?? "").split(",").map(s => s.trim()).filter(Boolean);
  // === CAPACITY CHECK ===
  const currentStudentsOnRoute = assignments.filter(
    a => String(a.routeId) === assignForm.routeId
  ).length;

  const selectedVehicle = selectedRoute?.vehicleId
    ? vehicles.find(v => v.id === selectedRoute.vehicleId)
    : null;

  const vehicleCapacity = selectedVehicle?.capacity ?? 0;
  const isOverCapacity = vehicleCapacity > 0 && currentStudentsOnRoute >= vehicleCapacity;
  const remainingSeats = vehicleCapacity - currentStudentsOnRoute;
  // Fetch student's assigned driver (for student view)
  const studentAssignmentQuery = useQuery({
    queryKey: ["transport", "my-assignment"],
    queryFn: () => fetchJson("/api/transport/my-assignment"),
    enabled: isStudentOrParent,
    staleTime: 30000,
  });

  const myAssignment = studentAssignmentQuery.data || null;

  const isBoardingAllowed = (route, trip) => {
    if (!route) return false;

    const timeStr = trip === "morning" ? route.morningTime : route.eveningTime;
    if (!timeStr) return false;

    const [hours, minutes] = timeStr.split(":").map(Number);
    const scheduled = new Date();
    scheduled.setHours(hours, minutes, 0, 0);

    const diffMinutes = Math.abs((Date.now() - scheduled.getTime()) / (1000 * 60));
    return diffMinutes <= 25;   // ±25 minutes window
  };

  function requireRole(...roles) {
    return (req, res, next) => {
      console.log("User =>", req.user);
      console.log("Allowed =>", roles);

      if (!req.user) {
        return res.status(401).json({
          error: "Not authenticated",
        });
      }

      if (!roles.includes(req.user.role)) {
        return res.status(403).json({
          error: `Role '${req.user.role}' not allowed`,
        });
      }

      next();
    };
  }
  return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-amber-400">Transport Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isDriver ? "View routes, vehicles, and your assigned manifest" : isStudentOrParent ? "School transport routes" : "Manage routes, vehicles, drivers, and student assignments"}
        </p>
      </div>
      {/* ====================== DRIVER - MY ROUTE (Boarding Section) ====================== */}
      {isDriver && tab === "my-route" && (
        <Card className="glass-card border-t-2 border-t-emerald-500/40">
          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold">Live Boarding / Deboarding</h2>
                <p className="text-muted-foreground">Mark students as they board or leave the bus</p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={selectedTrip === "morning" ? "default" : "outline"}
                  onClick={() => setSelectedTrip("morning")}
                >
                  Morning Trip
                </Button>
                <Button
                  variant={selectedTrip === "evening" ? "default" : "outline"}
                  onClick={() => setSelectedTrip("evening")}
                >
                  Evening Trip
                </Button>
              </div>
            </div>

            {routes.filter(r => r.driverId === user?.id || r.driverName === user?.name).length === 0 ? (
              <div className="text-center py-16">
                <AlertTriangle className="w-16 h-16 mx-auto text-amber-400 mb-4" />
                <h3 className="text-xl">No Route Assigned</h3>
                <p className="text-muted-foreground">Contact Transport Manager</p>
              </div>
            ) : (
              routes
                .filter(r => r.driverId === user?.id || r.driverName === user?.name)
                .map((route) => (
                  <div key={route.id} className="space-y-5">
                    {/* Route Info */}
                    <div className="bg-muted/60 p-5 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-lg">{route.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedTrip === "morning" ? route.morningTime : route.eveningTime} • {route.stops?.substring(0, 60)}...
                        </p>
                      </div>
                      <Badge variant="outline" className="text-lg px-4 py-1.5">
                        {studentsOnBus.size} on bus
                      </Badge>
                    </div>

                    {/* Students List */}
                    <div className="space-y-3">
                      {assignments
                        .filter(a => a.routeId === route.id)
                        .map((assignment) => {
                          const isOnBus = studentsOnBus.has(assignment.studentId);
                          const canBoardNow = !isOnBus && isBoardingAllowed(route, selectedTrip);

                          return (
                            <Card key={assignment.studentId} className="p-4 flex items-center justify-between hover:bg-muted/50 transition">
                              <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12">
                                  <AvatarFallback>{assignment.studentName?.[0] || "S"}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="font-medium text-base">{assignment.studentName}</p>
                                  <p className="text-sm text-muted-foreground">{assignment.pickupStop}</p>
                                </div>
                              </div>

                              {/* === BOARD / DEBOARD BUTTONS === */}
                              {isOnBus ? (
                                <Button
                                  variant="destructive"
                                  size="lg"
                                  onClick={() => unboardMutation.mutate({
                                    studentId: assignment.studentId,
                                    action: "unboarded"
                                  })}
                                >
                                  Deboard
                                </Button>
                              ) : (
                                <Button
                                  size="lg"
                                  disabled={!canBoardNow}
                                  onClick={() => boardMutation.mutate({
                                    studentId: assignment.studentId,
                                    routeId: route.id,
                                    trip: selectedTrip,
                                    action: "boarded"
                                  })}
                                  className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                  {canBoardNow ? "✅ Board Student" : "⏰ Outside Time Window"}
                                </Button>
                              )}
                            </Card>
                          );
                        })}
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>
      )}
    </div>

    {/* Driver notice */}
    {isDriver && (<div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 flex items-start gap-3">
      <Navigation className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
      <div>
        <p className="font-medium text-blue-400 text-sm">Driver View</p>
        <p className="text-xs text-muted-foreground">Use <span className="font-medium text-foreground">My Route</span> in the sidebar to see your assigned vehicle, route, and student manifest.</p>
      </div>
    </div>)}
    {/*  */}



    {/* Stats Cards - Fixed Alignment */}
    {isStudentOrParent ? (
      <div className="grid grid-cols-2 gap-4">
        {/* Student/Parent stats cards here */}
      </div>
    ) : (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 flex-shrink-0">
              <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Active Routes</p>
              <p className="text-xl sm:text-2xl font-bold text-amber-400">{activeRoutes.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-hover border-t-2 border-t-blue-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 flex-shrink-0">
              <Bus className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Vehicles</p>
              <p className="text-xl sm:text-2xl font-bold text-blue-400">{vehicles.length}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 flex-shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground truncate">Seats Assigned</p>
              <p className="text-xl sm:text-2xl font-bold text-emerald-400">
                {assignedSeats}
                <span className="text-xs ml-1 text-muted-foreground font-normal">/ {totalCapacity}</span>
              </p>
            </div>
          </CardContent>
        </Card>

        {isManager && (
          <Card className="glass-card glass-hover border-t-2 border-t-purple-500/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 flex-shrink-0">
                <UserCog className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground truncate">Drivers</p>
                <p className="text-xl sm:text-2xl font-bold text-purple-400">{drivers.length}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )}
    {/* Stats */}

    {/* Tabs */}
    {!hideTabs && (<div className="flex gap-2 flex-wrap">
      <Button variant={tab === "routes" ? "default" : "outline"} size="sm" onClick={() => setTab("routes")}>
        <MapPin className="w-3.5 h-3.5 mr-1.5" />Routes
      </Button>
      {isStudentOrParent && (
        <Button variant={tab === "my-driver" ? "default" : "outline"} size="sm" onClick={() => setTab("my-driver")}>
          <Navigation className="w-3.5 h-3.5 mr-1.5" />My Driver
        </Button>
      )}
      {isStudentOrParent && (
        <Button variant={tab === "logs" ? "default" : "outline"} size="sm" onClick={() => setTab("logs")}>
          <Clock className="w-3.5 h-3.5 mr-1.5" />Boarding Logs
        </Button>
      )}
      {!isStudentOrParent && (
        <>
          <Button variant={tab === "vehicles" ? "default" : "outline"} size="sm" onClick={() => setTab("vehicles")}>
            <Bus className="w-3.5 h-3.5 mr-1.5" />Vehicles
          </Button>
          <Button variant={tab === "logs" ? "default" : "outline"} size="sm" onClick={() => setTab("logs")}>
            <Clock className="w-3.5 h-3.5 mr-1.5" />Boarding Logs
          </Button>
        </>
      )}
      {isManager && (<>
        <Button variant={tab === "drivers" ? "default" : "outline"} size="sm" onClick={() => setTab("drivers")}>
          <UserCog className="w-3.5 h-3.5 mr-1.5" />Drivers
        </Button>
        <Button variant={tab === "assignments" ? "default" : "outline"} size="sm" onClick={() => setTab("assignments")}>
          <Users className="w-3.5 h-3.5 mr-1.5" />Student Assignments
        </Button>
      </>)}
    </div>)}

    {/* Tab toolbars */}
   {isAdmin && tab === "routes" && (
  <Dialog open={openRoute} onOpenChange={(value) => {
    setOpenRoute(value);
    if (!value) resetRouteForm();
  }}>
    <DialogTrigger asChild>
      <Button className="gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
        <Plus className="w-4 h-4" />Add Route
      </Button>
    </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingRouteId ? "Edit Transport Route" : "Add Transport Route"}</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div><Label>Route Name *</Label><Input value={routeForm.name} onChange={e => setRouteForm(f => ({ ...f, name: e.target.value }))} placeholder="Route A — City Centre" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start Point</Label><Input value={routeForm.startPoint} onChange={e => setRouteForm(f => ({ ...f, startPoint: e.target.value }))} /></div>
            <div><Label>End Point</Label><Input value={routeForm.endPoint} onChange={e => setRouteForm(f => ({ ...f, endPoint: e.target.value }))} /></div>
          </div>
          <div><Label>Stops (comma-separated)</Label><Input value={routeForm.stops} onChange={e => setRouteForm(f => ({ ...f, stops: e.target.value }))} placeholder="Stop 1, Stop 2, Stop 3" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Departure Time</Label><Input type="time" value={routeForm.morningTime} onChange={e => setRouteForm(f => ({ ...f, morningTime: e.target.value }))} /></div>
            <div><Label>Arrival Time</Label><Input type="time" value={routeForm.eveningTime} onChange={e => setRouteForm(f => ({ ...f, eveningTime: e.target.value }))} /></div>
          </div>
          <div>
            <Label>Assign Vehicle</Label>
            <Select value={routeForm.vehicleId} onValueChange={v => setRouteForm(f => ({ ...f, vehicleId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select vehicle" /></SelectTrigger>
              <SelectContent><SelectItem value="none">Unassigned</SelectItem>{vehicles.map(v => <SelectItem key={v.id} value={String(v.id)}>{v.vehicleNumber} — {v.model ?? ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Distance (km)</Label><Input type="number" step="0.1" value={routeForm.distance} onChange={e => setRouteForm(f => ({ ...f, distance: e.target.value }))} placeholder="12.5" /></div>
            <div><Label>Fare (₹/month)</Label><Input type="number" step="1" value={routeForm.fare} onChange={e => setRouteForm(f => ({ ...f, fare: e.target.value }))} placeholder="1500" /></div>
          </div>
          <Button className="w-full" disabled={!routeForm.name || (editingRouteId ? updateRouteMutation.isPending : createRouteMutation.isPending)} onClick={() => {
            const payload = {
              name: routeForm.name,
              startPoint: routeForm.startPoint || undefined,
              endPoint: routeForm.endPoint || undefined,
              stops: routeForm.stops || undefined,
              morningTime: routeForm.morningTime || undefined,
              eveningTime: routeForm.eveningTime || undefined,
              vehicleId: routeForm.vehicleId && routeForm.vehicleId !== "none" ? parseInt(routeForm.vehicleId) : null,
              distance: routeForm.distance || undefined,
              fare: routeForm.fare || undefined,
            };
            if (editingRouteId) {
              updateRouteMutation.mutate({
                id: editingRouteId,
                data: payload,
              });
            }
            else {
              createRouteMutation.mutate({ data: payload });
            }
          }}>
            {editingRouteId ? (updateRouteMutation.isPending ? "Saving..." : "Save Changes") : (createRouteMutation.isPending ? "Creating..." : "Create Route")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>)}

    {isAdmin && tab === "vehicles" && (
  <Dialog open={openVehicle} onOpenChange={(value) => {
    setOpenVehicle(value);
    if (!value) resetVehicleForm();
  }}>
    <DialogTrigger asChild>
      <Button className="gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
        <Plus className="w-4 h-4" />Add Vehicle
      </Button>
    </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Add Vehicle</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Registration No. *</Label><Input value={vehicleForm.vehicleNumber} onChange={e => setVehicleForm(f => ({ ...f, vehicleNumber: e.target.value.toUpperCase() }))} placeholder="MH-01-AB-1234" /></div>
            <div>
              <Label>Type</Label>
              <Select value={vehicleForm.type} onValueChange={v => setVehicleForm(f => ({ ...f, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="minibus">Mini Bus</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="auto">Auto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Model</Label><Input value={vehicleForm.model} onChange={e => setVehicleForm(f => ({ ...f, model: e.target.value }))} placeholder="Tata 407" /></div>
            <div><Label>Capacity *</Label><Input type="number" value={vehicleForm.capacity} onChange={e => setVehicleForm(f => ({ ...f, capacity: e.target.value }))} /></div>
          </div>
          <div>
            <Label>Assign Driver</Label>
            <Select value={vehicleForm.driverId} onValueChange={v => setVehicleForm(f => ({ ...f, driverId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select driver" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {drivers
                  .filter(d => {
                    // Show the driver if:
                    // 1. Editing this vehicle and this is the current driver, OR
                    // 2. Driver has no vehicle assigned
                    const isCurrentDriver = editingVehicleId && String(d.id) === vehicleForm.driverId;
                    const isUnassigned = !d.assignedVehicleId || d.assignedVehicleId === null;
                    return isCurrentDriver || isUnassigned;
                  })
                  .map(d => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name} ({d.phone})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={!vehicleForm.vehicleNumber || !vehicleForm.capacity || (editingVehicleId ? updateVehicleMutation.isPending : createVehicleMutation.isPending)} onClick={() => {
            const payload = {
              vehicleNumber: vehicleForm.vehicleNumber,
              model: vehicleForm.model || undefined,
              capacity: parseInt(vehicleForm.capacity),
              type: vehicleForm.type,
              driverId: vehicleForm.driverId && vehicleForm.driverId !== "none" ? parseInt(vehicleForm.driverId) : null,
            };
            if (editingVehicleId) {
              updateVehicleMutation.mutate({ id: editingVehicleId, data: payload });
            }
            else {
              createVehicleMutation.mutate({ data: payload });
            }
          }}>
            {editingVehicleId ? (updateVehicleMutation.isPending ? "Saving..." : "Save Changes") : (createVehicleMutation.isPending ? "Adding..." : "Add Vehicle")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>)}

{isAdmin && tab === "drivers" && (
  <Dialog open={openDriver} onOpenChange={(value) => {
    setOpenDriver(value);
    if (!value) resetDriverForm();
  }}>
    <DialogTrigger asChild>
      <Button className="gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
        <Plus className="w-4 h-4" />{editingDriverId ? "Edit Driver" : "Add Driver"}
      </Button>
    </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editingDriverId ? "Edit Driver" : "Add Driver"}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">A user account with role <span className="font-semibold text-amber-400">driver</span> will be created. They can log in with the chosen username and password.</p>
        <div className="space-y-3 py-2">
          <div><Label>Full Name *</Label><Input value={driverForm.name} onChange={e => setDriverForm(f => ({ ...f, name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone *</Label><Input value={driverForm.phone} onChange={e => setDriverForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div><Label>License No.</Label><Input value={driverForm.licenseNo} onChange={e => setDriverForm(f => ({ ...f, licenseNo: e.target.value }))} placeholder="DL-12-345678" /></div>
          </div>
          <div><Label>Email (optional)</Label><Input type="email" value={driverForm.email} onChange={e => setDriverForm(f => ({ ...f, email: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Username *</Label><Input value={driverForm.username} onChange={e => setDriverForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, "") }))} placeholder="ramesh" /></div>
            <div><Label>{editingDriverId ? "New Password" : "Password"}{editingDriverId ? " (optional)" : " *"}</Label><Input type="text" value={driverForm.password} onChange={e => setDriverForm(f => ({ ...f, password: e.target.value }))} placeholder={editingDriverId ? "Leave blank to keep current password" : "min 6 chars"} /></div>
          </div>
          <div>
            <Label>Assign to Vehicle</Label>
            <Select value={driverForm.assignedVehicleId} onValueChange={v => setDriverForm(f => ({ ...f, assignedVehicleId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select vehicle (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No vehicle</SelectItem>
                {vehicles.filter(v => !v.driverId || String(v.id) === driverForm.assignedVehicleId).map(v => <SelectItem key={v.id} value={String(v.id)}>{v.vehicleNumber} — {v.model ?? "—"}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" disabled={!driverForm.name || !driverForm.phone || !driverForm.username || (editingDriverId ? updateDriverMutation.isPending : createDriverMutation.isPending)} onClick={() => {
            const payload = {
              name: driverForm.name,
              phone: driverForm.phone,
              email: driverForm.email || undefined,
              licenseNo: driverForm.licenseNo || undefined,
              username: driverForm.username,
              assignedVehicleId: driverForm.assignedVehicleId && driverForm.assignedVehicleId !== "none" ? parseInt(driverForm.assignedVehicleId) : null,
            };
            if (driverForm.password) {
              payload.password = driverForm.password;
            }
            if (editingDriverId) {
              updateDriverMutation.mutate({ id: editingDriverId, data: payload });
            }
            else {
              createDriverMutation.mutate(payload);
            }
          }}>
            {editingDriverId ? (updateDriverMutation.isPending ? "Saving..." : "Save Changes") : (createDriverMutation.isPending ? "Creating..." : "Create Driver Account")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>)}

    {isAdmin && tab === "assignments" && (<Dialog open={openAssign} onOpenChange={setOpenAssign}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20">
          <Plus className="w-4 h-4" />Assign Student
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Assign Student to Route</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Student *</Label>
            <Select value={assignForm.studentId} onValueChange={v => setAssignForm(f => ({ ...f, studentId: v }))}>
              <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
              <SelectContent className="max-h-64">
                {students
                  .filter(s => !assignments.some(a => a.studentId === s.id))
                  .map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name} {s.rollNumber ? `(${s.rollNumber})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Route *</Label>
            <Select value={assignForm.routeId} onValueChange={v => setAssignForm(f => ({ ...f, routeId: v, pickupStop: "" }))}>
              <SelectTrigger><SelectValue placeholder="Select route" /></SelectTrigger>
              <SelectContent>
                {routes.filter(r => r.status === "active").map(r => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Pickup Stop</Label>
            {pickupOptions.length > 0 ? (<Select value={assignForm.pickupStop} onValueChange={v => setAssignForm(f => ({ ...f, pickupStop: v }))}>
              <SelectTrigger><SelectValue placeholder="Select stop" /></SelectTrigger>
              <SelectContent>{pickupOptions.map((s, i) => <SelectItem key={i} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>) : (<Input value={assignForm.pickupStop} onChange={e => setAssignForm(f => ({ ...f, pickupStop: e.target.value }))} placeholder="Enter pickup stop" />)}
          </div>
          <div>
            <Label>Drop Stop (optional)</Label>
            <Input value={assignForm.dropStop} onChange={e => setAssignForm(f => ({ ...f, dropStop: e.target.value }))} />
          </div>
          <p className="text-xs text-muted-foreground">A monthly transport fee of ₹1500 will be added to the student's account.</p>
          <div className="space-y-2">
            {selectedRoute && vehicleCapacity > 0 && (
              <div className={`text-sm flex items-center gap-2 p-3 rounded-lg border ${isOverCapacity ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
                <Bus className="w-4 h-4" />
                <span>
                  {selectedVehicle?.vehicleNumber} — {currentStudentsOnRoute}/{vehicleCapacity} seats taken
                  <span className="font-medium">({remainingSeats} remaining)</span>
                </span>
              </div>
            )}

            {isOverCapacity && (
              <p className="text-red-400 text-sm flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Vehicle is at full capacity. Cannot assign more students.
              </p>
            )}

            <Button
              className="w-full"
              disabled={
                !assignForm.studentId ||
                !assignForm.routeId ||
                createAssignmentMutation.isPending ||
                isOverCapacity
              }
              onClick={() => createAssignmentMutation.mutate({
                studentId: parseInt(assignForm.studentId),
                routeId: parseInt(assignForm.routeId),
                pickupStop: assignForm.pickupStop || undefined,
                dropStop: assignForm.dropStop || undefined
              })}
            >
              {createAssignmentMutation.isPending ? "Assigning..." : "Assign Student"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>)}


    {/* ==================== STUDENT "MY DRIVER" TAB ==================== */}
    {/* ==================== STUDENT "MY DRIVER" TAB ==================== */}
    {/* ==================== STUDENT "MY DRIVER" TAB ==================== */}
    {/* ==================== STUDENT "MY DRIVER" TAB ==================== */}
    {isStudentOrParent && tab === "my-driver" && (
      <Card className="glass-card border-t-2 border-t-blue-500/40">
        <CardContent className="p-6">
          {studentAssignmentQuery.isLoading ? (
            <Skeleton className="h-[500px] w-full" />
          ) : !myAssignment ? (
            <div className="text-center py-16">
              <AlertTriangle className="w-16 h-16 mx-auto text-amber-400 mb-4" />
              <h3 className="text-xl font-medium">No Transport Assigned</h3>
              <p className="text-muted-foreground mt-2">Please contact your Transport Manager.</p>
            </div>
          ) : !myAssignment.driverId ? (
            <div className="text-center py-16">
              <AlertTriangle className="w-16 h-16 mx-auto text-amber-400 mb-4" />
              <h3 className="text-xl font-medium">Driver Not Assigned</h3>
              <p className="text-muted-foreground mt-2">
                Route is assigned but no driver is linked to the vehicle yet.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Driver Info */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex gap-5">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="text-4xl bg-blue-100 text-blue-600">
                        {myAssignment.driverName?.[0] || "D"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <h2 className="text-2xl font-semibold">{myAssignment.driverName}</h2>
                      <p className="text-lg text-blue-400">{myAssignment.vehicleNumber}</p>
                      <div className="mt-4 space-y-1 text-sm">
                        <p><span className="text-muted-foreground">Phone:</span> {myAssignment.driverPhone || "—"}</p>
                        {myAssignment.driverLicense && (
                          <p><span className="text-muted-foreground">License:</span> {myAssignment.driverLicense}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <DriverLiveTracker
                driverId={myAssignment.driverId}
                isManagerView={false}
                height="460px"
                showControls={false}
              />
            </div>
          )}
        </CardContent>
      </Card>
    )}

    {/* Routes content */}
    {tab === "routes" && (<Card className="glass-card border-t-2 border-t-amber-500/30">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {routesLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 w-full" />)
            : routes.length === 0
              ? <p className="text-muted-foreground col-span-2 text-center py-8">No routes added yet.</p>
              : routes.map((route) => (<Card key={route.id} className="glass-card glass-hover border-l-2 border-l-amber-500/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold">{route.name}</p>
                    <Badge className={`text-xs ${route.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{route.status}</Badge>
                  </div>
                  {(route.startPoint || route.endPoint) && (<div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span>{route.startPoint} → {route.endPoint}</span>
                  </div>)}
                  {(route.morningTime || route.eveningTime) && (<div className="flex gap-4 text-xs text-muted-foreground">
                    {route.morningTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />AM: {route.morningTime}</span>}
                    {route.eveningTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />PM: {route.eveningTime}</span>}
                  </div>)}
                  {route.stops && (<div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground mb-1">Stops:</p>
                    <div className="flex flex-wrap gap-1">
                      {route.stops.split(",").map((stop, i) => <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{stop.trim()}</span>)}
                    </div>
                  </div>)}
                  {(route.distance || route.fare) && (<div className="flex gap-3 text-xs text-muted-foreground">
                    {route.distance && <span>📏 {route.distance} km</span>}
                    {route.fare && <span>💰 ₹{route.fare}/mo</span>}
                  </div>)}
                  {/* === UPDATED: Show capacity & remaining seats === */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                    <span className="text-muted-foreground">
                      Driver: <span className="font-medium text-foreground">{route.driverName ?? "—"}</span>
                    </span>

                    {(() => {
                      const assigned = route.studentCount ?? 0;
                      const vehicle = vehicles.find(v => v.id === route.vehicleId);
                      const capacity = vehicle?.capacity ?? 0;
                      const remaining = capacity - assigned;

                      return (
                        <div className="flex items-center gap-2">
                          <span className="text-amber-400 font-medium">{assigned} students</span>
                          {capacity > 0 && (
                            <Badge variant="outline" className={`text-xs ${remaining < 5 ? "border-red-500 text-red-400" : "border-emerald-500 text-emerald-400"}`}>
                              {remaining} left / {capacity}
                            </Badge>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  {isManager && (
                    <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/40">
                      <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openEditRoute(route)}>
                        <Edit3 className="w-3.5 h-3.5" />Edit
                      </Button>
                      <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => {
                        if (window.confirm(`Delete route “${route.name}”? This will remove the route and related assignments.`)) {
                          deleteRouteMutation.mutate(route.id);
                        }
                      }} aria-label="Delete route">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>))}
        </div>
      </CardContent>
    </Card>)}

    {/* Vehicles content */}
    {tab === "vehicles" && (<Card className="glass-card border-t-2 border-t-amber-500/30">
      <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {vehiclesLoading
          ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
          : vehicles.length === 0
            ? <p className="text-muted-foreground col-span-3 text-center py-8">No vehicles registered.</p>
            : vehicles.map((v) => (<Card key={v.id} className="glass-card glass-hover">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">{v.vehicleNumber}</p>
                    <p className="text-xs text-muted-foreground capitalize">{v.type} · {v.capacity} seats</p>
                  </div>
                  <Badge className={`text-xs ${v.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>{v.status}</Badge>
                </div>
                {v.model && <p className="text-xs text-muted-foreground mt-1">{v.model}</p>}
                <p className="text-xs text-muted-foreground mt-1">Driver: <span className="font-medium text-foreground">{v.driverName ?? "Unassigned"}</span></p>
                {isManager && (
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border/40">
                    <Button size="sm" variant="outline" className="h-8 px-2" onClick={() => openEditVehicle(v)}>
                      <Edit3 className="w-3.5 h-3.5" />Edit
                    </Button>
                    <Button size="sm" variant="destructive" className="h-8 w-8 p-0" onClick={() => {
                      if (window.confirm(`Delete vehicle “${v.vehicleNumber}”? This will unassign it from any route.`)) {
                        deleteVehicleMutation.mutate(v.id);
                      }
                    }} aria-label="Delete vehicle">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>))}
      </CardContent>
    </Card>)}

    {/* Drivers content */}
    {isManager && tab === "drivers" && (<Card className="glass-card border-t-2 border-t-amber-500/30">
      <CardContent className="p-4">
        {driversQuery.isLoading ? (<Skeleton className="h-32 w-full" />) : drivers.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No drivers yet. Click "Add Driver" to create one.
          </p>
        ) : (<div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                <th className="py-2 px-2">Name</th>
                <th className="py-2 px-2">Phone</th>
                <th className="py-2 px-2">License</th>
                <th className="py-2 px-2">Assigned Vehicle</th>
                <th className="py-2 px-2">Status</th>
                <th className="py-2 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {drivers.map(d => (
                <tr key={d.id} className="border-b border-border/20 hover:bg-white/5">
                  <td className="py-2 px-2 font-medium">{d.name}</td>
                  <td className="py-2 px-2 text-muted-foreground">{d.phone ?? "—"}</td>
                  <td className="py-2 px-2 text-muted-foreground font-mono text-xs">{d.licenseNo ?? "—"}</td>
                  <td className="py-2 px-2">
                    {d.assignedVehicleNumber ? (
                      <Badge className="bg-blue-500/10 text-blue-400 text-xs">{d.assignedVehicleNumber}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Unassigned</span>
                    )}
                  </td>
                  <td className="py-2 px-2">
                    <Badge className={`text-xs ${d.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                      {d.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-2 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {/* NEW: Live GPS Tracking Button */}
                      {d.assignedVehicleNumber && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-3 gap-1.5 text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
                          onClick={() => {
                            setSelectedDriverForTracking(d);
                            setOpenLiveTrack(true);
                          }}
                        >
                          <Eye className="w-3.5 h-3.5" /> Live Track
                        </Button>
                      )}

                      {isManager && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => openEditDriver(d)}>
                            <Edit3 className="w-3.5 h-3.5" />Edit
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10"
                            onClick={() => {
                              if (window.confirm(`Delete driver “${d.name}”?`)) deleteDriverMutation.mutate(d.id);
                            }}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>)}
      </CardContent>
    </Card>)}

    {/* NEW: Live Tracking Modal */}
    {(isManager || isStudentOrParent) && (
      <Dialog
        open={openLiveTrack}
        onOpenChange={setOpenLiveTrack}
      >
        <DialogContent className="max-w-6xl h-[88vh] p-0 flex flex-col">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle>
              Live GPS Tracking — {selectedDriverForTracking?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 relative min-h-0">
            <DriverLiveTracker
              driverId={selectedDriverForTracking?.id}
              vehicleId={selectedDriverForTracking?.assignedVehicleId}
              isManagerView={isManager}
              height="100%"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}

    {/* Assignments content */}
    {isManager && tab === "assignments" && (<Card className="glass-card border-t-2 border-t-amber-500/30">
      <CardContent className="p-4">
        {assignmentsQuery.isLoading ? (<Skeleton className="h-32 w-full" />) : assignments.length === 0 ? (<p className="text-muted-foreground text-center py-8">No student-route assignments yet.</p>) : (<div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40">
              <th className="py-2 px-2">Student</th><th className="py-2 px-2">Class</th><th className="py-2 px-2">Route</th><th className="py-2 px-2">Pickup</th><th className="py-2 px-2">Fee</th><th className="py-2 px-2"></th>
            </tr></thead>
            <tbody>
              {assignments.map(a => (<tr key={a.id} className="border-b border-border/20 hover:bg-white/5">
                <td className="py-2 px-2 font-medium flex items-center gap-2">
                  <Avatar className="h-6 w-6 shrink-0">
                    {a.studentAvatarUrl && <AvatarImage src={a.studentAvatarUrl} />}
                    <AvatarFallback className="text-[10px]">{a.studentName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{a.studentName} {a.studentRoll ? <span className="text-xs text-muted-foreground">({a.studentRoll})</span> : null}</span>
                </td>
                <td className="py-2 px-2 text-muted-foreground text-xs">{a.className ?? "—"}</td>
                <td className="py-2 px-2 text-amber-400">{a.routeName ?? `Route #${a.routeId}`}</td>
                <td className="py-2 px-2 text-muted-foreground text-xs">{a.pickupStop ?? "—"}</td>
                <td className="py-2 px-2">
                  <Badge className={`text-xs ${a.feeStatus === "paid" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{a.feeStatus}</Badge>
                </td>
                <td className="py-2 px-2 text-right">
                  {isAdmin && (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10" onClick={() => removeAssignmentMutation.mutate(a.id)} aria-label="Remove">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </td>
              </tr>))}
            </tbody>
          </table>
        </div>)}
      </CardContent>
    </Card>)}

    {/* Logs content */}
    {tab === "logs" && (<Card className="glass-card border-t-2 border-t-amber-500/30">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-4 h-4 text-amber-400" />
          <h2 className="font-semibold">Transport Boarding Logs</h2>
        </div>
        {logsQuery.isLoading ? (<Skeleton className="h-32 w-full" />) : logs.length === 0 ? (<p className="text-muted-foreground text-center py-8">No boarding logs recorded yet.</p>) : (<div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40">
              <th className="py-2 px-2">Student</th>
              <th className="py-2 px-2">Route</th>
              <th className="py-2 px-2">Action</th>
              <th className="py-2 px-2">Location</th>
              <th className="py-2 px-2">Time</th>
            </tr></thead>
            <tbody>
              {logs.map(log => (<tr key={log.id} className="border-b border-border/20 hover:bg-white/5">
                <td className="py-2 px-2 font-medium flex items-center gap-2">
                  <Avatar className="h-6 w-6 shrink-0">
                    {log.studentAvatarUrl && <AvatarImage src={log.studentAvatarUrl} />}
                    <AvatarFallback className="text-[10px]">{(log.studentName ?? "S").charAt(0)}</AvatarFallback>
                  </Avatar>
                  <span>{log.studentName ?? `Student #${log.studentId}`}</span>
                </td>
                <td className="py-2 px-2 text-muted-foreground">{log.routeName ?? `Route #${log.routeId}`}</td>
                <td className="py-2 px-2">
                  <Badge className={log.action === "boarded" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" : "bg-blue-500/10 text-blue-400 border border-blue-500/30"}>
                    {log.action === "boarded" ? "Boarded" : "Deboarded"}
                  </Badge>
                </td>
                <td className="py-2 px-2 text-muted-foreground">{log.location ?? "—"}</td>
                <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleString()}</td>
              </tr>))}
            </tbody>
          </table>
        </div>)}
      </CardContent>
    </Card>)}

    {!isStudentOrParent && !isManager && !isDriver && (<div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4 flex items-start gap-3">
      <AlertTriangle className="w-5 h-5 text-yellow-400 shrink-0 mt-0.5" />
      <p className="text-sm text-muted-foreground">You do not have permission to manage transport. Contact a Transport Manager.</p>
    </div>)}
  </div>);
}