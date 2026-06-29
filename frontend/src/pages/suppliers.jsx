import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building, Phone, Mail, ShoppingCart } from "lucide-react";
import { fetchJson } from "./products";
export default function Suppliers() {
    const { data: suppliers = [], isLoading } = useQuery({
        queryKey: ["inventory", "suppliers"],
        queryFn: () => fetchJson("/api/inventory/suppliers"),
        staleTime: 10000,
    });
    const totalSpend = suppliers.reduce((a, s) => a + s.totalSpend, 0);
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400"><Building className="w-5 h-5"/></div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-yellow-400">Suppliers</h1>
          <p className="text-muted-foreground text-sm mt-1">Vendors the store has purchase orders with</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-yellow-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400"><Building className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Active Suppliers</p><p className="text-2xl font-bold text-yellow-400">{suppliers.length}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-green-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10 text-green-400"><ShoppingCart className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Total Orders</p><p className="text-2xl font-bold text-green-400">{suppliers.reduce((a, s) => a + s.poCount, 0)}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><ShoppingCart className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Total Spend</p><p className="text-xl font-bold text-emerald-400">₹{totalSpend.toLocaleString("en-IN")}</p></div></CardContent></Card>
      </div>

      <Card className="glass-card border-t-2 border-t-yellow-500/30">
        <CardContent className="p-4">
          {isLoading ? <Skeleton className="h-32 w-full"/> : suppliers.length === 0 ? (<p className="text-muted-foreground text-center py-8">No suppliers yet. Create a purchase order to a vendor to add them here.</p>) : (<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {suppliers.map(s => (<Card key={s.id} className="glass-card glass-hover border-l-2 border-l-yellow-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.contactPerson}</p>
                      </div>
                      <Badge className={`text-xs ${s.status === "active" ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"}`}>{s.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2"><Phone className="w-3 h-3"/>{s.phone}</div>
                      <div className="flex items-center gap-2"><Mail className="w-3 h-3"/>{s.email}</div>
                      {s.category && <Badge className="bg-muted/40 text-foreground text-xs">{s.category}</Badge>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground">Orders: <span className="font-medium text-foreground">{s.poCount}</span></span>
                      <span className="text-emerald-400 font-semibold">₹{s.totalSpend.toLocaleString("en-IN")}</span>
                    </div>
                  </CardContent>
                </Card>))}
            </div>)}
        </CardContent>
      </Card>
    </div>);
}
