import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Wallet, ShoppingCart, CheckCircle, Clock, Eye, ArrowRight, FileText, Upload, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
const statusColor = {
    draft: "bg-muted/40 text-muted-foreground border-muted/30",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    sent: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    acknowledged: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    invoiced: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    delivered: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    received: "bg-green-500/10 text-green-400 border-green-500/30",
    paid: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    cancelled: "bg-red-500/10 text-red-400 border-red-500/30",
};
// Vendor-allowed forward transitions. Moving to "invoiced" requires uploading
// an invoice PDF, so it's handled separately (not via this simple advance button).
const vendorNextStatus = {
    draft: null,
    pending: null,
    sent: { next: "acknowledged", label: "Acknowledge order" },
    acknowledged: null,
    invoiced: { next: "delivered", label: "Mark as delivered" },
    delivered: null,
    received: null,
    paid: null,
    cancelled: null,
};
async function fetchJson(url, init) {
    const r = await fetch(url, { credentials: "include", ...init });
    if (!r.ok)
        throw new Error(`${r.status}`);
    return r.json();
}
function currentFinancialYear(today = new Date()) {
    // Indian financial year: 1 April – 31 March
    const y = today.getFullYear();
    const m = today.getMonth(); // 0-based; 3 === April
    const startYear = m >= 3 ? y : y - 1;
    return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}
function csvEscape(value) {
    const s = value == null ? "" : String(value);
    if (/[",\n\r]/.test(s))
        return `"${s.replace(/"/g, '""')}"`;
    return s;
}
export default function VendorFinance() {
    const qc = useQueryClient();
    const { toast } = useToast();
    const [openPO, setOpenPO] = useState(null);
    const [invoiceNumber, setInvoiceNumber] = useState("");
    const [invoiceFile, setInvoiceFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);
    const defaultFY = currentFinancialYear();
    const [fromDate, setFromDate] = useState(defaultFY.from);
    const [toDate, setToDate] = useState(defaultFY.to);
    const uploadInvoice = async () => {
        if (!openPO || !invoiceFile)
            return;
        if (invoiceFile.type !== "application/pdf") {
            toast({ title: "PDF required", description: "Please choose a PDF file.", variant: "destructive" });
            return;
        }
        setUploading(true);
        try {
            const form = new FormData();
            form.append("file", invoiceFile);
            if (invoiceNumber)
                form.append("invoiceNumber", invoiceNumber);
            const res = await fetch(`/api/purchase-orders/${openPO.id}/invoice`, {
                method: "POST",
                credentials: "include",
                body: form,
            });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error ?? `${res.status}`);
            }
            const updated = await res.json();
            qc.invalidateQueries({ queryKey: ["vendor", "my-pos"] });
            setOpenPO(updated);
            setInvoiceFile(null);
            setInvoiceNumber("");
            if (fileInputRef.current)
                fileInputRef.current.value = "";
            toast({ title: "Invoice uploaded", description: `Order ${updated.poNumber} is now invoiced.` });
        }
        catch (err) {
            toast({ title: "Upload failed", description: err.message, variant: "destructive" });
        }
        finally {
            setUploading(false);
        }
    };
    const { data: orders = [], isLoading } = useQuery({
        queryKey: ["vendor", "my-pos"],
        queryFn: () => fetchJson("/api/purchase-orders"),
        staleTime: 5000,
    });
    const updateStatus = useMutation({
        mutationFn: async ({ id, status }) => fetchJson(`/api/purchase-orders/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
        }),
        onSuccess: (po) => {
            qc.invalidateQueries({ queryKey: ["vendor", "my-pos"] });
            setOpenPO(po);
            toast({ title: "Status updated", description: `Order ${po.poNumber} is now ${po.status}.` });
        },
        onError: () => toast({ title: "Update failed", description: "Could not update order status.", variant: "destructive" }),
    });
    // Earnings calculations
    const totalBilled = orders.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const paidStatuses = new Set(["paid"]);
    const totalPaid = orders.filter(o => paidStatuses.has(o.status)).reduce((s, o) => s + Number(o.totalAmount ?? 0), 0);
    const outstanding = totalBilled - totalPaid;
    const pendingCount = orders.filter(o => ["sent", "acknowledged", "invoiced"].includes(o.status)).length;
    const filteredForStatement = orders.filter(o => {
        const created = new Date(o.createdAt);
        if (Number.isNaN(created.getTime()))
            return false;
        if (fromDate) {
            const from = new Date(`${fromDate}T00:00:00`);
            if (created < from)
                return false;
        }
        if (toDate) {
            const to = new Date(`${toDate}T23:59:59.999`);
            if (created > to)
                return false;
        }
        return true;
    });
    const downloadStatement = () => {
        if (filteredForStatement.length === 0) {
            toast({ title: "Nothing to export", description: "No purchase orders fall within the selected date range.", variant: "destructive" });
            return;
        }
        const header = ["PO #", "Created date", "Items count", "Total (INR)", "Status", "Paid date"];
        const rows = filteredForStatement.map(o => [
            o.poNumber,
            format(new Date(o.createdAt), "yyyy-MM-dd"),
            o.items?.length ?? 0,
            Number(o.totalAmount ?? 0),
            o.status,
            // No paid_at field is tracked on purchase orders today. Surface "paid" when
            // the status is paid so the column is still informative for accounting.
            o.status === "paid" ? "paid" : "",
        ]);
        const totalRow = ["", "", "", filteredForStatement.reduce((s, o) => s + Number(o.totalAmount ?? 0), 0), "TOTAL", ""];
        const csv = [header, ...rows, totalRow].map(r => r.map(csvEscape).join(",")).join("\r\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const vendorPart = (filteredForStatement[0].vendorName ?? "vendor").replace(/[^a-z0-9-]+/gi, "-").toLowerCase();
        a.href = url;
        a.download = `earnings-statement-${vendorPart}-${fromDate}-to-${toDate}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: "Statement downloaded", description: `${filteredForStatement.length} order(s) exported.` });
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

    const resetDateRange = () => {
        const fy = currentFinancialYear();
        setFromDate(fy.from);
        setToDate(fy.to);
    };
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-serif font-bold flex items-center gap-2"><Wallet className="w-6 h-6 text-yellow-400"/> Finance</h1>
          <p className="text-sm text-muted-foreground">Your purchase orders, billing, and earnings at a glance.</p>
        </div>
      </div>

      <Card className="glass-card border-t-2 border-t-emerald-500/30">
        <CardContent className="p-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2 mr-auto">
            <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400"><Download className="w-4 h-4"/></div>
            <div>
              <p className="text-sm font-semibold">Earnings statement</p>
              <p className="text-xs text-muted-foreground">CSV export of your purchase orders for accounting or tax filing.</p>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="stmt-from" className="text-xs">From</Label>
            <Input id="stmt-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-8 text-xs w-[10.5rem]" data-testid="input-statement-from"/>
          </div>
          <div className="space-y-1">
            <Label htmlFor="stmt-to" className="text-xs">To</Label>
            <Input id="stmt-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-8 text-xs w-[10.5rem]" data-testid="input-statement-to"/>
          </div>
          <Button size="sm" variant="outline" onClick={resetDateRange} className="h-8" data-testid="button-reset-fy">This FY</Button>
          <Button size="sm" onClick={downloadStatement} disabled={isLoading} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 gap-1.5 h-8" data-testid="button-download-statement">
            <Download className="w-3.5 h-3.5"/> Download statement ({filteredForStatement.length})
          </Button>
        </CardContent>
      </Card>

      {/* Earnings summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-yellow-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-400"><ShoppingCart className="w-4 h-4"/></div>
            <div><p className="text-xs text-muted-foreground">Total Orders</p><p className="text-2xl font-bold text-yellow-400">{orders.length}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card glass-hover border-t-2 border-t-violet-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-violet-500/10 p-2 rounded-lg text-violet-400"><FileText className="w-4 h-4"/></div>
            <div><p className="text-xs text-muted-foreground">Total Billed</p><p className="text-2xl font-bold text-violet-400">₹{totalBilled.toLocaleString("en-IN")}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400"><CheckCircle className="w-4 h-4"/></div>
            <div><p className="text-xs text-muted-foreground">Total Paid</p><p className="text-2xl font-bold text-emerald-400">₹{totalPaid.toLocaleString("en-IN")}</p></div>
          </CardContent>
        </Card>
        <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-amber-500/10 p-2 rounded-lg text-amber-400"><Clock className="w-4 h-4"/></div>
            <div><p className="text-xs text-muted-foreground">Outstanding</p><p className="text-2xl font-bold text-amber-400">₹{outstanding.toLocaleString("en-IN")}</p></div>
          </CardContent>
        </Card>
      </div>

      {pendingCount > 0 && (<Card className="glass-card border-t-2 border-t-blue-500/30">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-blue-500/10 p-2.5 rounded-lg text-blue-400"><Clock className="w-4 h-4"/></div>
            <div>
              <p className="text-sm font-semibold">{pendingCount} order(s) awaiting your action</p>
              <p className="text-xs text-muted-foreground">Open an order below to acknowledge, invoice, or mark it delivered.</p>
            </div>
          </CardContent>
        </Card>)}

      <Card className="glass-card border-t-2 border-t-yellow-500/30">
        <CardContent className="p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><ShoppingCart className="w-4 h-4 text-yellow-400"/> My Purchase Orders</h2>
          {isLoading ? (<div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full"/>)}</div>) : orders.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-10">No purchase orders yet. Once the school issues a PO addressed to you, it will appear here.</p>) : (<div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40"><th className="py-2 px-2">PO #</th><th className="py-2 px-2">Status</th><th className="py-2 px-2 text-right">Amount</th><th className="py-2 px-2">Delivery</th><th className="py-2 px-2">Created</th><th className="py-2 px-2 text-right">Action</th></tr></thead>
                <tbody>
                  {orders.map(po => (<tr key={po.id} className="border-b border-border/20 hover:bg-white/5">
                      <td className="py-2 px-2 font-mono text-xs">{po.poNumber}</td>
                      <td className="py-2 px-2"><Badge className={`text-xs capitalize border ${statusColor[po.status] ?? "bg-muted/40"}`}>{po.status}</Badge></td>
                      <td className="py-2 px-2 text-right font-semibold text-emerald-400">₹{Number(po.totalAmount).toLocaleString("en-IN")}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{po.deliveryDate ? format(new Date(po.deliveryDate), "MMM d, yyyy") : "—"}</td>
                      <td className="py-2 px-2 text-xs text-muted-foreground">{format(new Date(po.createdAt), "MMM d, yyyy")}</td>
                      <td className="py-2 px-2 text-right"><Button size="sm" variant="outline" onClick={() => setOpenPO(po)} className="gap-1.5"><Eye className="w-3.5 h-3.5"/>View</Button></td>
                    </tr>))}
                </tbody>
              </table>
            </div>)}
        </CardContent>
      </Card>

      <Dialog open={!!openPO} onOpenChange={(o) => { if (!o) {
        setOpenPO(null);
        setInvoiceFile(null);
        setInvoiceNumber("");
    } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><FileText className="w-4 h-4"/>{openPO?.poNumber}</DialogTitle></DialogHeader>
          {openPO && (<div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-muted-foreground">Status</p><Badge className={`text-xs capitalize border ${statusColor[openPO.status] ?? "bg-muted/40"}`}>{openPO.status}</Badge></div>
                <div><p className="text-xs text-muted-foreground">Total amount</p><p className="font-semibold text-emerald-400">₹{Number(openPO.totalAmount).toLocaleString("en-IN")}</p></div>
                <div><p className="text-xs text-muted-foreground">Delivery date</p><p className="text-sm">{openPO.deliveryDate ? format(new Date(openPO.deliveryDate), "MMM d, yyyy") : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm">{format(new Date(openPO.createdAt), "MMM d, yyyy")}</p></div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1.5">Items</p>
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40"><th className="py-1.5 px-2">Name</th><th className="py-1.5 px-2 text-right">Qty</th><th className="py-1.5 px-2 text-right">Unit ₹</th><th className="py-1.5 px-2 text-right">Total</th></tr></thead>
                  <tbody>
                    {openPO.items.map((it, idx) => (<tr key={idx} className="border-b border-border/20">
                        <td className="py-1.5 px-2">{it.name}</td>
                        <td className="py-1.5 px-2 text-right">{it.quantity}</td>
                        <td className="py-1.5 px-2 text-right">₹{Number(it.unitPrice).toLocaleString("en-IN")}</td>
                        <td className="py-1.5 px-2 text-right font-semibold">₹{Number(it.total).toLocaleString("en-IN")}</td>
                      </tr>))}
                  </tbody>
                </table>
              </div>

              {openPO.notes && (<div className="text-xs"><p className="text-muted-foreground">Notes</p><p className="mt-1 p-2 rounded bg-muted/20">{openPO.notes}</p></div>)}

              {/* Invoice section: vendor uploads at acknowledged/invoiced; everyone can view */}
              {openPO.invoiceUrl ? (<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-500/10 p-1.5 rounded text-amber-400"><FileText className="w-3.5 h-3.5"/></div>
                      <div>
                        <p className="text-sm font-semibold">Invoice uploaded</p>
                        {openPO.invoiceNumber && (<p className="text-xs text-muted-foreground">Invoice # {openPO.invoiceNumber}</p>)}
                      </div>
                    </div>
                    <a href={`/api/purchase-orders/${openPO.id}/invoice`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20">
                      <Download className="w-3.5 h-3.5"/> Download PDF
                    </a>
                  </div>
                </div>) : (["acknowledged", "invoiced"].includes(openPO.status) && (<div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="bg-amber-500/10 p-1.5 rounded text-amber-400"><Upload className="w-3.5 h-3.5"/></div>
                      <p className="text-sm font-semibold">Upload invoice PDF</p>
                    </div>
                    <p className="text-xs text-muted-foreground">Attach a PDF invoice for this order. The school's accounts team will see it on their PO view.</p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label htmlFor="invoice-number" className="text-xs">Invoice number (optional)</Label>
                        <Input id="invoice-number" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="e.g. INV-2026-001" className="h-8 text-xs"/>
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="invoice-file" className="text-xs">PDF file</Label>
                        <Input id="invoice-file" ref={fileInputRef} type="file" accept="application/pdf" onChange={(e) => setInvoiceFile(e.target.files?.[0] ?? null)} className="h-8 text-xs file:text-xs"/>
                      </div>
                    </div>
                    <Button size="sm" onClick={uploadInvoice} disabled={!invoiceFile || uploading} className="bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 gap-1.5">
                      <Upload className="w-3.5 h-3.5"/>
                      {uploading ? "Uploading…" : openPO.status === "acknowledged" ? "Upload & mark invoiced" : "Replace invoice"}
                    </Button>
                  </div>))}

              {openPO.status === "paid" && (<div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-emerald-500/10 p-1.5 rounded text-emerald-400"><Wallet className="w-3.5 h-3.5"/></div>
                      <div>
                        <p className="text-sm font-semibold">Payment completed</p>
                        {openPO.paymentReference && (<p className="text-xs text-muted-foreground">Reference: {openPO.paymentReference}</p>)}
                      </div>
                    </div>
                    <Button size="xs" variant="outline" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" onClick={() => handleDownloadPOReceipt(openPO)}>
                      <Download className="w-3.5 h-3.5"/> Download Receipt
                    </Button>
                  </div>
                </div>)}

              {/* Status timeline */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Order progress</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {["sent", "acknowledged", "invoiced", "delivered", "paid"].map((s, i, arr) => {
                const order = ["draft", "sent", "acknowledged", "invoiced", "delivered", "received", "paid"];
                const reached = order.indexOf(openPO.status) >= order.indexOf(s);
                return (<div key={s} className="flex items-center gap-1">
                        <Badge variant="outline" className={`text-[10px] capitalize ${reached ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-muted/20 text-muted-foreground"}`}>{s}</Badge>
                        {i < arr.length - 1 && <ArrowRight className="w-3 h-3 text-muted-foreground/40"/>}
                      </div>);
            })}
                </div>
              </div>
            </div>)}
          <DialogFooter className="gap-2">
            {openPO && vendorNextStatus[openPO.status] && (<Button onClick={() => updateStatus.mutate({ id: openPO.id, status: vendorNextStatus[openPO.status].next })} disabled={updateStatus.isPending} className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30">
                {vendorNextStatus[openPO.status].label}
              </Button>)}
            <Button variant="outline" onClick={() => setOpenPO(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}