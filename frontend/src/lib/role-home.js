// ─── Single source of truth: role → default landing route ─────────────────────
// Used by the login page (redirect after sign-in) and the protected-route
// wrapper (redirect to "/" then back to the intended URL after sign-in).
// Keep in sync with layout.tsx navItems — a role's landing page must appear
// in that role's nav allow-list, otherwise the user lands on a page that
// isn't shown in their sidebar.
export const ROLE_HOME = {
    admin: "/dashboard",
    teacher: "/dashboard",
    student: "/dashboard",
    parent: "/dashboard",
    clerk: "/dashboard",
    accountant: "/dashboard",
    hostel_warden: "/dashboard",
    transport_manager: "/dashboard",
    driver: "/dashboard",
    store_manager: "/dashboard",
    vendor: "/dashboard",
    librarian: "/dashboard",
};
export function homeForRole(role) {
    if (!role)
        return "/dashboard";
    return ROLE_HOME[role] ?? "/dashboard";
}
