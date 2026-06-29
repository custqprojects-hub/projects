import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Landmark, CheckCircle, Calendar, PlusCircle, AlertCircle } from "lucide-react";

export default function Payroll() {
    const qc = useQueryClient();
    const { toast } = useToast();
    const [month, setMonth] = useState("6");
    const [year, setYear] = useState("2026");
    const [isRunning, setIsRunning] = useState(false);

    const { data: runs = [], isLoading } = useQuery({
        queryKey: ["payroll"],
        queryFn: () => fetch("/api/payroll", { credentials: "include" }).then((r) => (r.ok ? r.json() : [])),
        staleTime: 5000,
    });

    const triggerPayroll = async () => {
        setIsRunning(true);
        try {
            const res = await fetch("/api/payroll/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ month: parseInt(month), year: parseInt(year) }),
                credentials: "include",
            });
            if (res.ok) {
                toast({ title: "Success", description: `Payroll processed for ${month}/${year}` });
                qc.invalidateQueries({ queryKey: ["payroll"] });
            } else {
                toast({ title: "Failed", description: "Failed to run payroll", variant: "destructive" });
            }
        } catch (err) {
            toast({ title: "Failed", description: err.message, variant: "destructive" });
        } finally {
            setIsRunning(false);
        }
    };

    const totalSalaryPaid = runs.reduce((sum, r) => sum + Number(r.net_salary), 0);

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-400">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-serif font-bold text-white">Payroll & Salaries</h1>
                        <p className="text-muted-foreground text-sm mt-1">Execute, verify, and monitor institutional salary disbursements</p>
                    </div>
                </div>
            </div>

            {/* Config & Trigger Panel */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-card md:col-span-2 border-t-2 border-t-emerald-500/40">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <PlusCircle className="w-4 h-4" />
                            <h3 className="font-semibold text-sm">Execute Monthly Payroll Run</h3>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs text-muted-foreground">Select Month</label>
                                <select 
                                    className="w-full mt-1 bg-background/50 border border-border/80 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                                    value={month}
                                    onChange={(e) => setMonth(e.target.value)}
                                >
                                    <option value="1">January</option>
                                    <option value="2">February</option>
                                    <option value="3">March</option>
                                    <option value="4">April</option>
                                    <option value="5">May</option>
                                    <option value="6">June</option>
                                    <option value="7">July</option>
                                    <option value="8">August</option>
                                    <option value="9">September</option>
                                    <option value="10">October</option>
                                    <option value="11">November</option>
                                    <option value="12">December</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs text-muted-foreground">Select Year</label>
                                <select 
                                    className="w-full mt-1 bg-background/50 border border-border/80 rounded-md px-3 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-400"
                                    value={year}
                                    onChange={(e) => setYear(e.target.value)}
                                >
                                    <option value="2026">2026</option>
                                    <option value="2027">2027</option>
                                    <option value="2028">2028</option>
                                </select>
                            </div>
                        </div>
                        <Button 
                            onClick={triggerPayroll} 
                            disabled={isRunning}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            {isRunning ? "Processing Salary Run..." : "Process Salary Run for All Active Staff"}
                        </Button>
                    </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card className="glass-card border-t-2 border-t-blue-500/40">
                    <CardContent className="p-6 flex flex-col justify-between h-full space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <Landmark className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground">Total Salary Disbursed</p>
                                <p className="text-2xl font-bold text-blue-400 mt-0.5">₹{totalSalaryPaid.toLocaleString("en-IN")}</p>
                            </div>
                        </div>
                        <div className="bg-white/5 p-3 rounded-lg flex items-start gap-2 text-xs text-muted-foreground">
                            <AlertCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                            <p>Funds are dispersed automatically via linked bank records upon verification of active staff status.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Payroll List */}
            <Card className="glass-card border-t-2 border-t-emerald-500/30">
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <h2 className="font-serif text-lg font-bold text-white">Disbursement Statements</h2>
                    </div>

                    {isLoading ? (
                        <Skeleton className="h-48 w-full" />
                    ) : runs.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Landmark className="w-10 h-10 mx-auto text-emerald-400 opacity-40 mb-2" />
                            <p className="font-semibold text-emerald-400">No payroll statements generated yet</p>
                            <p className="text-xs mt-1">Configure and process the salary run above to disburse.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs text-muted-foreground border-b border-border/40">
                                        <th className="py-3 px-2">Staff Member</th>
                                        <th className="py-3 px-2">Role</th>
                                        <th className="py-3 px-2">Month / Year</th>
                                        <th className="py-3 px-2 text-right">Base Salary</th>
                                        <th className="py-3 px-2 text-right">Allowances</th>
                                        <th className="py-3 px-2 text-right">Deductions</th>
                                        <th className="py-3 px-2 text-right">Net Paid</th>
                                        <th className="py-3 px-2 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {runs.map((r) => (
                                        <tr key={r.id} className="border-b border-border/20 hover:bg-white/5 transition-colors">
                                            <td className="py-3 px-2 font-medium text-white">{r.staffName || `ID: ${r.staff_id}`}</td>
                                            <td className="py-3 px-2 capitalize text-muted-foreground">{r.staffRole?.replace(/_/g, " ")}</td>
                                            <td className="py-3 px-2 text-xs text-muted-foreground">{r.month} / {r.year}</td>
                                            <td className="py-3 px-2 text-right text-muted-foreground">₹{Number(r.base_salary).toLocaleString("en-IN")}</td>
                                            <td className="py-3 px-2 text-right text-emerald-400">+₹{Number(r.allowances).toLocaleString("en-IN")}</td>
                                            <td className="py-3 px-2 text-right text-red-400">-₹{Number(r.deductions).toLocaleString("en-IN")}</td>
                                            <td className="py-3 px-2 text-right font-bold text-white">₹{Number(r.net_salary).toLocaleString("en-IN")}</td>
                                            <td className="py-3 px-2 text-center">
                                                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 gap-1">
                                                    <CheckCircle className="w-3 h-3" /> {r.payment_status}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
