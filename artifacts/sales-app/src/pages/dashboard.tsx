import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTotalVisits,
  useGetFeedbackSummary,
  useGetInactiveUsers,
  useGetVisitsPerUser,
  getGetTotalVisitsQueryKey,
  getGetFeedbackSummaryQueryKey,
  getGetInactiveUsersQueryKey,
  getGetVisitsPerUserQueryKey,
} from "@workspace/api-client-react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart,
  Users,
  FileSpreadsheet,
  FileText,
  Activity,
  TrendingUp,
  IndianRupee,
  Phone,
  PhoneCall,
  Package,
  CalendarDays,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type VisitRow = {
  id: number;
  visitDate: string;
  visitTime: string;
  feedback: string;
  area: string;
  siteStage: string;
  notes: string;
  customer: { id: number; name: string; mobile: string };
  user: { id: number; name: string; userId: string };
};

type BrandStat = { brandName: string; count: number };

type DateFilter = "today" | "week" | "month";

type AgentCallStat = {
  agentId: number;
  agentName: string;
  agentLoginId: string;
  visits: number;
  callsMade: number;
  connectedCalls: number;
  quotationsSent: number;
  convertedSales: number;
  conversionRate: number;
  salesValue: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FEEDBACK_COLORS: Record<string, string> = {
  Interested:       "hsl(var(--chart-1))",
  Potential:        "hsl(var(--chart-4))",
  "Not Interested": "hsl(var(--muted-foreground))",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function apiHeaders() {
  const token = localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}` };
}

function getDateRange(filter: DateFilter) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  if (filter === "today") return { from: today, to: today };
  if (filter === "week") {
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    return { from: ws.toISOString().slice(0, 10), to: today };
  }
  const ms = startOfMonth(now);
  return { from: ms.toISOString().slice(0, 10), to: today };
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FeedbackBadge({ feedback }: { feedback: string }) {
  const styles: Record<string, string> = {
    Interested:       "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    Potential:        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "Not Interested": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[feedback] ?? "bg-muted text-muted-foreground"}`}>
      {feedback}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [period,      setPeriod]      = useState<"daily" | "weekly" | "monthly">("daily");
  const [tableFilter, setTableFilter] = useState<DateFilter>("week");
  const [callFilter,  setCallFilter]  = useState<DateFilter>("month");

  // ── Existing API-based queries ─────────────────────────────────────────────
  const { data: totalVisits,       isLoading: isLoadingTotal          } = useGetTotalVisits({ query: { queryKey: getGetTotalVisitsQueryKey() } });
  const { data: feedbackSummary,   isLoading: isLoadingFeedback       } = useGetFeedbackSummary({ query: { queryKey: getGetFeedbackSummaryQueryKey() } });
  const { data: inactiveUsers,     isLoading: isLoadingInactive        } = useGetInactiveUsers({ query: { queryKey: getGetInactiveUsersQueryKey() } });
  const { data: visitsPerUser,     isLoading: isLoadingVisitsPerUser  } = useGetVisitsPerUser({ period }, { query: { queryKey: getGetVisitsPerUserQueryKey({ period }) } });
  const { data: dailyVisitsPerUser, isLoading: isLoadingDailyBreakdown } = useGetVisitsPerUser({ period: "daily" }, { query: { queryKey: getGetVisitsPerUserQueryKey({ period: "daily" }) } });

  const { data: brandStats, isLoading: isLoadingBrands } = useQuery<BrandStat[]>({
    queryKey: ["dashboard-brand-stats"],
    queryFn: async () => {
      const res  = await fetch("/api/dashboard/brand-stats", { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load brand stats");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  // ── Date ranges ────────────────────────────────────────────────────────────
  const callDateRange  = useMemo(() => getDateRange(callFilter),  [callFilter]);
  const tableDateRange = useMemo(() => getDateRange(tableFilter), [tableFilter]);

  // ── Supabase: call_logs in call-filter period ─────────────────────────────
  const { data: callRows = [] } = useQuery<any[]>({
    queryKey: ["dashboard-calls", callDateRange],
    queryFn: async () => {
      const { data } = await supabase
        .from("call_logs")
        .select("id, call_status, agent_id, customer_id, sale_value, call_date, quotation_sent")
        .gte("call_date", callDateRange.from + "T00:00:00Z")
        .lte("call_date", callDateRange.to + "T23:59:59Z");
      return data ?? [];
    },
  });

  // ── All users (for per-agent table) ───────────────────────────────────────
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["dashboard-all-users"],
    queryFn: async () => {
      const res  = await fetch("/api/users", { headers: apiHeaders() });
      const json = await res.json();
      return json.data ?? [];
    },
  });

  // ── Visits in call-filter period (for agent visit counts) ─────────────────
  const { data: agentVisitRows = [] } = useQuery<VisitRow[]>({
    queryKey: ["dashboard-agent-visits", callDateRange],
    queryFn: async () => {
      const params = new URLSearchParams({ from: callDateRange.from, to: callDateRange.to });
      const res    = await fetch(`/api/visits?${params}`, { headers: apiHeaders() });
      const json   = await res.json();
      return json.data ?? [];
    },
  });

  // ── Visits for the date-filtered table ────────────────────────────────────
  const { data: visitsData, isLoading: isLoadingVisits } = useQuery<VisitRow[]>({
    queryKey: ["dashboard-visits", tableDateRange.from, tableDateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: tableDateRange.from, to: tableDateRange.to });
      const res    = await fetch(`/api/visits?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load visits");
      const json   = await res.json();
      return json.data ?? [];
    },
  });

  // ── Overall KPI summary (all agents) ──────────────────────────────────────
  const callSummary = useMemo(() => {
    const totalCalls     = callRows.length;
    const connectedCalls = callRows.filter((c) => c.call_status === "Connected").length;
    const quotationsSent = callRows.filter((c) => c.quotation_sent === true).length;
    const convertedSales = callRows.filter((c) => c.call_status === "Converted").length;
    const salesValue     = callRows
      .filter((c) => c.call_status === "Converted")
      .reduce((sum: number, c: any) => sum + (parseFloat(c.sale_value ?? "0") || 0), 0);
    const conversionRate = totalCalls > 0 ? Math.round((convertedSales / totalCalls) * 100) : 0;
    return { totalCalls, connectedCalls, quotationsSent, convertedSales, conversionRate, salesValue };
  }, [callRows]);

  // ── Per-agent stats ────────────────────────────────────────────────────────
  const agentStats = useMemo((): AgentCallStat[] => {
    const map = new Map<number, AgentCallStat>();

    for (const u of allUsers) {
      map.set(u.id, {
        agentId:       u.id,
        agentName:     u.name,
        agentLoginId:  u.userId ?? "",
        visits:        0,
        callsMade:     0,
        connectedCalls: 0,
        quotationsSent: 0,
        convertedSales: 0,
        conversionRate: 0,
        salesValue:    0,
      });
    }

    for (const v of agentVisitRows) {
      const entry = map.get(v.user?.id);
      if (entry) entry.visits++;
    }
    for (const c of callRows) {
      const entry = map.get(c.agent_id);
      if (entry) {
        entry.callsMade++;
        if (c.call_status === "Connected")      entry.connectedCalls++;
        if (c.quotation_sent === true)           entry.quotationsSent++;
        if (c.call_status === "Converted") {
          entry.convertedSales++;
          entry.salesValue += parseFloat(c.sale_value ?? "0") || 0;
        }
      }
    }

    return Array.from(map.values())
      .filter((a) => a.callsMade > 0 || a.visits > 0)
      .map((a) => ({
        ...a,
        conversionRate: a.callsMade > 0 ? Math.round((a.convertedSales / a.callsMade) * 100) : 0,
      }))
      .sort((a, b) => b.callsMade - a.callsMade);
  }, [allUsers, agentVisitRows, callRows]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const totalToday  = (totalVisits as any)?.data?.today ?? 0;
  const totalAll    = (totalVisits as any)?.data?.total ?? 0;
  const feedbackRaw = (feedbackSummary as any)?.data ?? {};
  const pieData     = Object.entries(feedbackRaw)
    .filter(([, v]) => (v as number) > 0)
    .map(([feedback, count]) => ({ feedback, count: count as number }));
  const inactiveList: any[] = (inactiveUsers as any)?.data?.inactiveUsers ?? [];
  const visitUsers:   any[] = (visitsPerUser as any)?.data?.users ?? [];
  const dailyUsers:   any[] = (dailyVisitsPerUser as any)?.data?.users ?? [];

  const filterLabel: Record<DateFilter, string> = {
    today: "Today",
    week:  "This Week",
    month: "This Month",
  };

  const handleExport = async (type: "excel" | "pdf") => {
    try {
      const res  = await fetch(`/api/export/${type}`, { headers: apiHeaders() });
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `visits_report.${type === "excel" ? "xlsx" : "pdf"}`;
      a.click();
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of field sales activities</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
            <FileText className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards — Visits + Feedback */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Visits Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoadingTotal ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-3xl font-bold">{totalToday}</div>
                <p className="text-xs text-muted-foreground">{totalAll} total all-time</p>
              </>
            )}
            {dailyUsers.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                {isLoadingDailyBreakdown ? (
                  <div className="space-y-2">
                    <Skeleton className="h-7 w-full" />
                    <Skeleton className="h-7 w-full" />
                  </div>
                ) : (
                  dailyUsers.map((u) => (
                    <div key={u.userId} className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                        {u.userName.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs flex-1 truncate">{u.userName}</span>
                      <span className={`text-xs font-bold tabular-nums px-2 py-0.5 rounded-full ${
                        u.visitCount > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      }`}>
                        {u.visitCount}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Feedback Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="h-[200px] flex items-center justify-center">
            {isLoadingFeedback ? (
              <Skeleton className="h-[150px] w-[150px] rounded-full" />
            ) : pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="feedback"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={FEEDBACK_COLORS[entry.feedback] ?? "hsl(var(--primary))"} />
                    ))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-muted-foreground text-sm flex items-center gap-2">
                <BarChart className="h-4 w-4" />
                No feedback data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visits Per Agent chart + Inactive Today */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Visits Per Agent</CardTitle>
              <CardDescription>Performance comparison</CardDescription>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as "daily" | "weekly" | "monthly")}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="h-[300px]">
            {isLoadingVisitsPerUser ? (
              <Skeleton className="h-full w-full" />
            ) : visitUsers.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={visitUsers}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="userName" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <RechartsTooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }} />
                  <Bar dataKey="visitCount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </RechartsBarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                No visits recorded
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Today</CardTitle>
            <CardDescription>No visits recorded today</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingInactive ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : inactiveList.filter((u) => u.userId).length > 0 ? (
              <ul className="space-y-3">
                {inactiveList.filter((u) => u.userId).map((u) => (
                  <li key={u.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-xs font-bold text-secondary-foreground">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium leading-none">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.userId}</div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
                <Users className="h-8 w-8 mb-2 opacity-20" />
                <span className="text-sm">All agents active today</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Call Activity KPI card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <PhoneCall className="h-4 w-4" />
                Call Activity
              </CardTitle>
              <CardDescription>Call-based performance metrics</CardDescription>
            </div>
            <Tabs value={callFilter} onValueChange={(v) => setCallFilter(v as DateFilter)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {([
              {
                label: "Total Calls",
                value: callSummary.totalCalls,
                icon:  <Phone className="h-4 w-4 text-primary" />,
                color: "text-primary",
              },
              {
                label: "Connected Calls",
                value: callSummary.connectedCalls,
                icon:  <PhoneCall className="h-4 w-4 text-green-500" />,
                color: "text-green-600 dark:text-green-400",
              },
              {
                label: "Quotations Sent",
                value: callSummary.quotationsSent,
                icon:  <Activity className="h-4 w-4 text-blue-500" />,
                color: "text-blue-600 dark:text-blue-400",
              },
              {
                label: "Converted Sales",
                value: callSummary.convertedSales,
                icon:  <TrendingUp className="h-4 w-4 text-green-600" />,
                color: "text-green-600 dark:text-green-400",
              },
              {
                label: "Conversion Rate",
                value: `${callSummary.conversionRate}%`,
                icon:  <Activity className="h-4 w-4 text-purple-500" />,
                color: "text-purple-600 dark:text-purple-400",
              },
              {
                label: "Sales Value",
                value: `₹${callSummary.salesValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`,
                icon:  <IndianRupee className="h-4 w-4 text-green-600" />,
                color: "text-green-600 dark:text-green-400",
              },
            ] as const).map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center justify-center p-3 rounded-xl bg-muted/40 border border-border/40 text-center gap-1"
              >
                {stat.icon}
                <div className={`text-xl font-bold leading-none ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground leading-tight">{stat.label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Call-to-Sale Conversion per Agent */}
      <Card>
        <CardHeader className="pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Call-to-Sale Conversion
            </CardTitle>
            <CardDescription>Call-to-sale conversion per sales agent — {filterLabel[callFilter]}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {agentStats.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No activity data for this period</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Agent</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Visits</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Calls Made</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Connected</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Quotations</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Converted</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">Rate</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden md:table-cell">Sales Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {agentStats.map((a) => (
                    <tr key={a.agentId} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {a.agentName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-sm leading-none">{a.agentName}</div>
                            <div className="text-xs text-muted-foreground mt-0.5">{a.agentLoginId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.visits}</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">{a.callsMade}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell text-green-600 dark:text-green-400">{a.connectedCalls}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden sm:table-cell text-blue-600 dark:text-blue-400">{a.quotationsSent}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular-nums text-green-600 dark:text-green-400">{a.convertedSales}</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell text-purple-600 dark:text-purple-400">{a.conversionRate}%</td>
                      <td className="px-4 py-3 text-right tabular-nums hidden md:table-cell">
                        {a.salesValue > 0 ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            ₹{a.salesValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date-filtered section header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          Activity by Period
        </h2>
        <Tabs value={tableFilter} onValueChange={(v) => setTableFilter(v as DateFilter)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Site Visits Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Site Visits — {filterLabel[tableFilter]}
            {!isLoadingVisits && (
              <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                {visitsData?.length ?? 0}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingVisits ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (visitsData ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No visits for {filterLabel[tableFilter].toLowerCase()}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Agent</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Area</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Stage</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(visitsData ?? []).map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
                        {v.visitDate ? format(parseISO(v.visitDate), "MMM d") : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium leading-none">{v.customer?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{v.customer?.mobile}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {v.user?.name?.charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs">{v.user?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{v.area}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{v.siteStage}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <FeedbackBadge feedback={v.feedback ?? ""} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Brand Usage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Package className="h-4 w-4" />
            Brand Usage
          </CardTitle>
          <CardDescription>Most used brands across all visits</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingBrands ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : (brandStats ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Package className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No brand data yet</span>
            </div>
          ) : (
            <div className="space-y-2">
              {(brandStats ?? []).map((b, idx) => {
                const max = brandStats?.[0]?.count ?? 1;
                const pct = Math.round((b.count / max) * 100);
                return (
                  <div key={b.brandName} className="flex items-center gap-3">
                    <span className="text-xs font-medium text-muted-foreground w-4 text-right">{idx + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-sm font-medium truncate">{b.brandName}</span>
                        <span className="text-xs text-muted-foreground ml-2 shrink-0">{b.count} visits</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
