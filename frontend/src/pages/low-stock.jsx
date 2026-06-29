import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Package } from "lucide-react";
import { fetchJson } from "./products";
export default function LowStock() {
    const { data: products = [], isLoading } = useQuery({
        queryKey: ["inventory", "low-stock"],
        queryFn: () => fetchJson("/api/inventory/low-stock"),
        staleTime: 5000,
    });
    const totalShortage = products.reduce((a, p) => a + p.shortage, 0);
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-red-500/10 text-red-400"><AlertTriangle className="w-5 h-5"/></div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-red-400">Low-Stock Alerts</h1>
          <p className="text-muted-foreground text-sm mt-1">Products at or below their reorder threshold</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-red-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-red-500/10 text-red-400"><AlertTriangle className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Products Low</p><p className="text-2xl font-bold text-red-400">{products.length}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><Package className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Total Shortage</p><p className="text-2xl font-bold text-amber-400">{totalShortage}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-green-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10 text-green-400"><Package className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Action</p><p className="text-sm font-medium text-green-400 leading-tight">Create POs to refill</p></div></CardContent></Card>
      </div>

      <Card className="glass-card border-t-2 border-t-red-500/30">
        <CardContent className="p-4">
          {isLoading ? <Skeleton className="h-32 w-full"/> : products.length === 0 ? (<div className="text-center py-12">
              <Package className="w-10 h-10 mx-auto text-green-400 mb-2"/>
              <p className="font-semibold text-green-400">All products are above reorder threshold</p>
              <p className="text-xs text-muted-foreground mt-1">No replenishment needed right now.</p>
            </div>) : (<div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                  <th className="py-2 px-2">Product</th><th className="py-2 px-2">Category</th><th className="py-2 px-2 text-right">Current</th><th className="py-2 px-2 text-right">Reorder At</th><th className="py-2 px-2 text-right">Shortage</th>
                </tr></thead>
                <tbody>
                  {products.map(p => (<tr key={p.id} className="border-b border-border/20 hover:bg-white/5">
                      <td className="py-2 px-2 font-medium">{p.name}</td>
                      <td className="py-2 px-2"><Badge className="bg-muted/40 text-foreground text-xs capitalize">{p.category}</Badge></td>
                      <td className="py-2 px-2 text-right font-bold text-red-400">{p.currentStock} {p.unit}</td>
                      <td className="py-2 px-2 text-right text-muted-foreground text-xs">{p.reorderThreshold}</td>
                      <td className="py-2 px-2 text-right"><Badge className="bg-amber-500/10 text-amber-400 text-xs">+{p.shortage} needed</Badge></td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </CardContent>
      </Card>
    </div>);
}
