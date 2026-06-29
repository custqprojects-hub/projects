//store-purchase-order.jsx
import { useEffect, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListVendors, useCreatePurchaseOrder, getListVendorsQueryKey } from "@/api-client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, ShoppingCart, CheckCircle, Truck, Eye, AlertCircle, FileText, Download, Wallet } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { fetchJson, useProducts } from "./products";

const statusColor = {
  draft: "bg-muted/40 text-muted-foreground",
  pending: "bg-amber-500/10 text-amber-400",
  sent: "bg-blue-500/10 text-blue-400",
  acknowledged: "bg-violet-500/10 text-violet-400",
  invoiced: "bg-amber-500/10 text-amber-400",
  delivered: "bg-emerald-500/10 text-emerald-400",
  received: "bg-green-500/10 text-green-400",
  paid: "bg-emerald-500/10 text-emerald-400",
  cancelled: "bg-red-500/10 text-red-400",
};

export default function StorePurchaseOrders() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: vendors = [] } = useListVendors({ query: { queryKey: getListVendorsQueryKey(), staleTime: 30000 } });
  const { data: products = [] } = useProducts();
  const { data: orders = [], isLoading } = useQuery({ queryKey: ["inventory", "store-pos"], queryFn: () => fetchJson("/api/purchase-orders"), staleTime: 5000 });
    
  const search = useSearch();
  const deepLinkPoId = (() => {
    const raw = new URLSearchParams(search).get("po");
    const n = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(n) ? n : null;
  })();

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [autoOpenedFor, setAutoOpenedFor] = useState(null);
  const [openCreate, setOpenCreate] = useState(false);
  const [poForm, setPoForm] = useState({ 
    vendorId: "", 
    deliveryDate: "", 
    notes: "", 
    items: [{ id: Date.now(), productId: "", name: "", quantity: "1", unitPrice: "" }] 
  });
  const [viewPo, setViewPo] = useState(null);
  const [receivePo, setReceivePo] = useState(null);
  const [matchItems, setMatchItems] = useState([]);
  const [payPo, setPayPo] = useState(null);
  const [payForm, setPayForm] = useState({ amountPaid: "", paymentReference: "", paidAt: "" });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const createMutation = useCreatePurchaseOrder({
    mutation: {
      onSuccess: async (newPo) => {
        await qc.invalidateQueries({ queryKey: ["inventory", "store-pos"] });
        try {
          await fetchJson(`/api/purchase-orders/${newPo.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: "pending" })
          });
        } catch (e) {
          console.warn("Could not auto-set pending status", e);
        }

        await qc.invalidateQueries({ queryKey: ["inventory", "store-pos"] });

        setOpenCreate(false);
        setPoForm({ 
          vendorId: "", 
          deliveryDate: "", 
          notes: "", 
          items: [{ id: Date.now(), productId: "", name: "", quantity: "1", unitPrice: "" }] 
        });
        toast({ title: "Purchase Order created", description: "Status set to Pending" });
      },
      onError: (e) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
    },
  });

  const { user } = useAuth();
  const canMarkPaid = !!user && ["admin", "accountant"].includes(user.role);

  const markPaidMutation = useMutation({
    mutationFn: (d) => fetchJson(`/api/purchase-orders/${d.id}/pay`, { method: "POST", body: JSON.stringify({ amountPaid: d.amountPaid, paymentReference: d.paymentReference, paidAt: d.paidAt || undefined }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "store-pos"] });
      setPayPo(null);
      setViewPo(null);
      toast({ title: "Payment recorded", description: "Vendor invoice marked paid." });
    },
    onError: (e) => toast({ title: "Could not record payment", description: e.message, variant: "destructive" }),
  });

  const openPay = (po) => {
    setPayPo(po);
    setPayForm({ amountPaid: String(po.totalAmount), paymentReference: "", paidAt: new Date().toISOString().slice(0, 10) });
  };

  const submitPay = () => {
    if (!payPo) return;
    const amt = parseFloat(payForm.amountPaid);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (!payForm.paymentReference.trim()) {
      toast({ title: "Payment reference is required", description: "Cheque #, UTR, transaction id, etc.", variant: "destructive" });
      return;
    }
    markPaidMutation.mutate({ id: payPo.id, amountPaid: amt, paymentReference: payForm.paymentReference.trim(), paidAt: payForm.paidAt });
  };

  const receiveMutation = useMutation({
    mutationFn: (d) => fetchJson(`/api/purchase-orders/${d.id}/receive`, { method: "POST", body: JSON.stringify({ items: d.items }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory"] });
      setReceivePo(null);
      toast({ title: "Stock received", description: "Inventory updated and movements logged." });
    },
    onError: (e) => toast({ title: "Could not receive", description: e.message, variant: "destructive" }),
  });

  // Cancel (mark as cancelled)
  const canCancel = !!user && ["admin", "store_manager", "accountant"].includes(user.role);
  const cancelMutation = useMutation({
    mutationFn: (id) => fetchJson(`/api/purchase-orders/${id}`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inventory", "store-pos"] });
      toast({ title: "Purchase order cancelled" });
    },
    onError: (e) => toast({ title: "Could not cancel", description: e.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (deepLinkPoId == null || autoOpenedFor === deepLinkPoId) return;
    const target = orders.find((p) => p.id === deepLinkPoId);
    if (target) {
      setViewPo(target);
      setAutoOpenedFor(deepLinkPoId);
    }
  }, [deepLinkPoId, orders, autoOpenedFor]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
    if (page > totalPages) setPage(1);
  }, [orders.length]);

  const openReceive = (po) => {
    setReceivePo(po);
    setMatchItems(po.items.map(it => ({ name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, productId: "" })));
  };

  const submitReceive = () => {
    if (!receivePo) return;
    if (matchItems.some(m => !m.productId)) {
      toast({ title: "Select a product for every line", variant: "destructive" });
      return;
    }
    receiveMutation.mutate({ id: receivePo.id, items: matchItems.map(m => ({ name: m.name, quantity: m.quantity, unitPrice: Number(m.unitPrice), productId: parseInt(m.productId) })) });
  };

  const handleDownloadPOReceipt = (po) => {
    const amountFormatted = Number(po.amountPaid || po.totalAmount).toLocaleString("en-IN", { style: "currency", currency: "INR" });
    const dateString = po.paidAt ? new Date(po.paidAt).toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' }) : new Date().toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
    const txnId = po.paymentReference || `TXN-${po.id}-${Math.floor(1000 + Math.random() * 9000)}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Payment Receipt - ${po.poNumber}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            padding: 40px;
            background: #f4f6f9;
            color: #333;
          }
          .receipt-card {
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.08);
            max-width: 600px;
            margin: 0 auto;
            padding: 30px;
            border-top: 6px solid #10b981;
          }
          .header {
            text-align: center;
            margin-bottom: 25px;
          }
          .school-name {
            font-size: 24px;
            font-weight: 800;
            color: #111827;
            letter-spacing: -0.5px;
          }
          .receipt-title {
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
            color: #6b7280;
            letter-spacing: 1px;
            margin-top: 5px;
          }
          .divider {
            border-top: 1px solid #e5e7eb;
            margin: 20px 0;
          }
          .info-row {
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            font-size: 14px;
          }
          .info-label {
            color: #6b7280;
          }
          .info-value {
            font-weight: 600;
            color: #1f2937;
          }
          .amount-box {
            background: #ecfdf5;
            border-radius: 8px;
            padding: 15px;
            text-align: center;
            margin: 20px 0;
          }
          .amount-label {
            font-size: 12px;
            color: #047857;
            text-transform: uppercase;
            font-weight: 700;
          }
          .amount-value {
            font-size: 28px;
            font-weight: 800;
            color: #065f46;
          }
          .status-badge {
            background: #10b981;
            color: #fff;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 12px;
            border-radius: 9999px;
            text-transform: uppercase;
          }
          .footer {
            text-align: center;
            font-size: 11px;
            color: #9ca3af;
            margin-top: 30px;
          }
          .btn-print {
            display: block;
            width: 100%;
            text-align: center;
            background: #10b981;
            color: white;
            text-decoration: none;
            padding: 12px;
            border-radius: 6px;
            font-weight: 600;
            margin-top: 20px;
            font-size: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
            font-size: 13px;
          }
          th {
            border-bottom: 2px solid #e5e7eb;
            padding: 8px;
            text-align: left;
            color: #6b7280;
          }
          td {
            border-bottom: 1px solid #f3f4f6;
            padding: 8px;
          }
          @media print {
            body { background: #fff; padding: 0; }
            .receipt-card { box-shadow: none; border: none; max-width: 100%; padding: 0; }
            .btn-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="receipt-card">
          <div class="header">
            <div class="school-name">NEXUS ACADEMY</div>
            <div class="receipt-title">Payment Receipt / Disbursement Voucher</div>
          </div>
          <div class="info-row">
            <span class="info-label">PO Number</span>
            <span class="info-value">${po.poNumber}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Reference</span>
            <span class="info-value">${txnId}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Payment Date</span>
            <span class="info-value">${dateString}</span>
          </div>
          <div class="divider"></div>
          <div class="info-row">
            <span class="info-label">Vendor Name</span>
            <span class="info-value">${po.vendorName}</span>
          </div>
          <div class="divider"></div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align: right;">Qty</th>
                <th style="text-align: right;">Price</th>
                <th style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${po.items.map(it => `
                <tr>
                  <td>${it.name}</td>
                  <td style="text-align: right;">${it.quantity}</td>
                  <td style="text-align: right;">₹${Number(it.unitPrice).toLocaleString("en-IN")}</td>
                  <td style="text-align: right;">₹${Number(it.total || (it.quantity * it.unitPrice)).toLocaleString("en-IN")}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="divider"></div>
          <div class="amount-box">
            <div class="amount-label">Total Amount Paid</div>
            <div class="amount-value">${amountFormatted}</div>
          </div>
          <div class="info-row" style="align-items: center;">
            <span class="info-label">Payment Status</span>
            <span class="status-badge">PAID</span>
          </div>
          <div class="divider"></div>
          <a href="#" class="btn-print" onclick="window.print(); return false;">Print Receipt</a>
          <div class="footer">
            Thank you for your business.<br/>
            This is an official transaction record generated by Nexus Academy.
          </div>
        </div>
      </body>
      </html>
    `;

    const element = document.createElement("a");
    const file = new Blob([htmlContent], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `receipt-${po.poNumber}-${po.id}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const totalSpend = orders.reduce((a, p) => a + p.totalAmount, 0);
  const pending = orders.filter(p => !["received", "paid", "cancelled"].includes(p.status)).length;

  const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
  const paginatedOrders = orders.slice((page - 1) * pageSize, page * pageSize);

  // Function to add a new item with unique ID
  const addNewItem = () => {
    setPoForm((f) => ({
      ...f,
      items: [
        ...f.items,
        { id: Date.now() + Math.random(), productId: "", name: "", quantity: "1", unitPrice: "" },
      ],
    }));
  };

  // Function to remove an item by its unique ID
  const removeItem = (idToRemove) => {
    setPoForm((f) => ({
      ...f,
      items: f.items.filter((item) => item.id !== idToRemove),
    }));
  };

  // Function to update a specific item
  const updateItem = (id, field, value) => {
    setPoForm((f) => ({
      ...f,
      items: f.items.map((item) => {
        if (item.id === id) {
          // If selecting a product, auto-fill name and unit price
          if (field === 'productId') {
            const selectedProduct = products.find(p => String(p.id) === value);
            return {
              ...item,
              productId: value,
              name: selectedProduct?.name || "",
              unitPrice: selectedProduct?.unitPrice ? String(selectedProduct.unitPrice) : item.unitPrice
            };
          }
          return { ...item, [field]: value };
        }
        return item;
      }),
    }));
  };

  // Get selected product IDs (excluding the current item)
  const getSelectedProductIds = (currentItemId) => {
    return poForm.items
      .filter(item => item.id !== currentItemId && item.productId)
      .map(item => item.productId);
  };

  return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <h1 className="text-2xl font-serif font-bold text-yellow-400">Purchase Orders</h1>
      <p className="text-muted-foreground text-sm mt-1">Create orders to vendors and verify receipts</p>
    </div>
    <Dialog open={openCreate} onOpenChange={setOpenCreate}>
      <DialogTrigger asChild>
      <Button className="gap-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20"><Plus className="w-4 h-4"/>New PO</Button>
      </DialogTrigger>
   <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
  <DialogHeader>
  <DialogTitle>Create Purchase Order</DialogTitle>
  </DialogHeader>

  <div className="space-y-3 py-2">
  <div className="grid grid-cols-2 gap-3">
    <div>
    <Label>Vendor *</Label>
    <Select value={poForm.vendorId} onValueChange={v => setPoForm(f => ({ ...f, vendorId: v }))}>
      <SelectTrigger>
      <SelectValue placeholder="Select vendor" />
      </SelectTrigger>
      <SelectContent>
      {vendors.filter(v => ["active", "approved"].includes(v.status)).map(v => (
        <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
      ))}
      </SelectContent>
    </Select>
    </div>

  <div>
  <Label>Expected Delivery *</Label>

 <Popover
  open={calendarOpen}
  onOpenChange={setCalendarOpen}
>
    <PopoverTrigger asChild>
      <Button
        variant="outline"
        className="w-full justify-between text-left font-normal h-11 rounded-lg border border-input bg-background px-3 shadow-sm hover:bg-accent hover:text-accent-foreground hover:border-primary transition-all"
      >
        <div className="flex items-center">
          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
          {poForm.deliveryDate ? (
            format(new Date(poForm.deliveryDate), "dd MMM yyyy")
          ) : (
            <span className="text-muted-foreground">
              Select expected delivery date
            </span>
          )}
        </div>

        <CalendarIcon className="h-4 w-4 opacity-50" />
      </Button>
    </PopoverTrigger>

    <PopoverContent
      className="w-[320px] p-0 overflow-hidden rounded-xl shadow-xl border border-border z-50"
      align="start"
      side="bottom"
      sideOffset={6}
      avoidCollisions={true}
    >
      <div className="bg-primary/5 border-b px-4 py-3">
        <p className="text-sm font-medium">
          Expected Delivery Date
        </p>
        <p className="text-xs text-muted-foreground">
          Select today or a future date
        </p>
      </div>

      <div className="p-4 flex justify-center">
        <Calendar
          mode="single"
          selected={
            poForm.deliveryDate
              ? new Date(poForm.deliveryDate)
              : undefined
          }
          onSelect={(date) => {
            if (date) {
              const formattedDate = format(
                date,
                "yyyy-MM-dd"
              );

              setPoForm((f) => ({
                ...f,
                deliveryDate: formattedDate,
              }));
            }
          }}
          disabled={(date) =>
            date < new Date(new Date().setHours(0, 0, 0, 0))
          }
          initialFocus
          className="rounded-md"
          classNames={{
            months: "flex flex-col",
            month: "space-y-4",

            caption:
              "flex justify-between items-center px-2 pt-2",

            caption_label:
              "text-sm font-semibold",

            nav: "flex items-center gap-1",

            nav_button:
              "h-8 w-8 rounded-md hover:bg-accent",

            table:
              "w-full border-collapse",

            head_row:
              "grid grid-cols-7",

            head_cell:
              "h-8 w-10 flex items-center justify-center text-xs font-medium text-muted-foreground",

            row:
              "grid grid-cols-7 mt-1",

            cell:
              "h-10 w-10 flex items-center justify-center",

            day:
              "h-9 w-9 flex items-center justify-center rounded-md text-sm font-normal hover:bg-accent",

            day_selected:
              "!bg-primary !text-primary-foreground rounded-md",

            day_today:
              "border border-primary font-semibold",

            day_outside:
              "text-muted-foreground opacity-30",

            day_disabled:
              "opacity-30 cursor-not-allowed",

            day_range_start: "",
            day_range_end: "",
            day_range_middle: "",

            day_hidden:
              "invisible",
          }}
        />
      </div>

      <div className="border-t bg-muted/30 px-4 py-3 flex items-center justify-between">
  

  <Button
    size="sm"
    onClick={() => setCalendarOpen(false)}
    disabled={!poForm.deliveryDate}
  >
    Done
  </Button>
</div>
    </PopoverContent>
  </Popover>
</div>
    </div>

 {/* List Items Section */}
<div>
  <div className="flex items-center justify-between mb-2">
    <Label>List Items *</Label>
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={addNewItem}
    >
      + Add Item
    </Button>
  </div>

  <div className="space-y-3 border rounded-md p-4 bg-muted/30">
    {poForm.items.map((it) => {
      // Get selected product IDs from other items
      const selectedProductIds = getSelectedProductIds(it.id);
      
      return (
        <div
          key={it.id}
          className="grid grid-cols-[1fr,auto] gap-3 items-start"
        >
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Item Name
            </Label>

            <div className="flex gap-2">
              {/* Each item has its own Select with unique key and filtered options */}
              <Select
                key={`select-${it.id}`}
                value={it.productId}
                onValueChange={(value) => updateItem(it.id, 'productId', value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a product" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {products
                    .filter(p => {
                      // If the product is already selected in another item, don't show it
                      // But if it's the current item's selected product, show it
                      if (selectedProductIds.includes(String(p.id)) && String(p.id) !== it.productId) {
                        return false;
                      }
                      return true;
                    })
                    .map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name} 
                        <span className="text-muted-foreground text-xs ml-2">
                          (₹{p.unitPrice || 'N/A'})
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              {poForm.items.length > 1 && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-red-500 hover:text-red-600 hover:bg-red-100 h-9 w-9 p-0 mt-0.5"
                  onClick={() => removeItem(it.id)}
                  title="Remove item"
                >
                  🚮
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                Qty
              </Label>
              <Input
                type="number"
                min="1"
                placeholder="1"
                value={it.quantity}
                onChange={(e) =>
                  updateItem(it.id, 'quantity', e.target.value)
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                ₹ / Unit
              </Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={it.unitPrice}
                onChange={(e) =>
                  updateItem(it.id, 'unitPrice', e.target.value)
                }
              />
            </div>
          </div>
        </div>
      );
    })}
  </div>

  <p className="text-sm text-muted-foreground mt-2 text-right font-medium">
    Total: ₹
    {poForm.items
      .reduce(
        (a, i) =>
          a +
          parseFloat(i.quantity || "0") *
            parseFloat(i.unitPrice || "0"),
        0
      )
      .toFixed(2)}
  </p>
</div>

    <div>
      <Label>Notes</Label>
      <Input
        value={poForm.notes}
        onChange={e => setPoForm(f => ({ ...f, notes: e.target.value }))}
        placeholder="Additional notes (optional)"
      />
    </div>

    <Button
      className="w-full"
      disabled={
        !poForm.vendorId ||
        !poForm.deliveryDate ||
        poForm.items.some(i => !i.name?.trim() || !i.quantity || !i.unitPrice) ||
        createMutation.isPending
      }
      onClick={() => createMutation.mutate({
        data: {
          vendorId: parseInt(poForm.vendorId),
          items: poForm.items.map(i => ({
            name: i.name,
            quantity: parseInt(i.quantity),
            unitPrice: parseFloat(i.unitPrice)
          })),
          deliveryDate: poForm.deliveryDate,
          notes: poForm.notes?.trim() || undefined,
          status: "pending"
        }
      })}
    >
      {createMutation.isPending ? "Creating..." : "Create Order"}
    </Button>
  </div>
</DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-yellow-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400"><ShoppingCart className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Total POs</p><p className="text-2xl font-bold text-yellow-400">{orders.length}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><AlertCircle className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Pending Receipt</p><p className="text-2xl font-bold text-amber-400">{pending}</p></div></CardContent></Card>
        <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><Truck className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Total Spend</p><p className="text-xl font-bold text-emerald-400">₹{totalSpend.toLocaleString("en-IN")}</p></div></CardContent></Card>
      </div>

      <Card className="glass-card border-t-2 border-t-yellow-500/30">
        <CardContent className="p-4">
          {isLoading ? <Skeleton className="h-32 w-full"/> : orders.length === 0 ? <p className="text-muted-foreground text-center py-8">No purchase orders yet.</p> : (<div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                  <th className="py-2 px-2">PO #</th><th className="py-2 px-2">Vendor</th><th className="py-2 px-2">Items</th><th className="py-2 px-2 text-right">Amount</th><th className="py-2 px-2">Status</th><th className="py-2 px-2">Created</th><th className="py-2 px-2"></th>
                </tr></thead>
                <tbody>
                  {paginatedOrders.map(po => (
                    <tr key={po.id} className="border-b border-border/20 hover:bg-white/5">
                      <td className="py-2 px-2 font-mono text-xs">{po.poNumber}</td>
                      <td className="py-2 px-2 font-medium">{po.vendorName}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{po.items.length} line(s)</td>
                      <td className="py-2 px-2 text-right font-semibold">₹{po.totalAmount.toLocaleString("en-IN")}</td>
                      <td className="py-2 px-2"><Badge className={`text-xs ${statusColor[po.status] ?? "bg-muted/40"}`}>{po.status}</Badge></td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{new Date(po.createdAt).toLocaleDateString()}</td>
                      <td className="py-2 px-2 text-right space-x-1">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" aria-label="View" onClick={() => setViewPo(po)}><Eye className="w-3.5 h-3.5"/></Button>
                        {(["pending", "sent", "acknowledged", "invoiced"].includes(po.status)) && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-green-400 hover:bg-green-500/10" onClick={() => openReceive(po)}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1"/>Receive
                          </Button>
                        )}
                        {canMarkPaid && po.invoiceUrl && !["paid", "cancelled", "draft", "sent", "acknowledged"].includes(po.status) && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-emerald-400 hover:bg-emerald-500/10" onClick={() => openPay(po)}>
                            <Wallet className="w-3.5 h-3.5 mr-1"/>Mark Paid
                          </Button>
                        )}
                        {canCancel && !["paid", "received", "cancelled"].includes(po.status) && (
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:bg-red-500/10" onClick={() => {
                            if (!window.confirm(`Cancel PO ${po.poNumber}? This will mark it as cancelled.`)) return;
                            cancelMutation.mutate(po.id);
                          }} disabled={cancelMutation.isPending || cancelMutation.isLoading}>
                            🗑️
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Pagination controls */}
              {orders.length > pageSize && (
                <div className="flex items-center justify-between mt-3">
                  <div className="text-sm text-muted-foreground">Showing {Math.min((page - 1) * pageSize + 1, orders.length)}–{Math.min(page * pageSize, orders.length)} of {orders.length}</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</Button>
                    <div className="text-sm">Page {page} / {totalPages}</div>
                    <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>Next</Button>
                  </div>
                </div>
              )}
            </div>) }
        </CardContent>
      </Card>

      {/* View PO */}
      <Dialog open={!!viewPo} onOpenChange={(v) => !v && setViewPo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewPo?.poNumber}</DialogTitle></DialogHeader>
          {viewPo && (<div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><p className="text-xs text-muted-foreground">Vendor</p><p className="font-medium">{viewPo.vendorName}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><Badge className={`text-xs ${statusColor[viewPo.status]}`}>{viewPo.status}</Badge></div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Items</p>
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-border/40"><th className="text-left py-1">Item</th><th className="text-right py-1">Qty</th><th className="text-right py-1">Price</th><th className="text-right py-1">Total</th></tr></thead>
                  <tbody>
                    {viewPo.items.map((it, i) => (<tr key={i} className="border-b border-border/20">
                        <td className="py-1">{it.name}</td><td className="text-right">{it.quantity}</td><td className="text-right">₹{it.unitPrice}</td><td className="text-right">₹{it.total}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>
              <p className="text-right font-semibold">Total: ₹{viewPo.totalAmount.toLocaleString("en-IN")}</p>
              {viewPo.notes && <p className="text-xs text-muted-foreground border-t border-border/40 pt-2">Notes: {viewPo.notes}</p>}
              {viewPo.invoiceUrl && (<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-500/10 p-1.5 rounded text-amber-400"><FileText className="w-3.5 h-3.5"/></div>
                    <div>
                      <p className="text-xs font-semibold">Vendor invoice</p>
                      {viewPo.invoiceNumber && <p className="text-[11px] text-muted-foreground">Invoice # {viewPo.invoiceNumber}</p>}
                    </div>
                  </div>
                  <a href={`/api/purchase-orders/${viewPo.id}/invoice`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">
                    <Download className="w-3.5 h-3.5"/> Download PDF
                  </a>
                </div>)}
              {viewPo.status === "paid" && viewPo.paidAt && (<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2.5 space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
                    <span className="flex items-center gap-2"><Wallet className="w-3.5 h-3.5"/> Payment recorded</span>
                    <Button size="xs" variant="outline" className="h-6 text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 gap-1 px-2" onClick={() => handleDownloadPOReceipt(viewPo)}>
                      <Download className="w-3 h-3"/> Download Receipt
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div><p className="text-muted-foreground">Paid on</p><p className="font-medium">{new Date(viewPo.paidAt).toLocaleDateString()}</p></div>
                    <div><p className="text-muted-foreground">Amount</p><p className="font-medium">₹{(viewPo.amountPaid ?? 0).toLocaleString("en-IN")}</p></div>
                    <div><p className="text-muted-foreground">Reference</p><p className="font-mono">{viewPo.paymentReference ?? "—"}</p></div>
                  </div>
                </div>)}
              {canMarkPaid && viewPo.invoiceUrl && !["paid", "cancelled", "draft", "sent", "acknowledged"].includes(viewPo.status) && (<Button size="sm" className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20" onClick={() => openPay(viewPo)}>
                  <Wallet className="w-3.5 h-3.5 mr-1.5"/> Mark as paid
                </Button>)}
            </div>)}
        </DialogContent>
      </Dialog>

      {/* Mark as paid */}
      <Dialog open={!!payPo} onOpenChange={(v) => !v && setPayPo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Mark {payPo?.poNumber} as paid</DialogTitle></DialogHeader>
          {payPo && (<div className="space-y-3 py-2 text-sm">
              <div className="rounded-md bg-muted/20 px-3 py-2 text-xs flex justify-between">
                <span className="text-muted-foreground">Vendor</span><span className="font-medium">{payPo.vendorName}</span>
              </div>
              <div className="rounded-md bg-muted/20 px-3 py-2 text-xs flex justify-between">
                <span className="text-muted-foreground">PO total</span><span className="font-semibold">₹{payPo.totalAmount.toLocaleString("en-IN")}</span>
              </div>
              <div>
                <Label htmlFor="amountPaid">Amount paid (₹) *</Label>
                <Input id="amountPaid" type="number" step="0.01" min="0.01" value={payForm.amountPaid} onChange={e => setPayForm(f => ({ ...f, amountPaid: e.target.value }))}/>
              </div>
              <div>
                <Label htmlFor="paymentReference">Payment reference *</Label>
                <Input id="paymentReference" placeholder="Cheque #, UTR, transaction id…" value={payForm.paymentReference} onChange={e => setPayForm(f => ({ ...f, paymentReference: e.target.value }))} maxLength={100}/>
              </div>
              <div>
                <Label htmlFor="paidAt">Payment date</Label>
                <Input id="paidAt" type="date" value={payForm.paidAt} onChange={e => setPayForm(f => ({ ...f, paidAt: e.target.value }))}/>
              </div>
            </div>)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayPo(null)}>Cancel</Button>
            <Button className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20" disabled={markPaidMutation.isPending} onClick={submitPay}>
              <Wallet className="w-4 h-4 mr-1"/>{markPaidMutation.isPending ? "Recording…" : "Record payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receive / verify invoice */}
      <Dialog open={!!receivePo} onOpenChange={(v) => !v && setReceivePo(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Verify & Receive — {receivePo?.poNumber}</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">Match each PO line to a product. Item names, quantities, and unit prices must match the PO exactly (₹0.01 tolerance). On confirm, stock will be added and movements logged.</p>
          {receivePo && (<div className="space-y-2 py-2">
              <table className="w-full text-sm">
                <thead><tr className="text-xs text-muted-foreground border-b border-border/40"><th className="text-left py-2">Invoice Item</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Unit ₹</th><th className="py-2 text-left">Map to Product</th></tr></thead>
                <tbody>
                  {matchItems.map((m, i) => (<tr key={i} className="border-b border-border/20">
                      <td className="py-2"><Input value={m.name} onChange={e => setMatchItems(arr => arr.map((x, idx) => idx === i ? { ...x, name: e.target.value } : x))} className="text-xs"/></td>
                      <td className="py-2 w-20"><Input type="number" value={m.quantity} onChange={e => setMatchItems(arr => arr.map((x, idx) => idx === i ? { ...x, quantity: parseInt(e.target.value) || 0 } : x))} className="text-xs text-right"/></td>
                      <td className="py-2 w-24"><Input type="number" step="0.01" value={m.unitPrice} onChange={e => setMatchItems(arr => arr.map((x, idx) => idx === i ? { ...x, unitPrice: parseFloat(e.target.value) || 0 } : x))} className="text-xs text-right"/></td>
                      <td className="py-2">
                        <Select value={m.productId} onValueChange={v => setMatchItems(arr => arr.map((x, idx) => idx === i ? { ...x, productId: v } : x))}>
                          <SelectTrigger className="text-xs"><SelectValue placeholder="Choose product"/></SelectTrigger>
                          <SelectContent className="max-h-64">{products.map(p => <SelectItem key={p.id} value={String(p.id)}>{p.name} <span className="text-muted-foreground text-xs">({p.currentStock})</span></SelectItem>)}</SelectContent>
                        </Select>
                      </td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setReceivePo(null)}>Cancel</Button>
            <Button className="bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20" disabled={receiveMutation.isPending} onClick={submitReceive}><CheckCircle className="w-4 h-4 mr-1"/>{receiveMutation.isPending ? "Receiving..." : "Confirm & Receive"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}