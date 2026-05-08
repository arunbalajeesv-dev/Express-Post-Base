import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import {
  Phone, PhoneOff, CheckCircle2, Search, X, Loader2,
  CalendarClock, History, Clock, IndianRupee, FileText,
} from "lucide-react";
import { useLocation } from "wouter";
import { format, parseISO } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type Customer = { id: number; name: string; mobile: string; company_name?: string };

type CallLogRecord = {
  id: number;
  call_date: string;
  call_status: string;
  call_summary: string;
  quotation_number: string | null;
  invoice_number: string | null;
  sale_value: number | null;
  next_schedule_date: string | null;
  customer: { name: string; mobile: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "Connected",          label: "Connected",          sel: "bg-blue-600 text-white border-blue-600",      unsel: "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-800" },
  { value: "Not Connected",      label: "Not Connected",      sel: "bg-slate-600 text-white border-slate-600",    unsel: "bg-slate-50 text-slate-700 border-slate-300 dark:bg-slate-900/30 dark:text-slate-300 dark:border-slate-700" },
  { value: "Callback Requested", label: "Callback Requested", sel: "bg-orange-500 text-white border-orange-500",  unsel: "bg-orange-50 text-orange-800 border-orange-300 dark:bg-orange-950/30 dark:text-orange-300 dark:border-orange-800" },
  { value: "Quotation Sent",     label: "Quotation Sent",     sel: "bg-amber-500 text-white border-amber-500",    unsel: "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800" },
  { value: "Converted",          label: "Converted",          sel: "bg-green-600 text-white border-green-600",    unsel: "bg-green-50 text-green-800 border-green-300 dark:bg-green-950/30 dark:text-green-300 dark:border-green-800" },
  { value: "Not Interested",     label: "Not Interested",     sel: "bg-red-500 text-white border-red-500",        unsel: "bg-red-50 text-red-800 border-red-300 dark:bg-red-950/30 dark:text-red-300 dark:border-red-800" },
] as const;

const STATUS_BADGE: Record<string, string> = {
  "Connected":          "bg-blue-100 text-blue-800",
  "Not Connected":      "bg-slate-100 text-slate-700",
  "Callback Requested": "bg-orange-100 text-orange-800",
  "Quotation Sent":     "bg-amber-100 text-amber-800",
  "Converted":          "bg-green-100 text-green-800",
  "Not Interested":     "bg-red-100 text-red-800",
};

// ─── Schema ───────────────────────────────────────────────────────────────────

const callLogSchema = z.object({
  callStatus:       z.string().min(1, "Please select a call status"),
  callSummary:      z.string().min(10, "Summary must be at least 10 characters"),
  quotationNumber:  z.string().optional(),
  invoiceNumber:    z.string().optional(),
  saleValue:        z.string().optional(),
  nextScheduleDate: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.callStatus === "Callback Requested" && !data.nextScheduleDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Callback date/time is required", path: ["nextScheduleDate"] });
  }
  if (data.callStatus === "Quotation Sent" && !data.quotationNumber?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Quotation number is required", path: ["quotationNumber"] });
  }
  if (data.callStatus === "Converted") {
    if (!data.invoiceNumber?.trim()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invoice number is required", path: ["invoiceNumber"] });
    }
    if (!data.saleValue || isNaN(parseFloat(data.saleValue)) || parseFloat(data.saleValue) <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valid sale value is required", path: ["saleValue"] });
    }
  }
});

type CallLogFormValues = z.infer<typeof callLogSchema>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatElapsed(s: number) {
  return `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function authHeader(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewCall() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const urlParams           = new URLSearchParams(window.location.search);
  const prefilledCustomerId = urlParams.get("customerId");

  const [activeTab, setActiveTab]             = useState<"log" | "history">("log");
  const [search, setSearch]                   = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [dropdownOpen, setDropdownOpen]       = useState(false);
  const searchContainerRef                    = useRef<HTMLDivElement>(null);

  const [timerState, setTimerState] = useState<"idle" | "running" | "stopped">("idle");
  const [startedAt, setStartedAt]   = useState<Date | null>(null);
  const [elapsed, setElapsed]       = useState(0);
  const timerRef                    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [savedStatus, setSavedStatus] = useState<string | null>(null);

  // ── Customer list ──────────────────────────────────────────────────────────
  const { data: allCustomers = [] } = useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => {
      const res  = await fetch("/api/customers", { headers: authHeader() });
      const json = await res.json();
      return json.data ?? [];
    },
  });

  // ── My call history (from call_logs) ──────────────────────────────────────
  const { data: myCalls = [], isLoading: callsLoading } = useQuery<CallLogRecord[]>({
    queryKey: ["my-call-logs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, call_date, call_status, call_summary, quotation_number, invoice_number, sale_value, next_schedule_date, customer:customers(name, mobile)")
        .eq("agent_id", parseInt(user!.id))
        .order("call_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as CallLogRecord[];
    },
    enabled: !!user,
  });

  // ── Auto-select customer from URL param ───────────────────────────────────
  useEffect(() => {
    if (prefilledCustomerId && allCustomers.length > 0 && !selectedCustomer) {
      const found = allCustomers.find((c) => String(c.id) === prefilledCustomerId);
      if (found) setSelectedCustomer(found);
    }
  }, [prefilledCustomerId, allCustomers]);

  const filteredCustomers = search.trim().length >= 1
    ? allCustomers
        .filter((c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.mobile.includes(search) ||
          (c.company_name ?? "").toLowerCase().includes(search.toLowerCase())
        )
        .slice(0, 8)
    : [];

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  function startTimer() {
    setStartedAt(new Date()); setElapsed(0); setTimerState("running");
    timerRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
  }
  function stopTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerState("stopped");
  }

  const form = useForm<CallLogFormValues>({
    resolver: zodResolver(callLogSchema),
    defaultValues: { callSummary: "", callStatus: "" },
  });

  const callStatus = form.watch("callStatus");

  // ── Submit ─────────────────────────────────────────────────────────────────
  async function onSubmit(values: CallLogFormValues) {
    if (!selectedCustomer) {
      toast({ title: "Please select a customer first", variant: "destructive" });
      return;
    }
    if (!user) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("call_logs").insert({
        customer_id:       selectedCustomer.id,
        agent_id:          parseInt(user.id),
        call_date:         startedAt?.toISOString() ?? new Date().toISOString(),
        call_status:       values.callStatus,
        call_summary:      values.callSummary.trim(),
        quotation_sent:    values.callStatus === "Quotation Sent",
        quotation_number:  values.quotationNumber?.trim() || null,
        converted_to_sale: values.callStatus === "Converted",
        invoice_number:    values.invoiceNumber?.trim() || null,
        sale_value:        values.saleValue ? parseFloat(values.saleValue) : null,
        next_schedule_date: values.nextScheduleDate
          ? new Date(values.nextScheduleDate).toISOString()
          : null,
      });

      if (error) throw error;
      setSavedStatus(values.callStatus);
    } catch (err) {
      toast({ title: "Failed to save", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  // ── Success screen ─────────────────────────────────────────────────────────
  if (savedStatus !== null) {
    const nextDate = form.getValues("nextScheduleDate");
    return (
      <div className="p-4 max-w-lg mx-auto space-y-4">
        <Card>
          <CardContent className="pt-8 pb-6 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold">Call Logged</h2>
              <p className="text-muted-foreground text-sm">{selectedCustomer?.name}</p>
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${STATUS_BADGE[savedStatus] ?? "bg-muted text-muted-foreground"}`}>
                {savedStatus}
              </span>
              {savedStatus === "Callback Requested" && nextDate && (
                <div className="flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2 w-fit mx-auto">
                  <CalendarClock className="w-3.5 h-3.5 shrink-0" />
                  Callback: {format(new Date(nextDate), "MMM d, h:mm a")}
                </div>
              )}
              {savedStatus === "Converted" && (
                <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 w-fit mx-auto">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Sale recorded — ₹{parseFloat(form.getValues("saleValue") ?? "0").toLocaleString("en-IN")}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => navigate(-1 as any)}>Done</Button>
          <Button className="flex-1" onClick={() => {
            setSavedStatus(null);
            setSelectedCustomer(null);
            setTimerState("idle");
            setElapsed(0);
            setStartedAt(null);
            form.reset();
          }}>
            Log Another Call
          </Button>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <div className="p-4 max-w-lg mx-auto pb-24 space-y-4">

      {/* Header + Tabs */}
      <div>
        <h1 className="text-xl font-bold">Log a Call</h1>
        <div className="flex gap-2 mt-3 border-b">
          {(["log", "history"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "log"
                ? <><Phone className="w-3.5 h-3.5" />Log Call</>
                : <><History className="w-3.5 h-3.5" />My History</>}
            </button>
          ))}
        </div>
      </div>

      {/* ── History Tab ──────────────────────────────────────────────────────── */}
      {activeTab === "history" && (
        <div className="space-y-3">
          {callsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
            </div>
          ) : myCalls.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No call logs yet</p>
            </div>
          ) : (
            myCalls.map((c) => (
              <div key={c.id} className="rounded-xl border p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-sm leading-none truncate">{c.customer?.name ?? "Unknown"}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{c.customer?.mobile}</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${STATUS_BADGE[c.call_status] ?? "bg-muted text-muted-foreground"}`}>
                    {c.call_status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{c.call_summary}</p>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(parseISO(c.call_date), "MMM d, h:mm a")}
                  </span>
                  {c.quotation_number && <span className="font-mono">QT: {c.quotation_number}</span>}
                  {c.invoice_number   && <span className="font-mono">Inv: {c.invoice_number}</span>}
                  {c.sale_value       && <span className="text-green-600 font-semibold">₹{c.sale_value.toLocaleString("en-IN")}</span>}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Log Tab ──────────────────────────────────────────────────────────── */}
      {activeTab === "log" && <>

        {/* Customer Selector */}
        <div ref={searchContainerRef} className="relative">
          {selectedCustomer ? (
            <div className="flex items-center gap-3 p-3 rounded-xl border bg-primary/5 border-primary/20">
              <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                {selectedCustomer.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm leading-none truncate">{selectedCustomer.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{selectedCustomer.mobile}
                  {selectedCustomer.company_name && ` · ${selectedCustomer.company_name}`}
                </div>
              </div>
              <Button
                variant="ghost" size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                onClick={() => { setSelectedCustomer(null); setSearch(""); }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search customer by name or mobile…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setDropdownOpen(true); }}
                  onFocus={() => setDropdownOpen(true)}
                  className="pl-9"
                />
              </div>
              {dropdownOpen && filteredCustomers.length > 0 && (
                <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-popover border rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {filteredCustomers.map((c) => (
                    <button
                      key={c.id}
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 text-left transition-colors"
                      onClick={() => { setSelectedCustomer(c); setSearch(""); setDropdownOpen(false); }}
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{c.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.mobile}{c.company_name ? ` · ${c.company_name}` : ""}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Call Timer */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-mono text-lg font-bold tabular-nums">{formatElapsed(elapsed)}</span>
            </div>
            <div className="flex gap-2">
              {timerState === "idle" && (
                <Button size="sm" variant="outline" onClick={startTimer} className="gap-1.5">
                  <Phone className="w-3.5 h-3.5" /> Start Call
                </Button>
              )}
              {timerState === "running" && (
                <Button size="sm" variant="outline" onClick={stopTimer} className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50">
                  <PhoneOff className="w-3.5 h-3.5" /> End Call
                </Button>
              )}
              {timerState === "stopped" && (
                <span className="text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1.5 rounded-lg font-medium">
                  {formatElapsed(elapsed)} recorded
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            {/* ── Call Status ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Call Status <span className="text-red-500">*</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField control={form.control} name="callStatus" render={({ field }) => (
                  <FormItem>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUS_OPTIONS.map((o) => {
                        const selected = field.value === o.value;
                        return (
                          <button
                            key={o.value} type="button"
                            className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${selected ? o.sel : o.unsel}`}
                            onClick={() => field.onChange(o.value)}
                          >
                            {o.label}
                          </button>
                        );
                      })}
                    </div>
                    <FormMessage className="mt-2" />
                  </FormItem>
                )} />
              </CardContent>
            </Card>

            {/* ── Call Summary — always shown once status selected ─────────── */}
            {callStatus && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Call Summary <span className="text-red-500">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField control={form.control} name="callSummary" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea placeholder="What was discussed? (minimum 10 characters)" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ── Quotation Number — Quotation Sent only ───────────────────── */}
            {callStatus === "Quotation Sent" && (
              <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Quotation Number <span className="text-red-500">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField control={form.control} name="quotationNumber" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input placeholder="e.g. QT-2025-001" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ── Sale Details — Converted only ────────────────────────────── */}
            {callStatus === "Converted" && (
              <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-green-700 uppercase tracking-wide flex items-center gap-1.5">
                    <IndianRupee className="w-3.5 h-3.5" /> Sale Details <span className="text-red-500">*</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <FormField control={form.control} name="invoiceNumber" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Invoice Number</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. INV-2025-001" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="saleValue" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs text-muted-foreground">Sale Value (₹)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="e.g. 125000" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ── Schedule Next Call — Callback Requested or Connected ─────── */}
            {(callStatus === "Callback Requested" || callStatus === "Connected") && (
              <Card className={callStatus === "Callback Requested" ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20" : ""}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <CalendarClock className="w-3.5 h-3.5" />
                    {callStatus === "Callback Requested"
                      ? <> Next Callback <span className="text-red-500">*</span></>
                      : "Schedule Next Call (optional)"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <FormField control={form.control} name="nextScheduleDate" render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          className="h-10"
                          min={new Date().toISOString().slice(0, 16)}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </CardContent>
              </Card>
            )}

            {/* ── Submit ──────────────────────────────────────────────────── */}
            {callStatus && (
              <>
                <Button type="submit" className="w-full" size="lg" disabled={submitting || !selectedCustomer}>
                  {submitting
                    ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</>
                    : "Save Call Log"
                  }
                </Button>
                {!selectedCustomer && (
                  <p className="text-center text-xs text-muted-foreground -mt-2">Select a customer to enable save</p>
                )}
              </>
            )}

          </form>
        </Form>
      </>}
    </div>
  );
}
