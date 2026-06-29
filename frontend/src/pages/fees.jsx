import { useState, useEffect } from "react";
import { useListFees, useCreateFee, usePayFee, useListStudents, useListClasses, getListFeesQueryKey, getListStudentsQueryKey, getListClassesQueryKey, useListFeeStructures, useCreateFeeStructure, getListFeeStructuresQueryKey } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, CreditCard, AlertCircle, CheckCircle, Clock, Wallet, User, Receipt, Building2, Eye, X, IndianRupee, Printer, Download, FileText, History } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
const statusConfig = {
  paid: {
    label: "Paid",
    color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    icon: CheckCircle,
  },
  pending: {
    label: "Pending",
    color: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  overdue: {
    label: "Overdue",
    color: "bg-red-500/10 text-red-400 border-red-500/20",
    icon: AlertCircle,
  },
  partial: {
    label: "Partial",
    color: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    icon: CreditCard,
  },
};
const FEE_TYPES = [
  { value: "tuition", label: "Tuition Fee" },
  { value: "hostel", label: "Hostel Fee" },
  { value: "transport", label: "Transport Fee" },
  { value: "library", label: "Library Fee" },
  { value: "lab", label: "Lab Fee" },
  { value: "exam", label: "Examination Fee" },
  { value: "sports", label: "Sports Fee" },
  { value: "admission", label: "Admission Fee" },
  { value: "miscellaneous", label: "Miscellaneous" },
];
const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "online", label: "Online" },
];
function formatCurrency(n) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}
const defaultForm = {
  studentId: "",
  feeType: "tuition",
  amount: "",
  concession: "0",
  dueDate: "",
  academicYear: "2025-26",
  termType: "annual",
};
const DEFAULT_STRUCTURE = {
  tuition: "5000",
  hostel: "3000",
  transport: "1500",
  library: "500",
  lab: "800",
  exam: "600",
  sports: "400",
  uniform: "1200",
};
export default function Fees() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const isAccountant = ["admin", "accountant"].includes(user?.role ?? "");
  const isStudent = ["student"].includes(user?.role ?? "");
  const isParent = ["parent"].includes(user?.role ?? "");
  const isViewOnly = isStudent;
  const [tab, setTab] = useState("records");
  const [open, setOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterClassId, setFilterClassId] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [lateFineRate, setLateFineRate] = useState("0.05");
  const [receiptShown, setReceiptShown] = useState(null);
  const [selectedFee, setSelectedFee] = useState(null);
  const overdueMonths = (dueDate) => {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const today = new Date();
    if (isNaN(due.getTime()) || today <= due) return 0;
    const daysOverdue = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, Math.ceil(daysOverdue / 30));
  };
  const estimatedLatePenalty = (fee) => {
    const months = overdueMonths(fee?.dueDate);
    if (!months) return 0;
    const outstanding = Math.max(0, Number(fee.amount) - Number(fee.paidAmount ?? 0));
    return Number((outstanding * Number(lateFineRate) * months).toFixed(2));
  };
  const getLateFinesForFee = (feeId) => {
    return fees.filter(f => f.feeType && f.feeType.startsWith("Late Fine (Ref: #") && f.feeType === `Late Fine (Ref: #${feeId})`);
  };
  const getTotalPaymentDue = (fee) => {
    const feeBalance = Number(fee.balanceAmount ?? fee.amount) || 0;
    const lateFines = getLateFinesForFee(fee.id);
    const totalLateFines = lateFines.reduce((sum, lf) => sum + (Number(lf.balanceAmount ?? lf.amount) || 0), 0);
    return feeBalance + totalLateFines;
  };
  const handlePrintReceipt = (fee) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const totalAmount = Number(fee.payment?.amount ?? fee.paidAmount ?? fee.amount) || 0;
    const gstRate = 0.18; // 18% GST support
    const subtotal = totalAmount / (1 + gstRate);
    const cgst = subtotal * (gstRate / 2);
    const sgst = subtotal * (gstRate / 2);

    const formatCurrencyValue = (value) => value.toLocaleString("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const amountFormatted = formatCurrencyValue(totalAmount);
    const subtotalFormatted = formatCurrencyValue(subtotal);
    const cgstFormatted = formatCurrencyValue(cgst);
    const sgstFormatted = formatCurrencyValue(sgst);

    const dateString = new Date().toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const txnId = fee.receiptNumber || fee.payment?.receiptNumber || `REC-${fee.id}`;

    const printContent = `
            <div class="text-center font-bold" style="font-size: 18px; margin-bottom: 8px;">NEXUS ACADEMY</div>
            <div class="text-center text-sm" style="margin-bottom: 10px;">FEE PAYMENT RECEIPT (GST Compliant)</div>
            <div class="border-b"></div>
            <div class="row">
                <span>Receipt No:</span>
                <span class="font-bold">${txnId}</span>
            </div>
            <div class="row">
                <span>Date:</span>
                <span>${dateString}</span>
            </div>
            <div class="border-b"></div>
            <div class="row">
                <span>Student:</span>
                <span class="font-bold">${fee.studentName || "—"}</span>
            </div>
            <div class="row">
                <span>Fee Type:</span>
                <span class="capitalize">${fee.feeType || "—"}</span>
            </div>
            <div class="row">
                <span>Academic Year:</span>
                <span>${fee.academicYear || "—"}</span>
            </div>
            <div class="border-b"></div>
            <div class="row">
                <span>Subtotal (Excl. GST):</span>
                <span>${subtotalFormatted}</span>
            </div>
            <div class="row">
                <span>CGST (9%):</span>
                <span>${cgstFormatted}</span>
            </div>
            <div class="row">
                <span>SGST (9%):</span>
                <span>${sgstFormatted}</span>
            </div>
            <div class="border-b"></div>
            <div class="row bold-row">
                <span>AMOUNT PAID (Incl. GST):</span>
                <span>${amountFormatted}</span>
            </div>
            <div class="row">
                <span>Payment Status:</span>
                <span style="color: green; font-weight: bold;">PAID</span>
            </div>
            <div class="border-b"></div>
            <div class="text-center text-xs mt-4" style="color: #666;">
                Thank you for your payment.<br/>
                This is a computer generated receipt.
            </div>
        `;

    win.document.write(`
            <html>
            <head>
                <title>Fee Payment Receipt</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; background: #fff; }
                    .receipt-container { border: 2px dashed #000; padding: 20px; max-width: 400px; margin: 0 auto; }
                    .text-center { text-align: center; }
                    .flex { display: flex; justify-content: space-between; }
                    .border-b { border-bottom: 1px dashed #000; margin: 10px 0; }
                    .font-bold { font-weight: bold; }
                    .mt-4 { margin-top: 16px; }
                    .text-sm { font-size: 14px; }
                    .text-xs { font-size: 12px; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="receipt-container">
                    ${printContent}
                </div>
            </body>
            </html>
        `);
    win.document.close();
  };

  const handlePrintInvoice = (fee) => {
    const win = window.open("", "_blank");
    if (!win) return;
    const totalAmount = Number(fee.paidAmount ?? fee.payment?.amount ?? fee.amount) || 0;
    const gstRate = 0.18; // 18% GST

    const subtotal = totalAmount / (1 + gstRate);
    const cgst = subtotal * (gstRate / 2);
    const sgst = subtotal * (gstRate / 2);

    const amountFormatted = totalAmount.toLocaleString("en-IN", { style: "currency", currency: "INR" });
    const subtotalFormatted = subtotal.toLocaleString("en-IN", { style: "currency", currency: "INR" });
    const cgstFormatted = cgst.toLocaleString("en-IN", { style: "currency", currency: "INR" });
    const sgstFormatted = sgst.toLocaleString("en-IN", { style: "currency", currency: "INR" });

    const dateString = new Date().toLocaleDateString("en-IN", { day: 'numeric', month: 'short', year: 'numeric' });
    const invoiceId = `INV-${fee.id}-${Math.floor(1000 + Math.random() * 9000)}`;

    const printContent = `
            <div class="text-center font-bold" style="font-size: 16px; margin-bottom: 5px;">NEXUS ACADEMY</div>
            <div class="text-center text-sm" style="margin-bottom: 10px;">TAX FEE INVOICE (with GST Support)</div>
            <div class="border-b"></div>
            <div class="flex text-sm mt-4">
                <span>Invoice No:</span>
                <span class="font-bold">${invoiceId}</span>
            </div>
            <div class="flex text-sm">
                <span>Date:</span>
                <span>${dateString}</span>
            </div>
            <div class="border-b"></div>
            <div class="flex text-sm mt-4">
                <span>Student:</span>
                <span class="font-bold">${fee.studentName}</span>
            </div>
            <div class="flex text-sm">
                <span>Fee Type:</span>
                <span class="capitalize">${fee.feeType}</span>
            </div>
            <div class="flex text-sm">
                <span>Academic Year:</span>
                <span>${fee.academicYear}</span>
            </div>
            <div class="border-b"></div>
            <div class="flex text-sm mt-2">
                <span>Subtotal (Excl. Tax):</span>
                <span>${subtotalFormatted}</span>
            </div>
            <div class="flex text-sm">
                <span>CGST (9%):</span>
                <span>${cgstFormatted}</span>
            </div>
            <div class="flex text-sm">
                <span>SGST (9%):</span>
                <span>${sgstFormatted}</span>
            </div>
            <div class="border-b"></div>
            <div class="flex text-sm mt-4 font-bold" style="font-size: 15px;">
                <span>TOTAL DUE:</span>
                <span>${amountFormatted}</span>
            </div>
            <div class="flex text-sm">
                <span>Payment Status:</span>
                <span style="color: red; font-weight: bold;">PENDING</span>
            </div>
            <div class="border-b"></div>
            <div class="text-center text-xs mt-4" style="color: #666;">
                Please settle payment before due date (${fee.dueDate || "—"}).<br/>
                This is a computer generated tax invoice.
            </div>
        `;

    win.document.write(`
            <html>
            <head>
                <title>Fee Invoice</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; background: #fff; }
                    .receipt-container { border: 2px dashed #000; padding: 20px; max-width: 400px; margin: 0 auto; }
                    .text-center { text-align: center; }
                    .flex { display: flex; justify-content: space-between; }
                    .border-b { border-bottom: 1px dashed #000; margin: 10px 0; }
                    .font-bold { font-weight: bold; }
                    .mt-4 { margin-top: 16px; }
                    .text-sm { font-size: 14px; }
                    .text-xs { font-size: 12px; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="receipt-container">
                    ${printContent}
                </div>
            </body>
            </html>
        `);
    win.document.close();
  };

  const handleDownloadReceipt = (fee) => {
    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const width = doc.internal.pageSize.getWidth();
    const margin = 24;
    let y = 30;

    const txnId = fee.receiptNumber || fee.payment?.receiptNumber || `REC-${fee.id}`;
    const dateString = new Date().toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const totalAmount = Number(fee.payment?.amount ?? fee.paidAmount ?? fee.amount) || 0;
    const gstRate = 0.18;
    const subtotal = totalAmount / (1 + gstRate);
    const cgst = subtotal * (gstRate / 2);
    const sgst = subtotal * (gstRate / 2);

    const formatReceiptNumber = (value) => `Rs ${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const amountFormatted = formatReceiptNumber(totalAmount);
    const subtotalFormatted = formatReceiptNumber(subtotal);
    const cgstFormatted = formatReceiptNumber(cgst);
    const sgstFormatted = formatReceiptNumber(sgst);
    const statusLabel = fee.status === "partial" ? "PARTIAL" : fee.status?.toUpperCase() || "PAID";

    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text("NEXUS ACADEMY", width / 2, y, { align: "center" });

    y += 24;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("Official Fee Payment Receipt (GST Compliant)", width / 2, y, { align: "center" });

    y += 18;
    doc.setDrawColor(200);
    doc.setLineWidth(0.5);
    doc.line(margin, y, width - margin, y);

    y += 18;
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Receipt Details", margin, y);

    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text("Receipt Number:", margin, y);
    doc.text(txnId, width - margin, y, { align: "right" });

    y += 14;
    doc.text("Date & Time:", margin, y);
    doc.text(dateString, width - margin, y, { align: "right" });

    y += 22;
    doc.setLineWidth(0.5);
    doc.line(margin, y, width - margin, y);

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.text("Student & Fee Information", margin, y);

    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text("Student Name:", margin, y);
    doc.text(fee.studentName || "—", width - margin, y, { align: "right" });

    y += 14;
    doc.text("Fee Category:", margin, y);
    doc.text(String(fee.feeType || "—").toUpperCase(), width - margin, y, { align: "right" });

    y += 14;
    doc.text("Academic Year:", margin, y);
    doc.text(fee.academicYear || "—", width - margin, y, { align: "right" });

    y += 22;
    doc.line(margin, y, width - margin, y);

    y += 16;
    doc.setFont("helvetica", "bold");
    doc.text("Tax Breakdown", margin, y);

    y += 14;
    doc.setFont("helvetica", "normal");
    doc.text("Subtotal (Excl. GST):", margin, y);
    doc.text(subtotalFormatted, width - margin, y, { align: "right" });

    y += 14;
    doc.text("CGST (9%):", margin, y);
    doc.text(cgstFormatted, width - margin, y, { align: "right" });

    y += 14;
    doc.text("SGST (9%):", margin, y);
    doc.text(sgstFormatted, width - margin, y, { align: "right" });

    y += 22;
    doc.setFillColor(236, 253, 245);
    doc.rect(margin, y - 4, width - margin * 2, 28, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(4, 120, 87);
    doc.text("NET AMOUNT PAID (Incl. GST)", margin + 4, y + 12);
    doc.text(amountFormatted, width - margin, y + 12, { align: "right" });

    y += 42;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("Payment Status:", margin, y);
    doc.text(statusLabel, width - margin, y, { align: "right" });

    y += 22;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(
      "Thank you for your payment. This is an official transaction record generated by Nexus Academy.",
      margin,
      y,
      { maxWidth: width - margin * 2 }
    );

    doc.save(`receipt-${String(txnId).replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`);
  };

  const handleDownloadInvoice = (fee) => {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let y = 44;

  const invoiceId = `INV-${fee.id}-${Math.floor(1000 + Math.random() * 9000)}`;
  const dateString = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const totalAmount = Number(fee.paidAmount ?? fee.payment?.amount ?? fee.amount) || 0;
  const gstRate = 0.18;
  const subtotal = totalAmount / (1 + gstRate);
  const cgst = subtotal * (gstRate / 2);
  const sgst = subtotal * (gstRate / 2);

  const formatMoney = (value) => {
  return `Rs. ${Number(value).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

  const amountFormatted = formatMoney(totalAmount);
  const subtotalFormatted = formatMoney(subtotal);
  const cgstFormatted = formatMoney(cgst);
  const sgstFormatted = formatMoney(sgst);

  const drawTextPair = (label, value, yPos, opts = {}) => {
    const {
      labelFont = "normal",
      valueFont = "normal",
      labelColor = [100, 116, 139],
      valueColor = [15, 23, 42],
      size = 10,
    } = opts;

    doc.setFont("helvetica", labelFont);
    doc.setFontSize(size);
    doc.setTextColor(...labelColor);
    doc.text(label, margin, yPos);

    doc.setFont("helvetica", valueFont);
    doc.setTextColor(...valueColor);
    doc.text(String(value), pageWidth - margin, yPos, { align: "right" });
  };

  const drawSectionTitle = (title, yPos) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(title, margin, yPos);
  };

  const drawDivider = (yPos) => {
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(1);
    doc.line(margin, yPos, pageWidth - margin, yPos);
  };

  // Header band
  doc.setFillColor(16, 185, 129);
  doc.rect(0, 0, pageWidth, 92, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(255, 255, 255);
  doc.text("NEXUS ACADEMY", margin, 40);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Official Fee Invoice", margin, 60);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("INVOICE", pageWidth - margin, 42, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Status: ${fee.status?.toUpperCase() || "PENDING"}`, pageWidth - margin, 60, {
    align: "right",
  });

  y = 120;

  // Invoice info box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(margin, y, contentWidth, 76, 8, 8, "F");
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, y, contentWidth, 76, 8, 8, "S");

  drawTextPair("Invoice Number", invoiceId, y + 22, {
    labelFont: "bold",
    valueFont: "bold",
    size: 10,
  });
  drawTextPair("Date of Issue", dateString, y + 40, {
    size: 10,
  });
  drawTextPair("Due Date", fee.dueDate || "-", y + 58, {
    size: 10,
    valueColor: fee.dueDate ? [220, 38, 38] : [15, 23, 42],
    valueFont: fee.dueDate ? "bold" : "normal",
  });

  y += 104;

  // Student details
  drawSectionTitle("Student & Billing Information", y);
  y += 18;
  drawDivider(y);
  y += 20;

  drawTextPair("Student Name", fee.studentName || "-", y, {
    valueFont: "bold",
  });
  y += 18;

  drawTextPair(
    "Fee Category",
    FEE_TYPES.find((t) => t.value === fee.feeType)?.label ?? String(fee.feeType || "-"),
    y
  );
  y += 18;

  drawTextPair("Academic Year", fee.academicYear || "-", y);
  y += 18;

  drawTextPair("Term / Installment", fee.installmentLabel || fee.termType || "Annual", y);
  y += 18;

  if (Number(fee.concession ?? 0) > 0) {
    drawTextPair("Concession", formatMoney(Number(fee.concession)), y, {
      valueColor: [22, 163, 74],
      valueFont: "bold",
    });
    y += 18;
  }

  y += 10;

  // Fee breakdown section
  drawSectionTitle("Fee Breakdown & Tax Details", y);
  y += 18;
  drawDivider(y);
  y += 18;
// Table header
const tableX = margin;
const tableY = y;

const descriptionWidth = contentWidth * 0.65;

doc.setFillColor(241, 245, 249);
doc.rect(tableX, tableY, contentWidth, 28, "F");
doc.setDrawColor(226, 232, 240);
doc.rect(tableX, tableY, contentWidth, 28, "S");

doc.setFont("helvetica", "bold");
doc.setFontSize(10);
doc.setTextColor(51, 65, 85);

doc.text("Description", tableX + 12, tableY + 18);

doc.text(
  "Amount",
  tableX + contentWidth - 12,
  tableY + 18,
  { align: "right" }
);

const rows = [
  ["Subtotal (Taxable Amount)", subtotalFormatted],
  ["CGST (9%)", cgstFormatted],
  ["SGST (9%)", sgstFormatted],
];

let rowY = tableY + 28;

rows.forEach((row, index) => {
  const descLines = doc.splitTextToSize(
    row[0],
    descriptionWidth
  );

  const rowHeight = Math.max(
    26,
    descLines.length * 14 + 10
  );

  doc.setFillColor(
    index % 2 === 0 ? 255 : 250,
    index % 2 === 0 ? 255 : 252,
    index % 2 === 0 ? 255 : 255
  );

  doc.rect(tableX, rowY, contentWidth, rowHeight, "F");
  doc.setDrawColor(226, 232, 240);
  doc.rect(tableX, rowY, contentWidth, rowHeight, "S");

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);

  doc.text(
    descLines,
    tableX + 12,
    rowY + 17
  );

  doc.text(
    row[1],
    tableX + contentWidth - 12,
    rowY + 17,
    { align: "right" }
  );

  rowY += rowHeight;
});

// Total box
rowY += 18;

doc.setFillColor(236, 253, 245);
doc.roundedRect(
  tableX,
  rowY,
  contentWidth,
  54,
  8,
  8,
  "F"
);

doc.setDrawColor(16, 185, 129);
doc.roundedRect(
  tableX,
  rowY,
  contentWidth,
  54,
  8,
  8,
  "S"
);

const totalLabel = doc.splitTextToSize(
  "TOTAL AMOUNT DUE (Inclusive of GST)",
  contentWidth * 0.6
);

doc.setFont("helvetica", "bold");
doc.setFontSize(12);
doc.setTextColor(6, 95, 70);

doc.text(
  totalLabel,
  tableX + 12,
  rowY + 18
);

doc.setFontSize(15);

doc.text(
  amountFormatted,
  tableX + contentWidth - 12,
  rowY + 30,
  { align: "right" }
);

y = rowY + 80;


  // Footer
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, pageHeight - 48, pageWidth - margin, pageHeight - 48);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("Nexus Academy - Fee Management System", margin, pageHeight - 30);
  doc.text(`Generated on ${dateString}`, pageWidth - margin, pageHeight - 30, {
    align: "right",
  });

  doc.save(`invoice-${String(fee.studentName || "student").replace(/\s+/g, "_")}-${fee.id}.pdf`);
};


  // Fee structure state (class-wise)
  const [structureName, setStructureName] = useState("");
  const [structureClassId, setStructureClassId] = useState("");
  const [structureYear, setStructureYear] = useState("2025-26");
  const [structureComponents, setStructureComponents] = useState([
    { name: "Tuition Fee", amount: "" },
  ]);

  // Bulk assignment state
  const [selectedStructureId, setSelectedStructureId] = useState("");
  const [assignTermType, setAssignTermType] = useState("Annual");
  const [assignDueDate, setAssignDueDate] = useState("");
  const [assignClassId, setAssignClassId] = useState("");
  const [assignScope, setAssignScope] = useState("class");
  const [selectedAssignStudentIds, setSelectedAssignStudentIds] = useState([]);
  const [studentAdjustments, setStudentAdjustments] = useState({});
  const [assigningStructureBulk, setAssigningStructureBulk] = useState(false);
  const [page, setPage] = useState(1);
const [limit] = useState(20); // items per page
const [sortOrder, setSortOrder] = useState("desc"); // desc = newest first
  const params = {};
  if (filterStatus)
    params.status = filterStatus;
  const listFeesParams = {
    ...params,
    sort: "createdAt",
    order: sortOrder,
    page,
    limit,
  };
  const feeListQueryKey = getListFeesQueryKey(listFeesParams);
  // Student/parent scoping is enforced server-side. Do NOT pass
  // studentId=user.id (auth user id ≠ student row id) or parentId
  // (unsupported) — the server would 403 as out-of-scope.
  const { data: fees = [], isLoading } = useListFees(listFeesParams, {
    query: {
      queryKey: feeListQueryKey,
      staleTime: 5000,
    },
  });
  // Roster only needed by admin/accountant (create form, class apply, etc).
  const canSeeRoster = ["admin", "accountant", "clerk"].includes(user?.role ?? "");
  const { data: students = [] } = useListStudents({}, { query: { queryKey: getListStudentsQueryKey(), staleTime: 30000, enabled: canSeeRoster } });
  const { data: classes = [] } = useListClasses({ query: { queryKey: getListClassesQueryKey(), staleTime: 30000 } });
  const classStudents = filterClassId ? students.filter(s => String(s.classId) === filterClassId) : students;
  const createMutation = useCreateFee({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFeesQueryKey() });
        setOpen(false);
        setForm(defaultForm);
        toast({ title: "Fee record added" });
      },
      onError: (err) => {
        toast({ title: "Failed to add fee record", description: err?.message, variant: "destructive" });
      },
    },
  });
  const { data: feeStructures = [] } = useListFeeStructures({}, { query: { queryKey: getListFeeStructuresQueryKey(), staleTime: 30000 } });
  const selectedStructure = feeStructures.find((fs) => String(fs.id) === selectedStructureId);
  const assignClassStudents = assignClassId ? students.filter((s) => String(s.classId) === assignClassId) : [];
  const assignmentStudents = assignScope === "selected"
    ? assignClassStudents.filter((s) => selectedAssignStudentIds.includes(s.id))
    : assignClassStudents;
  const paymentHistoryQuery = useQuery({
    queryKey: ["feePayments", selectedFee?.id],
    queryFn: async () => {
      const res = await fetch(`/api/fees/${selectedFee.id}/payments`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch payment history");
      return res.json();
    },
    enabled: !!selectedFee?.id,
    staleTime: 5000,
  });

  const createStructureMutation = useCreateFeeStructure({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFeeStructuresQueryKey() });
        setStructureName("");
        setStructureClassId("");
        setStructureYear("2025-26");
        setStructureComponents([{ name: "Tuition Fee", amount: "" }]);
        toast({ title: "Fee structure created" });
      },
      onError: (err) => {
        toast({ title: "Could not create fee structure", description: err?.message, variant: "destructive" });
      },
    },
  });

  const handleCreateStructure = () => {
    const components = structureComponents
      .map((c) => ({ name: c.name.trim(), amount: parseFloat(c.amount || "0") }))
      .filter((c) => c.name && c.amount > 0);
    if (!structureName.trim() || !structureClassId || !structureYear.trim() || components.length === 0) {
      toast({ title: "Validation Error", description: "Name, class, year and at least one component are required", variant: "destructive" });
      return;
    }
    createStructureMutation.mutate({
      data: {
        name: structureName.trim(),
        classId: Number(structureClassId),
        academicYear: structureYear.trim(),
        components,
      },
    });
  };

  const toggleAssignStudent = (studentId) => {
    setSelectedAssignStudentIds((ids) => ids.includes(studentId)
      ? ids.filter((id) => id !== studentId)
      : [...ids, studentId]);
  };

  const updateStudentAdjustment = (studentId, field, value) => {
    setStudentAdjustments((current) => ({
      ...current,
      [studentId]: {
        ...(current[studentId] ?? {}),
        [field]: value,
      },
    }));
  };

  const buildStudentAdjustments = () => assignmentStudents
    .map((student) => {
      const adjustment = studentAdjustments[student.id] ?? {};
      const concession = parseFloat(adjustment.concession || "0");
      const scholarshipName = String(adjustment.scholarshipName || "").trim();
      const concessionReason = String(adjustment.concessionReason || "").trim();
      if (!concession && !scholarshipName && !concessionReason) return null;
      return {
        studentId: student.id,
        concession: Number.isFinite(concession) ? concession : 0,
        concessionType: scholarshipName ? "Scholarship" : (concession > 0 ? "Concession" : undefined),
        scholarshipName: scholarshipName || undefined,
        concessionReason: concessionReason || scholarshipName || undefined,
      };
    })
    .filter(Boolean);

  const handleAssignStructureBulk = async () => {
    if (!assignClassId || !selectedStructureId || !assignDueDate) {
      toast({ title: "Validation Error", description: "Class, Fee Structure and Due Date are required", variant: "destructive" });
      return;
    }
    if (assignScope === "selected" && assignmentStudents.length === 0) {
      toast({ title: "Validation Error", description: "Select at least one student for individual assignment", variant: "destructive" });
      return;
    }
    setAssigningStructureBulk(true);
    try {
      const selectedStudentIds = assignmentStudents.map((student) => student.id);
      const res = await fetch("/api/fees/assign-structure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classId: Number(assignClassId),
          feeStructureId: Number(selectedStructureId),
          dueDate: assignDueDate,
          termType: assignTermType,
          studentIds: assignScope === "selected" ? selectedStudentIds : undefined,
          studentAdjustments: buildStudentAdjustments(),
        }),
        credentials: "include"
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to assign structure");
      }
      const data = await res.json();
      toast({ title: "Success", description: data.message });
      qc.invalidateQueries({ queryKey: getListFeesQueryKey() });
      setAssignClassId("");
      setSelectedStructureId("");
      setAssignDueDate("");
      setAssignScope("class");
      setSelectedAssignStudentIds([]);
      setStudentAdjustments({});
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAssigningStructureBulk(false);
    }
  };

  const [runningLateFines, setRunningLateFines] = useState(false);
  const handleRunLateFineChecker = async () => {
    setRunningLateFines(true);
    try {
      const res = await fetch("/api/fees/apply-late-fines", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ rate: Number(lateFineRate) }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to run late fine checker");
      }
      const data = await res.json();
      toast({ title: "Late Fines Applied", description: data.message });
      qc.invalidateQueries({ queryKey: getListFeesQueryKey() });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRunningLateFines(false);
    }
  };

  const { data: reportsData, isLoading: isLoadingReports } = useQuery({
    queryKey: ["feeReports"],
    queryFn: async () => {
      const res = await fetch("/api/fees/reports", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch reports");
      return res.json();
    },
    enabled: isAccountant && tab === "reports"
  });
  const payMutation = usePayFee({
    mutation: {
      onSuccess: (data) => {
        qc.invalidateQueries({ queryKey: feeListQueryKey });
        qc.invalidateQueries({ queryKey: ["feePayments", data?.id] });
        const receipt = data?.receiptNumber || data?.payment?.receiptNumber || "Receipt generated";
        handleDownloadReceipt(data);
        setSelectedFee(data);
        setPayOpen(null);
        setPayReference("");
        setPayNotes("");
        setReceiptShown(receipt);
        setTimeout(() => setReceiptShown(null), 5000);
        toast({ title: "Payment confirmed", description: `Receipt: ${receipt}` });
      },
      onError: () => toast({ title: "Error", description: "Payment failed.", variant: "destructive" }),
    },
  });

  // Server already scopes fee records by session role for student/parent.
  // No client-side roster lookup or filtering is required.
  const scopedFees = fees;
  const filteredFees = scopedFees.filter((f) => filterType ? f.feeType === filterType : true);
  const totalCollected = filteredFees
    .filter((f) => f.status === "paid")
    .reduce((a, f) => a + (f.paidAmount ? Number(f.paidAmount) : Number(f.amount)), 0);
  const totalPending = filteredFees
    .reduce((sum, f) => {
      if (f.status === "pending") return sum + Number(f.amount);
      if (f.status === "partial") return sum + Number(f.balanceAmount ?? Math.max(0, Number(f.amount) - Number(f.paidAmount ?? 0)));
      return sum;
    }, 0);
  const totalOverdue = filteredFees
    .reduce((sum, f) => {
      if (f.status === "overdue") return sum + Number(f.amount);
      if (f.status === "partial" && overdueMonths(f.dueDate) > 0) return sum + Number(f.balanceAmount ?? Math.max(0, Number(f.amount) - Number(f.paidAmount ?? 0)));
      return sum;
    }, 0);
  const payingFee = fees.find((f) => f.id === payOpen);
  const payingFeeLateFines = payingFee ? getLateFinesForFee(payingFee.id) : [];
  const isPayAmountFixed = payingFeeLateFines.length > 0;
  const fixedPayAmount = payingFee ? getTotalPaymentDue(payingFee) : 0;

  
  const handleSubmitPaymentAmount = () => {
    if (isPayAmountFixed) return fixedPayAmount;
    const normalized = String(payAmount).replace(/,/g, "").trim();
    return parseFloat(normalized) || 0;
  };
  const feesByType = FEE_TYPES.map(ft => ({
    type: ft.label,
    total: fees.filter(f => f.feeType === ft.value).reduce((a, f) => a + Number(f.amount), 0),
    collected: fees.filter(f => f.feeType === ft.value && f.status === "paid").reduce((a, f) => a + Number(f.paidAmount ?? f.amount), 0),
  })).filter(x => x.total > 0);

  // === TEMPORARY DEBUG ===
useEffect(() => {
    console.log("VITE_ENV Loaded:", {
        VITE_RAZORPAY_KEY_ID: import.meta.env.VITE_RAZORPAY_KEY_ID,
        MODE: import.meta.env.MODE,
        DEV: import.meta.env.DEV,
    });
}, []);
 const handleRazorpayPayment = async () => {
    if (!payOpen) {
        toast({ title: "Error", description: "No fee selected", variant: "destructive" });
        return;
    }

    const razorpayKey = import.meta.env.VITE_RAZORPAY_KEY_ID?.trim();

    if (!razorpayKey) {
        toast({ title: "Configuration Error", description: "Razorpay key missing", variant: "destructive" });
        return;
    }

    try {
        console.log("Creating Razorpay order for fee ID:", payOpen);

        const requestedAmount = handleSubmitPaymentAmount();
        if (requestedAmount <= 0) {
            toast({ title: "Invalid Amount", description: "Enter a valid payment amount.", variant: "destructive" });
            return;
        }

        const res = await fetch(`/api/fees/${payOpen}/razorpay/order`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ 
              currency: "INR",
              amount: requestedAmount,
            }),
        });

        const orderData = await res.json();
        console.log("Order Response:", orderData);

        if (!res.ok) {
            toast({
                title: "Order Creation Failed",
                description: orderData.error || "Please try again later",
                variant: "destructive"
            });
            return;
        }

        if (!orderData.razorpayOrderId) {
            toast({ title: "Invalid Order", description: "Missing order ID from server", variant: "destructive" });
            return;
        }

        const amountInPaise = Number(orderData.amountInPaise ?? orderData.amount * 100);
        if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
            toast({ title: "Invalid Order Amount", description: "Unable to determine payment amount.", variant: "destructive" });
            return;
        }

        const options = {
            key: razorpayKey,
            amount: amountInPaise,
            currency: orderData.currency || "INR",
            name: "NEXUS ACADEMY",
            description: `Fee Payment - ${payingFee?.feeType || "School Fee"}`,
            order_id: orderData.razorpayOrderId,
            prefill: {
                name: payingFee?.studentName || "",
            },
            theme: { color: "#10b981" },
            handler: async function (response) {
                console.log("Payment Success Response:", response);

                const verifyRes = await fetch("/api/fees/razorpay/verify", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({
                        feeRecordId: payOpen,
                        razorpay_order_id: response.razorpay_order_id,
                        razorpay_payment_id: response.razorpay_payment_id,
                        razorpay_signature: response.razorpay_signature,
                    }),
                });

                const verifyData = await verifyRes.json();

                if (verifyRes.ok) {
                    qc.invalidateQueries({ queryKey: feeListQueryKey });
                    qc.invalidateQueries({ queryKey: ["feePayments", payOpen] });
                    handleDownloadReceipt(verifyData);
                    setSelectedFee(verifyData);
                    setPayOpen(null);
                    setPayAmount("");
                    setReceiptShown(verifyData.receiptNumber || "Receipt generated");
                    setTimeout(() => setReceiptShown(null), 5000);
                    toast({ title: "✅ Payment Successful!", description: `Receipt: ${verifyData.receiptNumber}` });
                } else {
                    toast({ title: "Verification Failed", description: verifyData.error, variant: "destructive" });
                }
            },
            modal: {
                ondismiss: () => toast({ title: "Payment Cancelled" }),
            },
        };

        const rzp = new window.Razorpay(options);
        rzp.open();
    } catch (err) {
        console.error("Razorpay Error:", err);
        toast({
            title: "Failed to Open Razorpay",
            description: err.message || "Please check console for details",
            variant: "destructive"
        });
    }
};
  return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-emerald-400">Fee Management</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isViewOnly
            ? "View your fee dues and payment history"
            : "Track fee collection and payments"}
        </p>
      </div>
      {isAccountant && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
            <span className="text-xs text-muted-foreground">Penalty</span>
            <Select value={lateFineRate} onValueChange={setLateFineRate}>
              <SelectTrigger className="h-9 w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0.05">5%</SelectItem>
                <SelectItem value="0.1">10%</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={runningLateFines}
            onClick={handleRunLateFineChecker}
            className="gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20"
          >
            <Clock className="w-4 h-4" />
            {runningLateFines ? "Applying..." : "Run Late Fine Checker"}
          </Button>
          {tab === "records" && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20">
                  <Plus className="w-4 h-4" />
                  Add Fee Record
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add Fee Record</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <Label>Filter by Class</Label>
                    <Select value={filterClassId || "all"} onValueChange={(v) => setFilterClassId(v === "all" ? "" : v)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="All classes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Classes</SelectItem>
                        {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>
                          {c.name}
                        </SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Student *</Label>
                    <Select value={form.studentId} onValueChange={(v) => setForm((f) => ({ ...f, studentId: v }))}>
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select student" />
                      </SelectTrigger>
                      <SelectContent>
                        {classStudents.map((s) => (<SelectItem key={s.id} value={String(s.id)}>
                          {s.name} ({s.rollNumber})
                        </SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Fee Type *</Label>
                      <Select value={form.feeType} onValueChange={(v) => setForm((f) => ({ ...f, feeType: v }))}>
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FEE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Term</Label>
                      <Select value={form.termType} onValueChange={v => setForm(f => ({ ...f, termType: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="annual">Annual</SelectItem>
                          <SelectItem value="term-wise">Term-wise</SelectItem>
                          <SelectItem value="term1">Term 1</SelectItem>
                          <SelectItem value="term2">Term 2</SelectItem>
                          <SelectItem value="term3">Term 3</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Amount (₹) *</Label>
                      <input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="0" />
                    </div>
                    <div>
                      <Label>Concession (₹)</Label>
                      <input type="number" value={form.concession} onChange={(e) => setForm((f) => ({ ...f, concession: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" placeholder="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Due Date</Label>
                      <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" />
                    </div>
                    <div>
                      <Label>Academic Year</Label>
                      <input value={form.academicYear} onChange={(e) => setForm((f) => ({ ...f, academicYear: e.target.value }))} className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background" />
                    </div>
                  </div>
                  {form.amount && (<div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Net payable</p>
                    <p className="text-lg font-bold text-emerald-400">
                      {formatCurrency(Math.max(0, parseFloat(form.amount || "0") -
                        parseFloat(form.concession || "0")))}
                    </p>
                  </div>)}
                  <Button className="w-full" disabled={!form.studentId || !form.amount || createMutation.isPending} onClick={() => createMutation.mutate({
                    data: {
                      studentId: parseInt(form.studentId),
                      feeType: form.feeType,
                      grossAmount: parseFloat(form.amount),
                      amount: parseFloat(form.amount),
                      concession: parseFloat(form.concession || "0"),
                      concessionType: parseFloat(form.concession || "0") > 0 ? "Concession" : undefined,
                      concessionReason: parseFloat(form.concession || "0") > 0 ? "Manual concession" : undefined,
                      termType: form.termType,
                      dueDate: form.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
                      academicYear: form.academicYear,
                    },
                  })}>
                    {createMutation.isPending ? "Saving..." : "Add Fee Record"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      )}
    </div>

    {/* Tab switcher for admin */}
    {isAccountant && (<div className="flex gap-2">
      <Button variant={tab === "records" ? "default" : "outline"} size="sm" onClick={() => setTab("records")}>
        <Receipt className="w-3.5 h-3.5 mr-1.5" />Fee Records
      </Button>
      <Button variant={tab === "structure" ? "default" : "outline"} size="sm" onClick={() => setTab("structure")}>
        <Building2 className="w-3.5 h-3.5 mr-1.5" />Fee Structure
      </Button>
      <Button variant={tab === "reports" ? "default" : "outline"} size="sm" onClick={() => setTab("reports")}>
        <FileText className="w-3.5 h-3.5 mr-1.5" />Financial Reports
      </Button>
    </div>)}

    {/* Fee Structure Tab */}
    {tab === "structure" && isAccountant && (<div className="space-y-6">
      <Card className="glass-card border-t-2 border-t-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Define Fee Structure
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label>Structure Name *</Label>
              <Input className="mt-1" value={structureName} onChange={(e) => setStructureName(e.target.value)} placeholder="Class 10 Annual Fees" />
            </div>
            <div>
              <Label>Class *</Label>
              <Select value={structureClassId} onValueChange={setStructureClassId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Academic Year *</Label>
              <Input className="mt-1" value={structureYear} onChange={(e) => setStructureYear(e.target.value)} />
            </div>
          </div>
          <div className="space-y-3">
            {structureComponents.map((component, index) => (
              <div key={index} className="grid grid-cols-[1fr_140px_36px] gap-2 items-end">
                <div>
                  <Label>{index === 0 ? "Component" : " "}</Label>
                  <Input className="mt-1" value={component.name} onChange={(e) => setStructureComponents((items) => items.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} placeholder="Tuition Fee" />
                </div>
                <div>
                  <Label>{index === 0 ? "Amount" : " "}</Label>
                  <Input type="number" className="mt-1" value={component.amount} onChange={(e) => setStructureComponents((items) => items.map((item, i) => i === index ? { ...item, amount: e.target.value } : item))} placeholder="0" />
                </div>
                <Button type="button" size="icon" variant="ghost" disabled={structureComponents.length === 1} onClick={() => setStructureComponents((items) => items.filter((_, i) => i !== index))}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="gap-2" onClick={() => setStructureComponents((items) => [...items, { name: "", amount: "" }])}>
              <Plus className="w-4 h-4" />Add Component
            </Button>
            <Button className="gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20" disabled={createStructureMutation.isPending} onClick={handleCreateStructure}>
              <Building2 className="w-4 h-4" />{createStructureMutation.isPending ? "Saving..." : "Save Structure"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card border-t-2 border-t-emerald-500/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-400" />
            Bulk Assign Fee Structure
          </CardTitle>
          <p className="text-sm text-muted-foreground">Assign a complete Fee Structure to all students in a class at once.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <Label>Target Class *</Label>
              <Select value={assignClassId} onValueChange={(value) => { setAssignClassId(value); setSelectedStructureId(""); setSelectedAssignStudentIds([]); setStudentAdjustments({}); }}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Fee Structure *</Label>
              <Select value={selectedStructureId} onValueChange={setSelectedStructureId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select structure" /></SelectTrigger>
                <SelectContent>
                  {feeStructures
                    .filter((fs) => !assignClassId || String(fs.classId) === assignClassId)
                    .map((fs) => (<SelectItem key={fs.id} value={String(fs.id)}>{fs.name} ({fs.academicYear})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>First Due Date *</Label>
              <Input type="date" className="mt-1" value={assignDueDate} onChange={(e) => setAssignDueDate(e.target.value)} />
            </div>
            <div>
              <Label>Term Type</Label>
              <Select value={assignTermType} onValueChange={setAssignTermType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Annual">Annual</SelectItem>
                  <SelectItem value="Term-wise">Term-wise</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                  <SelectItem value="Term 1">Term 1</SelectItem>
                  <SelectItem value="Term 2">Term 2</SelectItem>
                  <SelectItem value="Term 3">Term 3</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {assignClassId && (
            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/20 p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <Label>Assignment Scope</Label>
                  <p className="text-xs text-muted-foreground mt-1">{assignClassStudents.length} students available in this class</p>
                </div>
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant={assignScope === "class" ? "default" : "outline"} onClick={() => setAssignScope("class")}>
                    Full Class
                  </Button>
                  <Button type="button" size="sm" variant={assignScope === "selected" ? "default" : "outline"} onClick={() => setAssignScope("selected")}>
                    Selected Students
                  </Button>
                </div>
              </div>

              {assignScope === "selected" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {assignClassStudents.map((student) => (
                    <label key={student.id} className="flex items-center gap-2 rounded-md border border-border/50 bg-background/50 px-3 py-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedAssignStudentIds.includes(student.id)}
                        onChange={() => toggleAssignStudent(student.id)}
                      />
                      <span className="min-w-0 truncate">{student.name} ({student.rollNumber})</span>
                    </label>
                  ))}
                </div>
              )}

              {assignmentStudents.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Student-wise Scholarship / Concession</Label>
                    <Badge variant="outline" className="text-xs">{assignmentStudents.length} planned</Badge>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead className="w-32">Concession</TableHead>
                          <TableHead className="w-44">Scholarship</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {assignmentStudents.map((student) => {
                          const adjustment = studentAdjustments[student.id] ?? {};
                          return (
                            <TableRow key={student.id}>
                              <TableCell className="text-sm font-medium">{student.name}</TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  value={adjustment.concession ?? ""}
                                  onChange={(e) => updateStudentAdjustment(student.id, "concession", e.target.value)}
                                  placeholder="0"
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={adjustment.scholarshipName ?? ""}
                                  onChange={(e) => updateStudentAdjustment(student.id, "scholarshipName", e.target.value)}
                                  placeholder="Name"
                                  className="h-8"
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={adjustment.concessionReason ?? ""}
                                  onChange={(e) => updateStudentAdjustment(student.id, "concessionReason", e.target.value)}
                                  placeholder="Reason"
                                  className="h-8"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {assignClassId && selectedStructureId && (
            <div className="rounded-lg bg-muted/40 px-4 py-3 text-sm">
              <p className="font-medium mb-1">Fee Plan Preview</p>
              <p className="text-muted-foreground">
                Assigning fee structure <strong>{selectedStructure?.name}</strong>
                {" "}to <strong>{assignmentStudents.length}</strong> student{assignmentStudents.length === 1 ? "" : "s"} in class <strong>{classes.find(c => String(c.id) === assignClassId)?.name}</strong>.
              </p>
              {assignTermType === "Monthly" && <p className="text-xs text-muted-foreground mt-1">Monthly setup will generate 12 installment records from the first due date.</p>}
              {assignTermType === "Term-wise" && <p className="text-xs text-muted-foreground mt-1">Term-wise setup will generate Term 1, Term 2 and Term 3 records from the first due date.</p>}
              {selectedStructure && <p className="text-xs text-muted-foreground mt-1">Gross structure total: {formatCurrency(Number(selectedStructure.totalAmount ?? 0))}</p>}
            </div>
          )}

          <Button
            className="gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
            disabled={!assignClassId || !selectedStructureId || !assignDueDate || (assignScope === "selected" && assignmentStudents.length === 0) || assigningStructureBulk}
            onClick={handleAssignStructureBulk}
          >
            {assigningStructureBulk ? "Assigning..." : (
              <>
                <Plus className="w-4 h-4" />
                Generate Fee Plan
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>)}

    {tab === "records" && (<>
      {/* Parent/Student banner removed — roster lookup is no longer fetched
                on the client for these roles since fees are server-scoped. */}
      {(isStudent || isParent) && (<Card className="border-emerald-500/20 bg-emerald-500/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="p-2 rounded-full bg-emerald-500/10">
            <User className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="font-medium">{isStudent ? "Your fees" : "Your children's fees"}</p>
            <p className="text-sm text-muted-foreground">
              {scopedFees.length} record{scopedFees.length === 1 ? "" : "s"}
            </p>
          </div>
        </CardContent>
      </Card>)}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400"><CheckCircle className="w-4 h-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Collected</p>
              <p className="text-2xl font-bold text-emerald-400">
                {formatCurrency(totalCollected)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400"><Clock className="w-4 h-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-2xl font-bold text-amber-400">
                {formatCurrency(totalPending)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="glass-card glass-hover border-t-2 border-t-red-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-red-500/10 text-red-400"><AlertCircle className="w-4 h-4" /></div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Overdue</p>
              <p className="text-2xl font-bold text-red-400">
                {formatCurrency(totalOverdue)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterStatus || "all"} onValueChange={(v) => setFilterStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => (<SelectItem key={k} value={k}>
              {v.label}
            </SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterType || "all"} onValueChange={(v) => setFilterType(v === "all" ? "" : v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {FEE_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>
              {t.label}
            </SelectItem>))}
          </SelectContent>
        </Select>
        {(filterStatus || filterType) && (<Button variant="outline" onClick={() => {
          setFilterStatus("");
          setFilterType("");
        }}>
          Clear
        </Button>)}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
  <div className="flex items-center gap-3">
    <Select value={sortOrder} onValueChange={setSortOrder}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="desc">Newest First</SelectItem>
        <SelectItem value="asc">Oldest First</SelectItem>
      </SelectContent>
    </Select>
  </div>

  <div className="flex items-center gap-2">
    <Button 
      variant="outline" 
      size="sm"
      disabled={page === 1}
      onClick={() => setPage(p => p - 1)}
    >
      Previous
    </Button>
    <span className="text-sm text-muted-foreground px-3">
      Page {page}
    </span>
    <Button 
      variant="outline" 
      size="sm"
      onClick={() => setPage(p => p + 1)}
    >
      Next
    </Button>
  </div>
</div>

      {/* Fee records table */}
      <Card className="glass-card border-t-2 border-t-emerald-400/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-400" />
            Fee Records
            <Badge className="ml-auto text-xs">{filteredFees.length} records</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {isLoading ? (<div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (<Skeleton key={i} className="h-14 w-full" />))}
          </div>) : filteredFees.length === 0 ? (<div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-3">
            <Wallet className="w-10 h-10 opacity-30" />
            <p>No fee records found.</p>
          </div>) : (<div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {!isStudent && <TableHead>Student</TableHead>}
                  <TableHead>Fee Type</TableHead>
                  <TableHead>Academic Year</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFees.map((fee) => {
                  const cfg = statusConfig[fee.status] ??
                    statusConfig.pending;
                  const Icon = cfg.icon;
                  const isSelected = selectedFee?.id === fee.id;
                  return (<TableRow key={fee.id} className={`cursor-pointer hover:bg-emerald-500/5 transition-colors border-border/40 group ${isSelected ? "bg-emerald-500/8 border-l-2 border-l-emerald-400" : ""}`} onClick={() => setSelectedFee(isSelected ? null : fee)}>
                    {!isStudent && (<TableCell className="font-medium text-sm group-hover:text-emerald-400 transition-colors">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6 shrink-0">
                          <AvatarImage src={fee.studentAvatarUrl} />
                          <AvatarFallback className="text-[10px] bg-muted">{fee.studentName?.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <span>{fee.studentName}</span>
                      </div>
                    </TableCell>)}
                    <TableCell>
                      <Badge className="text-xs capitalize bg-muted text-muted-foreground border-0">
                        {fee.feeType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fee.academicYear}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {fee.dueDate || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div>
                        <p className="font-semibold text-sm">
                          {formatCurrency(Number(fee.amount))}
                        </p>
                        {fee.paidAmount ? (
                          <p className="text-xs text-muted-foreground">
                            Paid: {formatCurrency(Number(fee.paidAmount))}
                          </p>
                        ) : null}
                        {fee.status === "partial" && (
                          <p className="text-xs text-muted-foreground">
                            Remaining : {formatCurrency(Number(fee.balanceAmount ?? Math.max(0, Number(fee.amount) - Number(fee.paidAmount ?? 0))))}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Icon className={`w-3.5 h-3.5 ${cfg.color.split(" ")[1]}`} />
                        <Badge className={`text-xs border ${cfg.color}`}>
                          {cfg.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className={`h-7 w-7 ${isSelected ? "bg-emerald-500/15 text-emerald-400" : "hover:bg-emerald-500/10 hover:text-emerald-400"}`} onClick={() => setSelectedFee(isSelected ? null : fee)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {(isAccountant || isParent) && fee.status !== "paid" && (<Button size="sm" variant="outline" className="text-xs h-7 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10" onClick={() => { setPayOpen(fee.id); setPayAmount(String(getTotalPaymentDue(fee))); setPayReference(""); setPayNotes(""); }}>
                          Pay
                        </Button>)}
                      </div>
                    </TableCell>
                  </TableRow>);
                })}
              </TableBody>
            </Table>
          </div>)}
        </CardContent>
      </Card>
      {selectedFee && (<Card className="glass-card border-t-2 border-t-emerald-400/30 animate-in fade-in slide-in-from-bottom-2 duration-200">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base">{selectedFee.studentName}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">{FEE_TYPES.find(t => t.value === selectedFee.feeType)?.label ?? selectedFee.feeType} · {selectedFee.academicYear}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => setSelectedFee(null)}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4">
            <div><span className="text-xs text-muted-foreground block">Total Amount</span><p className="font-bold text-lg text-emerald-400">{formatCurrency(Number(selectedFee.amount))}</p></div>
            <div><span className="text-xs text-muted-foreground block">Paid</span><p className="font-semibold">{formatCurrency(Number(selectedFee.paidAmount ?? 0))}</p></div>
            <div><span className="text-xs text-muted-foreground block">Remaining</span><p className={`font-semibold ${Number(selectedFee.balanceAmount ?? selectedFee.amount) > 0 ? "text-red-400" : "text-emerald-400"}`}>{formatCurrency(Number(selectedFee.balanceAmount ?? selectedFee.amount))}</p></div>
            <div><span className="text-xs text-muted-foreground block">Due Date</span><p className="font-medium">{selectedFee.dueDate || "—"}</p></div>
          </div>
          {selectedFee.status !== "paid" && overdueMonths(selectedFee.dueDate) > 0 && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3 mb-4">
              <p className="text-xs text-red-500 uppercase tracking-[0.15em]">Overdue Penalty Estimate</p>
              <p className="mt-2 text-sm text-red-700">Due date passed by {overdueMonths(selectedFee.dueDate)} month(s).</p>
              <p className="mt-1 font-semibold text-red-600">Estimated late penalty: {formatCurrency(estimatedLatePenalty(selectedFee))}</p>
            </div>
          )}
          {(Number(selectedFee.concession ?? 0) > 0 || selectedFee.termType || selectedFee.installmentLabel) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm mb-4 rounded-lg bg-muted/30 p-3">
              <div><span className="text-xs text-muted-foreground block">Gross</span><p className="font-medium">{formatCurrency(Number(selectedFee.grossAmount ?? selectedFee.amount))}</p></div>
              <div><span className="text-xs text-muted-foreground block">Concession</span><p className="font-medium">{formatCurrency(Number(selectedFee.concession ?? 0))}</p></div>
              <div><span className="text-xs text-muted-foreground block">Term</span><p className="font-medium">{selectedFee.termType || "Annual"}</p></div>
              <div><span className="text-xs text-muted-foreground block">Installment</span><p className="font-medium">{selectedFee.installmentLabel || selectedFee.termType || "Annual"}</p></div>
              {(selectedFee.concessionType || selectedFee.concessionReason) && (
                <div className="col-span-2 sm:col-span-4">
                  <span className="text-xs text-muted-foreground block">Concession Details</span>
                  <p className="font-medium">{[selectedFee.concessionType, selectedFee.concessionReason].filter(Boolean).join(" - ")}</p>
                </div>
              )}
            </div>
          )}
          <div className="mb-4 rounded-lg border border-border/50">
            <div className="flex items-center gap-2 border-b border-border/50 px-3 py-2 text-sm font-medium">
              <History className="w-4 h-4 text-emerald-400" />
              Payment History
            </div>
            {paymentHistoryQuery.isLoading ? (
              <div className="p-3 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (paymentHistoryQuery.data ?? []).length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">No payments recorded for this fee yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Receipt</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(paymentHistoryQuery.data ?? []).map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-mono text-xs">{payment.receiptNumber}</TableCell>
                        <TableCell className="capitalize text-sm">{payment.paymentMethod}{payment.transactionReference ? ` / ${payment.transactionReference}` : ""}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{payment.paidAt ? new Date(payment.paidAt).toLocaleDateString("en-IN") : "—"}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(Number(payment.amount))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-3 border-t border-border/50">
            {(() => {
              const cfg = statusConfig[selectedFee.status] ?? statusConfig.pending;
              const Icon = cfg.icon;
              return <Badge className={`text-xs border ${cfg.color} flex items-center gap-1`}><Icon className="w-3 h-3" />{cfg.label}</Badge>;
            })()}
            {isAccountant && selectedFee.status !== "paid" && (<Button size="sm" className="gap-1.5 text-xs bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30" onClick={() => { setPayOpen(selectedFee.id); setPayAmount(String(getTotalPaymentDue(selectedFee))); setPayReference(""); setPayNotes(""); }}>
              <CreditCard className="w-3.5 h-3.5" />Collect Payment
            </Button>)}
            {selectedFee.status === "paid" ? (
              <>
                <Button size="sm" className="gap-1.5 text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20" onClick={() => handlePrintReceipt(selectedFee)}>
                  <Printer className="w-3.5 h-3.5" />Print Receipt
                </Button>
                <Button size="sm" className="gap-1.5 text-xs bg-teal-500/10 text-teal-400 border border-teal-500/30 hover:bg-teal-500/20" onClick={() => handleDownloadReceipt(selectedFee)}>
                  <Download className="w-3.5 h-3.5" />Download Receipt
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" className="gap-1.5 text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20" onClick={() => handlePrintInvoice(selectedFee)}>
                  <Printer className="w-3.5 h-3.5" />Print Invoice
                </Button>
                <Button size="sm" className="gap-1.5 text-xs bg-orange-500/10 text-orange-400 border border-orange-500/30 hover:bg-orange-500/20" onClick={() => handleDownloadInvoice(selectedFee)}>
                  <Download className="w-3.5 h-3.5" />Download Invoice
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>)}

      {receiptShown && (<div className="fixed bottom-4 right-4 z-50 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl p-4 shadow-xl flex items-center gap-3 animate-in slide-in-from-bottom-4">
        <Receipt className="w-5 h-5" />
        <div><p className="font-semibold text-sm">Payment Confirmed</p><p className="text-xs">{receiptShown}</p></div>
      </div>)}

      {/* Payment dialog */}
      <Dialog open={payOpen !== null} onOpenChange={() => setPayOpen(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {payingFee && (
              <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-2">
                <p className="font-medium">{payingFee.studentName}</p>
                <p className="text-muted-foreground text-xs capitalize">
                  {payingFee.feeType} · Due {payingFee.dueDate || "—"}
                </p>
                <div className="space-y-1.5 pt-2 border-t border-muted-foreground/20">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Due:</span>
                    <span className="font-semibold">
                      {formatCurrency(getTotalPaymentDue(payingFee))}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Amount Input for Razorpay */}
            {(isAccountant || isParent) && payingFee && (
              <div>
                <Label>Amount to Pay (₹)</Label>
                <Input
                  type="number"
                  value={payAmount}
                  readOnly={isPayAmountFixed}
                  onChange={(e) =>
                    !isPayAmountFixed && setPayAmount(e.target.value)
                  }
                  className="mt-1"
                />
                {isPayAmountFixed && (
                  <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
                    <span>🔒</span> Amount is fixed (includes late fee penalties for overdue payment)
                  </p>
                )}
                {!isPayAmountFixed && (
                  <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
                    <span>✏️</span> You can edit this amount for partial or full payment
                  </p>
                )}
              </div>
            )}

            {/* Razorpay Button */}
            {/* Razorpay Button */}
            {(isAccountant || isParent) && payingFee && (
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700 text-white gap-2"
                onClick={handleRazorpayPayment}
              >
                <CreditCard className="w-4 h-4" />
                Pay Online with Razorpay
              </Button>
            )}

            {isAccountant && (
    <>
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            OR
          </span>
        </div>
      </div>

      <div className="space-y-4">

        {/* Amount */}
        <div>
          <Label>Amount (₹)</Label>
          <Input
            type="number"
            value={payAmount}
            readOnly={isPayAmountFixed}
            onChange={(e) =>
              !isPayAmountFixed && setPayAmount(e.target.value)
            }
          />
          {isPayAmountFixed && (
            <p className="text-xs text-amber-400 mt-1.5 flex items-center gap-1">
              <span>🔒</span> Amount is fixed (includes late fee penalties for overdue payment)
            </p>
          )}
          {!isPayAmountFixed && (
            <p className="text-xs text-emerald-400 mt-1.5 flex items-center gap-1">
              <span>✏️</span> You can edit this amount for partial or full payment
            </p>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <Label>Payment Method</Label>
          <Select value={payMethod} onValueChange={setPayMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Transaction Reference */}
        {payMethod !== "cash" && (
          <div>
            <Label>Transaction Reference</Label>
            <Input
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              placeholder="UPI Ref / Card Auth ID"
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <Label>Notes</Label>
          <Input
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder="Optional remarks"
          />
        </div>

        {/* Manual Payment Submit */}
        <Button
          className="w-full"
          variant="outline"
          disabled={payMutation.isPending}
          onClick={() =>
            payMutation.mutate({
              id: payOpen,
              data: {
                amount: handleSubmitPaymentAmount(),
                paymentMethod: payMethod,
                transactionReference:
                  payReference || undefined,
                notes: payNotes || undefined,
              },
            })
          }
        >
          Record Manual Payment
        </Button>

      </div>
    </>
  )}
          </div>
        </DialogContent>
      </Dialog>
    </>)}

    {/* Financial Reports Tab */}
    {tab === "reports" && isAccountant && (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
        {isLoadingReports ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : reportsData ? (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <Card className="glass-card border-t-2 border-t-blue-500/40">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Invoiced (Generated)</p>
                  <p className="text-2xl font-bold text-blue-400">
                    {formatCurrency(reportsData.summary.totalGenerated)}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card border-t-2 border-t-emerald-500/40">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Collected</p>
                  <p className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(reportsData.summary.totalCollected)}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card border-t-2 border-t-red-500/40">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Overdue</p>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(reportsData.summary.totalOverdue)}
                  </p>
                </CardContent>
              </Card>
              <Card className="glass-card border-t-2 border-t-purple-500/40">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground mb-1">Collection Rate</p>
                  <p className="text-2xl font-bold text-purple-400">
                    {reportsData.summary.collectionRate.toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Progress Bar Card */}
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Collection Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-emerald-500 to-teal-400 h-full transition-all duration-500"
                    style={{ width: `${Math.min(100, reportsData.summary.collectionRate)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-2 text-muted-foreground">
                  <span>Collected: {formatCurrency(reportsData.summary.totalCollected)}</span>
                  <span>Target: {formatCurrency(reportsData.summary.totalGenerated)}</span>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Category Breakdown */}
              <Card className="glass-card border-t-2 border-t-emerald-400/30">
                <CardHeader>
                  <CardTitle className="text-base">Breakdown by Category</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Category</TableHead>
                          <TableHead className="text-right">Generated</TableHead>
                          <TableHead className="text-right">Collected</TableHead>
                          <TableHead className="text-right">Overdue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportsData.categoryBreakdown.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium capitalize">{row.category}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.generated)}</TableCell>
                            <TableCell className="text-right text-emerald-400">{formatCurrency(row.collected)}</TableCell>
                            <TableCell className="text-right text-red-400">{formatCurrency(row.overdue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Class Breakdown */}
              <Card className="glass-card border-t-2 border-t-emerald-400/30">
                <CardHeader>
                  <CardTitle className="text-base">Receivables by Class</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Class</TableHead>
                          <TableHead className="text-right">Generated</TableHead>
                          <TableHead className="text-right">Collected</TableHead>
                          <TableHead className="text-right">Overdue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportsData.classBreakdown.map((row, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{row.className}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.generated)}</TableCell>
                            <TableCell className="text-right text-emerald-400">{formatCurrency(row.collected)}</TableCell>
                            <TableCell className="text-right text-red-400">{formatCurrency(row.overdue)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        ) : (
          <div className="text-center py-12 text-muted-foreground">No report data available.</div>
        )}
      </div>
    )}
  </div>);
}
