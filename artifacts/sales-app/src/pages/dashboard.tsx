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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BarChart,
  Users,
  FileSpreadsheet,
  FileText,
  Activity,
  TrendingUp,
  IndianRupee,
  Phone,
  ClipboardList,
  CheckCircle2,
  Package,
  CalendarDays,
  User,
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

const FEEDBACK_COLORS: Record<string, string> = {
  Interested: "hsl(var(--chart-1))",
  Potential: "hsl(var(--chart-4))",
  "Not Interested": "hsl(var(--muted-foreground))",
};

type ConversionUser = {
  userId: number;
  userName: string;
  userLoginId: string;
  totalVisits: number;
  totalFollowups: number;
  convertedCount: number;
  conversionRate: number;
  totalSalesValue: number;
};

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

type FollowupRow = {
  id: number;
  followupDate: string;
  status: string;
  notes: string | null;
  summary: string | null;
  saleAmount: string | null;
  invoiceNumber: string | null;
  customer: { id: number; name: string; mobile: string; companyName: string | null } | null;
  assignedTo: { id: number; name: string; userId: string } | null;
  visit: { id: number; area: string; siteStage: string; feedback: string } | null;
};

type BrandStat = { brandName: string; count: number };

type AgentBreakdown = {
  agentId: number;
  agentName: string;
  agentLoginId: string;
  totalCompleted: number;
  customerContacted: number;
  quotationsSent: number;
  converted: number;
  conversionRate: number;
};

type ActivityMetric = "completed" | "contacted" | "quotations" | "converted" | "rate";

type DateFilter = "today" | "week" | "month";

function apiHeaders() {
  const token = localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}` };
}

function getDateRange(filter: DateFilter) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (filter === "today") return { from: today, to: today };
  if (filter === "week") {
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    return { from: ws.toISOString().slice(0, 10), to: today };
  }
  const ms = startOfMonth(now);
  return { from: ms.toISOString().slice(0, 10), to: today };
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Converted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    Missed:    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

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

export default function Dashboard() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [tableFilter, setTableFilter] = useState<DateFilter>("week");
  const [activityFilter, setActivityFilter] = useState<DateFilter>("month");
  const [agentDetailMetric, setAgentDetailMetric] = useState<ActivityMetric | null>(null);

  const { data: totalVisits, isLoading: isLoadingTotal } = useGetTotalVisits({
    query: { queryKey: getGetTotalVisitsQueryKey() },
  });

  const { data: feedbackSummary, isLoading: isLoadingFeedback } = useGetFeedbackSummary({
    query: { queryKey: getGetFeedbackSummaryQueryKey() },
  });

  const { data: inactiveUsers, isLoading: isLoadingInactive } = useGetInactiveUsers({
    query: { queryKey: getGetInactiveUsersQueryKey() },
  });

  const { data: visitsPerUser, isLoading: isLoadingVisitsPerUser } = useGetVisitsPerUser(
    { period },
    { query: { queryKey: getGetVisitsPerUserQueryKey({ period }) } },
  );

  const { data: dailyVisitsPerUser, isLoading: isLoadingDailyBreakdown } = useGetVisitsPerUser(
    { period: "daily" },
    { query: { queryKey: getGetVisitsPerUserQueryKey({ period: "daily" }) } },
  );

  const { data: conversionData, isLoading: isLoadingConversion } = useQuery<ConversionUser[]>({
    queryKey: ["dashboard-conversion-summary"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/conversion-summary", { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load conversion summary");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const activityDateRange = useMemo(() => getDateRange(activityFilter), [activityFilter]);

  const { data: followupActivity, isLoading: isLoadingActivity } = useQuery<{
    totalCompleted: number;
    customerContacted: number;
    quotationsSent: number;
    converted: number;
    conversionRate: number;
  }>({
    queryKey: ["followup-activity", activityDateRange.from, activityDateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: activityDateRange.from, to: activityDateRange.to });
      const res = await fetch(`/api/followups-activity?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load follow-up activity");
      const json = await res.json();
      return json.data;
    },
  });

  const { data: agentBreakdown, isLoading: isLoadingAgentBreakdown, isError: isAgentBreakdownError } = useQuery<AgentBreakdown[]>({
    queryKey: ["followup-agent-breakdown", activityDateRange.from, activityDateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: activityDateRange.from, to: activityDateRange.to });
      const res = await fetch(`/api/dashboard/followup-agent-breakdown?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load agent breakdown");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const { data: brandStats, isLoading: isLoadingBrands } = useQuery<BrandStat[]>({
    queryKey: ["dashboard-brand-stats"],
    queryFn: async () => {
      const res = await fetch("/api/dashboard/brand-stats", { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load brand stats");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const dateRange = useMemo(() => getDateRange(tableFilter), [tableFilter]);

  const { data: visitsData, isLoading: isLoadingVisits } = useQuery<VisitRow[]>({
    queryKey: ["dashboard-visits", dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
      const res = await fetch(`/api/visits?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load visits");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const { data: followupsData, isLoading: isLoadingFollowups } = useQuery<FollowupRow[]>({
    queryKey: ["dashboard-followups", dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
      const res = await fetch(`/api/followups?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load follow-ups");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const handleExport = async (type: "excel" | "pdf") => {
    try {
      const res = await fetch(`/api/export/${type}`, { headers: apiHeaders() });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `visits_report.${type === "excel" ? "xlsx" : "pdf"}`;
      a.click();
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const totalToday = (totalVisits as any)?.data?.today ?? 0;
  const totalAll   = (totalVisits as any)?.data?.total ?? 0;

  const feedbackRaw = (feedbackSummary as any)?.data ?? {};
  const pieData = Object.entries(feedbackRaw)
    .filter(([, v]) => (v as number) > 0)
    .map(([feedback, count]) => ({ feedback, count: count as number }));

  const inactiveList: any[] = (inactiveUsers as any)?.data?.inactiveUsers ?? [];
  const visitUsers: any[]   = (visitsPerUser as any)?.data?.users ?? [];
  const dailyUsers: any[]   = (dailyVisitsPerUser as any)?.data?.users ?? [];

  const filterLabel: Record<DateFilter, string> = {
    today: "Today",
    week:  "This Week",
    month: "This Month",
  };

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

      {/* Summary Cards */}
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
                        u.visitCount > 0
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
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
                      <Cell
                        key={`cell-${index}`}
                        fill={FEEDBACK_COLORS[entry.feedback] ?? "hsl(var(--primary))"}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                  />
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

      {/* Visits Per User + Inactive Users */}
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
                  <RechartsTooltip
                    cursor={{ fill: "hsl(var(--muted))" }}
                    contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))" }}
                  />
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
                {inactiveList
                  .filter((u) => u.userId)
                  .map((u) => (
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

      {/* Follow-up Activity Summary */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Follow-up Activity
              </CardTitle>
              <CardDescription>Click any stat to see agent-wise breakdown</CardDescription>
            </div>
            <Tabs value={activityFilter} onValueChange={(v) => setActivityFilter(v as DateFilter)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="month">Month</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingActivity ? (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {([
                { metric: "completed"  as ActivityMetric, label: "Completed",         value: followupActivity?.totalCompleted ?? 0,         icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,   color: "text-blue-600 dark:text-blue-400" },
                { metric: "contacted"  as ActivityMetric, label: "Spoke to Customer", value: followupActivity?.customerContacted ?? 0,       icon: <Phone className="h-4 w-4 text-green-500" />,         color: "text-green-600 dark:text-green-400" },
                { metric: "quotations" as ActivityMetric, label: "Quotations Sent",   value: followupActivity?.quotationsSent ?? 0,           icon: <ClipboardList className="h-4 w-4 text-primary" />,   color: "text-primary" },
                { metric: "converted"  as ActivityMetric, label: "Converted",         value: followupActivity?.converted ?? 0,               icon: <TrendingUp className="h-4 w-4 text-green-600" />,    color: "text-green-600 dark:text-green-400" },
                { metric: "rate"       as ActivityMetric, label: "Conversion Rate",   value: `${followupActivity?.conversionRate ?? 0}%`,    icon: <Activity className="h-4 w-4 text-purple-500" />,     color: "text-purple-600 dark:text-purple-400" },
              ] as const).map((stat) => (
                <button
                  key={stat.label}
                  onClick={() => setAgentDetailMetric(stat.metric)}
                  className="flex flex-col items-center justify-center p-3 rounded-xl bg-muted/40 border border-border/40 text-center gap-1 hover:bg-muted/70 hover:border-primary/30 transition-colors cursor-pointer w-full"
                >
                  {stat.icon}
                  <div className={`text-xl font-bold leading-none ${stat.color}`}>{stat.value}</div>
                  <div className="text-xs text-muted-foreground leading-tight">{stat.label}</div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent Breakdown Dialog */}
      <Dialog open={agentDetailMetric !== null} onOpenChange={(open) => { if (!open) setAgentDetailMetric(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-primary" />
              {agentDetailMetric === "completed"  && "Completed Follow-ups by Agent"}
              {agentDetailMetric === "contacted"  && "Customer Contact by Agent"}
              {agentDetailMetric === "quotations" && "Quotations Sent by Agent"}
              {agentDetailMetric === "converted"  && "Conversions by Agent"}
              {agentDetailMetric === "rate"        && "Conversion Rate by Agent"}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                — {activityFilter === "today" ? "Today" : activityFilter === "week" ? "This Week" : "This Month"}
              </span>
            </DialogTitle>
          </DialogHeader>

          {(isLoadingAgentBreakdown || agentBreakdown === undefined) && !isAgentBreakdownError ? (
            <div className="space-y-3 py-2">
              {[1,2,3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
          ) : isAgentBreakdownError ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">Could not load data — please rebuild the server</span>
            </div>
          ) : agentBreakdown!.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Users className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No follow-up activity for this period</span>
            </div>
          ) : (
            <div className="space-y-3 py-1">
              {agentBreakdown!.map((a) => {
                const highlight = agentDetailMetric;
                return (
                  <div key={a.agentId} className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                        {a.agentName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-sm leading-none">{a.agentName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{a.agentLoginId}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-5 gap-2 text-center">
                      {([
                        { key: "completed",  label: "Done",       value: a.totalCompleted,    color: "text-blue-600 dark:text-blue-400" },
                        { key: "contacted",  label: "Spoke",      value: a.customerContacted, color: "text-green-600 dark:text-green-400" },
                        { key: "quotations", label: "Quotations", value: a.quotationsSent,    color: "text-primary" },
                        { key: "converted",  label: "Converted",  value: a.converted,         color: "text-green-600 dark:text-green-400" },
                        { key: "rate",       label: "Rate",       value: `${a.conversionRate}%`, color: "text-purple-600 dark:text-purple-400" },
                      ] as const).map((col) => (
                        <div
                          key={col.key}
                          className={`rounded-lg py-2 px-1 transition-colors ${
                            highlight === col.key
                              ? "bg-primary/15 ring-1 ring-primary/30"
                              : "bg-background/60"
                          }`}
                        >
                          <div className={`text-base font-bold leading-none ${col.color}`}>{col.value}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{col.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Conversion Performance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversion Performance
            </CardTitle>
            <CardDescription>Follow-up to sale conversion per sales agent</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingConversion ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : (conversionData ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No conversion data yet</span>
            </div>
          ) : (
            <div className="space-y-3">
              {(conversionData ?? []).map((u) => (
                <div key={u.userId} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-muted/40 border border-border/40">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                      {u.userName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-sm leading-none">{u.userName}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{u.userLoginId}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-3 sm:gap-4 text-center sm:shrink-0">
                    <div>
                      <div className="text-lg font-bold leading-none">{u.totalVisits}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Visits</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold leading-none">{u.totalFollowups}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Follow-ups</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold leading-none text-green-600 dark:text-green-400">{u.convertedCount}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Converted</div>
                    </div>
                    <div>
                      <div className="text-lg font-bold leading-none text-primary">{u.conversionRate}%</div>
                      <div className="text-xs text-muted-foreground mt-0.5">Rate</div>
                    </div>
                  </div>

                  {u.totalSalesValue > 0 && (
                    <div className="flex items-center gap-1 text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-1.5 rounded-lg whitespace-nowrap">
                      <IndianRupee className="h-3.5 w-3.5" />
                      {u.totalSalesValue.toLocaleString("en-IN")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Date-filtered sections ────────────────────────────── */}
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

      {/* Visits Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Visits — {filterLabel[tableFilter]}
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
              {[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
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

      {/* Follow-ups Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Follow-ups — {filterLabel[tableFilter]}
            {!isLoadingFollowups && (
              <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                {followupsData?.length ?? 0}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoadingFollowups ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (followupsData ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No follow-ups for {filterLabel[tableFilter].toLowerCase()}</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Agent</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(followupsData ?? []).map((f) => (
                    <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground text-xs">
                        {f.followupDate ? format(parseISO(f.followupDate), "MMM d") : "—"}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium leading-none">{f.customer?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{f.customer?.mobile}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">
                            {f.assignedTo?.name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                          <span className="text-xs">{f.assignedTo?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <StatusBadge status={f.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        {f.status === "Converted" && f.saleAmount ? (
                          <div className="flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                            <IndianRupee className="h-3 w-3" />
                            {parseFloat(f.saleAmount).toLocaleString("en-IN")}
                            {f.invoiceNumber && <span className="font-normal text-muted-foreground ml-1">· {f.invoiceNumber}</span>}
                          </div>
                        ) : f.summary ? (
                          <span className="text-xs text-muted-foreground line-clamp-1">{f.summary}</span>
                        ) : f.notes ? (
                          <span className="text-xs text-muted-foreground line-clamp-1 italic">{f.notes}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
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

      {/* Brand Usage Stats */}
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
              {[1,2,3,4,5].map((i) => <Skeleton key={i} className="h-8 w-full" />)}
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
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
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
