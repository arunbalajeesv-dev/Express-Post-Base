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
import {
  ArrowLeft, Phone, Building2, User, Tag, MapPin, Calendar,
  Plus, Pencil, RefreshCw, DollarSign, Loader2, CheckCircle2, Clock, TrendingUp, Package
} from "lucide-react";

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

const CUSTOMER_TYPE_OPTIONS = [
  "Owner", "Purchase Manager", "Site Manager", "Site Mastery", "Technician", "Others",
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

function statusBadge(status: string) {
  const cls =
    status === "Converted"  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    status === "Completed"  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{status}</span>;
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

  const [modal, setModal] = useState<"addFollowup" | "editCustomer" | "updateStage" | "markConversion" | "editFollowup" | null>(null);
  const [editingFollowup, setEditingFollowup] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);

  const { user } = useAuth();
  const isManager = user?.role === "Manager";

  const { data, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: () => authFetch(`/customers/${id}`).then((r) => r.json()),
    enabled: !!id,
  });

  const detail = data?.data;
  const customer = detail?.customer;
  const stats    = detail?.stats;
  const visits   = detail?.visits   ?? [];
  const followups = detail?.followups ?? [];
  const conversions = detail?.conversions ?? [];
  const brands    = detail?.brands   ?? [];

  const invalidate = () => qc.invalidateQueries({ queryKey: ["customer", id] });

  const close = () => { setModal(null); setEditingFollowup(null); };

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

  const addFollowupForm = useForm({
    resolver: zodResolver(z.object({
      visit_id:      z.string().min(1, "Please select an agent"),
      followup_date: z.string().min(1, "Date is required"),
      notes:         z.string().trim().min(1, "Notes are required"),
    })),
    defaultValues: { visit_id: "", followup_date: "", notes: "" },
  });

  const editCustomerForm = useForm({
    resolver: zodResolver(z.object({
      name:        z.string().trim().min(1, "Name is required"),
      companyName: z.string().trim().optional(),
    })),
    defaultValues: { name: customer?.name ?? "", companyName: customer?.company_name ?? "" },
  });

  const updateStageForm = useForm({
    resolver: zodResolver(z.object({
      site_stage: z.string().min(1, "Please select a stage"),
    })),
    defaultValues: { site_stage: stats?.currentSiteStage ?? "" },
  });

  const markConversionForm = useForm({
    resolver: zodResolver(z.object({
      followup_id:    z.string().min(1, "Select a follow-up"),
      sale_amount:    z.string().trim().min(1, "Sale amount is required"),
      invoice_number: z.string().trim().min(1, "Invoice number is required"),
    })),
    defaultValues: { followup_id: "", sale_amount: "", invoice_number: "" },
  });

  const editFollowupForm = useForm({
    resolver: zodResolver(z.object({
      followup_date: z.string().min(1, "Date is required"),
      notes:         z.string().trim().optional(),
      status:        z.enum(["Pending", "Completed"]),
    })),
    defaultValues: { followup_date: "", notes: "", status: "Pending" as const },
  });

  const openEditFollowup = (fu: any) => {
    setEditingFollowup(fu);
    editFollowupForm.reset({
      followup_date: fu.followup_date ?? "",
      notes:         fu.notes ?? "",
      status:        fu.status === "Converted" ? "Completed" : fu.status,
    });
    setModal("editFollowup");
  };

  const openEditCustomer = () => {
    editCustomerForm.reset({ name: customer?.name ?? "", companyName: customer?.company_name ?? "" });
    setModal("editCustomer");
  };

  const openUpdateStage = () => {
    updateStageForm.reset({ site_stage: stats?.currentSiteStage ?? "" });
    setModal("updateStage");
  };

  // ── Submissions ──────────────────────────────────────────────────────────

  const onAddFollowup = addFollowupForm.handleSubmit(async (d) => {
    await handleApiCall("/add-followup", "POST", { visit_id: Number(d.visit_id), followup_date: d.followup_date, notes: d.notes }, "Follow-up added");
    addFollowupForm.reset();
  });

  const onEditCustomer = editCustomerForm.handleSubmit(async (d) => {
    await handleApiCall(`/customers/${id}`, "PUT", { name: d.name, companyName: d.companyName || null }, "Customer updated");
  });

  const onUpdateStage = updateStageForm.handleSubmit(async (d) => {
    const latestVisit = visits[0];
    if (!latestVisit) { toast({ variant: "destructive", title: "No visit found to update" }); return; }
    await handleApiCall(`/visits/${latestVisit.id}`, "PUT", { site_stage: d.site_stage }, "Site stage updated");
  });

  const onMarkConversion = markConversionForm.handleSubmit(async (d) => {
    await handleApiCall(`/followups/${d.followup_id}`, "PUT", {
      status: "Converted",
      sale_amount: d.sale_amount,
      invoice_number: d.invoice_number,
    }, "Conversion recorded");
    markConversionForm.reset();
  });

  const onEditFollowup = editFollowupForm.handleSubmit(async (d) => {
    await handleApiCall(`/followups/${editingFollowup.id}`, "PUT", {
      status:        d.status,
      followup_date: d.followup_date,
      notes:         d.notes,
    }, "Follow-up updated");
    editFollowupForm.reset();
  });

  const pendingFollowups = followups.filter((f: any) => f.status !== "Converted");
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = followups.filter((f: any) => f.status !== "Converted" && f.followup_date >= today);
  const nextFollowup = upcoming.sort((a: any, b: any) => a.followup_date.localeCompare(b.followup_date))[0];

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
          <div className="flex items-start justify-between gap-3">
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
              {nextFollowup && (
                <div className="mt-1.5 flex items-center gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span className="text-muted-foreground">Next follow-up:</span>
                  <span className="font-medium text-primary">{fmtDate(nextFollowup.followup_date)}</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="Visits"      value={stats?.totalVisits ?? 0} />
            <StatCard label="Follow-ups"  value={stats?.totalFollowups ?? 0} />
            <StatCard label="Converted"   value={stats?.totalConversions ?? 0} />
            <StatCard label="Sales Value" value={fmtCurrency(stats?.totalSalesValue)} />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button size="sm" onClick={() => { addFollowupForm.reset({ visit_id: isManager ? "" : String(visits[0]?.id ?? ""), followup_date: "", notes: "" }); setModal("addFollowup"); }}>
              <Plus className="h-4 w-4 mr-1" /> Add Follow-up
            </Button>
            <Button size="sm" variant="outline" onClick={openEditCustomer}>
              <Pencil className="h-4 w-4 mr-1" /> Edit Customer
            </Button>
            {visits.length > 0 && (
              <Button size="sm" variant="outline" onClick={openUpdateStage}>
                <RefreshCw className="h-4 w-4 mr-1" /> Update Stage
              </Button>
            )}
            {pendingFollowups.length > 0 && (
              <Button size="sm" variant="outline" className="border-green-500/50 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={() => { markConversionForm.reset(); setModal("markConversion"); }}>
                <DollarSign className="h-4 w-4 mr-1" /> Mark Conversion
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

      {/* ── C. Follow-ups ── */}
      <Card className="border-none shadow-md">
        <CardContent className="p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Follow-ups
          </h2>
          {followups.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No follow-ups yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[420px]">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <th className="text-left px-2 py-2">Date</th>
                    <th className="text-left px-2 py-2">Status</th>
                    <th className="text-left px-2 py-2">Notes</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {followups.map((f: any) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap">{fmtDate(f.followup_date)}</td>
                      <td className="px-2 py-2.5">{statusBadge(f.status)}</td>
                      <td className="px-2 py-2.5 text-xs text-muted-foreground max-w-[180px] truncate">{f.notes || "—"}</td>
                      <td className="px-2 py-2.5">
                        {f.status !== "Converted" && (
                          <button onClick={() => openEditFollowup(f)} className="text-muted-foreground hover:text-foreground transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
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

      {/* ── D. Conversion History ── */}
      {conversions.length > 0 && (
        <Card className="border-none shadow-md">
          <CardContent className="p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-600" /> Conversion History
            </h2>
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-sm min-w-[360px]">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <th className="text-left px-2 py-2">Date</th>
                    <th className="text-left px-2 py-2">Invoice</th>
                    <th className="text-right px-2 py-2">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {conversions.map((c: any) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="px-2 py-2.5 text-xs whitespace-nowrap">{fmtDate(c.converted_at ?? c.followup_date)}</td>
                      <td className="px-2 py-2.5 text-xs font-mono">{c.invoice_number || "—"}</td>
                      <td className="px-2 py-2.5 text-xs font-semibold text-right text-green-700 dark:text-green-400">{fmtCurrency(c.sale_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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

      {/* Add Follow-up */}
      <Dialog open={modal === "addFollowup"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Follow-up</DialogTitle></DialogHeader>
          <Form {...addFollowupForm}>
            <form onSubmit={onAddFollowup} className="space-y-4">
              {isManager && (
                <FormField control={addFollowupForm.control} name="visit_id" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Assign to Agent *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10"><SelectValue placeholder="Select agent" /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {visits.map((v: any) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.agent_name} — {fmtDate(v.visit_date)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              )}
              <FormField control={addFollowupForm.control} name="followup_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Follow-up Date *</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={addFollowupForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes *</FormLabel>
                  <FormControl><Textarea placeholder="What needs follow-up?" rows={3} {...field} className="resize-none" /></FormControl>
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

      {/* Mark Conversion */}
      <Dialog open={modal === "markConversion"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Mark Conversion</DialogTitle></DialogHeader>
          <Form {...markConversionForm}>
            <form onSubmit={onMarkConversion} className="space-y-4">
              <FormField control={markConversionForm.control} name="followup_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Follow-up *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Choose follow-up to convert" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {pendingFollowups.map((f: any) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {fmtDate(f.followup_date)} — {f.status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={markConversionForm.control} name="sale_amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Sale Amount (₹) *</FormLabel>
                  <FormControl><Input placeholder="e.g. 75000" {...field} className="h-10" /></FormControl>
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
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Record Conversion
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Follow-up */}
      <Dialog open={modal === "editFollowup"} onOpenChange={(o) => !o && close()}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Follow-up</DialogTitle></DialogHeader>
          <Form {...editFollowupForm}>
            <form onSubmit={onEditFollowup} className="space-y-4">
              <FormField control={editFollowupForm.control} name="followup_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Follow-up Date *</FormLabel>
                  <FormControl><Input type="date" {...field} className="h-10" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editFollowupForm.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={editFollowupForm.control} name="notes" render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl><Textarea rows={3} {...field} className="resize-none" /></FormControl>
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
