export const UserRole = {
    admin: "admin",
    teacher: "teacher",
    accountant: "accountant",
    clerk: "clerk",
    transport_manager: "transport_manager",
    driver: "driver",
    hostel_warden: "hostel_warden",
    store_manager: "store_manager",
    student: "student",
    parent: "parent",
    vendor: "vendor",
    librarian: "librarian",
};
export const StudentStatus = {
    active: "active",
    inactive: "inactive",
    graduated: "graduated",
    transferred: "transferred",
};
export const StaffStatus = {
    active: "active",
    inactive: "inactive",
    on_leave: "on_leave",
};
export const AttendanceStatus = {
    present: "present",
    absent: "absent",
    late: "late",
    half_day: "half_day",
};
export const AttendanceInputStatus = {
    present: "present",
    absent: "absent",
    late: "late",
    half_day: "half_day",
};
export const ExamType = {
    midterm: "midterm",
    final: "final",
    unit_test: "unit_test",
    quiz: "quiz",
    practical: "practical",
};
export const ExamStatus = {
    upcoming: "upcoming",
    ongoing: "ongoing",
    completed: "completed",
    results_published: "results_published",
};
export const FeeRecordStatus = {
    pending: "pending",
    paid: "paid",
    overdue: "overdue",
    partial: "partial",
    waived: "waived",
};
export const FeePaymentInputPaymentMethod = {
    cash: "cash",
    upi: "upi",
    card: "card",
    bank_transfer: "bank_transfer",
    cheque: "cheque",
};
export const HostelRoomType = {
    single: "single",
    double: "double",
    triple: "triple",
    dormitory: "dormitory",
};
export const HostelRoomStatus = {
    available: "available",
    full: "full",
    maintenance: "maintenance",
    reserved: "reserved",
};
export const HostelApplicationStatus = {
    pending: "pending",
    approved: "approved",
    rejected: "rejected",
    waitlisted: "waitlisted",
};
export const TransportRouteStatus = {
    active: "active",
    inactive: "inactive",
    on_trip: "on_trip",
};
export const VehicleType = {
    bus: "bus",
    van: "van",
    minibus: "minibus",
};
export const VehicleStatus = {
    active: "active",
    maintenance: "maintenance",
    inactive: "inactive",
};
export const AnnouncementAudience = {
    all: "all",
    students: "students",
    parents: "parents",
    staff: "staff",
    teachers: "teachers",
    class_specific: "class_specific",
};
export const AnnouncementPriority = {
    normal: "normal",
    important: "important",
    urgent: "urgent",
};
export const ComplaintCategory = {
    academic: "academic",
    facility: "facility",
    transport: "transport",
    hostel: "hostel",
    staff: "staff",
    fees: "fees",
    other: "other",
};
export const ComplaintStatus = {
    open: "open",
    in_progress: "in_progress",
    resolved: "resolved",
    closed: "closed",
};
export const ComplaintPriority = {
    low: "low",
    medium: "medium",
    high: "high",
};
export const VendorStatus = {
    active: "active",
    inactive: "inactive",
    blacklisted: "blacklisted",
    pending_verification: "pending_verification",
};
export const PurchaseOrderStatus = {
    draft: "draft",
    sent: "sent",
    acknowledged: "acknowledged",
    delivered: "delivered",
    invoiced: "invoiced",
    paid: "paid",
    cancelled: "cancelled",
};
export const StudyMaterialType = {
    pdf: "pdf",
    video: "video",
    document: "document",
    link: "link",
    note: "note",
};
export const AssignmentStatus = {
    draft: "draft",
    published: "published",
    closed: "closed",
};
export const LessonPlanStatus = {
    draft: "draft",
    submitted: "submitted",
    approved: "approved",
    rejected: "rejected",
};
export const AdmissionStatus = {
    pending: "pending",
    under_review: "under_review",
    approved: "approved",
    rejected: "rejected",
    waitlisted: "waitlisted",
    enrolled: "enrolled",
};
