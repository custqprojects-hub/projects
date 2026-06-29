import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Navigation, Play, Square, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { format } from "date-fns";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

function MapUpdater({ position }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo([position.lat, position.lng], 16, { duration: 0.6 });
  }, [position, map]);
  return null;
}

export default function DriverLiveTracker({
  driverId,
  isManagerView = false,
  height = "420px",
  showControls = true
}) {
  const { user } = useAuth();
  
  // FIX: For students, fetch the driver ID from the API
  const [resolvedDriverId, setResolvedDriverId] = useState(null);
  const [isLoadingDriver, setIsLoadingDriver] = useState(false);
  const [hasFetchedAssignment, setHasFetchedAssignment] = useState(false);

  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [lastSent, setLastSent] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);

  const watchIdRef = useRef(null);
  const intervalRef = useRef(null);

  // ==================== FETCH DRIVER ID FOR STUDENTS ====================
  useEffect(() => {
    // If driverId is provided and is a valid number, use it
    if (driverId && !isNaN(driverId)) {
      console.log("Using provided driverId:", driverId);
      setResolvedDriverId(driverId);
      setHasFetchedAssignment(true);
      return;
    }

    // For students and parents, fetch their assigned driver
    if (user?.role === "student" || user?.role === "parent") {
      const fetchMyAssignment = async () => {
        setIsLoadingDriver(true);
        setError(null);
        try {
          console.log("Fetching my assignment for student/parent...");
          const res = await fetch("/api/transport/my-assignment", {
            credentials: "include"
          });
          
          if (!res.ok) {
            if (res.status === 500) {
              throw new Error("Server error - please try again");
            }
            throw new Error(`HTTP ${res.status}`);
          }
          
          const data = await res.json();
          console.log("My assignment data:", data);
          
          if (data?.driverId) {
            setResolvedDriverId(data.driverId);
            console.log("Found driver ID:", data.driverId);
          } else {
            setError("No driver assigned to your route");
            console.log("No driver assigned");
          }
        } catch (err) {
          console.error("Failed to fetch driver assignment:", err);
          setError("Could not find your assigned driver");
        } finally {
          setIsLoadingDriver(false);
          setHasFetchedAssignment(true);
        }
      };
      
      fetchMyAssignment();
    } else {
      // For other roles, mark as done
      setHasFetchedAssignment(true);
    }
  }, [driverId, user?.role]);

  // ==================== FETCH LOCATION (Student + Manager) ====================
  const fetchLatestLocation = async () => {
    if (!resolvedDriverId) {
      console.log("No resolvedDriverId, skipping fetch");
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      console.log(`Fetching location for driver ${resolvedDriverId}...`);
      const res = await fetch(`/api/transport/drivers/live?driverId=${resolvedDriverId}`, { 
        credentials: "include" 
      });

      if (!res.ok) {
        if (res.status === 403) {
          setError("You don't have permission to track this driver");
        } else if (res.status === 404) {
          setError("Driver location not available");
        } else {
          throw new Error(`HTTP ${res.status}`);
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      console.log("Location data received:", data);
      
      // Handle the response format
      if (data?.lat && data?.lng) {
        setCurrentLocation({
          lat: Number(data.lat),
          lng: Number(data.lng),
          speed: data.speed ? Number(data.speed) : undefined
        });
        setLastSent(data.lastUpdated ? new Date(data.lastUpdated) : new Date());
        setIsLive(data.lastUpdated ? Date.now() - new Date(data.lastUpdated).getTime() < 5 * 60 * 1000 : false);
        console.log("Location set:", { lat: data.lat, lng: data.lng });
      } else if (data?.message) {
        // No location available yet
        setCurrentLocation(null);
        setIsLive(false);
        setError(data.message);
      } else {
        setCurrentLocation(null);
        setIsLive(false);
      }
    } catch (err) {
      console.error("Fetch location error:", err);
      setError("Failed to fetch location");
    } finally {
      setLoading(false);
    }
  };

  // ==================== DRIVER SEND LOCATION ====================
  const sendLocation = async (position) => {
    try {
      await fetch("/api/transport/drivers/live-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed || 0,
        }),
      });
      setLastSent(new Date());
    } catch (e) {
      console.error("Send location failed", e);
    }
  };

  const beginTracking = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser");
      return;
    }

    const id = navigator.geolocation.watchPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          speed: position.coords.speed
        });
        setIsLive(true);
        setError(null);
        sendLocation(position);
      },
      (err) => {
        console.error("Geolocation Error:", err);
        if (err.code === 1) {
          setError("Location access denied. Please allow location permission.");
        } else if (err.code === 2) {
          setError("Location unavailable. Try again.");
        } else if (err.code === 3) {
          setError("Location request timed out.");
        } else {
          setError("Failed to get location. Please try again.");
        }
      },
      { 
        enableHighAccuracy: true, 
        maximumAge: 5000, 
        timeout: 15000 
      }
    );

    watchIdRef.current = id;
  };

  const startTracking = () => {
    setError(null);
    beginTracking();
    setIsTracking(true);
    localStorage.setItem("driver_live_tracking", "true");
  };

  const stopTracking = async () => {
    if (watchIdRef.current) navigator.geolocation.clearWatch(watchIdRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);

    try {
      await fetch("/api/transport/drivers/stop-tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
    } catch (e) {}

    setIsTracking(false);
    setIsLive(false);
    localStorage.removeItem("driver_live_tracking");
  };

  // Auto fetch for students/managers
  useEffect(() => {
    if (resolvedDriverId && (isManagerView || user?.role === "student" || user?.role === "parent")) {
      console.log("Starting location polling for driver:", resolvedDriverId);
      fetchLatestLocation();
      const int = setInterval(fetchLatestLocation, 8000);
      return () => {
        console.log("Clearing location polling interval");
        clearInterval(int);
      };
    }
  }, [resolvedDriverId, isManagerView, user?.role]);

  // Debug logging
  useEffect(() => {
    console.log("DriverLiveTracker Debug:", {
      passedDriverId: driverId,
      userRole: user?.role,
      resolvedDriverId,
      isLoadingDriver,
      hasFetchedAssignment,
      currentLocation: currentLocation ? "Has location" : "No location",
    });
  }, [driverId, user?.role, resolvedDriverId, isLoadingDriver, hasFetchedAssignment, currentLocation]);

  // Show loading state
  if (isLoadingDriver) {
    return (
      <Card className="glass-card border-t-2 border-t-blue-500/40 h-full flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading driver information...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // If we've fetched and there's no driver assigned
  if (hasFetchedAssignment && !resolvedDriverId && !driverId) {
    return (
      <Card className="glass-card border-t-2 border-t-blue-500/40 h-full flex flex-col">
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 mx-auto text-amber-400 mb-4" />
            <p className="text-muted-foreground">No driver assigned to your route</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card border-t-2 border-t-blue-500/40 h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-blue-400" />
            Live GPS Tracking
          </CardTitle>
          <Badge className={isLive ? "bg-emerald-500" : "bg-amber-500"}>
            {isLive ? "LIVE" : "OFFLINE"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0">
        {showControls && user?.role === "driver" && (
          <div className="p-4 border-b flex gap-3">
            <Button onClick={startTracking} disabled={isTracking} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              <Play className="w-4 h-4 mr-2" /> Start Tracking
            </Button>
            <Button onClick={stopTracking} disabled={!isTracking} variant="destructive" className="flex-1">
              <Square className="w-4 h-4 mr-2" /> Stop Tracking
            </Button>
          </div>
        )}

        {error && (
          <div className="mx-4 mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 flex gap-3">
            <AlertTriangle className="w-5 h-5 mt-0.5" />
            <div>
              {error}
              {error.includes("denied") && (
                <p className="text-xs mt-1">Click the lock icon in address bar → Allow Location</p>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 p-4 relative" style={{ minHeight: height }}>
          <div className="absolute inset-0 rounded-xl overflow-hidden border border-border">
            {currentLocation ? (
              <MapContainer center={[currentLocation.lat, currentLocation.lng]} zoom={16} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[currentLocation.lat, currentLocation.lng]}>
                  <Popup>
                    <div>
                      <strong>Current Location</strong>
                      {currentLocation.speed && (
                        <p>Speed: {Math.round(currentLocation.speed * 3.6)} km/h</p>
                      )}
                      {lastSent && (
                        <p className="text-xs text-muted-foreground">
                          Updated: {format(lastSent, "HH:mm:ss")}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
                <MapUpdater position={currentLocation} />
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-center px-8 text-muted-foreground">
                {user?.role === "driver" 
                  ? "Click 'Start Tracking' to begin sharing your location" 
                  : loading 
                    ? "Fetching location..." 
                    : "Waiting for driver location..."}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}