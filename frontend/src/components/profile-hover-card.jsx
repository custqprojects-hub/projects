import { useState } from "react";
import { Link } from "wouter";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, IdCard, ExternalLink, Briefcase, GraduationCap, Building2, Store } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
const endpoints = {
    student: {
        url: (id) => `/api/students/${id}`,
        href: (id) => `/students/${id}`,
        color: "sky",
        icon: <GraduationCap className="w-3.5 h-3.5"/>,
    },
    staff: {
        url: (id) => `/api/staff/${id}`,
        href: (id) => `/staff/${id}`,
        color: "purple",
        icon: <Briefcase className="w-3.5 h-3.5"/>,
    },
    teacher: {
        url: (id) => `/api/staff/${id}`,
        href: (id) => `/staff/${id}`,
        color: "purple",
        icon: <Briefcase className="w-3.5 h-3.5"/>,
    },
    vendor: {
        url: (id) => `/api/vendors/${id}`,
        href: (id) => `/vendors`,
        color: "yellow",
        icon: <Store className="w-3.5 h-3.5"/>,
    },
};
const colorClasses = {
    sky: { bg: "bg-sky-500/10", text: "text-sky-400", ring: "ring-sky-400/30", link: "text-sky-400 hover:text-sky-300" },
    purple: { bg: "bg-purple-500/10", text: "text-purple-400", ring: "ring-purple-400/30", link: "text-purple-400 hover:text-purple-300" },
    yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", ring: "ring-yellow-400/30", link: "text-yellow-400 hover:text-yellow-300" },
};
export function ProfileHoverCard({ kind, id, name, avatarUrl, children, fallbackLabel }) {
    const [open, setOpen] = useState(false);
    const endpoint = endpoints[kind];
    const colors = colorClasses[endpoint.color] ?? colorClasses.sky;
    const displayName = name ?? fallbackLabel ?? "—";
    // Only fetch on first hover
    const { data, isLoading } = useQuery({
        queryKey: [kind, "profile", id],
        queryFn: async () => {
            const res = await fetch(endpoint.url(id), { credentials: "include" });
            if (!res.ok)
                throw new Error("Failed to load");
            return res.json();
        },
        enabled: open && id != null,
        staleTime: 60_000,
    });
    if (id == null) {
        return <span>{children ?? displayName}</span>;
    }
    const initials = (displayName || "?").charAt(0).toUpperCase();
    return (<HoverCard openDelay={250} closeDelay={100} onOpenChange={setOpen}>
      <HoverCardTrigger asChild>
        <span className={`${colors.link} cursor-pointer underline-offset-4 hover:underline transition-colors`}>
          {children ?? displayName}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 glass-strong border border-border/60 p-0 overflow-hidden" align="start" side="top">
        <div className={`px-4 pt-4 pb-3 ${colors.bg} border-b border-border/40`}>
          <div className="flex items-center gap-3">
            <Avatar className={`h-12 w-12 ring-2 ${colors.ring}`}>
              <AvatarImage src={data?.avatarUrl ?? avatarUrl ?? undefined}/>
              <AvatarFallback className={`${colors.bg} ${colors.text} font-semibold`}>{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{data?.name ?? displayName}</p>
              <div className={`flex items-center gap-1.5 text-xs ${colors.text} mt-0.5`}>
                {endpoint.icon}
                <span className="capitalize truncate">
                  {kind === "vendor"
            ? data?.category ?? "Vendor"
            : kind === "student"
                ? data?.className ?? "Student"
                : data?.role ?? "Staff"}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-3 space-y-1.5 text-xs">
          {isLoading ? (<>
              <Skeleton className="h-3 w-3/4"/>
              <Skeleton className="h-3 w-1/2"/>
              <Skeleton className="h-3 w-2/3"/>
            </>) : (<>
              {kind === "student" && data?.studentId && <Row icon={<IdCard className="w-3 h-3"/>} label="ID" value={data.studentId} mono/>}
              {kind === "student" && data?.rollNumber && <Row icon={<IdCard className="w-3 h-3"/>} label="Roll" value={data.rollNumber} mono/>}
              {kind === "student" && data?.parentName && <Row icon={<Building2 className="w-3 h-3"/>} label="Parent" value={data.parentName}/>}
              {(kind === "staff" || kind === "teacher") && data?.staffId && <Row icon={<IdCard className="w-3 h-3"/>} label="ID" value={data.staffId} mono/>}
              {(kind === "staff" || kind === "teacher") && data?.department && <Row icon={<Building2 className="w-3 h-3"/>} label="Dept" value={data.department}/>}
              {(kind === "staff" || kind === "teacher") && data?.qualification && <Row icon={<GraduationCap className="w-3 h-3"/>} label="Qual" value={data.qualification}/>}
              {kind === "vendor" && data?.contactPerson && <Row icon={<Building2 className="w-3 h-3"/>} label="Contact" value={data.contactPerson}/>}
              {data?.email && <Row icon={<Mail className="w-3 h-3"/>} label="Email" value={data.email}/>}
              {data?.phone && <Row icon={<Phone className="w-3 h-3"/>} label="Phone" value={data.phone}/>}
              {data?.status && (<div className="pt-1.5">
                  <Badge variant="outline" className="capitalize text-[10px]">
                    {data.status}
                  </Badge>
                </div>)}
              {!isLoading && !data && (<p className="text-muted-foreground italic">Could not load profile.</p>)}
            </>)}
        </div>
        <div className="border-t border-border/40 px-3 py-2">
          <Link href={endpoint.href(id)}>
            <span className={`${colors.link} text-xs font-medium flex items-center gap-1 hover:gap-1.5 transition-all`}>
              View full profile <ExternalLink className="w-3 h-3"/>
            </span>
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>);
}
function Row({ icon, label, value, mono }) {
    return (<div className="flex items-center gap-2 text-muted-foreground">
      <span className="opacity-60">{icon}</span>
      <span className="text-[10px] uppercase tracking-wider w-12 shrink-0">{label}</span>
      <span className={`text-foreground truncate ${mono ? "font-mono" : ""}`} title={value}>
        {value}
      </span>
    </div>);
}
