import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, FileText, Package, AlertTriangle, ShoppingCart, TrendingUp, Download } from "lucide-react";
import { fetchJson, useProducts } from "./products";
import { jsPDF } from "jspdf";

export default function StoreReports() {
    const [purchasePage, setPurchasePage] = useState(1);
    const PURCHASE_PAGE_SIZE = 10;
    const { data: summary } = useQuery({ queryKey: ["inventory", "reports", "summary"], queryFn: () => fetchJson("/api/inventory/reports/summary"), staleTime: 10000 });
    const { data: purchases } = useQuery({ queryKey: ["inventory", "reports", "purchases"], queryFn: () => fetchJson("/api/inventory/reports/purchases"), staleTime: 10000 });
    const { data: usage } = useQuery({ queryKey: ["inventory", "reports", "usage"], queryFn: () => fetchJson("/api/inventory/reports/usage"), staleTime: 10000 });
    const { data: products = [] } = useProducts();
    const lowStock = products.filter(p => p.lowStock);
    const purchaseOrders = purchases?.orders ?? [];
    const purchaseTotalPages = Math.max(1, Math.ceil(purchaseOrders.length / PURCHASE_PAGE_SIZE));
    const safePurchasePage = Math.min(purchasePage, purchaseTotalPages);
    const pagedPurchaseOrders = purchaseOrders.slice((safePurchasePage - 1) * PURCHASE_PAGE_SIZE, safePurchasePage * PURCHASE_PAGE_SIZE);

    useEffect(() => {
        setPurchasePage(1);
    }, [purchaseOrders.length]);

    const handleDownloadCSV = () => {
        if (!summary) return;
        let csvContent = "data:text/csv;charset=utf-8,";
        
        csvContent += "Nexus Academy Inventory Report\r\n";
        csvContent += `Generated: ${new Date().toLocaleString()}\r\n\r\n`;
        
        csvContent += "SUMMARY METRICS\r\n";
        csvContent += `Total Products,${summary.totalProducts}\r\n`;
        csvContent += `Total Stock,${summary.totalStock}\r\n`;
        csvContent += `Low Stock Items,${summary.lowStockCount}\r\n`;
        csvContent += `Total Inventory Value,INR ${summary.inventoryValue}\r\n\r\n`;
        
        csvContent += "STOCK BY CATEGORY\r\n";
        csvContent += "Category,Products,Total Stock,Value (INR)\r\n";
        summary.byCategory.forEach(c => {
            csvContent += `"${c.category}",${c.products},${c.stock},${c.value}\r\n`;
        });
        csvContent += "\r\n";
        
        csvContent += "LOW STOCK ITEMS\r\n";
        csvContent += "Product,Category,Current Stock,Reorder Threshold\r\n";
        lowStock.forEach(p => {
            csvContent += `"${p.name}","${p.category}",${p.currentStock},${p.reorderThreshold}\r\n`;
        });
        csvContent += "\r\n";

        csvContent += "ITEM USAGE HISTORY\r\n";
        csvContent += "Product,Category,In Quantity,Out Quantity,Net Movement,Total Movements\r\n";
        if (usage) {
            usage.byProduct.forEach(p => {
                csvContent += `"${p.productName}","${p.category}",${p.inQty},${p.outQty},${p.net},${p.movements}\r\n`;
            });
        }
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `inventory_report_${new Date().toISOString().split("T")[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadPDF = () => {
        if (!summary) return;
        const doc = new jsPDF();
        
        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(234, 179, 8); // Yellow accent
        doc.text("NEXUS ACADEMY", 105, 25, { align: "center" });
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text("Inventory Summary & Stock Audit Report", 105, 32, { align: "center" });
        
        doc.setDrawColor(229, 231, 235);
        doc.line(20, 38, 190, 38);
        
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("INVENTORY OVERVIEW", 20, 48);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`Total Products: ${summary.totalProducts}`, 20, 56);
        doc.text(`Total Stock Count: ${summary.totalStock}`, 20, 62);
        doc.text(`Low Stock Warnings: ${summary.lowStockCount}`, 20, 68);
        doc.text(`Estimated Stock Value: INR ${summary.inventoryValue.toLocaleString("en-IN")}`, 20, 74);
        
        doc.line(20, 80, 190, 80);
        
        doc.setFont("helvetica", "bold");
        doc.text("STOCK BY CATEGORY", 20, 90);
        
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text("Category", 20, 98);
        doc.text("Products", 100, 98, { align: "right" });
        doc.text("Stock", 140, 98, { align: "right" });
        doc.text("Value", 185, 98, { align: "right" });
        
        doc.setDrawColor(156, 163, 175);
        doc.line(20, 101, 190, 101);
        
        let y = 108;
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        summary.byCategory.forEach(c => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(c.category.toUpperCase(), 20, y);
            doc.text(String(c.products), 100, y, { align: "right" });
            doc.text(String(c.stock), 140, y, { align: "right" });
            doc.text(`INR ${c.value.toLocaleString("en-IN")}`, 185, y, { align: "right" });
            y += 7;
        });
        
        y += 10;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setDrawColor(229, 231, 235);
        doc.line(20, y - 5, 190, y - 5);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("CRITICAL LOW STOCK ITEMS", 20, y);
        y += 10;
        
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text("Item", 20, y);
        doc.text("Category", 100, y);
        doc.text("Current Qty", 140, y, { align: "right" });
        doc.text("Reorder Limit", 185, y, { align: "right" });
        y += 3;
        doc.line(20, y, 190, y);
        y += 7;
        
        doc.setFont("helvetica", "normal");
        doc.setTextColor(0, 0, 0);
        
        if (lowStock.length > 0) {
            lowStock.forEach(p => {
                if (y > 270) { doc.addPage(); y = 20; }
                doc.text(p.name, 20, y);
                doc.text(p.category.toUpperCase(), 100, y);
                doc.text(String(p.currentStock), 140, y, { align: "right" });
                doc.text(String(p.reorderThreshold), 185, y, { align: "right" });
                y += 7;
            });
        } else {
            doc.text("No items are currently below low-stock threshold.", 105, y, { align: "center" });
            y += 7;
        }
        
        doc.save(`inventory_audit_report_${new Date().toISOString().split("T")[0]}.pdf`);
    };

    if (!summary || !purchases) {
        return <div className="space-y-4"><Skeleton className="h-24 w-full"/><Skeleton className="h-64 w-full"/></div>;
    }
    return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400 print:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-serif font-bold text-yellow-400">Inventory Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">Summary, low stock, purchases, and category breakdown</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" onClick={handleDownloadCSV}>
            <Download className="w-4.5 h-4.5"/>Export CSV
          </Button>
          <Button variant="outline" className="gap-2 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10" onClick={handleDownloadPDF}>
            <FileText className="w-4.5 h-4.5"/>Export PDF
          </Button>
          <Button className="gap-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20" onClick={() => window.print()}>
            <Printer className="w-4.5 h-4.5"/>Print Report
          </Button>
        </div>
      </div>

      <div className="hidden print:block mb-4">
        <h1 className="text-3xl font-serif font-bold">Nexus Academy — Inventory Report</h1>
        <p className="text-sm text-muted-foreground">Generated {new Date().toLocaleString()}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="glass-card border-t-2 border-t-yellow-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-yellow-500/10 text-yellow-400"><Package className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Products</p><p className="text-2xl font-bold text-yellow-400">{summary.totalProducts}</p></div></CardContent></Card>
        <Card className="glass-card border-t-2 border-t-green-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-green-500/10 text-green-400"><Package className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Total Stock</p><p className="text-2xl font-bold text-green-400">{summary.totalStock}</p></div></CardContent></Card>
        <Card className="glass-card border-t-2 border-t-red-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-red-500/10 text-red-400"><AlertTriangle className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-2xl font-bold text-red-400">{summary.lowStockCount}</p></div></CardContent></Card>
        <Card className="glass-card border-t-2 border-t-emerald-500/40"><CardContent className="p-4 flex items-center gap-3"><div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><TrendingUp className="w-4 h-4"/></div><div><p className="text-xs text-muted-foreground">Inventory Value</p><p className="text-xl font-bold text-emerald-400">₹{summary.inventoryValue.toLocaleString("en-IN")}</p></div></CardContent></Card>
      </div>

      <Card className="glass-card border-t-2 border-t-yellow-500/30">
        <CardContent className="p-4 space-y-2">
          <h2 className="font-semibold flex items-center gap-2"><FileText className="w-4 h-4"/>Stock by Category</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40"><th className="py-2 px-2">Category</th><th className="py-2 px-2 text-right">Products</th><th className="py-2 px-2 text-right">Total Stock</th><th className="py-2 px-2 text-right">Value</th></tr></thead>
              <tbody>
                {summary.byCategory.map(c => (<tr key={c.category} className="border-b border-border/20">
                    <td className="py-2 px-2 capitalize">{c.category}</td>
                    <td className="py-2 px-2 text-right">{c.products}</td>
                    <td className="py-2 px-2 text-right">{c.stock}</td>
                    <td className="py-2 px-2 text-right">₹{c.value.toLocaleString("en-IN")}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-t-2 border-t-red-500/30">
        <CardContent className="p-4 space-y-2">
          <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400"/>Low-Stock Items ({lowStock.length})</h2>
          {lowStock.length === 0 ? <p className="text-xs text-muted-foreground">All items above reorder threshold.</p> : (<table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40"><th className="py-2 px-2">Product</th><th className="py-2 px-2">Category</th><th className="py-2 px-2 text-right">Current</th><th className="py-2 px-2 text-right">Reorder At</th></tr></thead>
              <tbody>
                {lowStock.map(p => (<tr key={p.id} className="border-b border-border/20"><td className="py-2 px-2 font-medium">{p.name}</td><td className="py-2 px-2 capitalize text-xs text-muted-foreground">{p.category}</td><td className="py-2 px-2 text-right text-red-400 font-bold">{p.currentStock}</td><td className="py-2 px-2 text-right text-muted-foreground text-xs">{p.reorderThreshold}</td></tr>))}
              </tbody>
            </table>)}
        </CardContent>
      </Card>

      <Card className="glass-card border-t-2 border-t-green-500/30">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-semibold flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-400"/>Item Usage History</h2>
            {usage && (<div className="flex gap-4 text-xs text-muted-foreground">
                <span>Movements: <span className="text-foreground font-semibold">{usage.movementCount}</span></span>
                <span>In: <span className="text-green-400 font-semibold">+{usage.totalIn}</span></span>
                <span>Out: <span className="text-red-400 font-semibold">−{usage.totalOut}</span></span>
              </div>)}
          </div>
          {!usage || usage.byProduct.length === 0 ? <p className="text-xs text-muted-foreground">No stock movements recorded yet.</p> : (<table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40"><th className="py-2 px-2">Product</th><th className="py-2 px-2">Category</th><th className="py-2 px-2 text-right">In</th><th className="py-2 px-2 text-right">Out</th><th className="py-2 px-2 text-right">Net</th><th className="py-2 px-2 text-right">Movements</th></tr></thead>
              <tbody>
                {usage.byProduct.map(p => (<tr key={p.productId} className="border-b border-border/20">
                    <td className="py-2 px-2 font-medium">{p.productName}</td>
                    <td className="py-2 px-2 capitalize text-xs text-muted-foreground">{p.category}</td>
                    <td className="py-2 px-2 text-right text-green-400">+{p.inQty}</td>
                    <td className="py-2 px-2 text-right text-red-400">−{p.outQty}</td>
                    <td className="py-2 px-2 text-right font-semibold">{p.net >= 0 ? "+" : ""}{p.net}</td>
                    <td className="py-2 px-2 text-right text-xs text-muted-foreground">{p.movements}</td>
                  </tr>))}
              </tbody>
            </table>)}
        </CardContent>
      </Card>

      <Card className="glass-card border-t-2 border-t-emerald-500/30">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2"><ShoppingCart className="w-4 h-4"/>Purchase History</h2>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>Orders: <span className="text-foreground font-semibold">{purchases.orderCount}</span></span>
              <span>Total: <span className="text-emerald-400 font-semibold">₹{purchases.totalSpend.toLocaleString("en-IN")}</span></span>
              <span>Received: <span className="text-green-400 font-semibold">₹{purchases.receivedSpend.toLocaleString("en-IN")}</span></span>
            </div>
          </div>
          {purchaseOrders.length === 0 ? <p className="text-xs text-muted-foreground">No purchase orders yet.</p> : (
            <>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-muted-foreground border-b border-border/40"><th className="py-2 px-2">PO #</th><th className="py-2 px-2">Vendor</th><th className="py-2 px-2">Status</th><th className="py-2 px-2">Date</th><th className="py-2 px-2 text-right">Amount</th></tr></thead>
                <tbody>
                  {pagedPurchaseOrders.map(o => (<tr key={o.id} className="border-b border-border/20"><td className="py-2 px-2 font-mono text-xs">{o.poNumber}</td><td className="py-2 px-2">{o.vendorName}</td><td className="py-2 px-2"><Badge className="bg-muted/40 text-foreground text-xs">{o.status}</Badge></td><td className="py-2 px-2 text-xs text-muted-foreground">{new Date(o.createdAt).toLocaleDateString()}</td><td className="py-2 px-2 text-right font-semibold">₹{o.totalAmount.toLocaleString("en-IN")}</td></tr>))}
                </tbody>
              </table>
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing {((safePurchasePage - 1) * PURCHASE_PAGE_SIZE) + 1}-{Math.min(safePurchasePage * PURCHASE_PAGE_SIZE, purchaseOrders.length)} of {purchaseOrders.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={safePurchasePage === 1} onClick={() => setPurchasePage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {safePurchasePage} of {purchaseTotalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={safePurchasePage === purchaseTotalPages} onClick={() => setPurchasePage((p) => Math.min(purchaseTotalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>);
}