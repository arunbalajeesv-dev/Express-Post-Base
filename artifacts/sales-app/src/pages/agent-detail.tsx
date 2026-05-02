import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import {
  ArrowLeft, Activity, CheckCircle2, TrendingUp, IndianRupee,
  Phone, ClipboardList, User,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

type DateFilter = "today" | "week" | "month" | "custom";

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

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending:   "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
    Converted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
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

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<DateFilter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const dateRange = useMemo(
    () => getDateRange(filter, customFrom, customTo),
    [filter, customFrom, customTo],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey: ["agent-detail", id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const params = new URLSearchParams({ from: dateRange.from, to: dateRange.to });
      const res = await fetch(`/api/dashboard/agent/${id}?${params}`, { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load agent detail");
      return res.json();
    },
    enabled: !!id,
  });

  const agentData  = data?.data;
  const agent      = agentData?.agent;
  const stats      = agentData?.stats;
  const visits     = (agentData?.visits    ?? []) as any[];
  const followups  = (agentData?.followups ?? []) as any[];

  if (isLoading) {
    return (
      <div className="p-6 space-y-5 max-w-4xl mx-auto">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[1,2,3,4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (isError || !agent) {
    return (
      <div className="p-6 text-center py-16">
        <h2 className="text-lg font-medium">Agent not found</h2>
        <Button variant="ghost" className="mt-4" onClick={() => navigate("/users")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Team
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">

      {/* Back */}
      <button
        onClick={() => navigate("/users")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Team
      </button>

      {/* Agent header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary shrink-0">
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{agent.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{agent.userId}</span>
            {agent.mobile && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{agent.mobile}</span>}
            <Badge variant="secondary" className="text-xs">{agent.role}</Badge>
          </div>
        </div>
      </div>

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
            <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-36 text-sm" />
            <span className="text-muted-foreground text-sm">to</span>
            <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-9 w-36 text-sm" />
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {([
          { label: "Visits",          value: stats?.totalVisits ?? 0,                                   icon: <Activity className="h-4 w-4 text-primary" />,              color: "text-primary" },
          { label: "Follow-ups Done", value: stats?.completed ?? 0,                                      icon: <CheckCircle2 className="h-4 w-4 text-blue-500" />,          color: "text-blue-600 dark:text-blue-400" },
          { label: "Converted",       value: stats?.converted ?? 0,                                      icon: <TrendingUp className="h-4 w-4 text-green-500" />,           color: "text-green-600 dark:text-green-400" },
          { label: "Sales Value",     value: fmtCurrency(stats?.totalSalesValue ?? 0),                   icon: <IndianRupee className="h-4 w-4 text-green-600" />,          color: "text-green-600 dark:text-green-400" },
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
      <div className="grid grid-cols-3 gap-3">
        {([
          { label: "Spoke to Customer", value: stats?.customerContacted ?? 0 },
          { label: "Quotations Sent",   value: stats?.quotationsSent    ?? 0 },
          { label: "Total Follow-ups",  value: stats?.totalFollowups    ?? 0 },
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
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Area</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Stage</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Feedback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {visits.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(v.visitDate)}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-sm leading-none">{v.customerName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{v.customerMobile}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{v.area}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{v.siteStage}</td>
                      <td className="px-4 py-2.5"><FeedbackBadge feedback={v.feedback ?? ""} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-ups table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Follow-ups
            <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
              {followups.length}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {followups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <ClipboardList className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No follow-ups for this period</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {followups.map((f) => (
                    <tr key={f.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(f.followupDate)}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-sm leading-none">{f.customerName}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{f.customerMobile}</div>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap"><StatusBadge status={f.status} /></td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {f.status === "Converted" && f.saleAmount ? (
                          <span className="flex items-center gap-1 font-semibold text-green-600 dark:text-green-400">
                            <IndianRupee className="h-3 w-3" />
                            {parseFloat(f.saleAmount).toLocaleString("en-IN")}
                            {f.invoiceNumber && <span className="font-normal ml-1">· {f.invoiceNumber}</span>}
                          </span>
                        ) : f.notes ? (
                          <span className="line-clamp-1">{f.notes}</span>
                        ) : "—"}
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
