import { useState, useMemo } from "react";
import { useAuth } from "@/lib/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  parseISO,
  isToday,
  isBefore,
  isAfter,
  differenceInDays,
} from "date-fns";
import {
  CalendarClock,
  Phone,
  User,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  IndianRupee,
  FileText,
  ChevronLeft,
  ChevronRight,
  Plus,
  Bell,
  MessageSquare,
  ClipboardList,
  AlertTriangle,
  Search,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Followup = {
  id: number;
  followupDate: string;
  status: string;
  notes: string | null;
  saleAmount: string | null;
  invoiceNumber: string | null;
  convertedAt: string | null;
  summary: string | null;
  spokeToCustomer: boolean | null;
  quotationSent: boolean | null;
  quotationNumber: string | null;
  customer: { id: number; name: string; mobile: string; companyName: string | null } | null;
  visit: { id: number; area: string; siteStage: string; feedback: string } | null;
  assignedTo: { id: number; name: string; userId: string } | null;
};

type CustomerItem = {
  id: number;
  name: string;
  mobile: string;
  companyName: string | null;
  visitCount: number;
};

function apiHeaders() {
  const token = localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowStr() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function useFollowups() {
  return useQuery<Followup[]>({
    queryKey: ["followups-all"],
    queryFn: async () => {
      const res = await fetch("/api/followups", { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load follow-ups");
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

function useCustomers() {
  return useQuery<CustomerItem[]>({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const res = await fetch("/api/customers", { headers: apiHeaders() });
      if (!res.ok) throw new Error("Failed to load customers");
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

function useUpdateFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Record<string, unknown> & { id: number }) => {
      const { id, ...rest } = body;
      const res = await fetch(`/api/followups/${id}`, {
        method: "PUT",
        headers: apiHeaders(),
        body: JSON.stringify(rest),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Update failed");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followups-all"] }),
  });
}

function useScheduleFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { visit_id: number; followup_date: string; notes?: string }) => {
      const res = await fetch("/api/add-followup", {
        method: "POST",
        headers: apiHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).message || "Failed to schedule follow-up");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["followups-all"] }),
  });
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

function MiniCalendar({
  followups,
  onSelectDate,
  selectedDate,
}: {
  followups: Followup[];
  onSelectDate: (d: Date | null) => void;
  selectedDate: Date | null;
}) {
  const [viewMonth, setViewMonth] = useState<Date>(new Date());

  const datesWithFollowups = useMemo(() => {
    const s = new Set<string>();
    for (const f of followups) {
      if (f.followupDate) s.add(f.followupDate);
    }
    return s;
  }, [followups]);

  const dotColor = (dateStr: string): string | null => {
    const fus = followups.filter((f) => f.followupDate === dateStr);
    if (!fus.length) return null;
    if (fus.some((f) => f.status === "Missed" || (f.status === "Pending" && dateStr < todayStr()))) return "bg-red-500";
    if (fus.some((f) => f.status === "Pending" && dateStr === tomorrowStr())) return "bg-orange-400";
    if (fus.some((f) => f.status === "Converted")) return "bg-green-500";
    if (fus.some((f) => f.status === "Completed")) return "bg-blue-500";
    return "bg-amber-400";
  };

  const monthStart  = startOfMonth(viewMonth);
  const monthEnd    = endOfMonth(viewMonth);
  const calStart    = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd      = endOfWeek(monthEnd,   { weekStartsOn: 1 });

  const days: Date[] = [];
  let cur = calStart;
  while (cur <= calEnd) {
    days.push(cur);
    cur = addDays(cur, 1);
  }

  const handleClick = (d: Date) => {
    if (selectedDate && isSameDay(d, selectedDate)) {
      onSelectDate(null);
    } else {
      onSelectDate(d);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setViewMonth((m) => subMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-semibold text-sm">{format(viewMonth, "MMMM yyyy")}</span>
        <button
          onClick={() => setViewMonth((m) => addMonths(m, 1))}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-1">
        {["Mo","Tu","We","Th","Fr","Sa","Su"].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const inMonth = isSameMonth(day, viewMonth);
          const selected = selectedDate && isSameDay(day, selectedDate);
          const todayDay = isToday(day);
          const dot = dotColor(dateStr);

          return (
            <button
              key={i}
              onClick={() => inMonth && handleClick(day)}
              disabled={!inMonth}
              className={`
                relative flex flex-col items-center py-1 rounded-lg transition-colors text-xs
                ${!inMonth ? "opacity-20 cursor-default" : "cursor-pointer hover:bg-muted"}
                ${selected ? "bg-primary text-primary-foreground hover:bg-primary" : ""}
                ${todayDay && !selected ? "font-bold text-primary ring-1 ring-primary/30" : ""}
              `}
            >
              <span>{format(day, "d")}</span>
              {dot && inMonth && (
                <span className={`absolute bottom-0.5 w-1.5 h-1.5 rounded-full ${dot} ${selected ? "bg-white/80" : ""}`} />
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex gap-3 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Overdue</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />Due tomorrow</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Upcoming</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />Done</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Converted</span>
      </div>
    </div>
  );
}

type ReportDialogState =
  | { open: false }
  | { open: true; followup: Followup; mode: "complete" | "convert" | "reschedule" };

type ScheduleDialogState = { open: false } | { open: true };

function FollowupCard({
  f,
  onReport,
  isManager = false,
}: {
  f: Followup;
  onReport: () => void;
  isManager?: boolean;
}) {
  const isConverted = f.status === "Converted";
  const isCompleted = f.status === "Completed";
  const isMissed    = f.status === "Missed";
  const isPending   = f.status === "Pending";
  const locked      = isConverted;

  const today = todayStr();
  const tomorrow = tomorrowStr();
  const isOverdue  = isPending && f.followupDate <= today;
  const isDueSoon  = isPending && f.followupDate === tomorrow;

  let borderColor = "border-l-primary";
  if (isConverted) borderColor = "border-l-green-500";
  else if (isCompleted) borderColor = "border-l-blue-500";
  else if (isMissed || isOverdue) borderColor = "border-l-red-400";
  else if (isDueSoon) borderColor = "border-l-orange-400";

  return (
    <Card className={`border-l-4 overflow-hidden ${borderColor}`}>
      <CardContent className="p-4 space-y-2.5">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-1 min-w-0">
            <h3 className="font-semibold text-sm flex items-center gap-1.5 truncate">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {f.customer?.name ?? "—"}
            </h3>
            {f.customer?.mobile && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Phone className="h-3 w-3" />{f.customer.mobile}
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <CalendarClock className="h-3 w-3" />
              {f.followupDate ? format(parseISO(f.followupDate), "MMM d, yyyy") : "—"}
              {isDueSoon && !isOverdue && (
                <span className="ml-1 text-orange-500 font-semibold">· Due soon</span>
              )}
              {isOverdue && (
                <span className="ml-1 text-red-500 font-semibold">· Overdue</span>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {isOverdue
              ? <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">Overdue</span>
              : <StatusBadge status={f.status} />}
          </div>
        </div>

        {f.notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 line-clamp-2">{f.notes}</p>
        )}

        {(isCompleted || isConverted) && f.summary && (
          <div className="text-xs bg-muted/50 rounded-lg px-3 py-2 space-y-1">
            <div className="flex items-center gap-1 font-medium text-foreground/80">
              <MessageSquare className="h-3 w-3" />Summary
            </div>
            <p className="text-muted-foreground line-clamp-2">{f.summary}</p>
            <div className="flex gap-3 mt-1">
              {f.spokeToCustomer !== null && (
                <span className={`flex items-center gap-1 ${f.spokeToCustomer ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                  <Phone className="h-3 w-3" />{f.spokeToCustomer ? "Spoke to customer" : "No contact"}
                </span>
              )}
              {f.quotationSent !== null && f.quotationSent && (
                <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                  <ClipboardList className="h-3 w-3" />Quotation sent
                  {f.quotationNumber && <span className="font-mono">· {f.quotationNumber}</span>}
                </span>
              )}
            </div>
          </div>
        )}

        {isConverted && f.saleAmount && (
          <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
            <IndianRupee className="h-3.5 w-3.5" />
            {parseFloat(f.saleAmount).toLocaleString("en-IN")}
            {f.convertedAt && (
              <span className="text-xs font-normal text-muted-foreground ml-1">
                · {format(new Date(f.convertedAt), "MMM d, yyyy")}
              </span>
            )}
            {f.invoiceNumber && (
              <span className="text-xs font-normal text-muted-foreground ml-1 flex items-center gap-0.5">
                <FileText className="h-3 w-3" />{f.invoiceNumber}
              </span>
            )}
          </div>
        )}

        {f.visit && (
          <div className="text-xs text-muted-foreground flex gap-1.5 flex-wrap">
            <span className="bg-muted px-2 py-0.5 rounded">{f.visit.area}</span>
            <span className="bg-muted px-2 py-0.5 rounded">{f.visit.siteStage}</span>
            {f.assignedTo?.name && (
              <span className="bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                {f.assignedTo.name}
              </span>
            )}
          </div>
        )}

        {!locked && !isCompleted && !isManager && (
          <Button
            size="sm"
            variant="outline"
            className="w-full mt-1 text-xs h-8"
            onClick={onReport}
          >
            <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
            {isMissed ? "File Report" : "Update Follow-up"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  icon,
  followups,
  onReport,
  accent,
  defaultOpen = true,
  isManager = false,
}: {
  title: string;
  icon: React.ReactNode;
  followups: Followup[];
  onReport: (f: Followup) => void;
  accent?: string;
  defaultOpen?: boolean;
  isManager?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  if (followups.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        className={`flex items-center gap-2 w-full text-left py-1 ${accent ?? "text-foreground"}`}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5 font-medium">{followups.length}</span>
        <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <div className="space-y-3">
          {followups.map((f) => (
            <FollowupCard key={f.id} f={f} onReport={() => onReport(f)} isManager={isManager} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportDialog({
  state,
  onClose,
}: {
  state: ReportDialogState;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const update = useUpdateFollowup();

  const [mode, setMode] = useState<"complete" | "convert" | "reschedule">("complete");
  const [summary, setSummary] = useState("");
  const [spoke, setSpoke] = useState<boolean | null>(null);
  const [quotationSent, setQuotationSent] = useState<boolean | null>(null);
  const [quotationNumber, setQuotationNumber] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");

  const open = state.open;
  const followup = state.open ? state.followup : null;

  function reset() {
    setSummary(""); setSpoke(null); setQuotationSent(null);
    setQuotationNumber(""); setSaleAmount(""); setInvoiceNumber(""); setRescheduleDate("");
    setMode("complete");
  }

  function handleClose() {
    reset();
    onClose();
  }

  const handleSubmit = async () => {
    if (!followup) return;

    if (mode === "reschedule") {
      if (!rescheduleDate) {
        toast({ variant: "destructive", title: "Date required", description: "Please select a new date." });
        return;
      }
      try {
        await update.mutateAsync({ id: followup.id, status: "Pending", followup_date: rescheduleDate });
        toast({ title: "Rescheduled", description: `Follow-up moved to ${format(parseISO(rescheduleDate), "MMM d, yyyy")}` });
        handleClose();
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
      }
      return;
    }

    if (mode === "complete") {
      if (!summary.trim()) {
        toast({ variant: "destructive", title: "Summary required", description: "Please provide a summary of the discussion." });
        return;
      }
      if (spoke === null) {
        toast({ variant: "destructive", title: "Required", description: "Please indicate whether you spoke to the customer." });
        return;
      }
      if (quotationSent === null) {
        toast({ variant: "destructive", title: "Required", description: "Please indicate whether a quotation was sent." });
        return;
      }
      if (quotationSent && !quotationNumber.trim()) {
        toast({ variant: "destructive", title: "Quotation number required", description: "Enter the quotation number." });
        return;
      }
      try {
        await update.mutateAsync({
          id: followup.id,
          status: "Completed",
          summary: summary.trim(),
          spoke_to_customer: spoke,
          quotation_sent: quotationSent,
          quotation_number: quotationSent ? quotationNumber.trim() : null,
        });
        toast({ title: "Follow-up completed", description: "Report saved successfully." });
        handleClose();
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
      }
      return;
    }

    if (mode === "convert") {
      if (!summary.trim()) {
        toast({ variant: "destructive", title: "Summary required" });
        return;
      }
      if (spoke === null || quotationSent === null) {
        toast({ variant: "destructive", title: "All fields required" });
        return;
      }
      if (!saleAmount.trim() || isNaN(Number(saleAmount)) || Number(saleAmount) <= 0) {
        toast({ variant: "destructive", title: "Invalid amount" });
        return;
      }
      if (!invoiceNumber.trim()) {
        toast({ variant: "destructive", title: "Invoice required" });
        return;
      }
      try {
        await update.mutateAsync({
          id: followup.id,
          status: "Converted",
          summary: summary.trim(),
          spoke_to_customer: spoke,
          quotation_sent: quotationSent,
          quotation_number: quotationSent ? quotationNumber.trim() : null,
          sale_amount: saleAmount.trim(),
          invoice_number: invoiceNumber.trim(),
        });
        toast({ title: "Converted!", description: `Sale of ₹${parseFloat(saleAmount).toLocaleString("en-IN")} · Invoice ${invoiceNumber.trim()}` });
        handleClose();
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Follow-up Report
          </DialogTitle>
          {followup?.customer && (
            <p className="text-sm text-muted-foreground mt-0.5">{followup.customer.name} · {followup.followupDate ? format(parseISO(followup.followupDate), "MMM d, yyyy") : ""}</p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex gap-2">
            {(["complete", "convert", "reschedule"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors capitalize ${
                  mode === m
                    ? m === "complete" ? "bg-blue-600 text-white border-blue-600"
                      : m === "convert" ? "bg-green-600 text-white border-green-600"
                      : "bg-muted text-foreground border-border"
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                {m === "complete" ? "Complete" : m === "convert" ? "Converted" : "Reschedule"}
              </button>
            ))}
          </div>

          {mode === "reschedule" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">New Date *</label>
              <Input
                type="date"
                min={todayStr()}
                value={rescheduleDate}
                onChange={(e) => setRescheduleDate(e.target.value)}
                className="h-10"
              />
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Summary of Discussion *
                </label>
                <Textarea
                  placeholder="What was discussed during this follow-up?"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  className="resize-none h-24 text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Spoke to customer? *
                </label>
                <div className="flex gap-2">
                  {([true, false] as const).map((val) => (
                    <button
                      key={String(val)}
                      onClick={() => setSpoke(val)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        spoke === val
                          ? val ? "bg-green-600 text-white border-green-600" : "bg-red-500 text-white border-red-500"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {val ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5" />
                  Quotation sent? *
                </label>
                <div className="flex gap-2">
                  {([true, false] as const).map((val) => (
                    <button
                      key={String(val)}
                      onClick={() => setQuotationSent(val)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        quotationSent === val
                          ? val ? "bg-blue-600 text-white border-blue-600" : "bg-muted text-foreground border-border"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {val ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>

              {quotationSent === true && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Quotation Number *</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="e.g. QT-2024-001"
                      value={quotationNumber}
                      onChange={(e) => setQuotationNumber(e.target.value)}
                      className="pl-9 h-10 font-mono text-sm"
                    />
                  </div>
                </div>
              )}

              {mode === "convert" && (
                <div className="space-y-3 pt-1 border-t">
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide">Conversion Details</p>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Sale Amount *</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="number"
                        min="1"
                        placeholder="0.00"
                        value={saleAmount}
                        onChange={(e) => setSaleAmount(e.target.value)}
                        className="pl-9 h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Invoice Number *</label>
                    <div className="relative">
                      <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="e.g. INV-2024-001"
                        value={invoiceNumber}
                        onChange={(e) => setInvoiceNumber(e.target.value)}
                        className="pl-9 h-10 font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleSubmit}
            disabled={update.isPending}
            className={
              mode === "convert" ? "bg-green-600 hover:bg-green-700 text-white"
                : mode === "complete" ? "bg-blue-600 hover:bg-blue-700 text-white"
                : ""
            }
          >
            {update.isPending ? "Saving…"
              : mode === "complete" ? "Save Report"
              : mode === "convert" ? "Confirm Conversion"
              : "Reschedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const { data: customers = [], isLoading: isLoadingCustomers } = useCustomers();
  const schedule = useScheduleFollowup();

  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [followupDate, setFollowupDate] = useState("");
  const [notes, setNotes] = useState("");

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.mobile.includes(search) ||
      (c.companyName ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  function handleClose() {
    setSearch(""); setSelectedCustomer(null); setFollowupDate(""); setNotes("");
    onClose();
  }

  const handleSubmit = async () => {
    if (!selectedCustomer) {
      toast({ variant: "destructive", title: "Select a customer" });
      return;
    }
    if (!followupDate) {
      toast({ variant: "destructive", title: "Date required" });
      return;
    }

    const res = await fetch(`/api/customers/${selectedCustomer.id}`, { headers: apiHeaders() });
    const json = await res.json();
    const latestVisit = (json.data?.visits ?? [])[0];
    if (!latestVisit) {
      toast({ variant: "destructive", title: "No visits found", description: "This customer has no visits. Record a visit first." });
      return;
    }

    try {
      await schedule.mutateAsync({ visit_id: latestVisit.id, followup_date: followupDate, notes: notes.trim() || undefined });
      toast({ title: "Follow-up scheduled", description: `${selectedCustomer.name} · ${format(parseISO(followupDate), "MMM d, yyyy")}` });
      handleClose();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Schedule Follow-up
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Customer *</label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between border rounded-lg px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedCustomer.mobile}</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search customer…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9 text-sm"
                  />
                </div>
                {search.trim() && (
                  <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                    {isLoadingCustomers ? (
                      <div className="p-3 text-sm text-muted-foreground">Loading…</div>
                    ) : filtered.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">No customers found</div>
                    ) : filtered.slice(0, 10).map((c) => (
                      <button
                        key={c.id}
                        className="w-full text-left px-3 py-2 hover:bg-muted transition-colors"
                        onClick={() => { setSelectedCustomer(c); setSearch(""); }}
                      >
                        <p className="text-sm font-medium">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.mobile} {c.companyName ? `· ${c.companyName}` : ""}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Follow-up Date *</label>
            <Input
              type="date"
              min={todayStr()}
              value={followupDate}
              onChange={(e) => setFollowupDate(e.target.value)}
              className="h-10"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Notes</label>
            <Textarea
              placeholder="Any notes for this follow-up…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none h-20 text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={schedule.isPending}>
            {schedule.isPending ? "Scheduling…" : "Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Followups() {
  const { data: all = [], isLoading } = useFollowups();
  const { user } = useAuth();
  const isManager = user?.role === "Manager";

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [reportDialog, setReportDialog] = useState<ReportDialogState>({ open: false });
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const today = todayStr();
  const tomorrow = tomorrowStr();

  const filtered = useMemo(() => {
    if (!selectedDate) return all;
    const ds = format(selectedDate, "yyyy-MM-dd");
    return all.filter((f) => f.followupDate === ds);
  }, [all, selectedDate]);

  const overdue   = filtered.filter((f) => f.status === "Pending" && f.followupDate <= today);
  const missed    = filtered.filter((f) => f.status === "Missed");
  const dueSoon   = filtered.filter((f) => f.status === "Pending" && f.followupDate === tomorrow);
  const upcoming  = filtered.filter((f) => f.status === "Pending" && f.followupDate > tomorrow);
  const completed = filtered.filter((f) => f.status === "Completed");
  const converted = filtered.filter((f) => f.status === "Converted");

  const tomorrowPending = all.filter((f) => f.status === "Pending" && f.followupDate === tomorrow);
  const overduePending  = all.filter((f) => f.status === "Pending" && f.followupDate <= today);

  const totalSales = converted.reduce((s, f) => s + parseFloat(f.saleAmount ?? "0"), 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto pb-24">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Track and manage customer follow-ups</p>
        </div>
        {!isManager && (
          <Button size="sm" onClick={() => setScheduleOpen(true)} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Schedule
          </Button>
        )}
      </div>

      {/* Reminder banners */}
      {overduePending.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {overduePending.length} overdue follow-up{overduePending.length !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">These customers are waiting for contact</p>
          </div>
        </div>
      )}
      {tomorrowPending.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3">
          <Bell className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
            {tomorrowPending.length} follow-up{tomorrowPending.length !== 1 ? "s" : ""} due tomorrow
          </p>
        </div>
      )}

      {/* Calendar */}
      <MiniCalendar
        followups={all}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
      />

      {selectedDate && (
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">
            {format(selectedDate, "MMMM d, yyyy")} · {filtered.length} follow-up{filtered.length !== 1 ? "s" : ""}
          </span>
          <button
            className="text-xs text-muted-foreground hover:text-foreground underline"
            onClick={() => setSelectedDate(null)}
          >
            Show all
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-5">
          <Section
            title="Overdue / Missed"
            icon={<AlertTriangle className="h-4 w-4" />}
            followups={[...overdue, ...missed]}
            onReport={(f) => setReportDialog({ open: true, followup: f, mode: "complete" })}
            accent="text-red-600 dark:text-red-400"
            isManager={isManager}
          />
          <Section
            title="Due Tomorrow"
            icon={<Bell className="h-4 w-4" />}
            followups={dueSoon}
            onReport={(f) => setReportDialog({ open: true, followup: f, mode: "complete" })}
            accent="text-orange-600 dark:text-orange-400"
            isManager={isManager}
          />
          <Section
            title="Upcoming"
            icon={<CalendarClock className="h-4 w-4" />}
            followups={upcoming}
            onReport={(f) => setReportDialog({ open: true, followup: f, mode: "complete" })}
            isManager={isManager}
          />
          <Section
            title="Completed"
            icon={<CheckCircle2 className="h-4 w-4" />}
            followups={completed}
            onReport={(f) => setReportDialog({ open: true, followup: f, mode: "complete" })}
            accent="text-blue-600 dark:text-blue-400"
            defaultOpen={false}
            isManager={isManager}
          />
          {converted.length > 0 && (
            <>
              <div className="flex items-center gap-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl px-4 py-3">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300">{converted.length} Conversion{converted.length !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-green-600/80 dark:text-green-400/80">Total: ₹{totalSales.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <Section
                title="Converted"
                icon={<TrendingUp className="h-4 w-4" />}
                followups={converted}
                onReport={() => {}}
                accent="text-green-600 dark:text-green-400"
                defaultOpen={false}
                isManager={isManager}
              />
            </>
          )}

          {filtered.length === 0 && !isLoading && (
            <div className="text-center py-16 border rounded-xl border-dashed bg-card/30">
              <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <h3 className="text-lg font-medium">No follow-ups</h3>
              <p className="text-muted-foreground text-sm">
                {selectedDate ? "No follow-ups on this day" : "Schedule one to get started"}
              </p>
            </div>
          )}
        </div>
      )}

      <ReportDialog state={reportDialog} onClose={() => setReportDialog({ open: false })} />
      <ScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} />
    </div>
  );
}
