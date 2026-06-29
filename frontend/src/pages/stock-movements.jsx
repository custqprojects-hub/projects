import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProducts, fetchJson } from "./products";
export default function StockMovements() {
    const qc = useQueryClient();
    const { toast } = useToast();
    const { data: products = [] } = useProducts();
    const { data: movements = [], isLoading } = useQuery({ queryKey: ["inventory", "movements"], queryFn: () => fetchJson("/api/inventory/stock-movements?limit=200"), staleTime: 5000 });
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState({ productId: "", direction: "in", quantity: "", reason: "manual", reference: "", notes: "" });
    const [page, setPage] = useState(1);
    const PAGE_SIZE = 10;
    const createMutation = useMutation({
        mutationFn: (d) => fetchJson("/api/inventory/stock-movements", { method: "POST", body: JSON.stringify(d) }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["inventory"] });
            setOpen(false);
            setForm({ productId: "", direction: "in", quantity: "", reason: "manual", reference: "", notes: "" });
            toast({ title: "Stock movement recorded" });
        },
        onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    });
    const totalIn = movements.filter(m => m.direction === "in").reduce((a, m) => a + m.quantity, 0);
    const totalOut = movements.filter(m => m.direction === "out").reduce((a, m) => a + m.quantity, 0);
    const totalPages = Math.max(1, Math.ceil(movements.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pagedMovements = movements.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    useEffect(() => {
        setPage(1);
    }, [movements.length]);
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-green-400">Stock Movement</h1>
          <p className="text-muted-foreground text-sm mt-1">Log incoming and outgoing stock</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20"><Plus className="w-4 h-4"/>Log Movement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Log Stock Movement</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div>
                <Label>Product *</Label>
                <Select value={form.productId} onValueChange={v => setForm(f => ({ ...f, productId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select product"/></SelectTrigger>
                  <SelectContent className="max-h-64">
                    {products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} <span className="text-xs text-muted-foreground">({p.currentStock} {p.unit})</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Direction *</Label>
                  <Select value={form.direction} onValueChange={v => setForm(f => ({ ...f, direction: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in">Incoming (Stock In)</SelectItem>
                      <SelectItem value="out">Outgoing (Distribute)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Quantity *</Label><Input type="number" min="1" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}/></div>
              </div>
              <div>
                <Label>Reason</Label>
                <Select value={form.reason} onValueChange={v => setForm(f => ({ ...f, reason: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual entry</SelectItem>
                    <SelectItem value="distribution">Distribution to staff/students</SelectItem>
                    <SelectItem value="adjustment">Stock adjustment</SelectItem>
                    <SelectItem value="damage">Damaged / Lost</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Source / Destination</Label><Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="e.g. Class 10-A, Storeroom B"/></div>
              <div><Label>Notes</Label><Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}/></div>
              <Button className="w-full" disabled={!form.productId || !form.quantity || createMutation.isPending} onClick={() => createMutation.mutate({ productId: parseInt(form.productId), direction: form.direction, quantity: parseInt(form.quantity), reason: form.reason, reference: form.reference || undefined, notes: form.notes || undefined })}>
                Save Movement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-green-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10 text-green-400"><ArrowDownToLine className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Stock In (recent)</p><p className="text-2xl font-bold text-green-400">{totalIn}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-red-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-red-500/10 text-red-400"><ArrowUpFromLine className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Stock Out (recent)</p><p className="text-2xl font-bold text-red-400">{totalOut}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-yellow-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400"><ArrowDownToLine className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Movements Logged</p><p className="text-2xl font-bold text-yellow-400">{movements.length}</p></div></CardContent></Card>
      </div>

      <Card className="glass-card border-t-2 border-t-green-500/30">
        <CardContent className="p-4">
          {isLoading ? <Skeleton className="h-32 w-full"/> : movements.length === 0 ? <p className="text-muted-foreground text-center py-8">No movements recorded yet.</p> : (<div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                  <th className="py-2 px-2">Date</th><th className="py-2 px-2">Product</th><th className="py-2 px-2">Direction</th><th className="py-2 px-2 text-right">Qty</th><th className="py-2 px-2">Reason</th><th className="py-2 px-2">Reference</th>
                </tr></thead>
                <tbody>
                  {pagedMovements.map(m => (<tr key={m.id} className="border-b border-border/20 hover:bg-white/5">
                      <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleDateString()} {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-2 px-2 font-medium">{m.productName}</td>
                      <td className="py-2 px-2"><Badge className={`text-xs ${m.direction === "in" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>{m.direction === "in" ? "IN" : "OUT"}</Badge></td>
                      <td className="py-2 px-2 text-right font-bold">{m.direction === "in" ? "+" : "−"}{m.quantity}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground capitalize">{m.reason.replace(/_/g, " ")}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{m.reference ?? "—"}</td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
          {!isLoading && movements.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {((safePage - 1) * PAGE_SIZE) + 1}-{Math.min(safePage * PAGE_SIZE, movements.length)} of {movements.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={safePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {safePage} of {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={safePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>);
}