import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import {
  Activity, TrendingUp, IndianRupee,
  MapPin, PhoneCall, ChevronRight, CalendarClock, Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

type DateFilter = "today" | "week" | "month" | "custom";

type TodayCall = {
  id: number;
  call_summary: string | null;
  next_schedule_date: string;
  customer: { id: number; name: string; mobile: string } | null;
};

function apiHeaders() {
  const token = localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}` };
}

function getDateRange(filter: DateFilter, customFrom: string, customTo: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (filter === "today") return { from: today, to: today };
  if (filter === "week") {
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    return { from: ws.toISOString().slice(0, 10), to: today };
  }
  if (filter === "month") {
    const ms = startOfMonth(now);
    return { from: ms.toISOString().slice(0, 10), to: today };
  }
  return { from: customFrom || today, to: customTo || today };
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtCurrency(v: number) {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function FeedbackBadge({ feedback }: { feedback: string }) {
  const styles: Record<string, string> = {
    Interested: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    Potential: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    "Not Interested": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[feedback] ?? "bg-muted text-muted-foreground"}`}>
      {feedback}
    </span>
  );
}


export default function AgentDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<DateFilter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(
    () => getDateRange(filter, customFrom, customTo),
    [filter, customFrom, customTo],
  );

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const { data: todayCalls = [] } = useQuery<TodayCall[]>({
    queryKey: ["today-scheduled-calls", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, call_summary, next_schedule_date, customer:customers!customer_id(id, name, mobile)")
        .eq("agent_id", parseInt(user!.id))
        .not("next_schedule_date", "is", null)
        .gte("next_schedule_date", todayStart.toISOString())
        .lte("next_schedule_date", todayEnd.toISOString())
        .order("next_schedule_date", { ascending: true });
      if (error) return [];
      return (data ?? []) as unknown as TodayCall[];
    },
    enabled: !!user?.id,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["agent-dashboard", user?.id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
      const res = await fetch(`/api/visits/my-stats?${params}`, {
        headers: apiHeaders(),
      });
      if (!res.ok) throw new Error("Failed to load dashboard");
      return res.json();
    },
    enabled: !!user?.id,
  });

  const agentData = data?.data;
  const stats     = agentData?.stats;
  const visits    = (agentData?.visits ?? []) as any[];

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
        <Skeleton className="h-6 w-48" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto pb-24 md:pb-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Performance</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {user?.name} · {user?.userId}
        </p>
      </div>

      {/* Quick action cards */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => navigate("/add-visit")}
          className="flex items-center gap-3 p-4 rounded-xl bg-orange-50 border border-orange-200 hover:bg-orange-100 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-orange-900">Add Visit</div>
            <div className="text-xs text-orange-700 mt-0.5">Log a site visit</div>
          </div>
          <ChevronRight className="w-4 h-4 text-orange-400 shrink-0" />
        </button>

        <button
          onClick={() => navigate("/calls/new")}
          className="flex items-center gap-3 p-4 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 active:scale-[0.98] transition-all text-left"
        >
          <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0">
            <PhoneCall className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-primary">Log a Call</div>
            <div className="text-xs text-primary/70 mt-0.5">Record a cold call</div>
          </div>
          <ChevronRight className="w-4 h-4 text-primary/40 shrink-0" />
        </button>
      </div>

      {/* Today's Scheduled Calls */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-orange-600" />
            Today's Scheduled Calls
            {todayCalls.length > 0 && (
              <span className="ml-1 bg-orange-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {todayCalls.length} scheduled today
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 pb-2">
          {todayCalls.length === 0 ? (
            <p className="px-4 pb-3 text-sm text-muted-foreground">No calls scheduled for today</p>
          ) : (
            <div className="divide-y divide-orange-100">
              {todayCalls.map((call) => (
                <div key={call.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{call.customer?.name ?? "Unknown"}</div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                      <Phone className="h-3 w-3" />
                      {call.customer?.mobile ?? "—"}
                      <span className="mx-1">·</span>
                      {format(parseISO(call.next_schedule_date), "h:mm a")}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white h-8 px-3 shrink-0"
                    onClick={() => navigate("/schedule")}
                  >
                    <PhoneCall className="h-3.5 w-3.5 mr-1" /> Call Now
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Date filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as DateFilter)}>
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
        {filter === "custom" && (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 w-36 text-sm"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 w-36 text-sm"
            />
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: "Visits",      value: stats?.totalVisits ?? 0,                  icon: <Activity className="h-4 w-4 text-primary" />,         color: "text-primary" },
          { label: "Converted",   value: stats?.converted ?? 0,                    icon: <TrendingUp className="h-4 w-4 text-green-500" />,      color: "text-green-600 dark:text-green-400" },
          { label: "Sales Value", value: fmtCurrency(stats?.totalSalesValue ?? 0), icon: <IndianRupee className="h-4 w-4 text-green-600" />,     color: "text-green-600 dark:text-green-400" },
        ] as const).map((kpi) => (
          <Card key={kpi.label}>
            <CardContent className="p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{kpi.label}</span>
                {kpi.icon}
              </div>
              <div className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 gap-3">
        {([
          { label: "Spoke to Customer", value: stats?.customerContacted ?? 0 },
          { label: "Quotations Sent",   value: stats?.quotationsSent    ?? 0 },
        ] as const).map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/40 p-3 text-center">
            <div className="text-lg font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Visits table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Visits
            <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
              {visits.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Activity className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No visits for this period</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Area</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap hidden sm:table-cell">Stage</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visits.map((v: any) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(v.visitDate)}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-sm leading-none">{v.customerName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{v.customerMobile}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">{v.area}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap hidden sm:table-cell">{v.siteStage}</td>
                      <td className="px-4 py-2.5"><FeedbackBadge feedback={v.feedback ?? ""} /></td>
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
