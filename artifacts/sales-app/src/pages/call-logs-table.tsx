import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, IndianRupee, PhoneCall, CalendarClock, Search } from "lucide-react";

type CallLog = {
  id: number;
  call_date: string;
  call_status: string;
  call_summary: string;
  quotation_sent: boolean;
  quotation_number: string | null;
  invoice_number: string | null;
  sale_value: number | null;
  next_schedule_date: string | null;
  customer: { id: number; name: string; mobile: string } | null;
  agent: { id: number; name: string } | null;
};

type DateFilter = "today" | "week" | "month" | "all" | "custom";

const STATUS_BADGE: Record<string, string> = {
  "Connected":          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Not Connected":      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "Callback Requested": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Quotation Sent":     "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Converted":          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Not Interested":     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy · h:mm a"); } catch { return d; }
}

function fmtCurrency(v: number | null | undefined) {
  if (!v) return null;
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function getDateBounds(filter: DateFilter, customFrom: string, customTo: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  if (filter === "today") return { from: today + "T00:00:00Z", to: today + "T23:59:59Z" };
  if (filter === "week") {
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    return { from: ws.toISOString().slice(0, 10) + "T00:00:00Z", to: today + "T23:59:59Z" };
  }
  if (filter === "month") {
    const ms = startOfMonth(now);
    return { from: ms.toISOString().slice(0, 10) + "T00:00:00Z", to: today + "T23:59:59Z" };
  }
  if (filter === "custom" && customFrom && customTo) {
    return { from: customFrom + "T00:00:00Z", to: customTo + "T23:59:59Z" };
  }
  return null; // "all" — no date filter
}

export default function CallLogsTable() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentFilter, setAgentFilter]   = useState("all");
  const [search, setSearch]             = useState("");

  const dateBounds = useMemo(
    () => getDateBounds(dateFilter, customFrom, customTo),
    [dateFilter, customFrom, customTo],
  );

  const { data: logs = [], isLoading } = useQuery<CallLog[]>({
    queryKey: ["call-logs-table", dateBounds],
    queryFn: async () => {
      let q = supabase
        .from("call_logs")
        .select("id, call_date, call_status, call_summary, quotation_sent, quotation_number, invoice_number, sale_value, next_schedule_date, customer:customers!customer_id(id, name, mobile), agent:users!agent_id(id, name)")
        .order("call_date", { ascending: false });

      if (dateBounds) {
        q = q.gte("call_date", dateBounds.from).lte("call_date", dateBounds.to);
      }

      const { data, error } = await q;
      if (error) return [];
      return (data ?? []) as unknown as CallLog[];
    },
    retry: false,
  });

  // fetch all users for agent dropdown (so all agents show regardless of call count)
  const { data: agentOptions = [] } = useQuery<{ id: number; name: string }[]>({
    queryKey: ["all-agents-list"],
    queryFn: async () => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      return (json.data ?? []).map((u: any) => ({ id: u.id, name: u.name }));
    },
  });

  // apply client-side filters
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (statusFilter !== "all" && l.call_status !== statusFilter) return false;
      if (agentFilter !== "all" && String(l.agent?.id) !== agentFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchCustomer = l.customer?.name?.toLowerCase().includes(q) || l.customer?.mobile?.includes(q);
        const matchSummary  = l.call_summary?.toLowerCase().includes(q);
        const matchQuote    = l.quotation_number?.toLowerCase().includes(q);
        const matchInvoice  = l.invoice_number?.toLowerCase().includes(q);
        if (!matchCustomer && !matchSummary && !matchQuote && !matchInvoice) return false;
      }
      return true;
    });
  }, [logs, statusFilter, agentFilter, search]);

  // summary stats
  const stats = useMemo(() => ({
    total:      filtered.length,
    connected:  filtered.filter((l) => l.call_status === "Connected").length,
    quotations: filtered.filter((l) => l.quotation_sent).length,
    converted:  filtered.filter((l) => l.call_status === "Converted").length,
    salesValue: filtered.filter((l) => l.call_status === "Converted")
                        .reduce((s, l) => s + (l.sale_value ?? 0), 0),
  }), [filtered]);

  return (
    <div className="p-6 space-y-5 max-w-6xl mx-auto">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Call Logs</h1>
        <p className="text-sm text-muted-foreground mt-0.5">All call activity by agents</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total Calls",   value: stats.total,      color: "text-foreground",                          icon: <PhoneCall className="h-4 w-4 text-primary" /> },
          { label: "Connected",     value: stats.connected,  color: "text-blue-600 dark:text-blue-400",         icon: <Phone className="h-4 w-4 text-blue-500" /> },
          { label: "Quotations",    value: stats.quotations, color: "text-amber-600 dark:text-amber-400",        icon: <CalendarClock className="h-4 w-4 text-amber-500" /> },
          { label: "Converted",     value: stats.converted,  color: "text-green-600 dark:text-green-400",        icon: <PhoneCall className="h-4 w-4 text-green-500" /> },
          { label: "Sales Value",   value: fmtCurrency(stats.salesValue) ?? "₹0", color: "text-green-600 dark:text-green-400", icon: <IndianRupee className="h-4 w-4 text-green-600" /> },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{s.label}</span>
                {s.icon}
              </div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-muted-foreground">Filters</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Date tabs */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Tabs value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <TabsList>
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="month">This Month</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
                <TabsTrigger value="custom">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            {dateFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-9 w-36 text-sm" />
                <span className="text-muted-foreground text-sm">to</span>
                <Input type="date" value={customTo}   onChange={(e) => setCustomTo(e.target.value)}   className="h-9 w-36 text-sm" />
              </div>
            )}
          </div>

          {/* Search + dropdowns */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search customer, mobile, summary..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-full sm:w-48 text-sm">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["Connected", "Not Connected", "Callback Requested", "Quotation Sent", "Converted", "Not Interested"].map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="h-9 w-full sm:w-44 text-sm">
                <SelectValue placeholder="All Agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agentOptions.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <PhoneCall className="h-10 w-10 mb-3 opacity-20" />
              <p className="text-sm font-medium">No call logs found</p>
              <p className="text-xs mt-1">Try changing your filters or date range</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Date & Time</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Agent</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">Summary</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Quotation #</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Invoice #</th>
                    <th className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Sale Value</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground whitespace-nowrap">Callback</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(log.call_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                            {log.agent?.name?.charAt(0).toUpperCase() ?? "?"}
                          </div>
                          <span className="text-xs font-medium">{log.agent?.name ?? "—"}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs font-medium leading-none">{log.customer?.name ?? "—"}</div>
                        {log.customer?.mobile && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{log.customer.mobile}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[log.call_status] ?? "bg-muted text-muted-foreground"}`}>
                          {log.call_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-[220px]">
                        <p className="text-xs line-clamp-2 leading-snug">{log.call_summary}</p>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.quotation_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.invoice_number ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {log.sale_value ? (
                          <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                            {fmtCurrency(log.sale_value)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {log.next_schedule_date ? (
                          <span className="text-orange-600 dark:text-orange-400 font-medium">
                            {fmtDate(log.next_schedule_date)}
                          </span>
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

      {filtered.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filtered.length} of {logs.length} call logs
        </p>
      )}
    </div>
  );
}
