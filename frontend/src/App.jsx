import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Students from "@/pages/students";
import StudentDetail from "@/pages/student-detail";
import ParentMapping from "@/pages/parent-mapping";
import Staff from "@/pages/staff";
import StaffDetail from "@/pages/staff-detail";
import Classes from "@/pages/classes";
import Subjects from "@/pages/subjects";
import Attendance from "@/pages/attendance";
import Exams from "@/pages/exams";
import ExamResults from "@/pages/exam-results";
import Fees from "@/pages/fees";
import Hostel from "@/pages/hostel";
import Transport from "@/pages/transport";
import TransportRoutes from "@/pages/transport-routes";
import TransportVehicles from "@/pages/transport-vehicles";
import TransportDrivers from "@/pages/transport-drivers";
import TransportAssignments from "@/pages/transport-assignments";
import DriverRoute from "@/pages/driver-route";
import Products from "@/pages/products";
import StockMovements from "@/pages/stock-movements";
import LowStock from "@/pages/low-stock";
import Suppliers from "@/pages/suppliers";
import StorePurchaseOrders from "@/pages/store-purchase-orders";
import StoreReports from "@/pages/store-reports";
import Announcements from "@/pages/announcements";
import Complaints from "@/pages/complaints";
import Vendors from "@/pages/vendors";
import Admissions from "@/pages/admissions";
import Materials from "@/pages/materials";
import Assignments from "@/pages/assignments";
import LessonPlans from "@/pages/lesson-plans";
import Leaves from "@/pages/leaves";
import Timetable from "@/pages/timetable";
import Visitors from "@/pages/visitors";
import HostelAttendance from "@/pages/hostel-attendance";
import LibraryPage from "@/pages/library";
import VendorFinance from "@/pages/vendor-finance";
import Profile from "@/pages/profile";
import Payroll from "@/pages/payroll";
import TeacherCheckInOutCard from "@/pages/TeacherCheckInOutCard";





const queryClient = new QueryClient();
function ProtectedRoute({ component: Component, roles, ...rest }) {
    const { isAuthenticated, isLoading, user } = useAuth();
    const [location, setLocation] = useLocation();
    useEffect(() => {
        if (!isLoading && !isAuthenticated) {
            // Preserve the intended URL (path + query) so the login page can
            // return the user here after a successful sign-in.
            const here = location + (window.location.search || "");
            const next = here && here !== "/" && here !== "/login" ? `?next=${encodeURIComponent(here)}` : "";
            setLocation("/login" + next);
        }
    }, [isAuthenticated, isLoading, location, setLocation]);
    if (isLoading) {
        return (<div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary"/>
      </div>);
    }
    if (!isAuthenticated)
        return null;
    if (roles && user && !roles.includes(user.role)) {
        return (<Layout>
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-400 max-w-md mx-auto mt-16 text-center">
          <h1 className="text-2xl font-serif font-bold text-red-400">Access Denied</h1>
          <p className="text-muted-foreground text-sm">Your role ({user.role}) does not have permission to view this page.</p>
        </div>
      </Layout>);
    }
    return (<Layout>
      <Component {...rest}/>
    </Layout>);
}
function Router() {
    return (<Switch>
      <Route path="/" component={Login}/>
      <Route path="/login" component={Login}/>
      <Route path="/dashboard"><ProtectedRoute component={Dashboard}/></Route>
      <Route path="/students"><ProtectedRoute component={Students} roles={["admin", "teacher", "clerk", "librarian"]}/></Route>
      <Route path="/students/:id"><ProtectedRoute component={StudentDetail} roles={["admin", "teacher", "clerk", "librarian", "student", "parent"]}/></Route>
      <Route path="/parent-mapping"><ProtectedRoute component={ParentMapping} roles={["admin", "clerk"]}/></Route>
      <Route path="/staff"><ProtectedRoute component={Staff} roles={["admin"]}/></Route>
      <Route path="/staff/:id"><ProtectedRoute component={StaffDetail} roles={["admin", "clerk"]}/></Route>
      <Route path="/classes"><ProtectedRoute component={Classes} roles={["admin", "teacher"]}/></Route>
      <Route path="/subjects"><ProtectedRoute component={Subjects} roles={["admin", "teacher", "student", "parent", "clerk"]}/></Route>
     <Route path="/attendance"><ProtectedRoute component={Attendance} roles={["admin", "teacher", "accountant", "parent", "student", "clerk"]}/></Route>
     
      <Route path="/exams"><ProtectedRoute component={Exams} roles={["admin", "teacher", "student", "parent", "clerk"]}/></Route>
      <Route path="/exam-results"><ProtectedRoute component={ExamResults} roles={["admin", "teacher", "student", "parent", "clerk"]}/></Route>
      <Route path="/fees"><ProtectedRoute component={Fees} roles={["admin", "accountant", "clerk", "parent", "student"]}/></Route>
      <Route path="/hostel"><ProtectedRoute component={Hostel} roles={["admin", "hostel_warden", "student", "parent"]}/></Route>
      <Route path="/transport"><ProtectedRoute component={Transport} roles={["admin", "transport_manager", "driver", "parent", "student"]}/></Route>
      <Route path="/transport/routes"><ProtectedRoute component={TransportRoutes} roles={["admin", "transport_manager", "driver"]}/></Route>
      <Route path="/transport/vehicles"><ProtectedRoute component={TransportVehicles} roles={["admin", "transport_manager", "driver"]}/></Route>
      <Route path="/transport/drivers"><ProtectedRoute component={TransportDrivers} roles={["admin", "transport_manager", "driver"]}/></Route>
      <Route path="/transport/assignments"><ProtectedRoute component={TransportAssignments} roles={["admin", "transport_manager", "driver"]}/></Route>
      <Route path="/my-route"><ProtectedRoute component={DriverRoute} roles={["driver"]}/></Route>
      <Route path="/inventory/products"><ProtectedRoute component={Products} roles={["admin", "store_manager"]}/></Route>
      <Route path="/inventory/stock"><ProtectedRoute component={StockMovements} roles={["admin", "store_manager"]}/></Route>
      <Route path="/inventory/low-stock"><ProtectedRoute component={LowStock} roles={["admin", "store_manager"]}/></Route>
      <Route path="/inventory/orders"><ProtectedRoute component={StorePurchaseOrders} roles={["admin", "store_manager", "accountant"]}/></Route>
      <Route path="/inventory/suppliers"><ProtectedRoute component={Suppliers} roles={["admin", "store_manager"]}/></Route>
      <Route path="/inventory/reports"><ProtectedRoute component={StoreReports} roles={["admin", "store_manager"]}/></Route>
      <Route path="/announcements"><ProtectedRoute component={Announcements} roles={["admin", "teacher", "student", "parent", "clerk", "accountant", "hostel_warden", "transport_manager", "driver", "store_manager", "vendor", "librarian"]}/></Route>
      
      <Route path="/complaints"><ProtectedRoute component={Complaints} roles={["admin", "clerk", "hostel_warden", "teacher", "student", "parent", "accountant", "transport_manager", "librarian", "driver","store_manager","vendor"]}/></Route>
      
      
       <Route path="/vendors"><ProtectedRoute component={Vendors} roles={["admin", "store_manager", "accountant", "vendor"]}/></Route>
      <Route path="/admissions"><ProtectedRoute component={Admissions} roles={["admin", "clerk", "parent"]}/></Route>
      <Route path="/materials"><ProtectedRoute component={Materials} roles={["admin", "teacher", "student", "parent", "librarian", "clerk"]}/></Route>
      <Route path="/assignments"><ProtectedRoute component={Assignments} roles={["admin", "teacher", "student", "parent", "clerk"]}/></Route>
   <Route path="/lesson-plans"><ProtectedRoute component={LessonPlans} roles={["admin", "teacher", "clerk", "driver"]}/></Route>
   
      <Route path="/leaves"><ProtectedRoute component={Leaves} roles={["admin", "teacher", "clerk", "student", "parent", "hostel_warden", "accountant", "transport_manager", "store_manager", "librarian", "driver"]}/></Route>

          <Route path="/timetable"><ProtectedRoute component={Timetable} roles={["admin", "teacher", "student", "parent", "clerk"]}/></Route>
      <Route path="/visitors"><ProtectedRoute component={Visitors} roles={["admin", "clerk", "hostel_warden"]}/></Route>
      <Route path="/hostel-attendance"><ProtectedRoute component={HostelAttendance} roles={["admin", "hostel_warden"]}/></Route>
      <Route path="/library"><ProtectedRoute component={LibraryPage} roles={["admin", "teacher", "student", "librarian"]}/></Route>
      <Route path="/vendor-finance"><ProtectedRoute component={VendorFinance} roles={["vendor"]}/></Route>
      <Route path="/profile"><ProtectedRoute component={Profile}/></Route>
      <Route path="/payroll"><ProtectedRoute component={Payroll} roles={["admin", "accountant"]}/></Route>
      <Route component={NotFound}/>
    </Switch>);
}
function App() {
    return (<QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>);
}
export default App;
