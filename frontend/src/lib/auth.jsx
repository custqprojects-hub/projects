import { createContext, useContext } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetCurrentUser, getGetCurrentUserQueryKey, useLogout } from "@/api-client";
import { useLocation } from "wouter";
const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { data: user, isLoading, error } = useGetCurrentUser({
        query: {
            queryKey: getGetCurrentUserQueryKey(),
            retry: false,
            staleTime: Infinity,
        }
    });
    const logoutMutation = useLogout({
        mutation: {
            onSuccess: () => {
                queryClient.clear();
                setLocation("/");
            }
        }
    });
    const handleLogout = () => {
        localStorage.removeItem("driver_live_tracking");
        logoutMutation.mutate();
    };
    return (<AuthContext.Provider value={{
            user: user || null,
            isLoading,
            logout: handleLogout,
            isAuthenticated: !!user
        }}>
      {children}
    </AuthContext.Provider>);
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
