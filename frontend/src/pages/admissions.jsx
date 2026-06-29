import { useState, useEffect } from "react";
import { useListAdmissions, useCreateAdmission, useUpdateAdmission, useListFees, useListClasses, getListAdmissionsQueryKey, getListFeesQueryKey, } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, UserCheck, UserX, Clock, Upload, FileSearch, CheckCircle, X, Eye, Phone, Mail, Printer, CreditCard, Download, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

async function fetchJson(url, init) {
  const res = await fetch(url, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(body?.error ?? `Request failed (${res.status})`);
  return body;
}




// purchase
const validatePurchaseForm = (form) => {
  const errors = [];
  
  if (!form.applicantName || !/^[A-Za-z\s]{2,50}$/.test(form.applicantName)) {
    errors.push("Applicant name must contain only letters and spaces (2-50 characters)");
  }
  
  if (!form.applyingForClass) {
    errors.push("Please select a class");
  }
  
  if (!form.parentName || !/^[A-Za-z\s]{2,50}$/.test(form.parentName)) {
    errors.push("Parent name must contain only letters and spaces (2-50 characters)");
  }
  
  if (!form.parentPhone || !/^[6-9]\d{9}$/.test(form.parentPhone)) {
    errors.push("Phone number must start with 6,7,8,9 and be exactly 10 digits");
  }
  
  if (!form.parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,4}$/.test(form.parentEmail)) {
    errors.push("Please enter a valid email address (e.g., name@domain.com)");
  }
  
  return errors;
};










// 

const statusColors = {
  pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  waitlisted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  enrolled: "bg-violet-500/10 text-violet-400 border-violet-500/20",
};
const CLASSES = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const todayDate = () => new Date().toISOString().split("T")[0];
const classLabel = (value) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "Class";
  if (["lkg", "ukg"].includes(raw.toLowerCase())) return raw.toUpperCase();
  return raw.toLowerCase().startsWith("class") ? raw : `Class ${raw}`;
};
const classGrade = (value) => {
  const raw = String(value ?? "").trim().replace(/^class\s+/i, "");
  if (["lkg", "ukg"].includes(raw.toLowerCase())) return raw.toUpperCase();
  return raw.match(/\d+/)?.[0] ?? "";
};
const ageRangeForClass = (value) => {
  const grade = classGrade(value);
  if (grade === "LKG") return { min: 3, max: 4 };
  if (grade === "UKG") return { min: 4, max: 5 };
  const n = Number(grade);
  if (!Number.isFinite(n)) return null;
  return { min: n + 4, max: n + 5 };
};
const getAge = (dateOfBirth) => {
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const beforeBirthday = now.getMonth() < dob.getMonth() || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate());
  if (beforeBirthday) age -= 1;
  return age;
};
const sanitizePhone = (value) => String(value ?? "").replace(/\D/g, "").slice(0, 10);
const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(value ?? "").trim());
const isValidPhone = (value) => /^[6-9]\d{9}$/.test(String(value ?? ""));
const contactValidation = ({ parentEmail, parentPhone }) => {
  if (parentEmail && !isValidEmail(parentEmail)) return "Enter a valid email address with a domain, for example name@example.com.";
  if (parentPhone && !isValidPhone(parentPhone)) return "Phone number must start with 6, 7, 8, or 9 and contain exactly 10 digits.";
  return "";
};
const dobValidationMessage = (dateOfBirth, applyingForClass) => {
  if (!dateOfBirth || !applyingForClass) return "";
  if (dateOfBirth > todayDate()) return "Future dates are not allowed for date of birth.";
  const range = ageRangeForClass(applyingForClass);
  const age = getAge(dateOfBirth);
  if (!range || age === null) return "";
  if (age < range.min || age > range.max) {
    return `${classLabel(applyingForClass)} applicants must be ${range.min}-${range.max} years old.`;
  }
  return "";
};
const parseDocs = (value) => {
  if (!value) return [];
  try {
    const docs = JSON.parse(value);
    return Array.isArray(docs) ? docs : [];
  } catch {
    return [];
  }
};
const readFilesAsDocs = (files, replacementFor) => Promise.all(
  Array.from(files || []).map((file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      id: `${Date.now()}-${file.name}`,
      name: file.name,
      type: file.type,
      docType: file.name,
      dataUrl: String(reader.result),
      status: "pending",
      remarks: "",
      ...(replacementFor ? { replacementFor } : {}),
    });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  }))
);
const defaultForm = {
  applicantName: "",
  dateOfBirth: "",
  gender: "Male",
  applyingForClass: "",
  previousSchool: "",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  address: "",
  documents: "",
};
const defaultInquiryForm = {
  applicantName: "",
  applyingForClass: "",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  message: "",
  source: "Website",
};
const defaultPurchaseForm = {
  applicantName: "",
  applyingForClass: "",
  parentName: "",
  parentEmail: "",
  parentPhone: "",
  mode: "online",
  paymentMethod: "upi",
  amount: "500",
  transactionId: "",
};
export default function Admissions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState("applications");
  const [open, setOpen] = useState(false);
  const [openInquiry, setOpenInquiry] = useState(false);
  const [openPurchase, setOpenPurchase] = useState(false);
  const [filter, setFilter] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [inquiryForm, setInquiryForm] = useState(defaultInquiryForm);
  const [purchaseForm, setPurchaseForm] = useState(defaultPurchaseForm);
  const [selectedAdmission, setSelectedAdmission] = useState(null);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [meritOnly, setMeritOnly] = useState(false);
  const [enrollingAdmission, setEnrollingAdmission] = useState(null);
  const [enrolledCredentials, setEnrolledCredentials] = useState(null);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [testDrafts, setTestDrafts] = useState({});
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const PAGE_SIZE = 5;
  const [applicationPage, setApplicationPage] = useState(1);
  const [purchasePage, setPurchasePage] = useState(1);
  const [inquiryPage, setInquiryPage] = useState(1);

  useEffect(() => {
    const saved = localStorage.getItem("admission_form_draft");
    if (saved) {
      try {
        setForm(JSON.parse(saved));
      } catch (e) {
        console.error("Draft parsing failed", e);
      }
    }
  }, []);

  useEffect(() => {
    if (form && (form.applicantName || form.applyingForClass || form.parentName || form.parentEmail || form.parentPhone)) {
      localStorage.setItem("admission_form_draft", JSON.stringify(form));
    }
  }, [form]);

  const params = {};
  if (filter)
    params.status = filter;

  // Server scopes by role (parents see only their own); no client-side filter needed.
  const { data: admissions = [], isLoading } = useListAdmissions(params, {
    query: { queryKey: getListAdmissionsQueryKey(params), staleTime: 10000 },
  });

  const filteredAdmissions = meritOnly
    ? admissions.filter((a) => a.meritListIncluded === "yes").sort((a, b) => parseInt(a.meritRank || "9999") - parseInt(b.meritRank || "9999"))
    : admissions;
  const applicationTotalPages = Math.max(1, Math.ceil(filteredAdmissions.length / PAGE_SIZE));
  const safeApplicationPage = Math.min(applicationPage, applicationTotalPages);
  const pagedAdmissions = filteredAdmissions.slice((safeApplicationPage - 1) * PAGE_SIZE, safeApplicationPage * PAGE_SIZE);

  const inquiriesQuery = useQuery({
    queryKey: ["admissions", "inquiries"],
    queryFn: () => fetchJson("/api/admissions/inquiries"),
    staleTime: 10000,
  });
  const purchasesQuery = useQuery({
    queryKey: ["admissions", "form-purchases"],
    queryFn: () => fetchJson("/api/admissions/form-purchases"),
    staleTime: 10000,
  });
  const inquiries = inquiriesQuery.data ?? [];
  const purchases = purchasesQuery.data ?? [];
  const purchaseTotalPages = Math.max(1, Math.ceil(purchases.length / PAGE_SIZE));
  const safePurchasePage = Math.min(purchasePage, purchaseTotalPages);
  const pagedPurchases = purchases.slice((safePurchasePage - 1) * PAGE_SIZE, safePurchasePage * PAGE_SIZE);
  const inquiryTotalPages = Math.max(1, Math.ceil(inquiries.length / PAGE_SIZE));
  const safeInquiryPage = Math.min(inquiryPage, inquiryTotalPages);
  const pagedInquiries = inquiries.slice((safeInquiryPage - 1) * PAGE_SIZE, safeInquiryPage * PAGE_SIZE);

  const { toast } = useToast();
  const isAdminRole = user?.role === "admin";
  const { data: allFees = [], isLoading: feesLoading } = useListFees({}, { query: { queryKey: getListFeesQueryKey(), staleTime: 10000, enabled: isAdminRole } });
  const { data: classes = [] } = useListClasses({ query: { enabled: isAdminRole } });
  const admissionFeeIds = new Set(allFees
    .filter((f) => f.feeType === "admission" && typeof f.studentId === "number" && f.studentId < 0)
    .map((f) => -f.studentId));
  const getMatchedClass = (admission) => {
    const grade = classGrade(admission?.applyingForClass);
    return classes.find((c) => String(c.grade) === grade) ?? null;
  };
  const hasUnverifiedDocs = (admission) => parseDocs(admission?.documents).some((d) => (d.status || "pending") !== "verified");
  const getTestDraft = (admission) => ({
    testStatus: admission.testStatus || "not_assigned",
    testDate: admission.testDate || "",
    testScore: admission.testScore || "",
    interviewScore: admission.interviewScore || "",
    meritListIncluded: admission.meritListIncluded || "no",
    meritRank: admission.meritRank || "",
    ...(testDrafts[admission.id] ?? {}),
  });

  useEffect(() => {
    setApplicationPage(1);
  }, [filter, meritOnly, admissions.length]);

  useEffect(() => {
    setPurchasePage(1);
  }, [purchases.length]);

  useEffect(() => {
    setInquiryPage(1);
  }, [inquiries.length]);
  const setTestDraftValue = (id, field, value) => {
    setTestDrafts((drafts) => ({
      ...drafts,
      [id]: {
        ...(drafts[id] ?? {}),
        [field]: value,
      },
    }));
  };
  const formDobError = dobValidationMessage(form.dateOfBirth, form.applyingForClass);
  const formContactError = contactValidation(form);
  const purchaseContactError = contactValidation(purchaseForm);
  const inquiryContactError = contactValidation(inquiryForm);

  const createMutation = useCreateAdmission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey() });
        setOpen(false);
        setForm(defaultForm);
        localStorage.removeItem("admission_form_draft");
        toast({ title: "Application submitted successfully" });
      },
      onError: (err) => {
        toast({ title: "Failed to submit application", description: err?.message ?? "Please fill all required fields.", variant: "destructive" });
      },
    },
  });

  const createInquiryMutation = useMutation({
    mutationFn: (data) => fetchJson("/api/admissions/inquiries", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions", "inquiries"] });
      setOpenInquiry(false);
      setInquiryForm(defaultInquiryForm);
      toast({ title: "Inquiry submitted successfully" });
    },
    onError: (err) => {
      toast({ title: "Failed to submit inquiry", description: err.message, variant: "destructive" });
    }
  });

  const createPurchaseMutation = useMutation({
    mutationFn: (data) => fetchJson("/api/admissions/form-purchases", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["admissions", "form-purchases"] });
      setOpenPurchase(false);
      setPurchaseForm(defaultPurchaseForm);
      setSelectedPurchase(data); // Auto-show the slip for printing
      toast({ title: "Form purchased successfully", description: `Transaction ID: ${data.transactionId}` });
    },
    onError: (err) => {
      toast({ title: "Purchase failed", description: err.message, variant: "destructive" });
    }
  });

  const updatePurchaseStatusMutation = useMutation({
    mutationFn: ({ id, data }) => fetchJson(`/api/admissions/form-purchases/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admissions", "form-purchases"] });
      toast({ title: "Payment status updated" });
    },
    onError: (err) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    }
  });

  const updateMutation = useUpdateAdmission({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey() });
        qc.invalidateQueries({ queryKey: getListFeesQueryKey() });
        toast({ title: "Application status updated" });
      },
      onError: (err) => {
        toast({ title: "Update failed", description: err?.message, variant: "destructive" });
      },
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id) => fetchJson(`/api/admissions/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey() });
      setDeleteConfirmId(null);
      setSelectedAdmission(null);
      toast({ title: "Application deleted successfully" });
    },
    onError: (err) => {
      toast({ title: "Failed to delete application", description: err?.message, variant: "destructive" });
    },
  });

  const verifyDocMutation = useMutation({
    mutationFn: ({ id, docId, status, remarks }) => fetchJson(`/api/admissions/${id}/documents/${encodeURIComponent(docId)}`, {
      method: "PATCH",
      body: JSON.stringify({ status, remarks })
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey() });
      toast({ title: "Document verification status updated successfully" });
    },
    onError: (err) => {
      toast({ title: "Failed to update verification status", description: err.message, variant: "destructive" });
    }
  });

  const uploadDocMutation = useMutation({
    mutationFn: ({ id, documents }) => fetchJson(`/api/admissions/${id}/documents`, {
      method: "POST",
      body: JSON.stringify({ documents })
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey() });
      toast({ title: "Document uploaded for verification" });
    },
    onError: (err) => {
      toast({ title: "Document upload failed", description: err.message, variant: "destructive" });
    }
  });

  const enrolMutation = useMutation({
    mutationFn: ({ id, classId }) => fetchJson(`/api/admissions/${id}/enrol`, {
      method: "POST",
      body: JSON.stringify({ classId })
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: getListAdmissionsQueryKey() });
      setEnrollingAdmission(null);
      setEnrolledCredentials(data);
      toast({ title: "Student Enrolled Successfully" });
    },
    onError: (err) => {
      toast({ title: "Enrolment failed", description: err.message, variant: "destructive" });
    }
  });

  const handlePrint = (elementId) => {
    const printContent = document.getElementById(elementId)?.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
            <html>
            <head>
                <title>Receipt/Invoice</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; background: #fff; }
                    .receipt-container { border: 2px dashed #000; padding: 20px; max-width: 400px; margin: 0 auto; }
                    .text-center { text-align: center; }
                    .flex { display: flex; justify-content: space-between; }
                    .border-b { border-bottom: 1px dashed #000; margin: 10px 0; }
                    .font-bold { font-weight: bold; }
                    .mt-4 { margin-top: 16px; }
                    .text-sm { font-size: 14px; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="receipt-container">
                    \${printContent}
                </div>
            </body>
            </html>
        `);
    win.document.close();
  };

  const handlePrintCredentials = (elementId, title, isIdCard) => {
    const printContent = document.getElementById(elementId)?.innerHTML;
    const win = window.open("", "_blank");
    if (!win) return;

    let styles = `
            body { font-family: 'Courier New', Courier, monospace; padding: 20px; color: #000; background: #fff; }
            .slip-container { border: 2px dashed #000; padding: 20px; max-width: 400px; margin: 0 auto; }
            .text-center { text-align: center; }
            .flex { display: flex; justify-content: space-between; }
            .border-b { border-bottom: 1px dashed #000; margin: 10px 0; }
            .font-bold { font-weight: bold; }
            .mt-4 { margin-top: 16px; }
            .text-sm { font-size: 14px; }
        `;

    if (isIdCard) {
      styles = `
                body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    background: #fff;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                    margin: 0;
                }
                .id-card-print {
                    width: 240px;
                    height: 380px;
                    border: 1px solid #ddd;
                    border-radius: 12px;
                    padding: 16px;
                    box-shadow: 0 4px 10px rgba(0,0,0,0.1);
                    background: linear-gradient(135deg, #f5f3ff 0%, #fff 100%);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    position: relative;
                    box-sizing: border-box;
                }
                .id-card-header {
                    text-align: center;
                    font-weight: 800;
                    font-size: 16px;
                    color: #5b21b6;
                    margin-bottom: 15px;
                }
                .id-card-avatar {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    border: 3px solid #8b5cf6;
                    background: #eee;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 32px;
                    font-weight: bold;
                    color: #8b5cf6;
                    margin-bottom: 15px;
                }
                .id-card-name {
                    font-size: 16px;
                    font-weight: 700;
                    color: #111827;
                    margin-bottom: 5px;
                    text-align: center;
                }
                .id-card-role {
                    font-size: 10px;
                    background: #8b5cf6;
                    color: #fff;
                    padding: 2px 8px;
                    border-radius: 9999px;
                    text-transform: uppercase;
                    font-weight: bold;
                    margin-bottom: 15px;
                }
                .id-card-info {
                    width: 100%;
                    font-size: 11px;
                    color: #4b5563;
                    border-top: 1px solid #f3f4f6;
                    padding-top: 10px;
                }
                .id-card-info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 4px 0;
                }
                .id-card-info-label {
                    color: #9ca3af;
                }
                .id-card-info-value {
                    font-weight: 600;
                }
                .id-card-barcode {
                    margin-top: auto;
                    font-size: 12px;
                    font-family: monospace;
                    color: #000;
                    letter-spacing: 2px;
                }
            `;
    }

    win.document.write(`
            <html>
            <head>
                <title>${title}</title>
                <style>${styles}</style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="${isIdCard ? '' : 'slip-container'}">
                    ${printContent}
                </div>
            </body>
            </html>
        `);
    win.document.close();
  };

  const handleDownloadPurchaseReceipt = (p) => {
    const dateString = new Date(p.createdAt).toLocaleDateString();
    const receiptNo = `RCP-${p.id}-${new Date(p.createdAt).getFullYear()}`;

    const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Admission Form Receipt - ${p.applicantName}</title>
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
                        max-width: 500px;
                        margin: 0 auto;
                        padding: 30px;
                        border-top: 6px solid #8b5cf6;
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
                        background: #f5f3ff;
                        border-radius: 8px;
                        padding: 15px;
                        text-align: center;
                        margin: 20px 0;
                    }
                    .amount-label {
                        font-size: 12px;
                        color: #6d28d9;
                        text-transform: uppercase;
                        font-weight: 700;
                    }
                    .amount-value {
                        font-size: 28px;
                        font-weight: 800;
                        color: #5b21b6;
                        margin-top: 5px;
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
                        background: #8b5cf6;
                        color: white;
                        text-decoration: none;
                        padding: 12px;
                        border-radius: 6px;
                        font-weight: 600;
                        margin-top: 20px;
                        font-size: 14px;
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
                        <div class="receipt-title">Admission Form Slip</div>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Receipt Number</span>
                        <span class="info-value">${receiptNo}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Date & Time</span>
                        <span class="info-value">${dateString}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Payment Mode</span>
                        <span class="info-value" style="text-transform: uppercase;">${p.mode}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Payment Method</span>
                        <span class="info-value" style="text-transform: uppercase;">${p.paymentMethod}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Transaction ID</span>
                        <span class="info-value font-mono">${p.transactionId ?? "—"}</span>
                    </div>
                    <div class="divider"></div>
                    <div class="info-row">
                        <span class="info-label">Applicant Name</span>
                        <span class="info-value">${p.applicantName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Applying for Class</span>
                        <span class="info-value">${classLabel(p.applyingForClass)}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Parent Name</span>
                        <span class="info-value">${p.parentName}</span>
                    </div>
                    <div class="info-row">
                        <span class="info-label">Parent Contact</span>
                        <span class="info-value">${p.parentPhone}</span>
                    </div>
                    <div class="divider"></div>
                    <div class="amount-box">
                        <div class="amount-label">Amount Paid</div>
                        <div class="amount-value">₹${p.amount}.00</div>
                    </div>
                    <div class="info-row" style="align-items: center;">
                        <span class="info-label">Payment Status</span>
                        <span class="status-badge">${p.paymentStatus.toUpperCase()}</span>
                    </div>
                    <div class="divider"></div>
                    <a href="#" class="btn-print" onclick="window.print(); return false;">Print Slip</a>
                    <div class="footer">
                        Thank you for choosing Nexus Academy!<br/>
                        This is an official transaction record generated by Nexus Academy.
                    </div>
                </div>
            </body>
            </html>
        `;

    const element = document.createElement("a");
    const file = new Blob([htmlContent], { type: 'text/html' });
    element.href = URL.createObjectURL(file);
    element.download = `receipt-admission-${p.applicantName.replace(/\s+/g, '_')}-${p.id}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const isAdmin = user?.role === "admin";
  const pending = admissions.filter((a) => a.status === "pending").length;
  const approved = admissions.filter((a) => a.status === "approved").length;
  const rejected = admissions.filter((a) => a.status === "rejected").length;

  return (<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
    {/* Header */}
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-serif font-bold text-violet-400">Admissions Portal</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Manage student admission applications, inquiries, and form purchases
        </p>
      </div>
      <div className="flex gap-2">
        {tab === "applications" && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-violet-600/10 text-violet-400 border border-violet-500/20 hover:bg-violet-600/20">
                <Plus className="w-4 h-4" />New Application
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Admission Application</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
              <div>
  <Label>Applicant Name *</Label>
  <Input
    className="mt-1"
    value={form.applicantName}
    onChange={(e) => {
      const value = e.target.value.replace(/[^A-Za-z\s]/g, "");
      setForm((f) => ({
        ...f,
        applicantName: value,
      }));
    }}
    placeholder="Full name of applicant"
  />
</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Date of Birth *</Label>
                    <Input type="date" max={todayDate()} className="mt-1" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} />
                    {formDobError && <p className="text-xs text-red-400 mt-1">{formDobError}</p>}
                  </div>
                  <div>
                    <Label>Gender *</Label>
                    <Select value={form.gender} onValueChange={(v) => setForm((f) => ({ ...f, gender: v }))}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Applying for Class *</Label>
                  <Select value={form.applyingForClass} onValueChange={(v) => setForm((f) => ({ ...f, applyingForClass: v }))}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
                    <SelectContent className="max-h-56">
                      {CLASSES.map((c) => (<SelectItem key={c} value={c}>{classLabel(c)}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Previous School</Label>
                  <Input className="mt-1" value={form.previousSchool} onChange={(e) => setForm((f) => ({ ...f, previousSchool: e.target.value }))} placeholder="Name of previous school (if any)" />
                </div>
                <div className="border-t pt-4">
                  <p className="text-sm font-medium mb-3">Parent / Guardian Details</p>
                  <div className="space-y-3">
                    <div>
                      <Label>Parent / Guardian Name *</Label>
                      <Input className="mt-1" value={form.parentName} onChange={(e) => setForm((f) => ({ ...f, parentName: e.target.value }))} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Email *</Label>
                        <Input type="email" className="mt-1" value={form.parentEmail} onChange={(e) => setForm((f) => ({ ...f, parentEmail: e.target.value.trim() }))} placeholder="name@example.com" />
                      </div>
                      <div>
                        <Label>Phone *</Label>
                        <Input type="tel" inputMode="numeric" maxLength={10} className="mt-1" value={form.parentPhone} onChange={(e) => setForm((f) => ({ ...f, parentPhone: sanitizePhone(e.target.value) }))} placeholder="10-digit mobile number" />
                      </div>
                    </div>
                    {formContactError && <p className="text-xs text-red-400">{formContactError}</p>}
                   <div>
  <Label>
    Address <span className="text-red-500">*</span>
  </Label>

  <Textarea
    className="mt-1 resize-none"
    rows={2}
    value={form.address}
    placeholder="Enter your address"
    required
    onChange={(e) =>
      setForm((f) => ({
        ...f,
        address: e.target.value,
      }))
    }
  />

  {!form.address.trim() && (
    <p className="text-red-500 text-sm mt-1">
      Address is required
    </p>
  )}
</div>
                  </div>
                </div>
              <div className="space-y-3">
  <Label className="flex items-center gap-2 font-semibold text-xs text-violet-300 uppercase tracking-wider">
    Upload Required Documents <span className="text-red-500">*</span>
  </Label>

  <div className="space-y-1">
    <Label className="text-xs text-muted-foreground">
      Upload Documents <span className="text-red-500">*</span>
    </Label>

    <Input
      type="file"
      multiple
      accept="image/*,application/pdf"
      className={`mt-1 text-xs ${
        !form.documents ? "border-red-500" : ""
      }`}
      onChange={async (e) => {
        const files = Array.from(e.target.files || []);

        const uploadedDocs = await readFilesAsDocs(files);

        setForm((f) => {
          let existingDocs = [];
          if (f.documents) {
            try {
              existingDocs = parseDocs(f.documents);
            } catch {}
          }

          return {
            ...f,
            documents: JSON.stringify([
              ...existingDocs,
              ...uploadedDocs,
            ]),
          };
        });
      }}
    />

    {!form.documents && (
      <p className="text-red-500 text-xs mt-1">
        Please upload at least one document.
      </p>
    )}
  </div>

  {form.documents &&
    (() => {
      let docs = [];
      docs = parseDocs(form.documents);

      if (docs.length === 0) return null;

      return (
        <div className="bg-violet-950/20 p-2.5 rounded-lg border border-violet-500/20 mt-2 space-y-1.5">
          <p className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
            Currently Attached Files:
          </p>

          <div className="space-y-1 text-xs">
            {docs.map((d, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between bg-white/5 p-1 px-2 rounded"
              >
                <span className="text-[11px] text-violet-300 font-semibold">
                  {d.docType}: {d.name}
                </span>

                <button
                  type="button"
                  className="text-red-400 hover:text-red-300 font-bold px-1"
                  onClick={() => {
                    setForm((f) => {
                      let current = [];
                      current = parseDocs(f.documents);

                      const next = current.filter(
                        (x) => x.id !== d.id
                      );

                      return {
                        ...f,
                        documents:
                          next.length > 0
                            ? JSON.stringify(next)
                            : "",
                      };
                    });
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      );
    })()}
</div>
                <Button className="w-full" disabled={!form.applicantName || !form.dateOfBirth || !form.applyingForClass || !form.parentName || !form.parentEmail || !form.parentPhone || !!formDobError || !!formContactError || createMutation.isPending} onClick={() => {
                  const dobError = dobValidationMessage(form.dateOfBirth, form.applyingForClass);
                  if (dobError) {
                    toast({ title: "Invalid date of birth", description: dobError, variant: "destructive" });
                    return;
                  }
                  const contactError = contactValidation(form);
                  if (contactError) {
                    toast({ title: "Invalid contact details", description: contactError, variant: "destructive" });
                    return;
                  }
                  createMutation.mutate({
                  data: {
                    applicantName: form.applicantName,
                    dateOfBirth: form.dateOfBirth,
                    gender: form.gender,
                    applyingForClass: form.applyingForClass,
                    previousSchool: form.previousSchool || undefined,
                    parentName: form.parentName,
                    parentEmail: form.parentEmail,
                    parentPhone: form.parentPhone,
                    address: form.address || undefined,
                    ...(form.documents ? { documents: form.documents } : {}),
                  },
                });
                }}>
                  {createMutation.isPending ? "Submitting…" : "Submit Application"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
{tab === "purchases" && (
  <Dialog open={openPurchase} onOpenChange={setOpenPurchase}>
    <DialogTrigger asChild>
      <Button className="gap-2 bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-600/20">
        <Plus className="w-4 h-4" />Buy Admission Form
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Admission Form Purchase</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Applicant Name *</Label>
          <Input 
            className="mt-1" 
            value={purchaseForm.applicantName} 
            onChange={(e) => {
              // Only allow letters and spaces
              const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
              setPurchaseForm((f) => ({ ...f, applicantName: value }));
            }}
            placeholder="Enter applicant's full name"
          />
          {purchaseForm.applicantName && !/^[A-Za-z\s]{2,50}$/.test(purchaseForm.applicantName) && (
            <p className="text-xs text-red-400 mt-1">Name should only contain letters and spaces (2-50 characters)</p>
          )}
        </div>
        
        <div>
          <Label>Applying for Class *</Label>
          <Select value={purchaseForm.applyingForClass} onValueChange={(v) => setPurchaseForm((f) => ({ ...f, applyingForClass: v }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent className="max-h-56">
              {CLASSES.map((c) => (<SelectItem key={c} value={c}>{classLabel(c)}</SelectItem>))}
            </SelectContent>
          </Select>
          {!purchaseForm.applyingForClass && (
            <p className="text-xs text-red-400 mt-1">Please select a class</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Parent Name *</Label>
            <Input 
              className="mt-1" 
              value={purchaseForm.parentName} 
              onChange={(e) => {
                // Only allow letters and spaces
                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                setPurchaseForm((f) => ({ ...f, parentName: value }));
              }}
              placeholder="Parent's full name"
            />
            {purchaseForm.parentName && !/^[A-Za-z\s]{2,50}$/.test(purchaseForm.parentName) && (
              <p className="text-xs text-red-400 mt-1">Name should only contain letters and spaces (2-50 characters)</p>
            )}
          </div>
          <div>
            <Label>Parent Phone *</Label>
            <Input 
              className="mt-1" 
              value={purchaseForm.parentPhone} 
              onChange={(e) => {
                // Only allow digits and limit to 10 characters
                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                setPurchaseForm((f) => ({ ...f, parentPhone: value }));
              }}
              placeholder="10-digit mobile number"
              maxLength={10}
              inputMode="numeric"
            />
            {purchaseForm.parentPhone && !/^[6-9]\d{9}$/.test(purchaseForm.parentPhone) && (
              <p className="text-xs text-red-400 mt-1">Must start with 6,7,8,9 and be exactly 10 digits</p>
            )}
          </div>
        </div>
        
        <div>
          <Label>Parent Email *</Label>
          <Input 
            type="email" 
            className="mt-1" 
            value={purchaseForm.parentEmail} 
            onChange={(e) => {
              const value = e.target.value.trim();
              setPurchaseForm((f) => ({ ...f, parentEmail: value }));
            }}
            placeholder="name@example.com"
          />
          {purchaseForm.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,4}$/.test(purchaseForm.parentEmail) && (
            <p className="text-xs text-red-400 mt-1">Enter a valid email (e.g., name@domain.com)</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3 border-t pt-3">
          <div>
            <Label>Mode</Label>
            <Select value={purchaseForm.mode} onValueChange={(v) => setPurchaseForm((f) => ({ ...f, mode: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="offline">Offline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Payment Method</Label>
            <Select value={purchaseForm.paymentMethod} onValueChange={(v) => setPurchaseForm((f) => ({ ...f, paymentMethod: v }))}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="upi">UPI / QR Code</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <div className="bg-emerald-500/5 p-2.5 rounded-lg border border-emerald-500/20 text-center">
          <p className="text-xs text-muted-foreground">Form Price</p>
          <p className="font-bold text-emerald-400 text-lg">₹500.00</p>
        </div>
        
        <Button 
          className="w-full" 
          disabled={
            !purchaseForm.applicantName || 
            !purchaseForm.applyingForClass || 
            !purchaseForm.parentName || 
            !purchaseForm.parentEmail || 
            !purchaseForm.parentPhone ||
            !/^[A-Za-z\s]{2,50}$/.test(purchaseForm.applicantName) ||
            !/^[A-Za-z\s]{2,50}$/.test(purchaseForm.parentName) ||
            !/^[6-9]\d{9}$/.test(purchaseForm.parentPhone) ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]{2,4}$/.test(purchaseForm.parentEmail) ||
            createPurchaseMutation.isPending
          } 
          onClick={() => {
            // Validate all fields before submitting
            const errors = [];
            
            if (!purchaseForm.applicantName || !/^[A-Za-z\s]{2,50}$/.test(purchaseForm.applicantName)) {
              errors.push("Please enter a valid applicant name (letters and spaces only, 2-50 characters)");
            }
            
            if (!purchaseForm.applyingForClass) {
              errors.push("Please select a class");
            }
            
            if (!purchaseForm.parentName || !/^[A-Za-z\s]{2,50}$/.test(purchaseForm.parentName)) {
              errors.push("Please enter a valid parent name (letters and spaces only, 2-50 characters)");
            }
            
            if (!purchaseForm.parentPhone || !/^[6-9]\d{9}$/.test(purchaseForm.parentPhone)) {
              errors.push("Please enter a valid 10-digit phone number starting with 6,7,8, or 9");
            }
            
            if (!purchaseForm.parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,4}$/.test(purchaseForm.parentEmail)) {
              errors.push("Please enter a valid email address (e.g., name@domain.com)");
            }
            
            if (errors.length > 0) {
              toast({ 
                title: "Validation Errors", 
                description: errors.join("\n"), 
                variant: "destructive" 
              });
              return;
            }
            
            createPurchaseMutation.mutate({
              applicantName: purchaseForm.applicantName,
              applyingForClass: purchaseForm.applyingForClass,
              parentName: purchaseForm.parentName,
              parentEmail: purchaseForm.parentEmail,
              parentPhone: purchaseForm.parentPhone,
              mode: purchaseForm.mode,
              paymentMethod: purchaseForm.paymentMethod,
              amount: "500",
            });
          }}
        >
          {createPurchaseMutation.isPending ? "Processing..." : "Confirm & Pay"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)}

    {tab === "inquiries" && (
  <Dialog open={openInquiry} onOpenChange={setOpenInquiry}>
    <DialogTrigger asChild>
      <Button className="gap-2 bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20">
        <Plus className="w-4 h-4" />New Inquiry
      </Button>
    </DialogTrigger>
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>Admission Inquiry Form</DialogTitle></DialogHeader>
      <div className="space-y-3 py-2">
        <div>
          <Label>Applicant Name *</Label>
          <Input 
            className="mt-1" 
            value={inquiryForm.applicantName} 
            onChange={(e) => {
              // Only allow letters and spaces
              const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
              setInquiryForm((f) => ({ ...f, applicantName: value }));
            }}
            placeholder="Enter applicant's full name"
          />
          {inquiryForm.applicantName && !/^[A-Za-z\s]{2,50}$/.test(inquiryForm.applicantName) && (
            <p className="text-xs text-red-400 mt-1">Name should only contain letters and spaces (2-50 characters)</p>
          )}
        </div>
        
        <div>
          <Label>Applying for Class *</Label>
          <Select value={inquiryForm.applyingForClass} onValueChange={(v) => setInquiryForm((f) => ({ ...f, applyingForClass: v }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select class" /></SelectTrigger>
            <SelectContent className="max-h-56">
              {CLASSES.map((c) => (<SelectItem key={c} value={c}>{classLabel(c)}</SelectItem>))}
            </SelectContent>
          </Select>
          {!inquiryForm.applyingForClass && (
            <p className="text-xs text-red-400 mt-1">Please select a class</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Parent Name *</Label>
            <Input 
              className="mt-1" 
              value={inquiryForm.parentName} 
              onChange={(e) => {
                // Only allow letters and spaces
                const value = e.target.value.replace(/[^A-Za-z\s]/g, '');
                setInquiryForm((f) => ({ ...f, parentName: value }));
              }}
              placeholder="Parent's full name"
            />
            {inquiryForm.parentName && !/^[A-Za-z\s]{2,50}$/.test(inquiryForm.parentName) && (
              <p className="text-xs text-red-400 mt-1">Name should only contain letters and spaces (2-50 characters)</p>
            )}
          </div>
          <div>
            <Label>Parent Phone *</Label>
            <Input 
              className="mt-1" 
              value={inquiryForm.parentPhone} 
              onChange={(e) => {
                // Only allow digits and limit to 10 characters
                const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                setInquiryForm((f) => ({ ...f, parentPhone: value }));
              }}
              placeholder="10-digit mobile number"
              maxLength={10}
              inputMode="numeric"
            />
            {inquiryForm.parentPhone && !/^[6-9]\d{9}$/.test(inquiryForm.parentPhone) && (
              <p className="text-xs text-red-400 mt-1">Must start with 6,7,8,9 and be exactly 10 digits</p>
            )}
          </div>
        </div>
        
        <div>
          <Label>Parent Email *</Label>
          <Input 
            type="email" 
            className="mt-1" 
            value={inquiryForm.parentEmail} 
            onChange={(e) => {
              const value = e.target.value.trim();
              setInquiryForm((f) => ({ ...f, parentEmail: value }));
            }}
            placeholder="name@example.com"
          />
          {inquiryForm.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,4}$/.test(inquiryForm.parentEmail) && (
            <p className="text-xs text-red-400 mt-1">Enter a valid email (e.g., name@domain.com)</p>
          )}
        </div>
        
        <div>
          <Label>Inquiry Source *</Label>
          <Select value={inquiryForm.source} onValueChange={(v) => setInquiryForm((f) => ({ ...f, source: v }))}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select source" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Website">Website</SelectItem>
              <SelectItem value="Social Media">Social Media</SelectItem>
              <SelectItem value="Referral">Referral</SelectItem>
              <SelectItem value="Walk-in">Walk-in</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
          {!inquiryForm.source && (
            <p className="text-xs text-red-400 mt-1">Please select a source</p>
          )}
        </div>
        
      <div>
  <Label>
    Inquiry Message / Question <span className="text-red-500">*</span>
  </Label>

  <Textarea
    className="mt-1 resize-none"
    rows={3}
    required
    value={inquiryForm.message}
    onChange={(e) => {
      const value = e.target.value.slice(0, 500);
      setInquiryForm((f) => ({
        ...f,
        message: value,
      }));
    }}
    placeholder="Type your query here... (max 500 characters)"
  />

  {!inquiryForm.message.trim() && (
    <p className="text-xs text-red-400 mt-1">
      Inquiry message is required
    </p>
  )}

  <p className="text-xs text-muted-foreground mt-1">
    {inquiryForm.message.length}/500 characters
  </p>
</div>
        
        <Button 
          className="w-full" 
          disabled={
            !inquiryForm.applicantName || 
            !inquiryForm.applyingForClass || 
            !inquiryForm.parentName || 
            !inquiryForm.parentEmail || 
            !inquiryForm.parentPhone ||
            !inquiryForm.source ||
            !/^[A-Za-z\s]{2,50}$/.test(inquiryForm.applicantName) ||
            !/^[A-Za-z\s]{2,50}$/.test(inquiryForm.parentName) ||
            !/^[6-9]\d{9}$/.test(inquiryForm.parentPhone) ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]{2,4}$/.test(inquiryForm.parentEmail) ||
            createInquiryMutation.isPending
          } 
          onClick={() => {
            // Validate all fields before submitting
            const errors = [];
            
            if (!inquiryForm.applicantName || !/^[A-Za-z\s]{2,50}$/.test(inquiryForm.applicantName)) {
              errors.push("Please enter a valid applicant name (letters and spaces only, 2-50 characters)");
            }
            
            if (!inquiryForm.applyingForClass) {
              errors.push("Please select a class");
            }
            
            if (!inquiryForm.parentName || !/^[A-Za-z\s]{2,50}$/.test(inquiryForm.parentName)) {
              errors.push("Please enter a valid parent name (letters and spaces only, 2-50 characters)");
            }
            
            if (!inquiryForm.parentPhone || !/^[6-9]\d{9}$/.test(inquiryForm.parentPhone)) {
              errors.push("Please enter a valid 10-digit phone number starting with 6,7,8, or 9");
            }
            
            if (!inquiryForm.parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,4}$/.test(inquiryForm.parentEmail)) {
              errors.push("Please enter a valid email address (e.g., name@domain.com)");
            }
            
            if (!inquiryForm.source) {
              errors.push("Please select an inquiry source");
            }
            
            if (errors.length > 0) {
              toast({ 
                title: "Validation Errors", 
                description: errors.join("\n"), 
                variant: "destructive" 
              });
              return;
            }
            
            createInquiryMutation.mutate({
              applicantName: inquiryForm.applicantName,
              applyingForClass: inquiryForm.applyingForClass,
              parentName: inquiryForm.parentName,
              parentEmail: inquiryForm.parentEmail,
              parentPhone: inquiryForm.parentPhone,
              message: inquiryForm.message,
              source: inquiryForm.source,
            });
          }}
        >
          {createInquiryMutation.isPending ? "Submitting..." : "Submit Inquiry"}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
)}
      </div>
    </div>

    {/* Tabs list */}
    <div className="flex gap-2 flex-wrap border-b border-border/40 pb-2">
      <Button variant={tab === "applications" ? "default" : "outline"} size="sm" onClick={() => setTab("applications")}>
        Applications
      </Button>
      <Button variant={tab === "purchases" ? "default" : "outline"} size="sm" onClick={() => setTab("purchases")}>
        Form Purchases & Receipts
      </Button>
      <Button variant={tab === "inquiries" ? "default" : "outline"} size="sm" onClick={() => setTab("inquiries")}>
        Inquiries
      </Button>
    </div>

    {/* APPLICATIONS TAB */}
    {tab === "applications" && (
      <>
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="glass-card glass-hover border-t-2 border-t-amber-500/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400"><Clock className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-2xl font-bold text-amber-400">{pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card glass-hover border-t-2 border-t-emerald-500/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400"><UserCheck className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Approved</p>
                <p className="text-2xl font-bold text-emerald-400">{approved}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card glass-hover border-t-2 border-t-red-500/40">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400"><UserX className="w-4 h-4" /></div>
              <div>
                <p className="text-xs text-muted-foreground">Rejected</p>
                <p className="text-2xl font-bold text-red-400">{rejected}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card glass-hover border-t-2 border-t-primary/40">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Applications</p>
              <p className="text-2xl font-bold">{admissions.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filter */}
        <div className="flex flex-wrap items-center gap-4">
          <Select value={filter || "all"} onValueChange={(v) => setFilter(v === "all" ? "" : v)}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="waitlisted">Waitlisted</SelectItem>
            </SelectContent>
          </Select>
          {filter && (<Button variant="outline" onClick={() => setFilter("")}>Clear</Button>)}

          {isAdmin && (
            <div className="flex items-center gap-2 border border-violet-500/20 bg-violet-500/5 px-3 py-1.5 rounded-lg">
              <input
                type="checkbox"
                id="meritOnly"
                className="rounded text-violet-600 focus:ring-violet-500 bg-background border-border"
                checked={meritOnly}
                onChange={(e) => setMeritOnly(e.target.checked)}
              />
              <label htmlFor="meritOnly" className="text-sm font-medium text-violet-300 cursor-pointer select-none">
                Merit List Only (Sorted by Rank)
              </label>
            </div>
          )}
        </div>

        {/* List */}
        <Card className="glass-card border-t-2 border-t-violet-400/30">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-violet-400" />
              Applications
              <Badge className="ml-auto text-xs">{admissions.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (<div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-20 w-full" />))}
            </div>) : filteredAdmissions.length === 0 ? (<div className="text-center py-16 text-muted-foreground flex flex-col items-center gap-3">
              <FileSearch className="w-10 h-10 opacity-30" />
              <p>No applications found.</p>
            </div>) : (<div className="space-y-2">
              {pagedAdmissions.map((a) => {
                const isSelected = selectedAdmission?.id === a.id;
                const testDraft = getTestDraft(a);
                return (<div key={a.id} className="rounded-lg border border-border/50 overflow-hidden transition-all">
                  <div className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 cursor-pointer hover:bg-violet-500/5 hover:border-violet-500/20 transition-colors gap-3 ${isSelected ? "bg-violet-500/8 border-l-2 border-l-violet-400" : ""}`} onClick={() => setSelectedAdmission(isSelected ? null : a)}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div className="w-7 h-7 rounded-full bg-violet-500/15 border border-violet-500/25 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-violet-400">{a.applicantName?.charAt(0)?.toUpperCase()}</span>
                        </div>
                        <p className="font-semibold group-hover:text-violet-400">{a.applicantName}</p>
                        <Badge className={`text-xs border capitalize ${statusColors[a.status ?? "pending"]}`}>{a.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{classLabel(a.applyingForClass)} · {a.gender}{a.dateOfBirth ? ` · DOB: ${a.dateOfBirth}` : ""}</p>
                      <p className="text-xs text-muted-foreground">Parent: {a.parentName} · {a.parentPhone}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className={`h-7 w-7 ${isSelected ? "bg-violet-500/15 text-violet-400" : "hover:bg-violet-500/10 hover:text-violet-400"}`} onClick={() => setSelectedAdmission(isSelected ? null : a)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      {isAdmin && a.status === "pending" && (<>
                        <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs h-7" onClick={() => {
                          if (hasUnverifiedDocs(a)) {
                            toast({ title: "Documents pending", description: "Verify all uploaded documents before approval.", variant: "destructive" });
                            return;
                          }
                          updateMutation.mutate({ id: a.id, data: { status: "approved" } });
                        }}>Approve</Button>
                        <Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs h-7" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "waitlisted" } })}>Waitlist</Button>
                        <Button size="sm" variant="outline" className="text-red-400 border-red-500/30 hover:bg-red-500/10 text-xs h-7" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "rejected" } })}>Reject</Button>
                      </>)}
                      {isAdmin && a.status === "approved" && !feesLoading && !admissionFeeIds.has(a.id) && (<Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 text-xs h-7 gap-1" onClick={async () => {
                        try {
                          const res = await fetch("/api/admissions/" + a.id + "/generate-fee", { method: "POST" });
                          const json = await res.json().catch(() => ({}));
                          if (res.ok) {
                            toast({ title: "Admission fee generated", description: "₹" + (json.amount ?? 5000) + " invoice created." });
                            qc.invalidateQueries({ queryKey: getListFeesQueryKey() });
                          }
                          else if (res.status === 409) {
                            toast({ title: "Already generated", description: json.error ?? "An admission fee already exists.", variant: "destructive" });
                            qc.invalidateQueries({ queryKey: getListFeesQueryKey() });
                          }
                          else {
                            toast({ title: "Failed", description: json.error ?? "Could not generate fee.", variant: "destructive" });
                          }
                        }
                        catch {
                          toast({ title: "Failed", description: "Network error", variant: "destructive" });
                        }
                      }}>Generate Admission Fee</Button>)}
                      {isAdmin && a.status === "approved" && admissionFeeIds.has(a.id) && (<Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-xs h-7 inline-flex items-center px-2">Admission Fee Generated</Badge>)}
                      {isAdmin && a.status === "approved" && (
                        <Button
                          size="sm"
                          className="bg-violet-600 hover:bg-violet-700 text-white text-xs h-7 gap-1"
                          onClick={() => {
                            const matchedClass = getMatchedClass(a);
                            setEnrollingAdmission(a);
                            setSelectedClassId(matchedClass ? String(matchedClass.id) : "");
                          }}
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Enrol
                        </Button>
                      )}
                      {isAdmin && a.status !== "pending" && (<Button size="sm" variant="outline" className="text-amber-400 border-amber-500/30 hover:bg-amber-500/10 text-xs h-7" onClick={() => updateMutation.mutate({ id: a.id, data: { status: "pending" } })}>Reopen</Button>)}
                      {isAdmin && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                          onClick={() => setDeleteConfirmId(a.id)}
                          title="Delete application"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {isSelected && (<div className="border-t border-violet-500/20 bg-violet-500/5 p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Application Details</p>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-muted-foreground" onClick={() => setSelectedAdmission(null)}><X className="h-3 w-3" /></Button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Applicant</p>
                        <div><span className="text-xs text-muted-foreground block">Full Name</span><p className="font-medium">{a.applicantName}</p></div>
                        <div><span className="text-xs text-muted-foreground block">Gender</span><p className="font-medium">{a.gender}</p></div>
                        <div><span className="text-xs text-muted-foreground block">Date of Birth</span><p className="font-medium">{a.dateOfBirth || "—"}</p></div>
                        <div><span className="text-xs text-muted-foreground block">Applying for Class</span><p className="font-medium">{classLabel(a.applyingForClass)}</p></div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parent / Guardian</p>
                        <div><span className="text-xs text-muted-foreground block">Name</span><p className="font-medium">{a.parentName || "—"}</p></div>
                        <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" /><p className="text-sm">{a.parentPhone || "—"}</p></div>
                        <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-muted-foreground" /><p className="text-sm">{a.parentEmail || "—"}</p></div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Other Info</p>
                        <div><span className="text-xs text-muted-foreground block">Previous School</span><p className="font-medium">{a.previousSchool || "—"}</p></div>
                        <div><span className="text-xs text-muted-foreground block">Address</span><p className="font-medium">{a.address || "—"}</p></div>
                        <div><span className="text-xs text-muted-foreground block">Applied On</span><p className="font-medium">{a.createdAt ? new Date(a.createdAt).toLocaleDateString("en-IN") : "—"}</p></div>
                      </div>
                    </div>
                    {(() => {
                      const docs = parseDocs(a.documents);
                      return (<div className="mt-4 pt-4 border-t border-violet-500/20 space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                          <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Uploaded Documents Verification</p>
                          <label className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded border border-violet-500/30 text-violet-300 hover:bg-violet-500/10 text-xs cursor-pointer">
                            <Upload className="w-3.5 h-3.5" />
                            Upload Document
                            <input
                              type="file"
                              multiple
                              accept="image/*,application/pdf"
                              className="hidden"
                              onChange={async (e) => {
                                const documents = await readFilesAsDocs(e.target.files);
                                if (documents.length) uploadDocMutation.mutate({ id: a.id, documents });
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                        {!docs.length && (
                          <p className="text-xs text-muted-foreground bg-white/5 border border-violet-500/10 rounded-lg p-3">No documents uploaded yet.</p>
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {docs.map((d, i) => {
                            const docId = d.id || d.name;
                            const docStatus = d.status || "pending";
                            const docRemarks = d.remarks || "";
                            let badgeColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                            if (docStatus === "verified") badgeColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                            if (docStatus === "rejected") badgeColor = "bg-red-500/10 text-red-400 border-red-500/20";

                            return (
                              <div key={i} className="flex flex-col p-3 rounded-lg border border-violet-500/20 bg-violet-950/20 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-medium text-xs truncate text-violet-300 max-w-[180px]" title={d.name}>{d.name}</span>
                                  <Badge className={`text-[10px] py-0.5 px-2 border uppercase ${badgeColor}`}>{docStatus}</Badge>
                                </div>
                                {docRemarks && (
                                  <p className="text-[11px] text-red-400 italic">Remarks: {docRemarks}</p>
                                )}
                                <div className="flex items-center gap-1.5 pt-1">
                                  <a href={d.dataUrl} target="_blank" rel="noreferrer" download={d.name} className="inline-flex items-center justify-center px-2 py-1 rounded bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 hover:text-violet-300 text-xs gap-1 mr-auto" title="View Document">
                                    <Eye className="w-3.5 h-3.5" /> View
                                  </a>
                                  {(isAdmin || user?.role === "clerk") && (
                                    <>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        className="h-7 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
                                        onClick={() => verifyDocMutation.mutate({
                                          id: a.id,
                                          docId,
                                          status: "verified"
                                        })}
                                        disabled={verifyDocMutation.isPending}
                                      >
                                        Verify
                                      </Button>
                                      <Button
                                        size="xs"
                                        variant="outline"
                                        className="h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10"
                                        onClick={() => {
                                          const rem = prompt("Enter rejection remarks (optional):");
                                          if (rem !== null) {
                                            verifyDocMutation.mutate({
                                              id: a.id,
                                              docId,
                                              status: "rejected",
                                              remarks: rem
                                            });
                                          }
                                        }}
                                        disabled={verifyDocMutation.isPending}
                                      >
                                        Reject
                                      </Button>
                                    </>
                                  )}
                                  {docStatus === "rejected" && (
                                    <label className="inline-flex items-center justify-center px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs gap-1 cursor-pointer">
                                      <Upload className="w-3.5 h-3.5" /> Replace
                                      <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        onChange={async (e) => {
                                          const documents = await readFilesAsDocs(e.target.files, docId);
                                          if (documents.length) uploadDocMutation.mutate({ id: a.id, documents: documents.slice(0, 1) });
                                          e.target.value = "";
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>);
                    })()}
                    {isAdmin && (
                      <div className="mt-4 pt-4 border-t border-violet-500/20 space-y-4">
                        <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Entrance Test & Merit Rating</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Test Status</label>
                            <select
                              className="w-full bg-background border border-violet-500/30 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                              value={testDraft.testStatus}
                              onChange={(e) => setTestDraftValue(a.id, "testStatus", e.target.value)}
                            >
                              <option value="not_assigned">Not Assigned</option>
                              <option value="assigned">Test Assigned</option>
                              <option value="conducted">Test Conducted</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Test Date</label>
                            <input
                              type="date"
                              className="w-full bg-background border border-violet-500/30 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                              value={testDraft.testDate}
                              onChange={(e) => setTestDraftValue(a.id, "testDate", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Test Score (out of 100)</label>
                            <input
                              type="text"
                              className="w-full bg-background border border-violet-500/30 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                              placeholder="e.g. 85"
                              value={testDraft.testScore}
                              onChange={(e) => setTestDraftValue(a.id, "testScore", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Interview Score (out of 100)</label>
                            <input
                              type="text"
                              className="w-full bg-background border border-violet-500/30 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                              placeholder="e.g. 90"
                              value={testDraft.interviewScore}
                              onChange={(e) => setTestDraftValue(a.id, "interviewScore", e.target.value)}
                            />
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Include in Merit List?</label>
                            <select
                              className="w-full bg-background border border-violet-500/30 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                              value={testDraft.meritListIncluded}
                              onChange={(e) => setTestDraftValue(a.id, "meritListIncluded", e.target.value)}
                            >
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs text-muted-foreground block mb-1">Merit Rank</label>
                            <input
                              type="text"
                              className="w-full bg-background border border-violet-500/30 rounded px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500"
                              placeholder="e.g. 1"
                              value={testDraft.meritRank}
                              onChange={(e) => setTestDraftValue(a.id, "meritRank", e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            className="bg-violet-600 hover:bg-violet-700 text-white"
                            disabled={updateMutation.isPending}
                            onClick={() => updateMutation.mutate({ id: a.id, data: testDraft })}
                          >
                            {updateMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                        </div>
                      </div>
                    )}
                    {!isAdmin && (
                      <div className="mt-4 pt-4 border-t border-violet-500/20 space-y-3">
                        <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Entrance Test Information</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                          <div><span className="text-xs text-muted-foreground block">Test Status</span><p className="font-medium capitalize">{(a.testStatus || "not_assigned").replace(/_/g, " ")}</p></div>
                          <div><span className="text-xs text-muted-foreground block">Test Date</span><p className="font-medium">{a.testDate || "Not assigned"}</p></div>
                          <div><span className="text-xs text-muted-foreground block">Test Score</span><p className="font-medium">{a.testScore || "Not available"}</p></div>
                          <div><span className="text-xs text-muted-foreground block">Interview Score</span><p className="font-medium">{a.interviewScore || "Not available"}</p></div>
                          <div><span className="text-xs text-muted-foreground block">Merit List</span><p className="font-medium">{a.meritListIncluded === "yes" ? "Included" : "Not included"}</p></div>
                          <div><span className="text-xs text-muted-foreground block">Merit Rank</span><p className="font-medium">{a.meritRank || "Not assigned"}</p></div>
                        </div>
                      </div>
                    )}
                  </div>)}
                </div>);
              })}
            </div>)}
            {filteredAdmissions.length > 0 && (
              <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-muted-foreground">
                  Showing {((safeApplicationPage - 1) * PAGE_SIZE) + 1}-{Math.min(safeApplicationPage * PAGE_SIZE, filteredAdmissions.length)} of {filteredAdmissions.length}
                </p>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={safeApplicationPage === 1} onClick={() => setApplicationPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Page {safeApplicationPage} of {applicationTotalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={safeApplicationPage === applicationTotalPages} onClick={() => setApplicationPage((p) => Math.min(applicationTotalPages, p + 1))}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </>
    )}

    {/* FORM PURCHASES TAB */}
    {tab === "purchases" && (
      <Card className="glass-card border-t-2 border-t-emerald-400/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="w-4 h-4 text-emerald-400" />Form Purchases & Receipts
            <Badge className="ml-auto text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/20">{purchases.length} forms</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {purchasesQuery.isLoading ? (<Skeleton className="h-32 w-full" />) : purchases.length === 0 ? (<p className="text-muted-foreground text-center py-8">No form purchases logged yet.</p>) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="border-b border-border/40 text-xs text-muted-foreground">
                    <th className="py-2 px-2">Applicant</th>
                    <th className="py-2 px-2">Class</th>
                    <th className="py-2 px-2">Mode</th>
                    <th className="py-2 px-2">Payment Status</th>
                    <th className="py-2 px-2">Amount</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedPurchases.map(p => (
                    <tr key={p.id} className="border-b border-border/20 hover:bg-white/5 cursor-pointer" onClick={() => setSelectedPurchase(p)}>
                      <td className="py-2.5 px-2">
                        <p className="font-semibold">{p.applicantName}</p>
                        <p className="text-xs text-muted-foreground">Parent: {p.parentName} · {p.parentPhone}</p>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{classLabel(p.applyingForClass)}</td>
                      <td className="py-2.5 px-2 capitalize">
                        <Badge className={p.mode === "online" ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/25" : "bg-orange-500/10 text-orange-400 border border-orange-500/25"}>
                          {p.mode}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2">
                        <Badge className={p.paymentStatus === "paid" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border-amber-500/20"}>
                          {p.paymentStatus}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-2 font-mono">₹{p.amount}</td>
                      <td className="py-2.5 px-2 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-end gap-2">
                          {isAdminRole && p.paymentStatus === "pending" && (
                            <Button size="xs" className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 h-7 text-xs" onClick={() => updatePurchaseStatusMutation.mutate({ id: p.id, data: { paymentStatus: "paid" } })}>
                              Mark Paid
                            </Button>
                          )}
                          <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => setSelectedPurchase(p)} title="View Receipt">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {purchases.length > 0 && (
                <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Showing {((safePurchasePage - 1) * PAGE_SIZE) + 1}-{Math.min(safePurchasePage * PAGE_SIZE, purchases.length)} of {purchases.length}
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
              )}
            </div>
          )}
        </CardContent>
      </Card>
    )}

    {/* INQUIRIES TAB */}
    {tab === "inquiries" && (
      <Card className="glass-card border-t-2 border-t-blue-400/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />Admission Inquiries
            <Badge className="ml-auto text-xs bg-blue-500/10 text-blue-400 border-blue-500/20">{inquiries.length} inquiries</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {inquiriesQuery.isLoading ? (<Skeleton className="h-32 w-full" />) : inquiries.length === 0 ? (<p className="text-muted-foreground text-center py-8">No inquiries submitted yet.</p>) : (
            <div className="space-y-3">
              {pagedInquiries.map(i => (
                <Card key={i.id} className="glass-card border-l-2 border-l-blue-400/50">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{i.applicantName}</p>
                        <p className="text-xs text-muted-foreground">Class: {classLabel(i.applyingForClass)} · Parent: {i.parentName} ({i.parentPhone} / {i.parentEmail})</p>
                        <p className="text-xs text-muted-foreground mt-1">Source: <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-violet-500/10 text-violet-400 border-violet-500/20">{i.source || "Website"}</Badge></p>
                      </div>
                      <Badge className={i.status === "new" ? "bg-amber-500/10 text-amber-400" : "bg-emerald-500/10 text-emerald-400"}>{i.status}</Badge>
                    </div>
                    {i.message && <p className="text-sm text-muted-foreground bg-white/5 p-2 rounded-md italic">"{i.message}"</p>}
                    <div className="text-right text-xs text-muted-foreground">
                      Submitted: {new Date(i.createdAt).toLocaleDateString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {inquiries.length > 0 && (
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Showing {((safeInquiryPage - 1) * PAGE_SIZE) + 1}-{Math.min(safeInquiryPage * PAGE_SIZE, inquiries.length)} of {inquiries.length}
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={safeInquiryPage === 1} onClick={() => setInquiryPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground px-2">
                  Page {safeInquiryPage} of {inquiryTotalPages}
                </span>
                <Button variant="outline" size="sm" disabled={safeInquiryPage === inquiryTotalPages} onClick={() => setInquiryPage((p) => Math.min(inquiryTotalPages, p + 1))}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )}

    {/* Printable Receipt/Invoice Modal Dialog */}
    <Dialog open={selectedPurchase !== null} onOpenChange={() => setSelectedPurchase(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Confirmation Slips</DialogTitle></DialogHeader>
        {selectedPurchase && (
          <div className="space-y-4 py-2">
            {/* Slip content wrapper */}
            <div id="receipt-slip" className="border border-border/80 p-5 rounded-lg bg-card text-card-foreground shadow-sm font-mono text-sm max-w-sm mx-auto">
              <div className="text-center space-y-1 mb-4">
                <h3 className="font-bold text-base tracking-wide">NEXUS ACADEMY</h3>
                <p className="text-xs text-muted-foreground">Admission Office · Mumbai, IN</p>
                <p className="text-xs text-muted-foreground">GSTIN: 27AAAAA1111A1Z1</p>
                <div className="border-b border-dashed border-border/60 my-2"></div>
                <h4 className="font-bold text-xs uppercase">Admission Form Slip</h4>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between"><span>Receipt No:</span><span className="font-semibold">RCP-{selectedPurchase.id}-{new Date(selectedPurchase.createdAt).getFullYear()}</span></div>
                <div className="flex justify-between"><span>Date:</span><span>{new Date(selectedPurchase.createdAt).toLocaleDateString()}</span></div>
                <div className="flex justify-between"><span>Mode:</span><span className="uppercase">{selectedPurchase.mode}</span></div>
                <div className="flex justify-between"><span>Payment Method:</span><span className="uppercase">{selectedPurchase.paymentMethod}</span></div>
                <div className="flex justify-between"><span>Transaction ID:</span><span className="truncate max-w-[150px] font-mono">{selectedPurchase.transactionId ?? "—"}</span></div>
                <div className="border-b border-dashed border-border/60 my-2"></div>
                <div className="flex justify-between"><span>Applicant Name:</span><span className="font-semibold">{selectedPurchase.applicantName}</span></div>
                <div className="flex justify-between"><span>Class:</span><span>{classLabel(selectedPurchase.applyingForClass)}</span></div>
                <div className="flex justify-between"><span>Parent Name:</span><span>{selectedPurchase.parentName}</span></div>
                <div className="flex justify-between"><span>Parent Contact:</span><span>{selectedPurchase.parentPhone}</span></div>
                <div className="border-b border-dashed border-border/60 my-2"></div>
                <div className="flex justify-between font-bold text-sm"><span>Amount Paid:</span><span className="text-emerald-400">₹{selectedPurchase.amount}.00</span></div>
                <div className="flex justify-between font-semibold text-xs"><span>Status:</span><span className="text-emerald-400 capitalize">{selectedPurchase.paymentStatus}</span></div>
              </div>

              <div className="text-center mt-6 text-[10px] text-muted-foreground">
                <p>Thank you for choosing Nexus Academy!</p>
                <p className="italic">This is a computer-generated confirmation slip.</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 flex-col sm:flex-row">
              <Button className="w-full gap-2 bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 border border-violet-500/30" onClick={() => handlePrint("receipt-slip")}>
                <Printer className="w-4 h-4" />Print
              </Button>
              <Button className="w-full gap-2 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30" onClick={() => handleDownloadPurchaseReceipt(selectedPurchase)}>
                <Download className="w-4 h-4" />Download
              </Button>
              <Button variant="outline" className="w-full" onClick={() => setSelectedPurchase(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Enrol Dialog */}
    <Dialog open={enrollingAdmission !== null} onOpenChange={() => setEnrollingAdmission(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Enrol Student</DialogTitle></DialogHeader>
        {enrollingAdmission && (() => {
          const matchedClass = getMatchedClass(enrollingAdmission);
          return (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Enrol <span className="font-semibold text-violet-400">{enrollingAdmission.applicantName}</span> into the class selected on the application. This will generate their student profile, roll number, and user login credentials.
            </p>
            {matchedClass ? (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-sm">
                <span className="text-xs text-muted-foreground block">Assigned Class</span>
                <p className="font-semibold text-violet-300">{matchedClass.grade}-{matchedClass.section}</p>
              </div>
            ) : (
              <div>
                <Label>Select Class *</Label>
                <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Choose class..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-56">
                    {classes.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.grade}-{c.section}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setEnrollingAdmission(null)}>Cancel</Button>
              <Button
                disabled={(!matchedClass && !selectedClassId) || enrolMutation.isPending}
                onClick={() => enrolMutation.mutate({ id: enrollingAdmission.id, classId: Number(selectedClassId || matchedClass?.id) })}
              >
                {enrolMutation.isPending ? "Enrolling..." : "Enrol Student"}
              </Button>
            </div>
          </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    {/* Enrolled Credentials Modal */}
    <Dialog open={enrolledCredentials !== null} onOpenChange={() => setEnrolledCredentials(null)}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Enrolment Completed</DialogTitle></DialogHeader>
        {enrolledCredentials && (() => {
          const student = enrolledCredentials.student;
          const creds = enrolledCredentials.credentials;

          // Resolve class name for display
          const classObj = classes.find(c => c.id === student.classId);
          const className = classObj ? `${classObj.grade}-${classObj.section}` : `Class ${student.classId}`;

          return (
            <div className="space-y-4 py-2">
              <div className="border-b border-border/40 pb-2">
                <p className="text-sm text-muted-foreground">
                  Student has been successfully enrolled! Print the credential slip and student ID card below.
                </p>
              </div>

              <div className="space-y-4">
                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider">Credential Slip</p>
                <div id="credential-slip" className="border border-dashed border-violet-500/40 p-5 rounded-lg bg-violet-950/20 text-card-foreground shadow-sm font-mono text-xs max-w-sm mx-auto font-mono">
                  <div className="text-center space-y-1 mb-4">
                    <h3 className="font-bold text-sm text-violet-400">NEXUS ACADEMY</h3>
                    <p className="text-[10px] text-muted-foreground">Student Credential Slip</p>
                    <div className="border-b border-dashed border-violet-500/20 my-2"></div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between"><span>Student Name:</span><span className="font-bold">{student.name}</span></div>
                    <div className="flex justify-between"><span>Roll Number:</span><span className="font-bold">{creds.studentId}</span></div>
                    <div className="flex justify-between"><span>Assigned Class:</span><span>{className}</span></div>
                    <div className="border-b border-dashed border-violet-500/20 my-2"></div>
                    <div className="bg-violet-900/20 p-2 rounded border border-violet-500/10 space-y-1 text-[11px]">
                      <div className="flex justify-between"><span>Username:</span><span className="font-bold text-violet-300">{creds.username}</span></div>
                      <div className="flex justify-between"><span>Password:</span><span className="font-bold text-violet-300">{creds.password}</span></div>
                    </div>
                    <p className="text-[9px] text-yellow-500/80 mt-2 text-center">Warning: Write down or copy these credentials. Password is only visible once.</p>
                  </div>
                </div>

                <div className="flex gap-2 flex-col sm:flex-row">
                  <Button className="w-full gap-2" onClick={() => handlePrintCredentials("credential-slip", "Credential Slip", false)}>
                    <Printer className="w-4 h-4" />Print Slip
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => {
                    const slipText = `NEXUS ACADEMY\nStudent Credential Slip\n---------------------\nStudent Name: ${student.name}\nRoll Number: ${creds.studentId}\nAssigned Class: ${className}\n---------------------\nUsername: ${creds.username}\nPassword: ${creds.password}\n---------------------\nWarning: Please save these details.`;
                    const element = document.createElement("a");
                    const file = new Blob([slipText], { type: 'text/plain' });
                    element.href = URL.createObjectURL(file);
                    element.download = `student-creds-${creds.studentId}.txt`;
                    document.body.appendChild(element);
                    element.click();
                    document.body.removeChild(element);
                  }}>
                    <Download className="w-4 h-4" />Download TXT
                  </Button>
                </div>

                <p className="text-xs font-semibold text-violet-400 uppercase tracking-wider pt-2">Student ID Card</p>
                <div className="flex justify-center py-2">
                  <div id="student-id-card" className="id-card-print w-[240px] h-[380px] border border-violet-500/30 rounded-xl p-4 shadow-lg bg-gradient-to-br from-violet-950/40 to-slate-900/50 backdrop-blur-md flex flex-col items-center box-border text-foreground">
                    <div className="id-card-header font-bold text-base text-violet-400 mb-4 tracking-wider text-center">
                      NEXUS ACADEMY
                    </div>
                    <div className="id-card-avatar w-20 h-20 rounded-full border-2 border-violet-500 bg-violet-500/10 flex items-center justify-center text-3xl font-bold text-violet-300 mb-4">
                      {student.name ? student.name.charAt(0).toUpperCase() : "S"}
                    </div>
                    <div className="id-card-name text-base font-bold mb-1 text-center truncate w-full">
                      {student.name}
                    </div>
                    <div className="id-card-role text-[10px] bg-violet-600 text-white px-2 py-0.5 rounded-full font-bold uppercase mb-4 tracking-wider">
                      Student
                    </div>
                    <div className="id-card-info w-full text-xs text-muted-foreground border-t border-violet-500/20 pt-3 space-y-1">
                      <div className="id-card-info-row flex justify-between">
                        <span className="id-card-info-label text-muted-foreground/60">Roll Number</span>
                        <span className="id-card-info-value font-semibold text-foreground">{creds.studentId}</span>
                      </div>
                      <div className="id-card-info-row flex justify-between">
                        <span className="id-card-info-label text-muted-foreground/60">Class</span>
                        <span className="id-card-info-value font-semibold text-foreground">{className}</span>
                      </div>
                      <div className="id-card-info-row flex justify-between">
                        <span className="id-card-info-label text-muted-foreground/60">Gender</span>
                        <span className="id-card-info-value font-semibold text-foreground">{student.gender || "—"}</span>
                      </div>
                      <div className="id-card-info-row flex justify-between">
                        <span className="id-card-info-label text-muted-foreground/60">Status</span>
                        <span className="id-card-info-value font-semibold text-emerald-400">Active</span>
                      </div>
                    </div>
                    <div className="id-card-barcode mt-auto font-mono text-[10px] text-muted-foreground tracking-widest border border-dashed border-border/40 px-2 py-1 bg-black/10 rounded">
                      ||||||| {creds.studentId} |||||||
                    </div>
                  </div>
                </div>

                <Button className="w-full gap-2 bg-violet-600 hover:bg-violet-700" onClick={() => handlePrintCredentials("student-id-card", "Student ID Card", true)}>
                  <Printer className="w-4 h-4" />Print ID Card
                </Button>
              </div>

              <Button variant="outline" className="w-full border-violet-500/30 text-violet-400 hover:bg-violet-500/10" onClick={() => setEnrolledCredentials(null)}>
                Close
              </Button>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog */}
    <Dialog open={deleteConfirmId !== null} onOpenChange={() => setDeleteConfirmId(null)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirm Delete</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete this application? This action cannot be undone.
          </p>
        </div>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            className="bg-red-600 hover:bg-red-700"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (deleteConfirmId) {
                deleteMutation.mutate(deleteConfirmId);
              }
            }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  </div>);
}
