import { useState, useRef } from "react";
import { useListVendors, useCreateVendor, useUpdateVendor, useListPurchaseOrders, useCreatePurchaseOrder, useUpdatePurchaseOrder, getListVendorsQueryKey, getListPurchaseOrdersQueryKey, UserRole, useDeleteVendor, useDeletePurchaseOrder } from "@/api-client";
import { useAuth } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, ShoppingCart, Building, Package, CheckCircle, Clock, XCircle, AlertCircle, Download, Copy, KeyRound, Upload, File, X, FileText, FileCheck, AlertTriangle, Eye, Trash2, User, Mail, Phone, MapPin, CreditCard, Calendar, Hash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileHoverCard } from "@/components/profile-hover-card";

const statusColors = {
    active: "bg-emerald-500/10 text-emerald-400",
    pending_verification: "bg-amber-500/10 text-amber-400",
    inactive: "bg-muted/50 text-muted-foreground",
    blacklisted: "bg-red-500/10 text-red-400",
};

const poStatusConfig = {
    pending: { label: "Pending", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: Clock },
    draft: { label: "Draft", color: "bg-muted/50 text-muted-foreground border-border", icon: AlertCircle },
    sent: { label: "Sent", color: "bg-blue-500/10 text-blue-400 border-blue-500/20", icon: Clock },
    acknowledged: { label: "Acknowledged", color: "bg-violet-500/10 text-violet-400 border-violet-500/20", icon: CheckCircle },
    invoiced: { label: "Invoiced", color: "bg-amber-500/10 text-amber-400 border-amber-500/20", icon: CheckCircle },
    paid: { label: "Paid", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
    delivered: { label: "Delivered", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", icon: CheckCircle },
    cancelled: { label: "Cancelled", color: "bg-red-500/10 text-red-400 border-red-500/20", icon: XCircle },
};

const VENDOR_CATEGORIES = [
    "Stationery", "Lab Equipment", "Sports Goods", "Furniture", "IT Equipment",
    "Cleaning Supplies", "Canteen / Food", "Uniforms", "Books", "Maintenance", "Other"
];

// Document types for vendor registration
const DOCUMENT_TYPES = [
    { value: "gst_certificate", label: "GST Certificate" },
    { value: "pan_card", label: "PAN Card" },
    { value: "aadhar_card", label: "Aadhar Card" },
    { value: "business_registration", label: "Business Registration" },
    { value: "bank_statement", label: "Bank Statement" },
    { value: "msme_certificate", label: "MSME Certificate" },
    { value: "other", label: "Other" }
];

// Allowed file types
const ALLOWED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

function formatCurrency(n) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

export default function Vendors() {
    const { user } = useAuth();
    const qc = useQueryClient();
    const { toast } = useToast();
    const [tab, setTab] = useState("vendors");
    const [openVendor, setOpenVendor] = useState(false);
    const [openOrder, setOpenOrder] = useState(false);
    const [createdVendorInfo, setCreatedVendorInfo] = useState(null);
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [openDocuments, setOpenDocuments] = useState(false);
    const [openVendorDetail, setOpenVendorDetail] = useState(false);
    const fileInputRef = useRef(null);
    const [vendorForm, setVendorForm] = useState({
        name: "", category: "", contactPerson: "", email: "", phone: "",
        address: "", gstNumber: "", bankAccount: "", renewalDate: "", renewalStatus: "active",
        documents: []
    });
    const [orderForm, setOrderForm] = useState({
        vendorId: "", description: "", quantity: "1", unitPrice: "", deliveryDate: "", notes: ""
    });

    // Validation states
    const [validationErrors, setValidationErrors] = useState({
        name: "",
        contactPerson: "",
        email: "",
        phone: "",
        documents: ""
    });

    // Document upload states
    const [uploadingDocument, setUploadingDocument] = useState(false);
    const [documentType, setDocumentType] = useState("");
    const [documentError, setDocumentError] = useState("");

    const { data: vendors = [], isLoading: vendorsLoading, refetch: refetchVendors } = useListVendors({
        query: { queryKey: getListVendorsQueryKey(), staleTime: 10000 }
    });
    const { data: orders = [], isLoading: ordersLoading } = useListPurchaseOrders({}, {
        query: { queryKey: getListPurchaseOrdersQueryKey(), staleTime: 10000 }
    });

    // Validation functions
    const validateCompanyName = (value) => {
        if (!value) return "Company name is required";
        if (/\d/.test(value)) return "Company name cannot contain numbers";
        return "";
    };

    const validateContactPerson = (value) => {
        if (value && /\d/.test(value)) return "Contact person cannot contain numbers";
        return "";
    };

    const validateEmail = (value) => {
        if (!value) return "";
        const emailRegex = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,3}$/;
        if (!emailRegex.test(value)) {
            return "Please enter a valid email (e.g., name@domain.com)";
        }
        return "";
    };

    const validateDuplicateEmail = (email) => {
        if (!email) return "";
        
        const existingVendor = vendors.find(v => 
            v.email && 
            v.email.toLowerCase() === email.toLowerCase()
        );
        
        if (existingVendor) {
            return "This email is already registered with another vendor";
        }
        
        return "";
    };

    const validatePhone = (value) => {
        if (!value) return "";
        const phoneRegex = /^[6-9][0-9]{9}$/;
        if (!phoneRegex.test(value)) {
            return "Phone must be 10 digits starting with 6,7,8, or 9";
        }
        return "";
    };

    const validateRenewalDate = (dateStr) => {
        if (!dateStr) return "";

        const selectedDate = new Date(dateStr);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (isNaN(selectedDate.getTime())) {
            return "Please enter a valid date";
        }

        const year = selectedDate.getFullYear();
        if (year < today.getFullYear()) {
            return "Renewal date cannot be in the past";
        }

        return "";
    };

    const validateDocument = (file) => {
        if (!file) {
            setDocumentError("Please select a file");
            return false;
        }

        if (!ALLOWED_FILE_TYPES.includes(file.type)) {
            setDocumentError("Only PDF, JPEG, PNG, and JPG files are allowed");
            return false;
        }

        if (file.size > MAX_FILE_SIZE) {
            setDocumentError("File size must be less than 5MB");
            return false;
        }

        if (!documentType) {
            setDocumentError("Please select a document type");
            return false;
        }

        setDocumentError("");
        return true;
    };

    const handleDocumentUpload = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = '';

        if (!validateDocument(file)) {
            toast({
                title: "Document validation failed",
                description: documentError,
                variant: "destructive"
            });
            return;
        }

        setUploadingDocument(true);

        const formData = new FormData();
        formData.append("file", file);

        fetch("/api/upload", {
            method: "POST",
            body: formData,
        })
            .then(res => {
                if (!res.ok) throw new Error("Upload failed");
                return res.json();
            })
            .then(data => {
                const newDocument = {
                    id: data.url.split("/").pop(),
                    name: file.name,
                    type: documentType,
                    size: file.size,
                    url: data.url,
                    uploadDate: new Date().toISOString().split('T')[0],
                    status: "uploaded"
                };

                setVendorForm(prev => ({
                    ...prev,
                    documents: [...prev.documents, newDocument]
                }));

                setDocumentType("");
                setDocumentError("");
                setUploadingDocument(false);

                toast({
                    title: "Document uploaded successfully",
                    description: `${file.name} has been uploaded`
                });
            })
            .catch(err => {
                setUploadingDocument(false);
                toast({
                    title: "Upload failed",
                    description: err.message || "Failed to upload document to server",
                    variant: "destructive"
                });
            });
    };

    const removeDocument = (docId) => {
        setVendorForm(prev => ({
            ...prev,
            documents: prev.documents.filter(doc => doc.id !== docId)
        }));
        toast({
            title: "Document removed",
            description: "Document has been removed from the list"
        });
    };

    const getFileIcon = (fileType) => {
        if (fileType === 'application/pdf') return <FileText className="w-4 h-4" />;
        if (fileType?.startsWith('image/')) return <File className="w-4 h-4" />;
        return <File className="w-4 h-4" />;
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const getDocumentTypeLabel = (type) => {
        return DOCUMENT_TYPES.find(d => d.value === type)?.label || type;
    };

    const handleVendorFormChange = (field, value) => {
        setVendorForm(f => ({ ...f, [field]: value }));

        if (validationErrors[field]) {
            setValidationErrors(prev => ({ ...prev, [field]: "" }));
        }
    };

    const validateForm = () => {
        const errors = {
            name: validateCompanyName(vendorForm.name),
            contactPerson: validateContactPerson(vendorForm.contactPerson),
            email: validateEmail(vendorForm.email) || validateDuplicateEmail(vendorForm.email),
            phone: validatePhone(vendorForm.phone),
            renewalDate: validateRenewalDate(vendorForm.renewalDate),
            documents: vendorForm.documents.length === 0 ? "At least one document is required" : ""
        };

        setValidationErrors(errors);

        return !Object.values(errors).some(error => error !== "");
    };

    const createVendorMutation = useCreateVendor({
        mutation: {
            onSuccess: (created) => {
                qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
                refetchVendors(); // Force refetch to get updated data

                const creds = created?.credentials;

                if (creds) {
                    setCreatedVendorInfo({
                        id: created.id,
                        vendorId: creds.vendorId || creds.staffId || `VND-${String(created.id).padStart(3, '0')}`,
                        username: creds.username || `vendor_${created.id}`,
                        password: creds.password || "Password123!",
                        name: vendorForm.name,
                        category: vendorForm.category,
                        email: vendorForm.email,
                        documentCount: vendorForm.documents.length
                    });

                    setVendorForm({
                        name: "", category: "", contactPerson: "", email: "", phone: "",
                        address: "", gstNumber: "", bankAccount: "", renewalDate: "",
                        renewalStatus: "active",
                        documents: []
                    });

                    setValidationErrors({
                        name: "",
                        contactPerson: "",
                        email: "",
                        phone: "",
                        documents: ""
                    });
                } else {
                    const generatedPassword = generateRandomPassword();
                    const generatedUsername = `vendor_${created.id}`;
                    const generatedVendorId = `VND-${String(created.id).padStart(3, '0')}`;

                    setCreatedVendorInfo({
                        id: created.id,
                        vendorId: generatedVendorId,
                        username: generatedUsername,
                        password: generatedPassword,
                        name: vendorForm.name,
                        category: vendorForm.category,
                        email: vendorForm.email,
                        documentCount: vendorForm.documents.length
                    });

                    setVendorForm({
                        name: "", category: "", contactPerson: "", email: "", phone: "",
                        address: "", gstNumber: "", bankAccount: "", renewalDate: "",
                        renewalStatus: "active",
                        documents: []
                    });

                    setValidationErrors({
                        name: "",
                        contactPerson: "",
                        email: "",
                        phone: "",
                        documents: ""
                    });

                    toast({
                        title: "Vendor created with credentials",
                        description: "Credentials are displayed in the dialog"
                    });
                }
            },
            onError: (err) => {
                toast({
                    title: "Error",
                    description: err?.message || "Failed to add vendor.",
                    variant: "destructive"
                });
            },
        }
    });

    const generateRandomPassword = () => {
        const length = 12;
        const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()";
        let password = "";
        for (let i = 0; i < length; i++) {
            password += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return password;
    };

    const createOrderMutation = useCreatePurchaseOrder({
        mutation: {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
                setOpenOrder(false);
                setOrderForm({
                    vendorId: "", description: "", quantity: "1", unitPrice: "",
                    deliveryDate: "", notes: ""
                });
                toast({ title: "Purchase order created" });
            },
            onError: (err) => {
                toast({
                    title: "Error",
                    description: err?.message || "Failed to create order.",
                    variant: "destructive"
                });
            },
        }
    });

    const updateOrderMutation = useUpdatePurchaseOrder({
        mutation: {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
                toast({ title: "Order updated" });
            },
            onError: (err) => {
                toast({
                    title: "Update failed",
                    description: err?.message,
                    variant: "destructive"
                });
            },
        },
    });

    const deleteVendorMutation = useDeleteVendor({
        mutation: {
            onMutate: async (variables) => {
                await qc.cancelQueries({ queryKey: getListVendorsQueryKey() });
                const previousVendors = qc.getQueryData(getListVendorsQueryKey());

                qc.setQueryData(getListVendorsQueryKey(), (old) =>
                    old?.filter(v => String(v.id) !== String(variables.id)) || []
                );

                return { previousVendors };
            },
            onError: (err, variables, context) => {
                if (context?.previousVendors) {
                    qc.setQueryData(getListVendorsQueryKey(), context.previousVendors);
                }
                toast({ 
                    title: "Delete failed", 
                    description: err?.message || "Could not delete vendor.", 
                    variant: "destructive" 
                });
            },
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
                refetchVendors();
                setOpenVendorDetail(false);
                toast({ title: "Vendor deleted successfully" });
            },
        }
    });

    const deleteOrderMutation = useDeletePurchaseOrder({
        mutation: {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListPurchaseOrdersQueryKey() });
                toast({ title: "Purchase order deleted successfully" });
            },
            onError: (err) => {
                toast({
                    title: "Delete failed",
                    description: err?.message || err?.details || "Could not delete order.",
                    variant: "destructive"
                });
            },
        }
    });

    const updateVendorMutation = useUpdateVendor({
        mutation: {
            onSuccess: () => {
                qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
                refetchVendors();
            }
        }
    });
    void updateVendorMutation;

    const approveVendorAction = (id, action) => {
        fetch(`/api/vendors/${id}/${action}`, { method: "POST" })
            .then(r => r.ok ? r.json() : Promise.reject(new Error("Failed")))
            .then(() => {
                qc.invalidateQueries({ queryKey: getListVendorsQueryKey() });
                refetchVendors();
                toast({
                    title: `Vendor ${action === "approve" ? "approved" : action === "reject" ? "rejected" : "suspended"}`
                });
            })
            .catch(() => toast({ title: "Action failed", variant: "destructive" }));
    };

    const handleDeleteVendor = (id, name) => {
        if (!confirm(`Delete vendor "${name}" and their account permanently?\n\nThis action cannot be undone.`)) return;
        
        deleteVendorMutation.mutate({ id });
    };

    const handleDeleteOrder = (id, poNumber) => {
        if (!confirm(`Delete purchase order ${poNumber || id}?\n\nThis action cannot be undone.`)) return;
        deleteOrderMutation.mutate({ id });
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() =>
            toast({ title: "Copied to clipboard" })
        );
    };

    const viewDocuments = (vendor) => {
        setSelectedVendor(vendor);
        setOpenDocuments(true);
    };

    const openVendorDetailDialog = (vendor) => {
        setSelectedVendor(vendor);
        setOpenVendorDetail(true);
    };

    const isManager = ["admin", "store_manager", "accountant"].includes(user?.role ?? "");
    const isAdmin = user?.role === "admin";
    const isVendor = user?.role === UserRole.vendor;

    const myVendorProfile = isVendor ? vendors.find(v => v.email === user?.email) : null;
    const scopedVendors = isVendor ? (myVendorProfile ? [myVendorProfile] : []) : vendors;
    const filteredOrders = isVendor ? orders.filter(o => String(o.vendorId) === String(myVendorProfile?.id || user?.id)) : orders;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-serif font-bold text-yellow-400">
                        {isVendor ? "My Vendor Portal" : "Vendors & Procurement"}
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        {isVendor ? "Your profile and purchase orders" : "Manage supplier registry and purchase orders"}
                    </p>
                </div>
                {isManager && (
                    <div className="flex gap-2 flex-wrap">
                        <Dialog
                            open={openVendor}
                            onOpenChange={(open) => {
                                setOpenVendor(open);
                                if (!open) {
                                    setCreatedVendorInfo(null);
                                    setValidationErrors({
                                        name: "",
                                        contactPerson: "",
                                        email: "",
                                        phone: "",
                                        documents: ""
                                    });
                                    setDocumentType("");
                                    setDocumentError("");
                                }
                            }}
                        >
                            <DialogTrigger asChild>
                                <Button className="gap-2 bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/20">
                                    <Plus className="w-4 h-4" />Add Vendor
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>
                                        {createdVendorInfo ? "Vendor Account Created" : "Register New Vendor"}
                                    </DialogTitle>
                                </DialogHeader>

                                {createdVendorInfo ? (
                                    <div className="space-y-4 py-2">
                                        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                                            <div className="flex items-center gap-2 mb-3">
                                                <CheckCircle className="w-5 h-5 text-emerald-400" />
                                                <p className="font-medium text-emerald-400">Account Created Successfully</p>
                                            </div>
                                            <p className="text-sm text-muted-foreground mb-4">
                                                Share these credentials securely with the vendor. The password is shown only once.
                                            </p>
                                            <div className="space-y-3">
                                                {[
                                                    { label: "Vendor ID", value: createdVendorInfo.vendorId },
                                                    { label: "Username", value: createdVendorInfo.username },
                                                    { label: "Password", value: createdVendorInfo.password },
                                                ].map((item) => (
                                                    <div key={item.label} className="flex items-center justify-between p-3 bg-muted rounded-md">
                                                        <div>
                                                            <p className="text-xs text-muted-foreground">{item.label}</p>
                                                            <p className="font-mono font-medium">{item.value}</p>
                                                        </div>
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="w-8 h-8"
                                                            onClick={() => copyToClipboard(item.value)}
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                            {createdVendorInfo.documentCount > 0 && (
                                                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-md">
                                                    <p className="text-xs text-blue-400">
                                                        <FileCheck className="w-3 h-3 inline mr-1" />
                                                        {createdVendorInfo.documentCount} document(s) uploaded successfully
                                                    </p>
                                                </div>
                                            )}
                                            <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-md">
                                                <p className="text-xs text-amber-400">
                                                    <AlertCircle className="w-3 h-3 inline mr-1" />
                                                    Vendor can log in with these credentials. They will see their own vendor profile and purchase orders.
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            className="w-full"
                                            onClick={() => {
                                                setOpenVendor(false);
                                                setCreatedVendorInfo(null);
                                            }}
                                        >
                                            Done
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-4 py-2">
                                        {/* Company Name */}
                                        <div>
                                            <Label>Company Name *</Label>
                                            <input
                                                value={vendorForm.name}
                                                onChange={e => {
                                                    const value = e.target.value;
                                                    handleVendorFormChange("name", value);
                                                }}
                                                onBlur={() => {
                                                    const error = validateCompanyName(vendorForm.name);
                                                    setValidationErrors(prev => ({ ...prev, name: error }));
                                                }}
                                                className={`w-full border ${validationErrors.name ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2 text-sm mt-1 bg-background`}
                                                placeholder="Vendor company name"
                                            />
                                            {validationErrors.name && (
                                                <p className="text-xs text-red-500 mt-1">{validationErrors.name}</p>
                                            )}
                                        </div>

                                        {/* Category and Contact Person */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label>Category *</Label>
                                                <Select
                                                    value={vendorForm.category}
                                                    onValueChange={v => setVendorForm(f => ({ ...f, category: v }))}
                                                >
                                                    <SelectTrigger className="mt-1">
                                                        <SelectValue placeholder="Select category" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {VENDOR_CATEGORIES.map(c => (
                                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <Label>Contact Person</Label>
                                                <input
                                                    value={vendorForm.contactPerson}
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        handleVendorFormChange("contactPerson", value);
                                                    }}
                                                    onBlur={() => {
                                                        const error = validateContactPerson(vendorForm.contactPerson);
                                                        setValidationErrors(prev => ({ ...prev, contactPerson: error }));
                                                    }}
                                                    className={`w-full border ${validationErrors.contactPerson ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2 text-sm mt-1 bg-background`}
                                                    placeholder="Name"
                                                />
                                                {validationErrors.contactPerson && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.contactPerson}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Email and Phone */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label>Email</Label>
                                                <input
                                                    type="email"
                                                    value={vendorForm.email}
                                                    onChange={e => {
                                                        const value = e.target.value;
                                                        handleVendorFormChange("email", value);
                                                    }}
                                                    onBlur={() => {
                                                        const error = validateEmail(vendorForm.email);
                                                        setValidationErrors(prev => ({ ...prev, email: error }));
                                                    }}
                                                    className={`w-full border ${validationErrors.email ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2 text-sm mt-1 bg-background`}
                                                    placeholder="vendor@domain.com"
                                                />
                                                {validationErrors.email && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.email}</p>
                                                )}
                                            </div>
                                            <div>
                                                <Label>Phone</Label>
                                                <input
                                                    value={vendorForm.phone}
                                                    onChange={e => {
                                                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                                                        handleVendorFormChange("phone", value);
                                                    }}
                                                    onBlur={() => {
                                                        const error = validatePhone(vendorForm.phone);
                                                        setValidationErrors(prev => ({ ...prev, phone: error }));
                                                    }}
                                                    className={`w-full border ${validationErrors.phone ? 'border-red-500' : 'border-border'} rounded-md px-3 py-2 text-sm mt-1 bg-background`}
                                                    placeholder="9876543210"
                                                    maxLength="10"
                                                />
                                                {validationErrors.phone && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.phone}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Address */}
                                        <div>
                                            <Label>Address</Label>
                                            <input
                                                value={vendorForm.address}
                                                onChange={e => setVendorForm(f => ({ ...f, address: e.target.value }))}
                                                className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                            />
                                        </div>

                                        {/* GST and Bank */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <Label>GSTIN</Label>
                                                <input
                                                    value={vendorForm.gstNumber}
                                                    onChange={e => setVendorForm(f => ({ ...f, gstNumber: e.target.value.toUpperCase() }))}
                                                    className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background font-mono"
                                                    placeholder="22AAAAA0000A1Z5"
                                                />
                                            </div>
                                            <div>
                                                <Label>Bank Account Details</Label>
                                                <input
                                                    value={vendorForm.bankAccount}
                                                    onChange={e => setVendorForm(f => ({ ...f, bankAccount: e.target.value }))}
                                                    className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                                    placeholder="Bank name, A/C No, IFSC"
                                                />
                                            </div>
                                        </div>

                                        {/* Contract Details */}
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
    <div>
        <Label>Contract Renewal Date</Label>

        <input
            type="date"
            value={vendorForm.renewalDate}
            min={new Date().toISOString().split("T")[0]}
            onChange={(e) => {
                setVendorForm((f) => ({
                    ...f,
                    renewalDate: e.target.value,
                }));
            }}
            onKeyDown={(e) => e.preventDefault()} // Disable manual typing
            onPaste={(e) => e.preventDefault()} // Disable paste
            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background text-white"
            style={{
                colorScheme: "dark", // White calendar icon in dark mode
                cursor: "pointer",
                minHeight: "44px",
                boxSizing: "border-box",
            }}
        />
    </div>

    <div>
        <Label>Contract Status</Label>

        <Select
            value={vendorForm.renewalStatus}
            onValueChange={(v) =>
                setVendorForm((f) => ({
                    ...f,
                    renewalStatus: v,
                }))
            }
        >
            <SelectTrigger className="mt-1">
                <SelectValue />
            </SelectTrigger>

            <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending_renewal">
                    Pending Renewal
                </SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
            </SelectContent>
        </Select>
    </div>
</div>
                                        {/* Document Upload Section */}
                                        <div className="border-t border-border pt-4">
                                            <Label className="text-sm font-semibold flex items-center gap-2">
                                                <Upload className="w-4 h-4" />
                                                Upload Documents *
                                            </Label>
                                            <p className="text-xs text-muted-foreground mt-1 mb-3">
                                                Upload GST certificate, PAN card, or other verification documents (Max 5MB each)
                                            </p>

                                            <div className="space-y-3">
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div>
                                                        <Select
                                                            value={documentType}
                                                            onValueChange={setDocumentType}
                                                        >
                                                            <SelectTrigger className="mt-1">
                                                                <SelectValue placeholder="Select document type" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {DOCUMENT_TYPES.map(doc => (
                                                                    <SelectItem key={doc.value} value={doc.value}>
                                                                        {doc.label}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    <div>
                                                        <input
                                                            ref={fileInputRef}
                                                            type="file"
                                                            onChange={handleDocumentUpload}
                                                            accept=".pdf,.jpg,.jpeg,.png"
                                                            className="hidden"
                                                            id="document-upload"
                                                        />
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="w-full mt-1"
                                                            onClick={() => fileInputRef.current?.click()}
                                                            disabled={uploadingDocument || !documentType}
                                                        >
                                                            {uploadingDocument ? (
                                                                <div className="flex items-center gap-2">
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-400"></div>
                                                                    Uploading...
                                                                </div>
                                                            ) : (
                                                                <>
                                                                    <Upload className="w-4 h-4 mr-2" />
                                                                    Choose File
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                </div>

                                                {documentError && (
                                                    <p className="text-xs text-red-500">{documentError}</p>
                                                )}

                                                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                                                    <span>Allowed: PDF, JPG, PNG</span>
                                                    <span>•</span>
                                                    <span>Max size: 5MB</span>
                                                </div>

                                                {vendorForm.documents.length > 0 && (
                                                    <div className="space-y-2 mt-3">
                                                        <p className="text-xs font-medium text-muted-foreground">
                                                            Uploaded Documents ({vendorForm.documents.length})
                                                        </p>
                                                        {vendorForm.documents.map(doc => {
                                                            const docTypeLabel = DOCUMENT_TYPES.find(d => d.value === doc.type)?.label || doc.type;
                                                            return (
                                                                <div key={doc.id} className="flex items-center justify-between p-2 bg-muted rounded-md border border-border">
                                                                    <div className="flex items-center gap-2 min-w-0">
                                                                        {getFileIcon(doc.file?.type)}
                                                                        <div className="min-w-0">
                                                                            <p className="text-xs font-medium truncate">{doc.name}</p>
                                                                            <p className="text-[10px] text-muted-foreground">
                                                                                {docTypeLabel} • {formatFileSize(doc.size)} • {doc.uploadDate}
                                                                            </p>
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        type="button"
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="w-6 h-6 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                                                                        onClick={() => removeDocument(doc.id)}
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </Button>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {validationErrors.documents && (
                                                    <p className="text-xs text-red-500 mt-1">{validationErrors.documents}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3">
                                            <div className="flex items-center gap-2">
                                                <KeyRound className="w-4 h-4 text-blue-400" />
                                                <p className="text-xs text-blue-400">
                                                    Vendor ID, username and password are auto-generated by the server.
                                                </p>
                                            </div>
                                        </div>

                                        <Button
                                            className="w-full"
                                            disabled={!vendorForm.name || !vendorForm.category || createVendorMutation.isPending || vendorForm.documents.length === 0}
                                            onClick={() => {
                                                if (validateForm()) {
                                                    createVendorMutation.mutate({
                                                        data: {
                                                            name: vendorForm.name,
                                                            category: vendorForm.category || undefined,
                                                            contactPerson: vendorForm.contactPerson,
                                                            email: vendorForm.email,
                                                            phone: vendorForm.phone,
                                                            address: vendorForm.address || undefined,
                                                            gstNumber: vendorForm.gstNumber || undefined,
                                                            bankAccount: vendorForm.bankAccount || undefined,
                                                            renewalDate: vendorForm.renewalDate || undefined,
                                                            renewalStatus: vendorForm.renewalStatus || "active",
                                                            documents: vendorForm.documents.map(doc => ({
                                                                id: doc.id ? String(doc.id) : String(Date.now()),
                                                                name: doc.name,
                                                                type: doc.type,
                                                                size: doc.size,
                                                                url: doc.url,
                                                                uploadDate: doc.uploadDate
                                                            }))
                                                        }
                                                    });
                                                } else {
                                                    toast({
                                                        title: "Validation Error",
                                                        description: "Please fix the errors before submitting.",
                                                        variant: "destructive"
                                                    });
                                                }
                                            }}
                                        >
                                            {createVendorMutation.isPending ? "Registering..." : "Register Vendor"}
                                        </Button>
                                    </div>
                                )}
                            </DialogContent>
                        </Dialog>

                        <Dialog open={openOrder} onOpenChange={setOpenOrder}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="gap-2 text-yellow-400 border-yellow-500/30">
                                    <Plus className="w-4 h-4" />New Order
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>Create Purchase Order</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-2">
                                    <div>
                                        <Label>Vendor *</Label>
                                        <Select
                                            value={orderForm.vendorId}
                                            onValueChange={v => setOrderForm(f => ({ ...f, vendorId: v }))}
                                        >
                                            <SelectTrigger className="mt-1">
                                                <SelectValue placeholder="Select vendor" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {vendors.filter(v => v.status === "active" || v.status === "approved").map(v => (
                                                    <SelectItem key={v.id} value={String(v.id)}>{v.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label>Description *</Label>
                                        <textarea
                                            value={orderForm.description}
                                            onChange={e => setOrderForm(f => ({ ...f, description: e.target.value }))}
                                            rows={3}
                                            className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background resize-none"
                                            placeholder="Items and specifications..."
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label>Quantity</Label>
                                            <input
                                                type="number"
                                                value={orderForm.quantity}
                                                onChange={e => setOrderForm(f => ({ ...f, quantity: e.target.value }))}
                                                className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                                min="1"
                                            />
                                        </div>
                                        <div>
                                            <Label>Unit Price (₹)</Label>
                                            <input
                                                type="number"
                                                value={orderForm.unitPrice}
                                                onChange={e => setOrderForm(f => ({ ...f, unitPrice: e.target.value }))}
                                                className="w-full border border-border rounded-md px-3 py-2 text-sm mt-1 bg-background"
                                            />
                                        </div>
                                    </div>
                                   <div style={{ width: "100%" }}>
    <Label
        htmlFor="deliveryDate"
        style={{
            display: "block",
            fontSize: "14px",
            fontWeight: "500",
            marginBottom: "6px"
        }}
    >
        Expected Delivery
    </Label>

    <input
        id="deliveryDate"
        type="date"
        value={orderForm.deliveryDate}
        min={new Date().toISOString().split("T")[0]}
        onChange={(e) => {
            const selectedDate = e.target.value;

            setOrderForm((f) => ({
                ...f,
                deliveryDate: selectedDate,
            }));
        }}
        onKeyDown={(e) => e.preventDefault()} // Prevent manual typing
        onPaste={(e) => e.preventDefault()}   // Prevent pasting
        required
        style={{
            width: "100%",
            minHeight: "44px",
            padding: "10px 12px",
            marginTop: "4px",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            background: "hsl(var(--background))",
            color: "#ffffff",
            fontSize: "14px",
            outline: "none",
            boxSizing: "border-box",
            colorScheme: "dark", // Makes calendar icon white in dark mode
            cursor: "pointer"
        }}
    />
</div>
                                    {orderForm.quantity && orderForm.unitPrice && (
                                        <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-lg p-3">
                                            <p className="text-xs text-muted-foreground">Total Order Value</p>
                                            <p className="text-lg font-bold text-yellow-400">
                                                {formatCurrency(parseFloat(orderForm.quantity) * parseFloat(orderForm.unitPrice))}
                                            </p>
                                        </div>
                                    )}
                                    <Button
                                        className="w-full"
                                        disabled={!orderForm.vendorId || !orderForm.description || createOrderMutation.isPending}
                                        onClick={() => createOrderMutation.mutate({
                                            data: {
                                                vendorId: parseInt(orderForm.vendorId),
                                                deliveryDate: orderForm.deliveryDate || undefined,
                                                notes: orderForm.notes || undefined,
                                                items: [{
                                                    name: orderForm.description,
                                                    quantity: parseInt(orderForm.quantity) || 1,
                                                    unitPrice: parseFloat(orderForm.unitPrice) || 0
                                                }]
                                            }
                                        })}
                                    >
                                        {createOrderMutation.isPending ? "Creating..." : "Create Purchase Order"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <Card className="glass-card glass-hover border-t-2 border-t-yellow-400/40">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-yellow-500/10 p-2 rounded-lg text-yellow-400">
                            <Building className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">{isVendor ? "My Profile" : "Total Vendors"}</p>
                            <p className="text-2xl font-bold text-yellow-400">{scopedVendors.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card glass-hover border-t-2 border-t-emerald-400/40">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                            <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">Active</p>
                            <p className="text-2xl font-bold text-emerald-400">
                                {scopedVendors.filter(v => v.status === "active").length}
                            </p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card glass-hover border-t-2 border-t-amber-400/40">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-amber-500/10 p-2 rounded-lg text-amber-400">
                            <Package className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">{isVendor ? "My Orders" : "Purchase Orders"}</p>
                            <p className="text-2xl font-bold text-amber-400">{filteredOrders.length}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="glass-card glass-hover border-t-2 border-t-green-400/40">
                    <CardContent className="p-4 flex items-center gap-3">
                        <div className="bg-green-500/10 p-2 rounded-lg text-green-400">
                            <ShoppingCart className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground">{isVendor ? "My Order Value" : "Total Order Value"}</p>
                            <p className="text-lg font-bold text-green-400">
                                {formatCurrency(filteredOrders.reduce((a, o) => a + Number(o.totalAmount ?? 0), 0))}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tabs */}
            <div className="flex gap-2">
                <Button
                    variant={tab === "vendors" ? "default" : "outline"}
                    size="sm"
                    className={tab === "vendors" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : ""}
                    onClick={() => setTab("vendors")}
                >
                    {isVendor ? "My Profile" : "Vendors"}
                </Button>
                <Button
                    variant={tab === "orders" ? "default" : "outline"}
                    size="sm"
                    className={tab === "orders" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : ""}
                    onClick={() => setTab("orders")}
                >
                    {isVendor ? "My Orders" : "Purchase Orders"}
                </Button>
            </div>

            {/* Vendors Tab */}
            {tab === "vendors" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {vendorsLoading ?
                        Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
                        : scopedVendors.length === 0 ?
                            <p className="text-muted-foreground col-span-full text-center py-12">
                                {isVendor ? "Your vendor profile is not set up yet. Contact the admin." : "No vendors registered."}
                            </p>
                            : scopedVendors.map(vendor => (
                                <Card 
                                    key={vendor.id} 
                                    className="hover:border-yellow-500/30 transition-colors cursor-pointer hover:shadow-lg hover:shadow-yellow-500/5"
                                    onClick={() => openVendorDetailDialog(vendor)}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="p-2 rounded-lg bg-yellow-500/10">
                                                <Building className="w-4 h-4 text-yellow-400" />
                                            </div>
                                            <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                                                {vendor.category}
                                            </Badge>
                                        </div>
                                        <p className="font-semibold mt-2">
                                            <ProfileHoverCard kind="vendor" id={vendor.id} name={vendor.name} />
                                        </p>
                                        {vendor.contactPerson && (
                                            <p className="text-xs text-muted-foreground mt-1 font-semibold">
                                                Contact: {vendor.contactPerson}
                                            </p>
                                        )}
                                        {vendor.email && <p className="text-xs text-muted-foreground">{vendor.email}</p>}
                                        {vendor.phone && <p className="text-xs text-muted-foreground">{vendor.phone}</p>}

                                        {vendor.bankAccount && (
                                            <div className="mt-2 text-xs border-t border-border/40 pt-2 text-muted-foreground">
                                                <span className="font-semibold block text-[10px] uppercase text-yellow-400">Bank Details</span>
                                                <p className="font-mono text-[10px]">{vendor.bankAccount}</p>
                                            </div>
                                        )}

                                        {(vendor.renewalDate || vendor.renewalStatus) && (
                                            <div className="mt-2 text-xs border-t border-border/40 pt-2 text-muted-foreground flex justify-between">
                                                <div>
                                                    <span className="font-semibold block text-[10px] uppercase text-yellow-400">Renewal Date</span>
                                                    <p className="text-[10px]">{vendor.renewalDate || "—"}</p>
                                                </div>
                                                <div>
                                                    <span className="font-semibold block text-[10px] uppercase text-yellow-400">Contract</span>
                                                    <Badge className={`text-[9px] py-0 px-1 capitalize ${vendor.renewalStatus === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                        vendor.renewalStatus === "expired" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                            "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                                        }`}>
                                                        {vendor.renewalStatus ?? "active"}
                                                    </Badge>
                                                </div>
                                            </div>
                                        )}

                                        {/* Documents Section */}
                                        <div className="mt-3 pt-2 border-t border-border/40">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                    <FileText className="w-3 h-3" />
                                                    <span>Documents</span>
                                                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                                                        {vendor.documents?.length || 0}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 px-2 text-xs text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        viewDocuments(vendor);
                                                    }}
                                                >
                                                    <Eye className="w-3 h-3 mr-1" />
                                                    View
                                                </Button>
                                            </div>
                                            {vendor.documents && vendor.documents.length > 0 && (
                                                <div className="mt-1 flex flex-wrap gap-1">
                                                    {vendor.documents.slice(0, 3).map((doc, idx) => (
                                                        <Badge key={idx} variant="outline" className="text-[8px] px-1 py-0 bg-blue-500/5 border-blue-500/20">
                                                            {getDocumentTypeLabel(doc.type)}
                                                        </Badge>
                                                    ))}
                                                    {vendor.documents.length > 3 && (
                                                        <Badge variant="outline" className="text-[8px] px-1 py-0">
                                                            +{vendor.documents.length - 3} more
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex gap-2 mt-3 flex-wrap items-center">
                                            {(() => {
                                                const st = String(vendor.status ?? "active");
                                                return (
                                                    <>
                                                        <Badge variant="outline" className={`text-xs ${st === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                                            st === "pending_verification" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                                                st === "blacklisted" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                                    "bg-muted text-muted-foreground"
                                                            }`}>
                                                            {st}
                                                        </Badge>
                                                        {isAdmin && st !== "active" && (
                                                            <Button size="sm" variant="outline" className="h-6 text-xs text-emerald-400 border-emerald-500/30" onClick={(e) => { e.stopPropagation(); approveVendorAction(vendor.id, "approve"); }}>
                                                                Approve
                                                            </Button>
                                                        )}
                                                        {isAdmin && st === "active" && (
                                                            <Button size="sm" variant="outline" className="h-6 text-xs text-amber-400 border-amber-500/30" onClick={(e) => { e.stopPropagation(); approveVendorAction(vendor.id, "suspend"); }}>
                                                                Suspend
                                                            </Button>
                                                        )}
                                                        {isAdmin && st !== "blacklisted" && (
                                                            <Button size="sm" variant="outline" className="h-6 text-xs text-red-400 border-red-500/30" onClick={(e) => { e.stopPropagation(); approveVendorAction(vendor.id, "reject"); }}>
                                                                Reject
                                                            </Button>
                                                        )}
                                                        {/* Delete button beside reject */}
                                                        {isAdmin && (
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-6 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10" 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    handleDeleteVendor(vendor.id, vendor.name); 
                                                                }}
                                                                disabled={deleteVendorMutation.isPending}
                                                            >
                                                                <Trash2 className="w-3 h-3 mr-1" />
                                                                Delete
                                                            </Button>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                    }
                </div>
            )}

            {/* Orders Tab */}
            {tab === "orders" && (
                <Card className="border-t-2 border-t-yellow-400/30">
                    <CardHeader>
                        <CardTitle className="text-base">{isVendor ? "My Purchase Orders" : "Purchase Orders"}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {ordersLoading ?
                            <div className="space-y-3">
                                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                            </div>
                            : filteredOrders.length === 0 ?
                                <div className="text-center py-12 text-muted-foreground">No orders found.</div>
                                : (
                                    <div className="space-y-2">
                                        {filteredOrders.map(order => {
                                            const cfg = poStatusConfig[order.status] ?? { label: order.status ?? "Unknown", color: "bg-muted/50 text-muted-foreground border-border", icon: AlertCircle };
                                            const Icon = cfg.icon;
                                            return (
                                                <div key={order.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border hover:bg-accent/30 transition-colors gap-3">
                                                    <div>
                                                        <p className="font-medium text-sm">
                                                            {order.items?.[0]?.name?.slice(0, 60)}
                                                            {(order.items?.[0]?.name?.length ?? 0) > 60 ? "..." : ""}
                                                            {order.items?.length > 1 ? `+${order.items.length - 1} more` : ""}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {order.vendorName} · PO: {order.poNumber}
                                                        </p>
                                                        {order.deliveryDate && (
                                                            <p className="text-xs text-muted-foreground">Delivery: {order.deliveryDate}</p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3 flex-wrap justify-end">
                                                        {order.totalAmount != null && (
                                                            <p className="font-semibold text-sm">{formatCurrency(Number(order.totalAmount))}</p>
                                                        )}
                                                        <Badge className={`border ${cfg.color} flex items-center gap-1`}>
                                                            <Icon className="w-3 h-3" />{cfg.label}
                                                        </Badge>
                                                        {order.invoiceUrl && (
                                                            <a href={`/api/purchase-orders/${order.id}/invoice`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" title={order.invoiceNumber ? `Invoice ${order.invoiceNumber}` : "Download invoice PDF"}>
                                                                <Download className="w-3 h-3" /> Invoice
                                                            </a>
                                                        )}
                                                        {isManager && order.status === "draft" && (
                                                            <Button size="sm" variant="outline" onClick={() => updateOrderMutation.mutate({ id: order.id, data: { status: "sent" } })}>
                                                                Send Order
                                                            </Button>
                                                        )}
                                                        {isManager && (order.status === "sent") && (
                                                            <Button size="sm" variant="outline" className="text-emerald-400 border-emerald-500/30 text-xs" onClick={() => updateOrderMutation.mutate({ id: order.id, data: { status: "acknowledged" } })}>
                                                                Acknowledge
                                                            </Button>
                                                        )}
                                                        {isManager && order.status === "acknowledged" && (
                                                            <Button size="sm" variant="outline" className="text-teal-400 border-teal-500/30 text-xs" onClick={() => updateOrderMutation.mutate({ id: order.id, data: { status: "delivered" } })}>
                                                                Mark Delivered
                                                            </Button>
                                                        )}
                                                        {isVendor && order.status === "sent" && (
                                                            <Button size="sm" variant="outline" className="text-violet-400 border-violet-500/30 text-xs" onClick={() => updateOrderMutation.mutate({ id: order.id, data: { status: "acknowledged" } })}>
                                                                Acknowledge
                                                            </Button>
                                                        )}
                                                        {isVendor && order.status === "invoiced" && (
                                                            <Button size="sm" variant="outline" className="text-teal-400 border-teal-500/30 text-xs" onClick={() => updateOrderMutation.mutate({ id: order.id, data: { status: "delivered" } })}>
                                                                Mark as Delivered
                                                            </Button>
                                                        )}
                                                    </div>
                                                    {isManager && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="text-red-400 border-red-500/30 hover:bg-red-500/10 text-xs"
                                                            onClick={() => handleDeleteOrder(order.id, order.poNumber)}
                                                            disabled={deleteOrderMutation.isPending}
                                                        >
                                                            <Trash2 className="w-3 h-3 mr-1" />
                                                            Delete
                                                        </Button>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )
                        }
                    </CardContent>
                </Card>
            )}

            {/* Vendor Detail Dialog */}
            <Dialog open={openVendorDetail} onOpenChange={setOpenVendorDetail}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Building className="w-5 h-5 text-yellow-400" />
                            Vendor Details
                        </DialogTitle>
                    </DialogHeader>
                    
                    {selectedVendor && (
                        <div className="space-y-4 py-2">
                            {/* Header with Status */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h2 className="text-xl font-bold">{selectedVendor.name}</h2>
                                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                                        <Hash className="w-3 h-3" />
                                        ID: {selectedVendor.id}
                                    </p>
                                </div>
                                <Badge variant="outline" className={`text-xs ${selectedVendor.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                    selectedVendor.status === "pending_verification" ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                        selectedVendor.status === "blacklisted" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                            "bg-muted text-muted-foreground"
                                    }`}>
                                    {selectedVendor.status || "active"}
                                </Badge>
                            </div>

                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4 border border-border">
                                <div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <User className="w-3 h-3" /> Contact Person
                                    </p>
                                    <p className="font-medium">{selectedVendor.contactPerson || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Mail className="w-3 h-3" /> Email
                                    </p>
                                    <p className="font-medium">{selectedVendor.email || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> Phone
                                    </p>
                                    <p className="font-medium">{selectedVendor.phone || "—"}</p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Building className="w-3 h-3" /> Category
                                    </p>
                                    <p className="font-medium">{selectedVendor.category || "—"}</p>
                                </div>
                            </div>

                            {/* Address */}
                            {selectedVendor.address && (
                                <div className="bg-muted/30 rounded-lg p-4 border border-border">
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> Address
                                    </p>
                                    <p className="font-medium">{selectedVendor.address}</p>
                                </div>
                            )}

                            {/* Financial & Contract Details */}
                            <div className="grid grid-cols-2 gap-4 bg-muted/30 rounded-lg p-4 border border-border">
                                {selectedVendor.gstNumber && (
                                    <div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <CreditCard className="w-3 h-3" /> GSTIN
                                        </p>
                                        <p className="font-mono font-medium text-sm">{selectedVendor.gstNumber}</p>
                                    </div>
                                )}
                                {selectedVendor.bankAccount && (
                                    <div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <CreditCard className="w-3 h-3" /> Bank Account
                                        </p>
                                        <p className="font-mono font-medium text-sm">{selectedVendor.bankAccount}</p>
                                    </div>
                                )}
                                {selectedVendor.renewalDate && (
                                    <div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <Calendar className="w-3 h-3" /> Renewal Date
                                        </p>
                                        <p className="font-medium">{selectedVendor.renewalDate}</p>
                                    </div>
                                )}
                                {selectedVendor.renewalStatus && (
                                    <div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" /> Contract Status
                                        </p>
                                        <Badge className={`text-xs ${selectedVendor.renewalStatus === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                                            selectedVendor.renewalStatus === "expired" ? "bg-red-500/10 text-red-400 border-red-500/20" :
                                                "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                            }`}>
                                            {selectedVendor.renewalStatus}
                                        </Badge>
                                    </div>
                                )}
                            </div>

                            {/* Documents Section */}
                            <div className="border-t border-border pt-4">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-sm font-semibold flex items-center gap-2">
                                        <FileText className="w-4 h-4 text-yellow-400" />
                                        Documents ({selectedVendor.documents?.length || 0})
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs"
                                        onClick={() => {
                                            setOpenVendorDetail(false);
                                            viewDocuments(selectedVendor);
                                        }}
                                    >
                                        <Eye className="w-3 h-3 mr-1" />
                                        View All
                                    </Button>
                                </div>
                                {selectedVendor.documents && selectedVendor.documents.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {selectedVendor.documents.slice(0, 4).map((doc, idx) => (
                                            <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-md border border-border">
                                                {getFileIcon(doc.type)}
                                                <div className="min-w-0">
                                                    <p className="text-xs font-medium truncate">{doc.name}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {getDocumentTypeLabel(doc.type)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                        {selectedVendor.documents.length > 4 && (
                                            <div className="flex items-center justify-center p-2 bg-muted rounded-md border border-border">
                                                <p className="text-xs text-muted-foreground">
                                                    +{selectedVendor.documents.length - 4} more documents
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-sm text-muted-foreground">No documents uploaded</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-border">
                                {isAdmin && (
                                    <Button
                                        variant="destructive"
                                        className="flex-1"
                                        onClick={() => {
                                            setOpenVendorDetail(false);
                                            handleDeleteVendor(selectedVendor.id, selectedVendor.name);
                                        }}
                                        disabled={deleteVendorMutation.isPending}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        {deleteVendorMutation.isPending ? "Deleting..." : "Delete Vendor"}
                                    </Button>
                                )}
                                <Button
                                    variant="outline"
                                    className="flex-1"
                                    onClick={() => setOpenVendorDetail(false)}
                                >
                                    Close
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Documents View Dialog */}
            <Dialog open={openDocuments} onOpenChange={setOpenDocuments}>
                <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <FileText className="w-5 h-5 text-yellow-400" />
                            Documents - {selectedVendor?.name}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {selectedVendor?.documents && selectedVendor.documents.length > 0 ? (
                            <div className="space-y-3">
                                {selectedVendor.documents.map((doc, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg border border-border">
                                        <div className="flex items-center gap-3 min-w-0">
                                            {getFileIcon(doc.type)}
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium truncate">{doc.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {getDocumentTypeLabel(doc.type)} • {doc.uploadDate || "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                        {doc.url && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs"
                                                onClick={() => window.open(doc.url, '_blank')}
                                            >
                                                <Download className="w-3 h-3 mr-1" />
                                                View
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <File className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                <p>No documents uploaded</p>
                                <p className="text-xs mt-1">Documents will appear here once uploaded</p>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}