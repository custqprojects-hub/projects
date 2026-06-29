import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Package, AlertTriangle, Edit2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
export const PRODUCT_CATEGORIES = ["books", "stationery", "uniforms", "lab", "hostel", "sports", "other"];
export async function fetchJson(url, init) {
    const res = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
        throw new Error(body?.error ?? `Request failed (${res.status})`);
    return body;
}
export function useProducts(params) {
    const queryParams = new URLSearchParams();
    if (params?.search) queryParams.set("search", params.search);
    if (params?.category && params.category !== "all") queryParams.set("category", params.category);
    if (params?.page) queryParams.set("page", String(params.page));
    if (params?.limit) queryParams.set("limit", String(params.limit));
    const url = `/api/inventory/products?${queryParams.toString()}`;
    return useQuery({ queryKey: ["inventory", "products", params], queryFn: () => fetchJson(url), staleTime: 10000 });
}
export function useCategories() {
    return useQuery({ queryKey: ["inventory", "categories"], queryFn: () => fetchJson("/api/inventory/categories"), staleTime: 60000 });
}
export default function Products() {
    const qc = useQueryClient();
    const { toast } = useToast();
    const [search, setSearch] = useState("");
    const [category, setCategory] = useState("all");
    const [page, setPage] = useState(1);
    const limit = 10;

    const { data: categoriesData = [] } = useCategories();
    const { data: allProducts = [] } = useProducts({ category: "all" });
    const { data: products = [], isLoading } = useProducts({ search, category, page, limit });

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState({ name: "", category: "stationery", unit: "pcs", currentStock: "0", reorderThreshold: "10", unitPrice: "", description: "" });
    
    const reset = () => { setForm({ name: "", category: "stationery", unit: "pcs", currentStock: "0", reorderThreshold: "10", unitPrice: "", description: "" }); setEditing(null); };
    const createMutation = useMutation({
        mutationFn: (d) => fetchJson("/api/inventory/products", { method: "POST", body: JSON.stringify(d) }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setOpen(false); reset(); toast({ title: "Product added" }); },
        onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    });
    const updateMutation = useMutation({
        mutationFn: (d) => fetchJson(`/api/inventory/products/${d.id}`, { method: "PATCH", body: JSON.stringify(d) }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); setOpen(false); reset(); toast({ title: "Product updated" }); },
        onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    });
    const deleteMutation = useMutation({
        mutationFn: (id) => fetchJson(`/api/inventory/products/${id}`, { method: "DELETE" }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["inventory"] }); toast({ title: "Product removed" }); },
        onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    });
    const openEdit = (p) => {
        setEditing(p);
        setForm({ name: p.name, category: p.category, unit: p.unit, currentStock: String(p.currentStock), reorderThreshold: String(p.reorderThreshold), unitPrice: p.unitPrice == null ? "" : String(p.unitPrice), description: p.description ?? "" });
        setOpen(true);
    };
    const submit = () => {
        if (editing) {
            updateMutation.mutate({ id: editing.id, name: form.name, category: form.category, unit: form.unit, reorderThreshold: parseInt(form.reorderThreshold), unitPrice: form.unitPrice || null, description: form.description || null });
        }
        else {
            createMutation.mutate({ name: form.name, category: form.category, unit: form.unit, currentStock: parseInt(form.currentStock), reorderThreshold: parseInt(form.reorderThreshold), unitPrice: form.unitPrice || null, description: form.description || null });
        }
    };
    
    const totalValue = allProducts.reduce((a, p) => a + (Number(p.unitPrice ?? 0) * p.currentStock), 0);
    const dynamicCategories = Array.from(new Set(["all", "low", ...PRODUCT_CATEGORIES, ...categoriesData]));

    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-serif font-bold text-yellow-400">Products</h1>
          <p className="text-muted-foreground text-sm mt-1">Inventory catalog · {allProducts.length} products</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v)
        reset(); }}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20"><Plus className="w-4 h-4"/>Add Product</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{editing ? "Edit Product" : "Add Product"}</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label>Name *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Category *</Label>
                  <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{dynamicCategories.filter(c => c !== "all" && c !== "low").map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Unit</Label><Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="pcs / kg / box"/></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Reorder At *</Label><Input type="number" value={form.reorderThreshold} onChange={e => setForm(f => ({ ...f, reorderThreshold: e.target.value }))}/></div>
                <div><Label>Unit Price (₹)</Label><Input type="number" step="0.01" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))}/></div>
              </div>
              {!editing && <div><Label>Opening Stock</Label><Input type="number" value={form.currentStock} onChange={e => setForm(f => ({ ...f, currentStock: e.target.value }))}/></div>}
              <div><Label>Description</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}/></div>
              <Button className="w-full" disabled={!form.name || createMutation.isPending || updateMutation.isPending} onClick={submit}>
                {editing ? "Save Changes" : "Add Product"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-yellow-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400"><Package className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Products</p><p className="text-2xl font-bold text-yellow-400">{allProducts.length}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-green-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10 text-green-400"><Package className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Total Stock</p><p className="text-2xl font-bold text-green-400">{allProducts.reduce((a, p) => a + p.currentStock, 0)}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-red-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-red-500/10 text-red-400"><AlertTriangle className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-2xl font-bold text-red-400">{allProducts.filter(p => p.lowStock).length}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><Package className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Inventory Value</p><p className="text-xl font-bold text-emerald-400">₹{totalValue.toLocaleString("en-IN")}</p></div></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {dynamicCategories.map(f => (<Button key={f} size="sm" variant={category === f ? "default" : "outline"} onClick={() => { setCategory(f); setPage(1); }} className="capitalize">{f === "low" ? "Low stock" : f}</Button>))}
        </div>
        <div className="w-full sm:w-64">
          <Input placeholder="Search products..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <Card className="glass-card border-t-2 border-t-yellow-500/30">
        <CardContent className="p-4">
          {isLoading ? <Skeleton className="h-32 w-full"/> : products.length === 0 ? <p className="text-muted-foreground text-center py-8">No products found.</p> : (<div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                    <th className="py-2 px-2">Name</th><th className="py-2 px-2">Category</th><th className="py-2 px-2">Unit</th><th className="py-2 px-2 text-right">Stock</th><th className="py-2 px-2 text-right">Reorder At</th><th className="py-2 px-2 text-right">Price</th><th className="py-2 px-2"></th>
                  </tr></thead>
                  <tbody>
                    {products.map(p => (<tr key={p.id} className="border-b border-border/20 hover:bg-white/5">
                        <td className="py-2 px-2 font-medium">{p.name}{p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}</td>
                        <td className="py-2 px-2"><Badge className="bg-muted/40 text-foreground text-xs capitalize">{p.category}</Badge></td>
                        <td className="py-2 px-2 text-muted-foreground text-xs">{p.unit}</td>
                        <td className="py-2 px-2 text-right font-bold"><span className={p.lowStock ? "text-red-400" : "text-foreground"}>{p.currentStock}</span></td>
                        <td className="py-2 px-2 text-right text-muted-foreground text-xs">{p.reorderThreshold}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground text-xs">{p.unitPrice ? `₹${p.unitPrice}` : "—"}</td>
                        <td className="py-2 px-2 text-right space-x-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="Edit" onClick={() => openEdit(p)}><Edit2 className="w-3.5 h-3.5"/></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:bg-red-500/10" aria-label="Delete" onClick={() => { if (confirm(`Delete ${p.name}?`))
                  deleteMutation.mutate(p.id); }}><Trash2 className="w-3.5 h-3.5"/></Button>
                        </td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-border/20 pt-4">
                <p className="text-xs text-muted-foreground">Showing page {page}</p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Previous</Button>
                  <Button size="sm" variant="outline" disabled={products.length < limit} onClick={() => setPage(p => p + 1)}>Next</Button>
                </div>
              </div>
            </div>)}
        </CardContent>
      </Card>
    </div>);
}
