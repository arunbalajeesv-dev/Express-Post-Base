import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, startOfWeek, startOfMonth } from "date-fns";
import { supabase } from "@/lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  ArrowLeft, Activity, TrendingUp, IndianRupee,
  Phone, PhoneCall, User, Download,
  FileText, Table2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

type DateFilter = "today" | "week" | "month" | "custom";
type HistoryFilter = "all" | "today" | "week" | "month" | "custom";

type ExportVisitRow = {
  id: number;
  visit_date: string;
  visit_time: string | null;
  area: string | null;
  site_stage: string | null;
  feedback: string | null;
  notes: string | null;
  customer: { name: string; mobile: string; company_name: string | null } | null;
};

type CallLogRow = {
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
};

const STATUS_BADGE: Record<string, string> = {
  "Connected":          "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Not Connected":      "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "Callback Requested": "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  "Quotation Sent":     "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Converted":          "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Not Interested":     "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
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

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(parseISO(d), "MMM d, yyyy · h:mm a"); } catch { return d; }
}

function fmtCurrency(v: number) {
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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

function buildTableData(rows: CallLogRow[]) {
  return rows.map((r) => [
    fmtDateTime(r.call_date),
    r.customer?.name ?? "—",
    r.customer?.mobile ?? "—",
    r.call_status,
    r.call_summary ?? "",
    r.quotation_number ?? "—",
    r.invoice_number ?? "—",
    r.sale_value != null ? `₹${Number(r.sale_value).toLocaleString("en-IN")}` : "—",
    r.next_schedule_date ? fmtDate(r.next_schedule_date) : "—",
  ]);
}

const TABLE_HEADERS = ["Date & Time", "Customer", "Mobile", "Status", "Summary", "Quotation #", "Invoice #", "Sale Value", "Callback Date"];

function exportToPDF(rows: CallLogRow[], agentName: string, from: string, to: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`Call Logs — ${agentName}`, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Period: ${from}  to  ${to}`, 14, 22);

  autoTable(doc, {
    head: [TABLE_HEADERS],
    body: buildTableData(rows),
    startY: 27,
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    columnStyles: { 4: { cellWidth: 55 } }, // Summary column wider
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${agentName.replace(/\s+/g, "_")}_calls_${from}_to_${to}.pdf`);
}

function exportToExcel(rows: CallLogRow[], agentName: string, from: string, to: string) {
  const wsData = [TABLE_HEADERS, ...buildTableData(rows)];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws["!cols"] = [
    { wch: 20 }, { wch: 18 }, { wch: 14 }, { wch: 18 },
    { wch: 40 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Call Logs");
  XLSX.writeFile(wb, `${agentName.replace(/\s+/g, "_")}_calls_${from}_to_${to}.xlsx`);
}

const VISIT_HEADERS = ["Date", "Time", "Customer", "Mobile", "Company", "Area", "Stage", "Feedback", "Notes"];

function buildVisitTableData(rows: ExportVisitRow[]) {
  return rows.map((r) => [
    fmtDate(r.visit_date),
    (r.visit_time ?? "").slice(0, 5) || "—",
    r.customer?.name ?? "—",
    r.customer?.mobile ?? "—",
    r.customer?.company_name ?? "—",
    r.area ?? "—",
    r.site_stage ?? "—",
    r.feedback ?? "—",
    r.notes ?? "",
  ]);
}

function exportVisitsToPDF(rows: ExportVisitRow[], agentName: string, from: string, to: string) {
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text(`Visit Report — ${agentName}`, 14, 15);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(`Period: ${from}  to  ${to}`, 14, 22);

  autoTable(doc, {
    head: [VISIT_HEADERS],
    body: buildVisitTableData(rows),
    startY: 27,
    styles: { fontSize: 7.5, cellPadding: 2.5 },
    headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
    columnStyles: { 8: { cellWidth: 50 } },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });

  doc.save(`${agentName.replace(/\s+/g, "_")}_visits_${from}_to_${to}.pdf`);
}

function exportVisitsToExcel(rows: ExportVisitRow[], agentName: string, from: string, to: string) {
  const wsData = [VISIT_HEADERS, ...buildVisitTableData(rows)];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [
    { wch: 12 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 20 },
    { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 35 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Visits");
  XLSX.writeFile(wb, `${agentName.replace(/\s+/g, "_")}_visits_${from}_to_${to}.xlsx`);
}

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<DateFilter>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");

  // Call history independent filter
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("all");
  const [historyFrom, setHistoryFrom]     = useState("");
  const [historyTo, setHistoryTo]         = useState("");

  // Visits independent filter
  const [visitsFilter, setVisitsFilter] = useState<HistoryFilter>("all");
  const [visitsFrom, setVisitsFrom]     = useState("");
  const [visitsTo, setVisitsTo]         = useState("");

  // Export dialog state
  const [exportOpen, setExportOpen]     = useState(false);
  const [exportType, setExportType]     = useState<"calls" | "visits">("calls");
  const [exportFrom, setExportFrom]     = useState("");
  const [exportTo, setExportTo]         = useState("");
  const [exportFilter, setExportFilter] = useState<DateFilter>("month");

  const dateRange = useMemo(
    () => getDateRange(filter, customFrom, customTo),
    [filter, customFrom, customTo],
  );

  const historyDateRange = useMemo(
    () => historyFilter === "all" ? null : getDateRange(historyFilter as DateFilter, historyFrom, historyTo),
    [historyFilter, historyFrom, historyTo],
  );

  const visitsDateRange = useMemo(
    () => visitsFilter === "all" ? null : getDateRange(visitsFilter as DateFilter, visitsFrom, visitsTo),
    [visitsFilter, visitsFrom, visitsTo],
  );

  const exportRange = useMemo(
    () => getDateRange(exportFilter, exportFrom, exportTo),
    [exportFilter, exportFrom, exportTo],
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

  const agentData = data?.data;
  const agent     = agentData?.agent;
  const stats     = agentData?.stats;

  // Main call logs (filtered by selected period)
  const { data: callRows = [] } = useQuery<CallLogRow[]>({
    queryKey: ["agent-calls", id, dateRange.from, dateRange.to],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("call_logs")
        .select("id, call_date, call_status, call_summary, quotation_sent, quotation_number, invoice_number, sale_value, next_schedule_date, customer:customers!customer_id(id, name, mobile)")
        .eq("agent_id", Number(id))
        .gte("call_date", dateRange.from + "T00:00:00Z")
        .lte("call_date", dateRange.to + "T23:59:59Z")
        .order("call_date", { ascending: false });
      return (rows ?? []) as unknown as CallLogRow[];
    },
    enabled: !!id,
  });

  // Call history table (independent filter — defaults to all time)
  const { data: historyRows = [] } = useQuery<CallLogRow[]>({
    queryKey: ["agent-history", id, historyDateRange?.from ?? "all", historyDateRange?.to ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("call_logs")
        .select("id, call_date, call_status, call_summary, quotation_sent, quotation_number, invoice_number, sale_value, next_schedule_date, customer:customers!customer_id(id, name, mobile)")
        .eq("agent_id", Number(id))
        .order("call_date", { ascending: false });
      if (historyDateRange) {
        q = q
          .gte("call_date", historyDateRange.from + "T00:00:00Z")
          .lte("call_date", historyDateRange.to + "T23:59:59Z");
      }
      const { data: rows } = await q;
      return (rows ?? []) as unknown as CallLogRow[];
    },
    enabled: !!id,
    retry: false,
  });

  // Visits table (independent filter — defaults to all time)
  type VisitRow = { id: number; visit_date: string; area: string | null; site_stage: string | null; feedback: string | null; customer: { id: number; name: string; mobile: string } | null };
  const { data: visitsRows = [] } = useQuery<VisitRow[]>({
    queryKey: ["agent-visits", id, visitsDateRange?.from ?? "all", visitsDateRange?.to ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("visits")
        .select("id, visit_date, area, site_stage, feedback, customer:customers!customer_id(id, name, mobile)")
        .eq("user_id", Number(id))
        .order("visit_date", { ascending: false });
      if (visitsDateRange) {
        q = q
          .gte("visit_date", visitsDateRange.from)
          .lte("visit_date", visitsDateRange.to);
      }
      const { data: rows } = await q;
      return (rows ?? []) as unknown as VisitRow[];
    },
    enabled: !!id,
    retry: false,
  });

  // Export call logs (separate query using exportRange)
  const { data: exportRows = [], refetch: fetchExport } = useQuery<CallLogRow[]>({
    queryKey: ["agent-calls-export", id, exportRange.from, exportRange.to],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("call_logs")
        .select("id, call_date, call_status, call_summary, quotation_sent, quotation_number, invoice_number, sale_value, next_schedule_date, customer:customers!customer_id(id, name, mobile)")
        .eq("agent_id", Number(id))
        .gte("call_date", exportRange.from + "T00:00:00Z")
        .lte("call_date", exportRange.to + "T23:59:59Z")
        .order("call_date", { ascending: false });
      return (rows ?? []) as unknown as CallLogRow[];
    },
    enabled: false, // only run when triggered
  });

  // Export visits (separate query, triggered on demand)
  const { data: exportVisitRows = [], refetch: fetchVisitExport } = useQuery<ExportVisitRow[]>({
    queryKey: ["agent-visits-export", id, exportRange.from, exportRange.to],
    queryFn: async () => {
      const { data: rows } = await supabase
        .from("visits")
        .select("id, visit_date, visit_time, area, site_stage, feedback, notes, customer:customers!customer_id(name, mobile, company_name)")
        .eq("user_id", Number(id))
        .gte("visit_date", exportRange.from)
        .lte("visit_date", exportRange.to)
        .order("visit_date", { ascending: false });
      return (rows ?? []) as unknown as ExportVisitRow[];
    },
    enabled: false,
  });

  const callsMade      = callRows.length;
  const connectedCalls = callRows.filter((c) => c.call_status === "Connected").length;
  const quotationsSent = callRows.filter((c) => c.quotation_sent === true).length;
  const converted      = callRows.filter((c) => c.call_status === "Converted").length;
  const salesValue     = callRows
    .filter((c) => c.call_status === "Converted")
    .reduce((sum, c) => sum + (parseFloat(String(c.sale_value ?? "0")) || 0), 0);

  const handleExport = async (format: "pdf" | "excel") => {
    const name = agent?.name ?? "Agent";
    if (exportType === "visits") {
      const { data: rows } = await fetchVisitExport();
      const data = (rows ?? exportVisitRows) as ExportVisitRow[];
      if (format === "pdf") exportVisitsToPDF(data, name, exportRange.from, exportRange.to);
      else exportVisitsToExcel(data, name, exportRange.from, exportRange.to);
    } else {
      const { data: rows } = await fetchExport();
      const data = (rows ?? exportRows) as CallLogRow[];
      if (format === "pdf") exportToPDF(data, name, exportRange.from, exportRange.to);
      else exportToExcel(data, name, exportRange.from, exportRange.to);
    }
    setExportOpen(false);
  };

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

      {/* Back + Export */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/users")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Team
        </button>
        <Button size="sm" variant="outline" onClick={() => setExportOpen(true)}>
          <Download className="h-4 w-4 mr-1.5" /> Export
        </Button>
      </div>

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
          { label: "Visits",      value: stats?.totalVisits ?? 0,  icon: <Activity className="h-4 w-4 text-primary" />,          color: "text-primary" },
          { label: "Calls Made",  value: callsMade,                icon: <PhoneCall className="h-4 w-4 text-blue-500" />,        color: "text-blue-600 dark:text-blue-400" },
          { label: "Converted",   value: converted,                icon: <TrendingUp className="h-4 w-4 text-green-500" />,      color: "text-green-600 dark:text-green-400" },
          { label: "Sales Value", value: fmtCurrency(salesValue),  icon: <IndianRupee className="h-4 w-4 text-green-600" />,    color: "text-green-600 dark:text-green-400" },
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
          { label: "Connected Calls", value: connectedCalls },
          { label: "Quotations Sent", value: quotationsSent },
          { label: "Converted",       value: converted },
        ] as const).map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/40 p-3 text-center">
            <div className="text-lg font-bold">{s.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Call History table */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <PhoneCall className="h-4 w-4" />
              Call History
              <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                {historyRows.length}
              </span>
            </CardTitle>
          </div>
          {/* Period filter tabs */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Tabs value={historyFilter} onValueChange={(v) => setHistoryFilter(v as HistoryFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all"   className="text-xs px-3 h-7">All Time</TabsTrigger>
                <TabsTrigger value="today" className="text-xs px-3 h-7">Today</TabsTrigger>
                <TabsTrigger value="week"  className="text-xs px-3 h-7">This Week</TabsTrigger>
                <TabsTrigger value="month" className="text-xs px-3 h-7">This Month</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs px-3 h-7">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            {historyFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={historyFrom} onChange={(e) => setHistoryFrom(e.target.value)} className="h-8 w-34 text-xs" />
                <span className="text-muted-foreground text-xs">to</span>
                <Input type="date" value={historyTo} onChange={(e) => setHistoryTo(e.target.value)} className="h-8 w-34 text-xs" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {historyRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <PhoneCall className="h-8 w-8 mb-2 opacity-20" />
              <span className="text-sm">No calls for this period</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Date & Time</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Customer</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Status</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Summary</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground whitespace-nowrap">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {historyRows.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDateTime(c.call_date)}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="text-xs font-medium leading-none">{c.customer?.name ?? "—"}</div>
                        {c.customer?.mobile && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">{c.customer.mobile}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[c.call_status] ?? "bg-muted text-muted-foreground"}`}>
                          {c.call_status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 max-w-[200px]">
                        <p className="text-xs line-clamp-2 leading-snug">{c.call_summary}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-col gap-1">
                          {c.quotation_number && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 whitespace-nowrap">
                              QT: {c.quotation_number}
                            </span>
                          )}
                          {c.invoice_number && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 whitespace-nowrap">
                              INV: {c.invoice_number}
                            </span>
                          )}
                          {c.sale_value != null && c.sale_value > 0 && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 whitespace-nowrap">
                              {fmtCurrency(c.sale_value)}
                            </span>
                          )}
                          {c.next_schedule_date && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 whitespace-nowrap">
                              CB: {fmtDate(c.next_schedule_date)}
                            </span>
                          )}
                          {!c.quotation_number && !c.invoice_number && !c.next_schedule_date && (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Visits table */}
      <Card>
        <CardHeader className="pb-3 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Visits
              <span className="ml-1 bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                {visitsRows.length}
              </span>
            </CardTitle>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <Tabs value={visitsFilter} onValueChange={(v) => setVisitsFilter(v as HistoryFilter)}>
              <TabsList className="h-8">
                <TabsTrigger value="all"    className="text-xs px-3 h-7">All Time</TabsTrigger>
                <TabsTrigger value="today"  className="text-xs px-3 h-7">Today</TabsTrigger>
                <TabsTrigger value="week"   className="text-xs px-3 h-7">This Week</TabsTrigger>
                <TabsTrigger value="month"  className="text-xs px-3 h-7">This Month</TabsTrigger>
                <TabsTrigger value="custom" className="text-xs px-3 h-7">Custom</TabsTrigger>
              </TabsList>
            </Tabs>
            {visitsFilter === "custom" && (
              <div className="flex items-center gap-2">
                <Input type="date" value={visitsFrom} onChange={(e) => setVisitsFrom(e.target.value)} className="h-8 w-34 text-xs" />
                <span className="text-muted-foreground text-xs">to</span>
                <Input type="date" value={visitsTo} onChange={(e) => setVisitsTo(e.target.value)} className="h-8 w-34 text-xs" />
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {visitsRows.length === 0 ? (
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
                  {visitsRows.map((v) => (
                    <tr key={v.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-muted-foreground">{fmtDate(v.visit_date)}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-sm leading-none">{v.customer?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{v.customer?.mobile ?? ""}</div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{v.area ?? "—"}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{v.site_stage ?? "—"}</td>
                      <td className="px-4 py-2.5"><FeedbackBadge feedback={v.feedback ?? ""} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-w-lg w-full">
          <DialogHeader>
            <DialogTitle>Export — {agent.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Data type toggle */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Export Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setExportType("calls")}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors
                    ${exportType === "calls"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
                >
                  <PhoneCall className="h-4 w-4" /> Call Logs
                </button>
                <button
                  onClick={() => setExportType("visits")}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors
                    ${exportType === "visits"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"}`}
                >
                  <Activity className="h-4 w-4" /> Visits
                </button>
              </div>
            </div>

            <div className="border-t pt-4 space-y-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Period</Label>
                <Tabs value={exportFilter} onValueChange={(v) => setExportFilter(v as DateFilter)}>
                  <TabsList className="grid grid-cols-4 w-full">
                    <TabsTrigger value="today"  className="text-xs">Today</TabsTrigger>
                    <TabsTrigger value="week"   className="text-xs">This Week</TabsTrigger>
                    <TabsTrigger value="month"  className="text-xs">This Month</TabsTrigger>
                    <TabsTrigger value="custom" className="text-xs">Custom</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {exportFilter === "custom" && (
                <div className="flex items-center gap-3">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Input type="date" value={exportFrom} onChange={(e) => setExportFrom(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Input type="date" value={exportTo} onChange={(e) => setExportTo(e.target.value)} className="h-9 text-sm" />
                  </div>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Exports {exportType === "calls" ? "call logs" : "visits"} from{" "}
                <span className="font-medium">{exportRange.from}</span> to{" "}
                <span className="font-medium">{exportRange.to}</span>.
              </p>
            </div>
          </div>
          <DialogFooter>
            <div className="flex w-full items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => setExportOpen(false)}>Cancel</Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handleExport("excel")}>
                  <Table2 className="h-4 w-4 mr-1.5 text-green-600" /> Download Excel
                </Button>
                <Button onClick={() => handleExport("pdf")}>
                  <FileText className="h-4 w-4 mr-1.5" /> Download PDF
                </Button>
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
