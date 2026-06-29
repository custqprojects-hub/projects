import { useEffect, useState, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { UserRole } from "@/api-client";
import { useQuery } from "@tanstack/react-query";
import { 
  LayoutDashboard, Users, GraduationCap, BookOpen, ClipboardCheck, 
  FileText, Wallet, Building, Bus, Bell, MessageSquare, ShoppingCart, 
  UserPlus, Library, FileEdit, LogOut, Menu, School, CalendarDays, 
  CalendarCheck, UserCheck, Package, Navigation, MapPin, UserCog, 
  ArrowDownToLine, ChevronRight, ChevronDown, Mail, Shield, User, 
  Search, X, Command, Landmark, Settings, Check, XCircle, Upload
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Role colour palettes ───────────────────────────────────────────────────────
const ROLE_THEMES = {
  [UserRole.admin]: { hsl: "258 84% 67%", label: "Administrator", hex: "#7C3AED" },
  [UserRole.teacher]: { hsl: "152 76% 42%", label: "Teacher", hex: "#16A34A" },
  [UserRole.student]: { hsl: "194 100% 45%", label: "Student", hex: "#0891B2" },
  [UserRole.parent]: { hsl: "25 95% 56%", label: "Parent", hex: "#EA580C" },
  [UserRole.accountant]: { hsl: "43 96% 52%", label: "Accountant", hex: "#D97706" },
  [UserRole.clerk]: { hsl: "173 80% 38%", label: "Clerk", hex: "#0D9488" },
  [UserRole.transport_manager]: { hsl: "213 94% 58%", label: "Transport Manager", hex: "#2563EB" },
  [UserRole.driver]: { hsl: "199 89% 56%", label: "Driver", hex: "#0284C7" },
  [UserRole.hostel_warden]: { hsl: "343 82% 58%", label: "Hostel Warden", hex: "#E11D48" },
  [UserRole.store_manager]: { hsl: "77 86% 40%", label: "Store Manager", hex: "#65A30D" },
  [UserRole.vendor]: { hsl: "265 89% 68%", label: "Vendor", hex: "#9333EA" },
  [UserRole.librarian]: { hsl: "38 92% 50%", label: "Librarian", hex: "#F59E0B" },
};

const CATEGORIES = [
  {
    name: "Core Hub",
    keys: ["Dashboard", "My Profile", "Announcements", "Complaints"],
  },
  {
    name: "Academic Suite",
    keys: ["Classes", "Subjects", "Attendance", "Timetable", "Exams", "Results", "Lesson Plans", "Materials", "Assignments"],
  },
  {
    name: "Administration",
    keys: ["Admissions", "Students", "Parents", "Staff", "Visitors", "Leave Mgmt"],
  },
  {
    name: "Operations & Services",
    keys: ["Fees", "Hostel", "Hostel Roll", "Library", "Transport", "My Route"],
  },
  {
    name: "Inventory & Logistics",
    keys: ["Products", "Stock", "Purchase Orders", "Suppliers", "Reports", "Vendors", "Finance"],
  }
];

function getBreadcrumbs(path) {
  const parts = path.split("/").filter(Boolean);
  const crumbs = [{ name: "SMS", href: "/dashboard" }];
  if (parts.length === 0 || parts[0] === "dashboard") {
    return crumbs;
  }
  let currentPath = "";
  parts.forEach((part, index) => {
    currentPath += `/${part}`;
    let name = part.replace(/-/g, " ");
    name = name.charAt(0).toUpperCase() + name.slice(1);
    if (part === "inventory")
      name = "Inventory";
    if (part === "transport")
      name = "Transport";
    if (part === "exam-results")
      name = "Exam Results";
    if (!isNaN(part)) {
      name = "Details";
    }
    crumbs.push({ name, href: currentPath });
  });
  return crumbs;
}

function applyRoleTheme(role) {
  const theme = ROLE_THEMES[role];
  if (!theme)
    return;
  const root = document.documentElement;
  root.style.setProperty("--primary", theme.hsl);
  root.style.setProperty("--ring", theme.hsl);
  root.style.setProperty("--sidebar-primary", theme.hsl);
  root.style.setProperty("--sidebar-ring", theme.hsl);
}

const navItems = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: Object.values(UserRole) },
  { name: "My Profile", href: "/profile", icon: User, roles: Object.values(UserRole) },
  { name: "Admissions", href: "/admissions", icon: UserPlus, roles: [UserRole.admin, UserRole.clerk, UserRole.parent] },
  { name: "Students", href: "/students", icon: Users, roles: [UserRole.admin, UserRole.teacher, UserRole.clerk, UserRole.librarian] },
  { name: "Parents", href: "/parent-mapping", icon: Users, roles: [UserRole.admin, UserRole.clerk] },
  { name: "Staff", href: "/staff", icon: Users, roles: [UserRole.admin] },
  { name: "Classes", href: "/classes", icon: GraduationCap, roles: [UserRole.admin, UserRole.teacher] },
  { name: "Subjects", href: "/subjects", icon: BookOpen, roles: [UserRole.admin, UserRole.teacher] },
  { name: "Attendance", href: "/attendance", icon: ClipboardCheck, roles: [UserRole.admin, UserRole.teacher, UserRole.parent, UserRole.student] },
  { name: "Exams", href: "/exams", icon: FileText, roles: [UserRole.admin, UserRole.teacher, UserRole.student, UserRole.parent] },
  { name: "Results", href: "/exam-results", icon: FileText, roles: [UserRole.admin, UserRole.teacher, UserRole.student, UserRole.parent] },
  { name: "Fees", href: "/fees", icon: Wallet, roles: [UserRole.admin, UserRole.accountant, UserRole.parent, UserRole.student] },
  { name: "Hostel", href: "/hostel", icon: Building, roles: [UserRole.admin, UserRole.hostel_warden, UserRole.student] },
  { name: "Transport", href: "/transport", icon: Bus, roles: [UserRole.admin, UserRole.transport_manager, UserRole.driver, UserRole.parent, UserRole.student] },
  { name: "Vendors", href: "/vendors", icon: ShoppingCart, roles: [UserRole.admin, UserRole.accountant, UserRole.vendor] },
  { name: "Finance", href: "/vendor-finance", icon: Wallet, roles: [UserRole.vendor] },
  { name: "Products", href: "/inventory/products", icon: Package, roles: [UserRole.admin, UserRole.store_manager] },
  { name: "Stock", href: "/inventory/stock", icon: ArrowDownToLine, roles: [UserRole.admin, UserRole.store_manager] },
  { name: "Purchase Orders", href: "/inventory/orders", icon: ShoppingCart, roles: [UserRole.admin, UserRole.store_manager, UserRole.accountant] },
  { name: "Suppliers", href: "/inventory/suppliers", icon: Building, roles: [UserRole.admin, UserRole.store_manager] },
  { name: "Reports", href: "/inventory/reports", icon: FileText, roles: [UserRole.admin, UserRole.store_manager] },
  { name: "Announcements", href: "/announcements", icon: Bell, roles: [UserRole.admin, UserRole.teacher, UserRole.student, UserRole.parent, UserRole.librarian, UserRole.hostel_warden, UserRole.transport_manager, UserRole.accountant, UserRole.clerk, UserRole.driver, UserRole.store_manager, UserRole.vendor] },
  {
    name: "Complaints",
    href: "/complaints",
    icon: MessageSquare,
    roles: [
      UserRole.admin,
      UserRole.clerk,
      UserRole.hostel_warden,
      UserRole.teacher,
      UserRole.student,
      UserRole.parent,
      UserRole.accountant,
      UserRole.transport_manager,
      UserRole.librarian,
      UserRole.driver,
      UserRole.store_manager,
      UserRole.vendor
    ]
  },
  { name: "Materials", href: "/materials", icon: Package, roles: [UserRole.admin, UserRole.teacher, UserRole.student] },
  { name: "Library", href: "/library", icon: Library, roles: [UserRole.admin, UserRole.teacher, UserRole.student, UserRole.librarian] },
  { name: "Assignments", href: "/assignments", icon: FileEdit, roles: [UserRole.admin, UserRole.teacher, UserRole.student] },
  { name: "Lesson Plans", href: "/lesson-plans", icon: BookOpen, roles: [UserRole.admin, UserRole.teacher] },
  { name: "Timetable", href: "/timetable", icon: CalendarDays, roles: [UserRole.admin, UserRole.teacher, UserRole.student, UserRole.parent] },
  { name: "Leave Mgmt", href: "/leaves", icon: CalendarCheck, roles: [UserRole.admin, UserRole.teacher, UserRole.clerk, UserRole.student, UserRole.parent, UserRole.hostel_warden, UserRole.accountant, UserRole.transport_manager, UserRole.store_manager, UserRole.librarian, UserRole.driver, UserRole.clerk] },
  { name: "Visitors", href: "/visitors", icon: UserCheck, roles: [UserRole.admin, UserRole.clerk, UserRole.hostel_warden] },
  { name: "Hostel Roll", href: "/hostel-attendance", icon: ClipboardCheck, roles: [UserRole.admin, UserRole.hostel_warden] },
  { name: "My Route", href: "/my-route", icon: Navigation, roles: [UserRole.driver] },
  { name: "Payroll", href: "/payroll", icon: Landmark, roles: [UserRole.admin, UserRole.accountant] },
];

const moduleHeaderColors = {
  "/dashboard": { header: "text-slate-300", border: "border-b border-slate-400/10" },
  "/payroll": { header: "text-emerald-400", border: "border-b border-emerald-500/20" },
  "/admissions": { header: "text-violet-400", border: "border-b border-violet-500/20" },
  "/students": { header: "text-sky-400", border: "border-b border-sky-500/20" },
  "/parent-mapping": { header: "text-sky-400", border: "border-b border-sky-500/20" },
  "/staff": { header: "text-purple-400", border: "border-b border-purple-500/20" },
  "/classes": { header: "text-indigo-400", border: "border-b border-indigo-500/20" },
  "/subjects": { header: "text-indigo-400", border: "border-b border-indigo-500/20" },
  "/attendance": { header: "text-orange-400", border: "border-b border-orange-500/20" },
  "/exams": { header: "text-pink-400", border: "border-b border-pink-500/20" },
  "/exam-results": { header: "text-pink-400", border: "border-b border-pink-500/20" },
  "/fees": { header: "text-emerald-400", border: "border-b border-emerald-500/20" },
  "/hostel": { header: "text-teal-400", border: "border-b border-teal-500/20" },
  "/transport": { header: "text-amber-400", border: "border-b border-amber-500/20" },
  "/vendors": { header: "text-yellow-400", border: "border-b border-yellow-500/20" },
  "/vendor-finance": { header: "text-yellow-400", border: "border-b border-yellow-500/20" },
  "/announcements": { header: "text-cyan-400", border: "border-b border-cyan-500/20" },
  "/complaints": { header: "text-red-400", border: "border-b border-red-500/20" },
  "/materials": { header: "text-lime-400", border: "border-b border-lime-500/20" },
  "/library": { header: "text-amber-400", border: "border-b border-amber-500/20" },
  "/assignments": { header: "text-rose-400", border: "border-b border-rose-500/20" },
  "/lesson-plans": { header: "text-rose-400", border: "border-b border-rose-500/20" },
  "/timetable": { header: "text-blue-400", border: "border-b border-blue-500/20" },
  "/leaves": { header: "text-orange-400", border: "border-b border-orange-500/20" },
  "/visitors": { header: "text-gray-400", border: "border-b border-gray-500/20" },
  "/hostel-attendance": { header: "text-teal-400", border: "border-b border-teal-500/20" },
  "/my-route": { header: "text-amber-400", border: "border-b border-amber-500/20" },
  "/inventory/products": { header: "text-yellow-400", border: "border-b border-yellow-500/20" },
  "/inventory/stock": { header: "text-green-400", border: "border-b border-green-500/20" },
  "/inventory/low-stock": { header: "text-red-400", border: "border-b border-red-500/20" },
  "/inventory/orders": { header: "text-yellow-400", border: "border-b border-yellow-500/20" },
  "/inventory/suppliers": { header: "text-yellow-400", border: "border-b border-yellow-500/20" },
  "/inventory/reports": { header: "text-yellow-400", border: "border-b border-yellow-500/20" },
};

function NotificationBell() {
  const { data, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications");
      if (!r.ok)
        throw new Error("Failed");
      return r.json();
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
  const items = data?.items ?? [];
  const urgentCount = items.filter(n => n.severity !== "info").length;
  return (
    <Link href="/announcements">
      <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground w-8 h-8" aria-label="Notifications">
        <Bell className="w-4 h-4" />
        {urgentCount > 0 && (<span className="absolute top-1 right-1 min-w-[14px] h-[14px] flex items-center justify-center bg-destructive rounded-full border border-card text-[9px] font-bold text-white px-0.5 leading-none">
          {urgentCount > 9 ? "9+" : urgentCount}
        </span>)}
        {urgentCount === 0 && !isLoading && items.length > 0 && (<span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-sky-500 rounded-full border border-card" />)}
      </Button>
    </Link>
  );
}

// ─── School Settings Component ──────────────────────────────────────────────
function SchoolSettings({ user, schoolName, setSchoolName, logoUrl, setLogoUrl, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [editName, setEditName] = useState(schoolName || "");
  const [editLogo, setEditLogo] = useState(logoUrl || "");
  const [logoError, setLogoError] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const saveToLocalStorage = (name, logo) => {
    try {
      const settings = {
        name: name,
        logoUrl: logo,
        updatedAt: new Date().toISOString(),
        version: Date.now()
      };
      localStorage.setItem('schoolSettings', JSON.stringify(settings));
      
      window.dispatchEvent(new StorageEvent('storage', {
        key: 'schoolSettings',
        newValue: JSON.stringify(settings),
        oldValue: null,
        storageArea: localStorage
      }));
      
      window.dispatchEvent(new CustomEvent('schoolSettingsUpdated', { 
        detail: settings 
      }));
      
      return true;
    } catch (error) {
      console.error('Error saving to localStorage:', error);
      return false;
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setUploadError(null);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setUploadError('Please upload an image file (JPEG, PNG, GIF, SVG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size should be less than 5MB');
      return;
    }

    setUploadingLogo(true);
    
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        setEditLogo(base64String);
        setUploadError(null);
        setUploadingLogo(false);
        setLogoError(false);
      };
      reader.onerror = () => {
        setUploadError('Failed to read file');
        setUploadingLogo(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading logo:', error);
      setUploadError('Failed to upload logo. Please try again.');
      setUploadingLogo(false);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleSave = () => {
    setIsLoading(true);
    setUploadError(null);
    
  fetch("/api/school-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: editName, logoUrl: editLogo || null }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const payload = await res.json().catch(() => null);
          throw new Error(payload?.error || "Failed to update school settings");
        }
        return res.json();
      })
      .then((settings) => {
        const newLogo = settings.logoUrl || "";
        const newName = settings.name || "Nexus Academy";
        
        // Save to state
        setSchoolName(newName);
        setLogoUrl(newLogo);
        
        // Save to local storage for local sync
        saveToLocalStorage(newName, newLogo);
        
        onUpdate?.({ name: newName, logoUrl: newLogo });
        setIsEditing(false);
 console.log("✅ School settings saved to database and localStorage successfully!");
      })
      .catch((error) => {
        console.error("Error updating school settings:", error);
        setUploadError(error.message || "Failed to update school settings. Please try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
    setUploadError(null);
  };

  const handleCancel = () => {
    setEditName(schoolName || "");
    setEditLogo(logoUrl || "");
    setIsEditing(false);
    setUploadError(null);
    setLogoError(false);
  };

  if (user?.role !== UserRole.admin) return null;

  return (
    <div className="w-full">
      {!isEditing ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setEditName(schoolName || "");
            setEditLogo(logoUrl || "");
            setIsEditing(true);
            setUploadError(null);
            setLogoError(false);
          }}
          className="h-7 px-2 text-xs hover:bg-white/10 w-full justify-start"
        >
          <Settings className="w-3 h-3 mr-2" />
          Edit School Settings
        </Button>
      ) : (
        <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/10">
          {uploadError && (
            <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs">
              {uploadError}
            </div>
          )}
          
          <div>
            <label className="text-[10px] font-medium text-white/50 block mb-1">
              School Name
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all placeholder:text-white/20"
              placeholder="Enter school name"
              autoFocus
            />
          </div>
          
          <div>
            <label className="text-[10px] font-medium text-white/50 block mb-1">
              Logo
            </label>
            
            <div className="mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/jpeg,image/png,image/gif,image/svg+xml,image/webp"
                  className="hidden"
                  id="logo-upload"
                />
                <label
                  htmlFor="logo-upload"
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-all cursor-pointer text-xs text-white/60 hover:text-white/80",
                    uploadingLogo && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {uploadingLogo ? (
                    <>
                      <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Converting...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3" />
                      Upload Logo
                    </>
                  )}
                </label>
                {editLogo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditLogo('')}
                    className="h-8 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <p className="text-[9px] text-white/30 mt-1">
                Supported: JPG, PNG, SVG, GIF, WEBP (Max 5MB)
              </p>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={editLogo}
                onChange={(e) => setEditLogo(e.target.value)}
                className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/90 text-xs focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/30 transition-all placeholder:text-white/20"
                placeholder="Or enter logo URL"
              />
            </div>

            {editLogo && !logoError && (
              <div className="mt-2 p-2 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <img 
                  src={editLogo} 
                  alt="Logo preview" 
                  className="h-12 object-contain"
                  onError={() => {
                    setLogoError(true);
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isLoading || uploadingLogo}
              size="sm"
              className="flex-1 bg-primary hover:bg-primary/80 text-white text-xs py-1.5 rounded-lg transition-all"
            >
              {isLoading ? (
                <div className="flex items-center gap-1">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Save
                </div>
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="flex-1 bg-transparent border-white/10 hover:bg-white/5 text-white/70 hover:text-white/90 text-xs py-1.5 rounded-lg transition-all"
            >
              <div className="flex items-center gap-1">
                <XCircle className="w-3 h-3" />
                Cancel
              </div>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Nav link with hover animation ────────────────────────────────────────────
function NavLink({ item, isActive, onNavigate }) {
  return (
    <Link href={item.href} onClick={onNavigate} className="outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-xl mx-2">
      <div className={cn("relative flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-150 text-sm font-medium group border", isActive
        ? "text-primary bg-primary/12 border border-primary/20 shadow-sm"
        : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-white/10 border border-transparent")}>
        {isActive && (<motion.div layoutId="nav-active" className="absolute inset-0 rounded-xl bg-primary/8" transition={{ type: "spring", bounce: 0.2, duration: 0.4 }} />)}
        <item.icon className={cn("w-4 h-4 shrink-0 relative z-10 transition-transform duration-150", !isActive && "group-hover:scale-110")} />
        <span className="truncate relative z-10">{item.name}</span>
        {isActive && <ChevronRight className="w-3 h-3 ml-auto text-primary/60 relative z-10 shrink-0" />}
      </div>
    </Link>
  );
}

// ─── Sidebar NavLinks ──────────────────────────────────────────────────────────
function NavLinks({ filteredNavItems, location, expandedCats, setExpandedCats, onNavigate }) {
  return (
    <div className="flex flex-col gap-2 py-3 px-0">
      {CATEGORIES.map((cat) => {
        const catItems = filteredNavItems.filter(item => cat.keys.includes(item.name));
        if (catItems.length === 0) return null;
        const isExpanded = expandedCats[cat.name];
        return (
          <div key={cat.name} className="space-y-1">
            <button
              type="button"
              onClick={() => setExpandedCats(prev => ({ ...prev, [cat.name]: !prev[cat.name] }))}
              className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-sidebar-foreground/40 hover:text-sidebar-foreground/80 transition-colors cursor-pointer outline-none select-none"
            >
              <span>{cat.name}</span>
              <ChevronDown className={cn("w-3 h-3 transition-transform duration-200 opacity-60", !isExpanded && "-rotate-90")} />
            </button>
            <AnimatePresence initial={false}>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden flex flex-col gap-0.5"
                >
                  {catItems.map((item) => {
                    const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
                    return <NavLink key={item.href} item={item} isActive={isActive} onNavigate={onNavigate} />;
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function Layout({ children }) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const [pageKey, setPageKey] = useState(location);
  const [expandedCats, setExpandedCats] = useState({
    "Core Hub": true,
    "Academic Suite": true,
    "Administration": true,
    "Operations & Services": true,
    "Inventory & Logistics": true,
  });

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState("");
  const [searchStudents, setSearchStudents] = useState([]);
  const [searchStaff, setSearchStaff] = useState([]);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [schoolName, setSchoolName] = useState("Nexus Academy");
  const [logoUrl, setLogoUrl] = useState("");
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsVersion, setSettingsVersion] = useState(0);

  const loadSettings = async() => {
    try {
      const res = await fetch("/api/school-settings", { credentials: "include" });
      if (res.ok) {
        const settings = await res.json();
        const newName = settings.name || "Nexus Academy";
        const newLogo = settings.logoUrl || "";
        
        setSchoolName(newName);
        setLogoUrl(newLogo);
      
      
      
      setSettingsVersion(settings.version || Date.now());
      
    // Save to local storage for other local components
        const localSettings = {
          name: newName,
          logoUrl: newLogo,
          updatedAt: settings.updatedAt || new Date().toISOString(),
          version: settings.version || Date.now()
        };
        localStorage.setItem('schoolSettings', JSON.stringify(localSettings));
        console.log("✅ Loaded settings from API:", newName);
    
    
    } else {

      throw new Error("API call failed");
      }
    } catch (error) {
    console.log("⚠️ Failed to load settings from API, falling back to localStorage...", error);
      try {
        const saved = localStorage.getItem('schoolSettings');
        if (saved) {
          const settings = JSON.parse(saved);
          setSchoolName(settings.name || "Nexus Academy");
          setLogoUrl(settings.logoUrl || "");
          setSettingsVersion(settings.version || Date.now());
          console.log("✅ Loaded settings from localStorage (fallback):", settings.name);
        } else {
          const defaultSettings = {
            name: "Nexus Academy",
            logoUrl: "",
            updatedAt: new Date().toISOString(),
            version: Date.now()
          };
          localStorage.setItem('schoolSettings', JSON.stringify(defaultSettings));
          setSchoolName(defaultSettings.name);
          setLogoUrl(defaultSettings.logoUrl);
          setSettingsVersion(defaultSettings.version);
          console.log("✅ Created default settings");
        }
      } catch (err) {
        console.error("Failed to load school settings from localStorage:", err);
      }
    
    
    } finally {
      setSettingsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();

    const handleStorageChange = (e) => {
      if (e.key === 'schoolSettings' && e.newValue) {
        try {
          const settings = JSON.parse(e.newValue);
          if (settings.version && settings.version > settingsVersion) {
            setSchoolName(settings.name || "Nexus Academy");
            setLogoUrl(settings.logoUrl || "");
            setSettingsVersion(settings.version);
            console.log("🔄 Settings updated from another tab:", settings.name);
          }
        } catch (error) {
          console.error("Error parsing settings from storage event:", error);
        }
      }
    };

    const handleCustomEvent = (e) => {
      const settings = e.detail;
      if (settings.version && settings.version > settingsVersion) {
        setSchoolName(settings.name || "Nexus Academy");
        setLogoUrl(settings.logoUrl || "");
        setSettingsVersion(settings.version);
        console.log("🔄 Settings updated from custom event:", settings.name);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('schoolSettingsUpdated', handleCustomEvent);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('schoolSettingsUpdated', handleCustomEvent);
    };
  }, [settingsVersion]);

  useEffect(() => {
    if (user?.role)
      applyRoleTheme(user.role);
  }, [user?.role]);

  useEffect(() => {
    setPageKey(location);
  }, [location]);

  useEffect(() => {
    if (!mobileNavOpen)
      return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileNavOpen]);

  if (!user)
    return <>{children}</>;

  const roleTheme = ROLE_THEMES[user.role] ?? ROLE_THEMES[UserRole.admin];
  const filteredNavItems = navItems.filter((item) => item.roles.includes(user.role));

  useEffect(() => {
    const activeItem = filteredNavItems.find(item =>
      location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href))
    );
    if (activeItem) {
      const activeCat = CATEGORIES.find(cat => cat.keys.includes(activeItem.name));
      if (activeCat) {
        setExpandedCats(prev => ({ ...prev, [activeCat.name]: true }));
      }
    }
  }, [location, filteredNavItems]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!paletteOpen) {
      setPaletteSearch("");
      setSearchStudents([]);
      setSearchStaff([]);
      return;
    }
    if (!paletteSearch || paletteSearch.length < 2) {
      setSearchStudents([]);
      setSearchStaff([]);
      return;
    }
    const delayDebounceFn = setTimeout(async () => {
      try {
        if (["admin", "teacher", "clerk", "librarian"].includes(user?.role)) {
          const studentRes = await fetch(`/api/students?search=${encodeURIComponent(paletteSearch)}`, { credentials: "include" });
          if (studentRes.ok) {
            const data = await studentRes.json();
            setSearchStudents(data.slice(0, 5));
          }
        }
        if (["admin", "clerk"].includes(user?.role)) {
          const staffRes = await fetch(`/api/staff`, { credentials: "include" });
          if (staffRes.ok) {
            const data = await staffRes.json();
            const query = paletteSearch.toLowerCase();
            const filtered = data.filter(s => s.name?.toLowerCase().includes(query) || s.staffId?.toLowerCase().includes(query));
            setSearchStaff(filtered.slice(0, 5));
          }
        }
      } catch (err) {
        console.error("Search error", err);
      }
    }, 250);
    return () => clearTimeout(delayDebounceFn);
  }, [paletteSearch, paletteOpen, user?.role]);

  const matchedRoutes = filteredNavItems.filter(item =>
    item.name.toLowerCase().includes(paletteSearch.toLowerCase())
  ).slice(0, 4);

  const currentModule = moduleHeaderColors[location] ?? moduleHeaderColors["/dashboard"];

  const RoleBadge = () => (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider" style={{
      background: `hsl(${roleTheme.hsl} / 0.15)`,
      color: `hsl(${roleTheme.hsl})`,
      border: `1px solid hsl(${roleTheme.hsl} / 0.3)`,
    }}>
      {roleTheme.label}
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between gap-2 px-3 py-3 border-b border-border/40 bg-[#050505] sticky top-0 z-30 backdrop-blur-sm">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt="School Logo" className="w-6 h-6 object-contain shrink-0" />
          ) : (
            <School className="w-6 h-6 text-primary shrink-0" />
          )}
          <span className="min-w-0 truncate font-serif font-bold text-base leading-tight">{schoolName}</span>
        </div>
        <div className="flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Open navigation menu"
            aria-expanded={mobileNavOpen}
            aria-controls="mobile-navigation"
            className="h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>
      </header>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/70"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            id="mobile-navigation"
            className="relative z-10 flex h-dvh w-[86vw] max-w-[18rem] min-w-[17rem] flex-col bg-[#050505] text-sidebar-foreground shadow-2xl border-r border-white/10"
            style={{ borderTop: `3px solid hsl(${roleTheme.hsl})` }}
          >
            <div className="p-4 border-b border-white/8">
              <div className="flex min-w-0 items-center gap-2 mb-3">
                <div className="bg-primary/15 border border-primary/25 p-1.5 rounded-lg shrink-0">
                  {logoUrl ? (
                    <img src={logoUrl} alt="School Logo" className="w-5 h-5 object-contain" />
                  ) : (
                    <School className="w-5 h-5 text-primary" />
                  )}
                </div>
                <span className="min-w-0 flex-1 truncate font-serif font-bold text-lg">{schoolName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="Close navigation menu"
                  className="h-8 w-8 shrink-0 rounded-lg text-white/60 hover:text-white hover:bg-white/10"
                  onClick={() => setMobileNavOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <RoleBadge />
              {user?.role === UserRole.admin && (
                <div className="mt-2">
                  <SchoolSettings
                    user={user}
                    schoolName={schoolName}
                    setSchoolName={setSchoolName}
                    logoUrl={logoUrl}
                    setLogoUrl={setLogoUrl}
                  />
                </div>
              )}
            </div>

            <nav className="flex-1 overflow-y-auto py-1" aria-label="Main navigation">
              <NavLinks
                filteredNavItems={filteredNavItems}
                location={location}
                expandedCats={expandedCats}
                setExpandedCats={setExpandedCats}
                onNavigate={() => setMobileNavOpen(false)}
              />
            </nav>

            <div className="p-4 border-t border-white/8 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 shrink-0" style={{ border: `2px solid hsl(${roleTheme.hsl} / 0.4)` }}>
                  <AvatarImage src={user.avatarUrl || ""} />
                  <AvatarFallback className="text-xs font-bold" style={{ background: `hsl(${roleTheme.hsl} / 0.2)`, color: `hsl(${roleTheme.hsl})` }}>
                    {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col overflow-hidden">
                  <span className="text-sm font-medium truncate text-white/85">{user.name}</span>
                  <span className="text-xs text-white/40 capitalize truncate">{user.role.replace(/_/g, " ")}</span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 h-9 text-sm"
                onClick={() => {
                  setMobileNavOpen(false);
                  logout();
                }}
                data-testid="button-mobile-logout"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-[#050505] border-r border-white/8 text-sidebar-foreground shrink-0 sticky top-0 h-screen" style={{ borderTop: `3px solid hsl(${roleTheme.hsl})` }}>
        <div className="p-5 border-b border-white/8">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="bg-primary/15 border border-primary/25 p-1.5 rounded-lg">
              {logoUrl ? (
                <img src={logoUrl} alt="School Logo" className="w-5 h-5 object-contain" />
              ) : (
                <School className="w-5 h-5 text-primary" />
              )}
            </div>
            <span className="font-serif font-bold text-lg">{schoolName}</span>
          </div>
          <div className="flex items-center justify-between mb-2">
            <RoleBadge />
          </div>
          {user?.role === UserRole.admin && (
            <SchoolSettings 
              user={user}
              schoolName={schoolName}
              setSchoolName={setSchoolName}
              logoUrl={logoUrl}
              setLogoUrl={setLogoUrl}
            />
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          <NavLinks
            filteredNavItems={filteredNavItems}
            location={location}
            expandedCats={expandedCats}
            setExpandedCats={setExpandedCats}
          />
        </div>

        <div className="p-4 border-t border-white/8">
          <div className="flex items-center gap-3 mb-4">
            <Avatar
              className="w-9 h-9 shrink-0"
              style={{ border: `2px solid hsl(${roleTheme.hsl} / 0.4)` }}
            >
              <AvatarImage src={user.avatarUrl || ""} />
              <AvatarFallback
                className="text-sm font-bold"
                style={{
                  background: `hsl(${roleTheme.hsl} / 0.2)`,
                  color: `hsl(${roleTheme.hsl})`
                }}
              >
                {user.name?.charAt(0)?.toUpperCase() ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-medium truncate text-white/85">
                {user.name}
              </span>
              <span className="text-xs text-white/40 capitalize truncate">
                {user.role.replace(/_/g, " ")}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-white/40 hover:text-white/80 hover:bg-white/5 h-9 text-sm"
            onClick={logout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background">
        <header className={`hidden md:flex h-14 bg-card/80 backdrop-blur-sm items-center justify-between px-6 sticky top-0 z-20 ${currentModule.border}`}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {getBreadcrumbs(location).map((crumb, idx, arr) => (
                <div key={idx} className="flex items-center gap-1.5">
                  {idx > 0 && <span className="text-white/10">/</span>}
                  {idx === arr.length - 1 ? (
                    <span className="font-semibold text-white/85 capitalize">{crumb.name}</span>
                  ) : (
                    <Link href={crumb.href} className="hover:text-white/85 transition-colors capitalize">
                      {crumb.name}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/8 bg-[#050505] text-xs text-muted-foreground hover:border-white/15 hover:text-foreground transition-all cursor-pointer w-48 text-left outline-none"
            >
              <Search className="w-3.5 h-3.5 opacity-60" />
              <span>Search SMS...</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-4 select-none items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1 font-mono text-[9px] font-medium text-white/50">
                <span>⌘</span>K
              </kbd>
            </button>
            <NotificationBell />
          </div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div 
            key={pageKey} 
            initial={{ opacity: 0, y: 8 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -4 }} 
            transition={{ duration: 0.22, ease: "easeOut" }} 
            className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl mx-auto w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Command Palette Overlay */}
      <AnimatePresence>
        {paletteOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPaletteOpen(false)}
            className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-start justify-center pt-[15vh] p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-[#0a0a0a] border border-white/10 shadow-2xl rounded-xl overflow-hidden flex flex-col max-h-[60vh]"
            >
              <div className="flex items-center gap-3 px-4 border-b border-white/10 h-12 shrink-0">
                <Search className="w-4 h-4 text-white/40 shrink-0" />
                <input
                  type="text"
                  placeholder="Search pages, students, staff..."
                  value={paletteSearch}
                  onChange={(e) => setPaletteSearch(e.target.value)}
                  className="flex-1 bg-transparent border-none text-sm text-white/90 placeholder-white/30 focus:outline-none h-full"
                  autoFocus
                />
                <button
                  onClick={() => setPaletteOpen(false)}
                  className="p-1 rounded-md hover:bg-white/5 text-white/40 hover:text-white/80"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-4">
                {matchedRoutes.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Pages</p>
                    <div className="space-y-0.5">
                      {matchedRoutes.map((route) => (
                        <button
                          key={route.href}
                          onClick={() => {
                            setLocation(route.href);
                            setPaletteOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-white/80"
                        >
                          <route.icon className="w-4 h-4 opacity-70" />
                          <span>{route.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchStudents.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Students</p>
                    <div className="space-y-0.5">
                      {searchStudents.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setLocation(`/students/${s.id}`);
                            setPaletteOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-white/80"
                        >
                          <Avatar className="w-5 h-5 shrink-0">
                            <AvatarImage src={s.avatarUrl} />
                            <AvatarFallback className="bg-sky-500/20 text-sky-400 text-[10px] font-bold">
                              {s.name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 truncate">
                            <p className="font-medium truncate leading-tight text-xs">{s.name}</p>
                            <p className="text-[10px] text-white/40 truncate">{s.rollNumber} · {s.className || 'No Class'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {searchStaff.length > 0 && (
                  <div>
                    <p className="px-3 py-1.5 text-[10px] font-semibold text-white/30 uppercase tracking-wider">Staff</p>
                    <div className="space-y-0.5">
                      {searchStaff.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => {
                            setLocation(`/staff/${s.id}`);
                            setPaletteOpen(false);
                          }}
                          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer text-white/80"
                        >
                          <Avatar className="w-5 h-5 shrink-0">
                            <AvatarImage src={s.avatarUrl} />
                            <AvatarFallback className="bg-purple-500/20 text-purple-400 text-[10px] font-bold">
                              {s.name?.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 truncate">
                            <p className="font-medium truncate leading-tight text-xs">{s.name}</p>
                            <p className="text-[10px] text-white/40 truncate">{s.staffId} · {s.role}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {paletteSearch.length >= 2 && matchedRoutes.length === 0 && searchStudents.length === 0 && searchStaff.length === 0 && (
                  <div className="py-8 text-center text-white/40 flex flex-col items-center justify-center gap-2">
                    <Search className="w-8 h-8 opacity-20" />
                    <p className="text-xs">No matching results found for "{paletteSearch}"</p>
                  </div>
                )}

                {(!paletteSearch || paletteSearch.length < 2) && (
                  <div className="px-3 py-4 text-center text-white/40 space-y-1">
                    <Command className="w-8 h-8 mx-auto opacity-20 mb-2" />
                    <p className="text-xs font-semibold text-white/70">SMS Command Center</p>
                    <p className="text-[11px]">Type at least 2 characters to search students, staff or pages.</p>
                  </div>
                )}
              </div>

              <div className="px-4 py-2 border-t border-white/10 bg-[#050505] flex items-center justify-between text-[10px] text-white/30 shrink-0">
                <span>Navigate with mouse or search directly</span>
                <span>ESC to close</span>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
