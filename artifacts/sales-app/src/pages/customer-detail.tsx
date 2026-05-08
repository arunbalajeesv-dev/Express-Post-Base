import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Phone, Building2, User, Tag, MapPin,
  Plus, Pencil, RefreshCw, DollarSign, Loader2, TrendingUp, Package,
  PhoneCall, FileText, IndianRupee,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type QuotationRecord = {
  id: string;
  quotation_number: string;
  quotation_date: string;
  quotation_value: number;
  created_at: string;
};

type CallLogRecord = {
  id: number;
  call_date: string;
  call_status: string;
  call_summary: string;
  quotation_number: string | null;
  invoice_number: string | null;
  sale_value: number | null;
  next_schedule_date: string | null;
  agent: { name: string } | null;
};

const CALL_STATUS_META: Record<string, { dot: string; badge: string }> = {
  "Connected":          { dot: "bg-blue-500",   badge: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  "Not Connected":      { dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  "Callback Requested": { dot: "bg-orange-500", badge: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300" },
  "Quotation Sent":     { dot: "bg-amber-500",  badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  "Converted":          { dot: "bg-green-500",  badge: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  "Not Interested":     { dot: "bg-red-500",    badge: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};


const authFetch = (path: string, opts?: RequestInit) => {
  const token = localStorage.getItem("auth_token");
  return fetch(`/api${path}`, {
    ...opts,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(opts?.headers ?? {}) },
  });
};

const SITE_STAGE_OPTIONS = [
  "New Site/ Foundation", "Brickwork", "Plastering",
  "Roofing", "Painting/ Tiles", "Plumbing/ Electrical", "Finishing Stage",
];

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-muted/40 rounded-xl p-3 text-center">
      <div className="text-xl font-bold text-foreground">{value}</div>
      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</div>
      {sub && <div className="text-xs text-primary font-medium mt-0.5">{sub}</div>}
    </div>
  );
}

function feedbackBadge(fb: string) {
  const cls =
    fb === "Interested" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    fb === "Potential"  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" :
    "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{fb}</span>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "MMM d, yyyy"); } catch { return d; }
}

function fmtCurrency(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? "0"));
  if (isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [modal, setModal] = useState<"editCustomer" | "updateStage" | "markConversion" | "addQuotation" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [callStatusFilter, setCallStatusFilter] = useState<string>("all");

  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => authFetch(`/customers/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const { data: callHistory = [] } = useQuery<CallLogRecord[]>({
    queryKey: ["customer-call-logs", id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("call_logs")
        .select("id, call_date, call_status, call_summary, quotation_number, invoice_number, sale_value, next_schedule_date, agent:users!agent_id(name)")
        .eq("customer_id", Number(id))
        .order("call_date", { ascending: false });
      if (error) return [];
      return (rows ?? []) as unknown as CallLogRecord[];
    },
    enabled: !!id,
  });

  const {
    data: quotations = [],
    refetch: refetchQuotations,
    error: quotationsError,
  } = useQuery<QuotationRecord[]>({
    queryKey: ["customer-quotations", id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("quotations")
        .select("id, quotation_number, quotation_date, quotation_value, created_at")
        .eq("customer_id", Number(id))
        .order("quotation_date", { ascending: false });
      if (error) throw new Error(error.message);
      return (rows ?? []) as QuotationRecord[];
    },
    enabled: !!id,
    retry: 1,
  });

  const detail    = data?.data;
  const customer  = detail?.customer;
  const stats     = detail?.stats;
  const visits    = detail?.visits  ?? [];
  const brands    = detail?.brands  ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customer", id] });
  const close = () => setModal(null);

  const handleApiCall = async (path: string, method: string, body: any, successMsg: string) => {
    setSubmitting(true);
    try {
      const res = await authFetch(path, { method, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || "Request failed");
      toast({ title: successMsg });
      invalidate();
      close();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Forms ────────────────────────────────────────────────────────────────

  const editCustomerForm = useForm({
    resolver: zodResolver(z.object({
      name:        z.string().trim().min(1, "Name is required"),
      mobile:      z.string().trim().min(1, "Phone number is required"),
      companyName: z.string().trim().optional(),
    })),
    defaultValues: { name: customer?.name ?? "", mobile: customer?.mobile ?? "", companyName: customer?.company_name ?? "" },
  });

  const updateStageForm = useForm({
    resolver: zodResolver(z.object({
      site_stage: z.string().min(1, "Please select a stage"),
    })),
    defaultValues: { site_stage: stats?.currentSiteStage ?? "" },
  });

  const markConversionForm = useForm({
    resolver: zodResolver(z.object({
      sale_amount:    z.string().trim().min(1, "Sale amount is required"),
      invoice_number: z.string().trim().min(1, "Invoice number is required"),
    })),
    defaultValues: { sale_amount: "", invoice_number: "" },
  });

  const addQuotationForm = useForm({
    resolver: zodResolver(z.object({
      quotation_number: z.string().trim().min(1, "Quotation number is required"),
      quotation_date:   z.string().min(1, "Date is required"),
      quotation_value:  z.string().trim().min(1, "Value is required"),
    })),
    defaultValues: { quotation_number: "", quotation_date: "", quotation_value: "" },
  });

  const openEditCustomer = () => {
    editCustomerForm.reset({ name: customer?.name ?? "", mobile: customer?.mobile ?? "", companyName: customer?.company_name ?? "" });
    setModal("editCustomer");
  };

  const openUpdateStage = () => {
    updateStageForm.reset({ site_stage: stats?.currentSiteStage ?? "" });
    setModal("updateStage");
  };

  // ── Submissions ──────────────────────────────────────────────────────────

  const onEditCustomer = editCustomerForm.handleSubmit(async (d) => {
    await handleApiCall(`/customers/${id}`, "PUT", { name: d.name, mobile: d.mobile, companyName: d.companyName || null }, "Customer updated");
  });

  const onUpdateStage = updateStageForm.handleSubmit(async (d) => {
    const latestVisit = visits[0];
    if (!latestVisit) { toast({ variant: "destructive", title: "No visit found to update" }); return; }
    await handleApiCall(`/visits/${latestVisit.id}`, "PUT", { site_stage: d.site_stage }, "Site stage updated");
  });

  const onMarkConversion = markConversionForm.handleSubmit(async (d) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("call_logs").insert({
        customer_id:      parseInt(id!),
        agent_id:         parseInt(user!.id),
        call_date:        new Date().toISOString(),
        call_status:      "Converted",
        call_summary:     `Sale recorded — Invoice ${d.invoice_number}`,
        converted_to_sale: true,
        sale_value:       parseFloat(d.sale_amount),
        invoice_number:   d.invoice_number,
      });
      if (error) throw new Error(error.message);
      toast({ title: "Sale recorded" });
      markConversionForm.reset();
      qc.invalidateQueries({ queryKey: ["customer-call-logs", id] });
      invalidate();
      close();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  });

  const onAddQuotation = addQuotationForm.handleSubmit(async (d) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("quotations").insert({
        customer_id:      parseInt(id!),
        quotation_number: d.quotation_number,
        quotation_date:   d.quotation_date,
        quotation_value:  parseFloat(d.quotation_value),
        created_by:       parseInt(user!.id),
      });
      if (error) throw new Error(error.message);
      toast({ title: "Quotation added" });
      addQuotationForm.reset();
      refetchQuotations();
      close();
    } catch (err: any) {
      toast({ variant: "destructive", title: "Error", description: err.message });
    } finally {
      setSubmitting(false);
    }
  });

  if (isLoading) return (
    <div className="p-4 space-y-4 max-w-3xl mx-auto">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full rounded-xl" />
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );

  if (!customer) return (
    <div className="p-4 text-center py-16">
      <h2 className="text-lg font-medium">Customer not found</h2>
      <Button variant="ghost" className="mt-4" onClick={() => navigate("/customers")}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back to Customers
      </Button>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto pb-32">

      {/* Back */}
      <button onClick={() => navigate("/customers")} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Back to Customers
      </button>

      {/* ── A. Customer Summary ── */}
      <Card className="border-none shadow-md">
        <CardContent className="p-5 space-y-4">
          <div className="min-w-0">
            <h1 className="text-xl font-bold truncate">{customer.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{customer.mobile}</span>
              {customer.company_name && <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{customer.company_name}</span>}
              {stats?.customerType && <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{stats.customerType}</span>}
            </div>
            {stats?.currentSiteStage && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                Current stage: <span className="font-medium text-foreground ml-1">{stats.currentSiteStage}</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <StatCard label="Visits"      value={stats?.totalVisits ?? 0} />
            <StatCard label="Converted"   value={stats?.totalConversions ?? 0} />
            <StatCard label="Sales Value" value={fmtCurrency(stats?.totalSalesValue)} />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={() => navigate(`/calls/new?customerId=${id}`)}>
              <PhoneCall className="h-4 w-4" /> Make a Call
            </Button>
            <Button size="sm" variant="outline" onClick={openEditCustomer}>
              <Pencil className="h-4 w-4 mr-1" /> Edit Customer
            </Button>
            {visits.length > 0 && (
              <Button size="sm" variant="outline" onClick={openUpdateStage}>
                <RefreshCw className="h-4 w-4 mr-1" /> Update Stage
              </Button>
            )}
            {visits.length > 0 && (
              <Button size="sm" variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => { markConversionForm.reset(); setModal("markConversion"); }}>
                <DollarSign className="h-4 w-4 mr-1" /> Add Sale
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── B. Visit History ── */}
      <Card className="border-none shadow-md">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Visit History
          </h2>
          {visits.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No visits recorded.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[500px]">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <th className="text-left px-2 py-2">Date</th>
                    <th className="text-left px-2 py-2">Area</th>
                    <th className="text-left px-2 py-2">Stage</th>
                    <th className="text-left px-2 py-2">Brands</th>
                    <th className="text-left px-2 py-2">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v: any) => (
                    <tr key={v.id} className="border-b last:border-0">
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap">{fmtDate(v.visit_date)}</td>
                      <td className="px-2 py-2.5 text-xs">{v.area}</td>
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap">{v.site_stage}</td>
                      <td className="px-2 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {(v.brands ?? []).map((b: any, i: number) => (
                            <span key={i} className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-medium">
                              {b.brandName ?? b.customBrandName}
                            </span>
                          ))}
                          {(v.brands ?? []).length === 0 && <span className="text-muted-foreground text-[10px]">—</span>}
                        </div>
                      </td>
                      <td className="px-2 py-2.5">{feedbackBadge(v.feedback)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── C. Call History ── */}
      <Card className="border-none shadow-md">
        <CardContent className="p-5">
          {/* Header row */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <PhoneCall className="h-4 w-4" /> Call History
              {callHistory.length > 0 && (
                <span className="bg-primary/10 text-primary text-xs font-semibold px-2 py-0.5 rounded-full">
                  {callHistory.length}
                </span>
              )}
            </h2>
            <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => navigate(`/calls/new?customerId=${id}`)}>
              <PhoneCall className="h-3.5 w-3.5 mr-1" /> Log Call
            </Button>
          </div>

          {/* Stats row */}
          {callHistory.length > 0 && (
            <div className="flex gap-3 mb-4 text-center">
              <div className="flex-1 rounded-lg bg-muted/40 p-2">
                <div className="text-base font-bold">{callHistory.length}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Total</div>
              </div>
              <div className="flex-1 rounded-lg bg-muted/40 p-2">
                <div className="text-base font-bold text-blue-600">{callHistory.filter((c) => c.call_status === "Connected").length}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Connected</div>
              </div>
              <div className="flex-1 rounded-lg bg-muted/40 p-2">
                <div className="text-base font-bold text-amber-600">{callHistory.filter((c) => c.quotation_number).length}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Quotations</div>
              </div>
              <div className="flex-1 rounded-lg bg-muted/40 p-2">
                <div className="text-base font-bold text-green-600">{callHistory.filter((c) => c.call_status === "Converted").length}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Converted</div>
              </div>
            </div>
          )}

          {/* Filter */}
          {callHistory.length > 0 && (
            <div className="mb-3">
              <Select value={callStatusFilter} onValueChange={setCallStatusFilter}>
                <SelectTrigger className="h-8 w-44 text-xs">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {["Connected", "Not Connected", "Callback Requested", "Quotation Sent", "Converted", "Not Interested"].map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {callHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No calls logged yet.</p>
          ) : (() => {
            const filtered = callStatusFilter === "all"
              ? callHistory
              : callHistory.filter((c) => c.call_status === callStatusFilter);

            return filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No calls with this status.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                      <th className="text-left px-2 py-2 whitespace-nowrap">Date</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Status</th>
                      <th className="text-left px-2 py-2">Summary</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Agent</th>
                      <th className="text-left px-2 py-2 whitespace-nowrap">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((call) => {
                      const meta = CALL_STATUS_META[call.call_status] ?? { dot: "bg-muted-foreground", badge: "bg-muted text-muted-foreground" };
                      return (
                        <tr key={call.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-2 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(call.call_date)}</td>
                          <td className="px-2 py-2.5 whitespace-nowrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${meta.badge}`}>
                              {call.call_status}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-xs max-w-[180px]">
                            <p className="line-clamp-2 leading-snug">{call.call_summary}</p>
                          </td>
                          <td className="px-2 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{call.agent?.name ?? "—"}</td>
                          <td className="px-2 py-2.5">
                            <div className="flex flex-col gap-1">
                              {call.quotation_number && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 whitespace-nowrap">
                                  QT: {call.quotation_number}
                                </span>
                              )}
                              {call.invoice_number && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 whitespace-nowrap">
                                  INV: {call.invoice_number}
                                </span>
                              )}
                              {call.sale_value != null && call.sale_value > 0 && (
                                <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300 whitespace-nowrap">
                                  {fmtCurrency(call.sale_value)}
                                </span>
                              )}
                              {call.next_schedule_date && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300 whitespace-nowrap">
                                  CB: {fmtDate(call.next_schedule_date)}
                                </span>
                              )}
                              {!call.quotation_number && !call.invoice_number && !call.next_schedule_date && (
                                <span className="text-[10px] text-muted-foreground">—</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* ── D. Quotations ── */}
      <Card className="border-none shadow-md">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" /> Quotations
            </h2>
            <Button size="sm" variant="outline" onClick={() => { addQuotationForm.reset(); setModal("addQuotation"); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Quotation
            </Button>
          </div>
          {quotationsError ? (
            <div className="text-sm text-red-600 text-center py-4 space-y-2">
              <p>Could not load quotations: {(quotationsError as Error).message}</p>
              <Button size="sm" variant="outline" onClick={() => refetchQuotations()}>Retry</Button>
            </div>
          ) : quotations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No quotations yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <th className="text-left px-2 py-2">Date</th>
                    <th className="text-left px-2 py-2">Quotation #</th>
                    <th className="text-right px-2 py-2">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id} className="border-b last:border-0">
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap">{fmtDate(q.quotation_date)}</td>
                      <td className="px-2 py-2.5 text-xs font-mono">{q.quotation_number}</td>
                      <td className="px-2 py-2.5 text-xs font-semibold text-right text-primary">
                        <span className="flex items-center justify-end gap-0.5">
                          <IndianRupee className="h-3 w-3" />
                          {Number(q.quotation_value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── E. Brands ── */}
      {brands.length > 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" /> Brands Used
            </h2>
            <div className="flex flex-wrap gap-2">
              {brands.map((b: any, i: number) => (
                <Badge key={i} variant="secondary" className="text-xs font-medium">
                  <Tag className="h-3 w-3 mr-1" /> {b.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ══════════════ MODALS ══════════════ */}

      {/* Edit Customer */}
      <Dialog open={modal === "editCustomer"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Customer Details</DialogTitle></DialogHeader>
          <Form {...editCustomerForm}>
            <form onSubmit={onEditCustomer} className="space-y-4">
              <FormField control={editCustomerForm.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Name *</FormLabel>
                  <FormControl><Input {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editCustomerForm.control} name="mobile" render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl><Input {...field} className="h-10" placeholder="+91 XXXXX XXXXX" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editCustomerForm.control} name="companyName" render={({ field }) => (
                <FormItem>
                  <FormLabel>Company / Builder Name <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Update Site Stage */}
      <Dialog open={modal === "updateStage"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update Site Stage</DialogTitle></DialogHeader>
          <Form {...updateStageForm}>
            <form onSubmit={onUpdateStage} className="space-y-4">
              <FormField control={updateStageForm.control} name="site_stage" render={({ field }) => (
                <FormItem>
                  <FormLabel>Site Stage *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select stage" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SITE_STAGE_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Update
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Sale */}
      <Dialog open={modal === "markConversion"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Sale</DialogTitle></DialogHeader>
          <Form {...markConversionForm}>
            <form onSubmit={onMarkConversion} className="space-y-4">
              <FormField control={markConversionForm.control} name="sale_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Amount (₹) *</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g. 75000" {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={markConversionForm.control} name="invoice_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Invoice Number *</FormLabel>
                  <FormControl><Input placeholder="e.g. INV-2024-001" {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-green-600 hover:bg-green-700 text-white">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save Sale
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Add Quotation */}
      <Dialog open={modal === "addQuotation"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Quotation</DialogTitle></DialogHeader>
          <Form {...addQuotationForm}>
            <form onSubmit={onAddQuotation} className="space-y-4">
              <FormField control={addQuotationForm.control} name="quotation_number" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quotation Number *</FormLabel>
                  <FormControl><Input placeholder="e.g. QT-2024-001" {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addQuotationForm.control} name="quotation_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Date *</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addQuotationForm.control} name="quotation_value" render={({ field }) => (
                <FormItem>
                  <FormLabel>Value (₹) *</FormLabel>
                  <FormControl><Input type="number" placeholder="e.g. 50000" {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Save
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

    </div>
  );
}
