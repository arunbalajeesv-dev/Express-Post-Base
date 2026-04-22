import { useState } from "react";
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
import { BarChart, Users, FileSpreadsheet, FileText, Activity, TrendingUp, IndianRupee } from "lucide-react";
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

export default function Dashboard() {
  const [period, setPeriod] = useState<"daily" | "weekly">("daily");

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

  const { data: conversionData, isLoading: isLoadingConversion } = useQuery<ConversionUser[]>({
    queryKey: ["dashboard-conversion-summary"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/dashboard/conversion-summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load conversion summary");
      const json = await res.json();
      return json.data ?? [];
    },
  });

  const handleExport = async (type: "excel" | "pdf") => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`/api/export/${type}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
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
  const totalAll = (totalVisits as any)?.data?.total ?? 0;

  const feedbackRaw = (feedbackSummary as any)?.data ?? {};
  const pieData = Object.entries(feedbackRaw)
    .filter(([, v]) => (v as number) > 0)
    .map(([feedback, count]) => ({ feedback, count: count as number }));

  const inactiveList: any[] = (inactiveUsers as any)?.data?.inactiveUsers ?? [];

  const visitUsers: any[] = (visitsPerUser as any)?.data?.users ?? [];

  return (
    <div className="p-6 space-y-6">
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

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Visits Today</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingTotal ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-3xl font-bold">{totalToday}</div>
                <p className="text-xs text-muted-foreground mt-1">{totalAll} total all-time</p>
              </>
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

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-sm font-medium text-muted-foreground">Visits Per User</CardTitle>
              <CardDescription>Performance comparison</CardDescription>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as "daily" | "weekly")}>
              <TabsList>
                <TabsTrigger value="daily">Daily</TabsTrigger>
                <TabsTrigger value="weekly">Weekly</TabsTrigger>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Inactive Users</CardTitle>
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
                <span className="text-sm">All users active today</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversion Metrics */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Conversion Performance
            </CardTitle>
            <CardDescription>Follow-up to sale conversion per sales user</CardDescription>
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
    </div>
  );
}
