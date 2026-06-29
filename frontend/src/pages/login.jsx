import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/lib/auth";
import { homeForRole } from "@/lib/role-home";
import { useLogin, getGetCurrentUserQueryKey } from "@/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { School, Loader2, Eye, EyeOff, UserCheck, GraduationCap, Users, Calculator, Bus, Home, ShoppingCart, Package, Shield, BookOpen, ArrowRight, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function Login() {
    const [, setLocation] = useLocation();
    const search = useSearch();

    const [schoolName, setSchoolName] = useState("Nexus Academy");
    const [logoUrl, setLogoUrl] = useState("");
    useEffect(() => {
        const loadSettings = async () => {
            try {
                const res = await fetch("/api/school-settings");
                if (res.ok) {
                    const settings = await res.json();
                    setSchoolName(settings.name || "Nexus Academy");
                    setLogoUrl(settings.logoUrl || "");
                }
            } catch (err) {
                console.error("Failed to load school settings on login page:", err);
            }
        };
        loadSettings();
    }, []);

    const nextPath = (() => {
        const p = new URLSearchParams(search).get("next");
        // Only allow safe internal paths
        if (p && p.startsWith("/") && !p.startsWith("//"))
            return p;
        return null;
    })();
    const { isAuthenticated, isLoading: authLoading, user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    
    const [showPw, setShowPw] = useState(false);
    const [demoLoading, setDemoLoading] = useState(null);
    const [loginForm, setLoginForm] = useState({ username: "", password: "" });
    
    const loginMutation = useLogin();
    useEffect(() => {
        if (!authLoading && isAuthenticated && user?.role) {
            setLocation(nextPath ?? homeForRole(user.role));
        }
    }, [isAuthenticated, authLoading, user?.role, nextPath, setLocation]);
    if (authLoading) {
        return (<div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary"/>
      </div>);
    }
    if (isAuthenticated)
        return null;
    const doLogin = (username, password, role) => {
        loginMutation.mutate({ data: { username, password } }, {
            onSuccess: async (data) => {
                const userData = data?.user;
                if (userData) {
                    // Optimistically set user cache — skips the /api/auth/me round-trip entirely
                    queryClient.setQueryData(getGetCurrentUserQueryKey(), userData);
                }
                await queryClient.invalidateQueries({ queryKey: getGetCurrentUserQueryKey() });
                const r = userData?.role ?? role ?? "admin";
                setLocation(nextPath ?? homeForRole(r));
            },
            onError: (err) => {
                toast({
                    title: "Sign-in failed",
                    description: err?.data?.error??err?.message ?? "Invalid username or password.",
                    variant: "destructive",
                });
                setDemoLoading(null);
            },
        });
    };
    
    const handleLogin = (e) => {
        e.preventDefault();
        if (!loginForm.username || !loginForm.password)
            return;
        doLogin(loginForm.username, loginForm.password);
    };
   
    return (<div className="min-h-screen flex flex-col md:flex-row bg-background">
      {/* Brand panel */}
      <div className="hidden md:flex flex-col flex-1 p-12 justify-between relative overflow-hidden bg-[#030303] border-r border-white/5">
        <div className="absolute inset-0 opacity-[0.025]" style={{
            backgroundImage: "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
            backgroundSize: "44px 44px",
        }}/>
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[120px] pointer-events-none"/>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-500/8 rounded-full blur-[100px] pointer-events-none"/>
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            
            {logoUrl ? (
              <img src={logoUrl} alt="School Logo" className="w-8 h-8 object-contain shrink-0" />
            ) : (
              <div className="bg-primary/15 border border-primary/20 p-2.5 rounded-xl">
                <School className="h-7 w-7 text-primary"/>
              </div>
            )}
            <span className="font-serif font-bold text-xl text-white tracking-tight">{schoolName}</span>
            
            
              </div>
          <div className="max-w-lg mt-16">
            <h1 className="text-5xl font-serif font-bold leading-tight mb-6 text-white">
              The Command Center for Modern Education
            </h1>
            <p className="text-lg text-white/40 leading-relaxed">
              Manage operations, academics, and communication from one definitive source of truth.
            </p>
          </div>
          {/* Module color dots */}
          <div className="flex flex-wrap gap-2 mt-10">
            {["bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-orange-500", "bg-cyan-500", "bg-rose-500", "bg-green-500", "bg-teal-500", "bg-sky-500", "bg-purple-500", "bg-indigo-500", "bg-pink-500"].map((c, i) => (<div key={i} className={`w-2 h-2 rounded-full ${c} opacity-60`}/>))}
          </div>
        </div>
  
  <p className="relative z-10 text-xs text-white/20">© {new Date().getFullYear()} {schoolName} Systems</p>
  
        </div>

      {/* Auth panel */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-10 min-h-screen overflow-y-auto bg-[#080808]">
        <div className="md:hidden flex items-center gap-3 mb-8 w-full max-w-sm">
          
          {logoUrl ? (
            <img src={logoUrl} alt="School Logo" className="w-6 h-6 object-contain shrink-0" />
          ) : (
            <div className="bg-primary/10 p-2 rounded-lg border border-primary/20">
              <School className="h-5 w-5 text-primary"/>
            </div>
          )}
          <span className="font-serif font-bold text-lg tracking-tight text-white">{schoolName}</span>
          
          
            </div>

        <div className="w-full max-w-[420px]">
          {/* Tabs */}
          

          <>
  <div className="mb-6">
    <h2 className="text-2xl font-bold font-serif mb-1 text-white">
      Welcome back
    </h2>
    <p className="text-white/40 text-sm">
      Sign in to your workspace.
    </p>
  </div>

  <form onSubmit={handleLogin} className="space-y-4">
    <div className="space-y-1.5">
      <Label className="text-white/70 text-xs font-semibold uppercase tracking-wider">
        Username
      </Label>
      <Input
        placeholder="Enter username"
        value={loginForm.username}
        onChange={(e) =>
          setLoginForm((f) => ({
            ...f,
            username: e.target.value,
          }))
        }
        className="h-11 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/50"
        autoComplete="username"
      />
    </div>

    <div className="space-y-1.5">
      <Label className="text-white/70 text-xs font-semibold uppercase tracking-wider">
        Password
      </Label>

      <div className="relative">
        <Input
          type={showPw ? "text" : "password"}
          placeholder="Enter password"
          value={loginForm.password}
          onChange={(e) =>
            setLoginForm((f) => ({
              ...f,
              password: e.target.value,
            }))
          }
          className="h-11 pr-10 bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-primary/50"
          autoComplete="current-password"
        />

        <button
          type="button"
          onClick={() => setShowPw((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
        >
          {showPw ? (
            <EyeOff className="w-4 h-4" />
          ) : (
            <Eye className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>

    <Button
      type="submit"
      className="w-full h-11 font-semibold group"
      disabled={
        loginMutation.isPending ||
        !loginForm.username ||
        !loginForm.password
      }
    >
      {loginMutation.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          Sign In
          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </>
      )}
    </Button>
  </form>
</>
        </div>
      </div>
    </div>);
}
