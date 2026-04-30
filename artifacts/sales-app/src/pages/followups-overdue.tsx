import { useState } from "react";
import { useGetOverdueFollowups, getGetOverdueFollowupsQueryKey } from "@workspace/api-client-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { format, parseISO } from "date-fns";
import {
  AlertTriangle,
  Phone,
  User,
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  IndianRupee,
  FileText,
  MessageSquare,
  TrendingUp,
} from "lucide-react";
import { Link } from "wouter";
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
};

function apiHeaders() {
  const token = localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
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
    onSuccess: () => qc.invalidateQueries({ queryKey: getGetOverdueFollowupsQueryKey() }),
  });
}

type ReportDialogState =
  | { open: false }
  | { open: true; followup: Followup; mode: "complete" | "convert" | "reschedule" };

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

  function handleClose() { reset(); onClose(); }

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
        toast({ variant: "destructive", title: "Summary required" }); return;
      }
      if (spoke === null) {
        toast({ variant: "destructive", title: "Required", description: "Did you speak to the customer?" }); return;
      }
      if (quotationSent === null) {
        toast({ variant: "destructive", title: "Required", description: "Was a quotation sent?" }); return;
      }
      if (quotationSent && !quotationNumber.trim()) {
        toast({ variant: "destructive", title: "Quotation number required" }); return;
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
        toast({ title: "Follow-up completed" });
        handleClose();
      } catch (e: any) {
        toast({ variant: "destructive", title: "Error", description: e.message });
      }
      return;
    }

    if (mode === "convert") {
      if (!summary.trim() || spoke === null || quotationSent === null) {
        toast({ variant: "destructive", title: "All fields required" }); return;
      }
      if (!saleAmount.trim() || isNaN(Number(saleAmount)) || Number(saleAmount) <= 0) {
        toast({ variant: "destructive", title: "Invalid amount" }); return;
      }
      if (!invoiceNumber.trim()) {
        toast({ variant: "destructive", title: "Invoice required" }); return;
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
        toast({ title: "Converted!", description: `Sale of ₹${parseFloat(saleAmount).toLocaleString("en-IN")}` });
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
            <p className="text-sm text-muted-foreground mt-0.5">
              {followup.customer.name} · {followup.followupDate ? format(parseISO(followup.followupDate), "MMM d, yyyy") : ""}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="flex gap-2">
            {(["complete", "convert", "reschedule"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
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
                  <MessageSquare className="h-3.5 w-3.5" />Summary of Discussion *
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
                  <Phone className="h-3.5 w-3.5" />Spoke to customer? *
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
                  <ClipboardList className="h-3.5 w-3.5" />Quotation sent? *
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
                        type="number" min="1" placeholder="0.00"
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

export default function OverdueFollowups() {
  const { data, isLoading } = useGetOverdueFollowups({
    query: { queryKey: getGetOverdueFollowupsQueryKey() },
  });

  const [reportDialog, setReportDialog] = useState<ReportDialogState>({ open: false });

  const followups: Followup[] = (data?.data ?? []) as Followup[];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto pb-24">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/followups">
          <Button variant="ghost" size="icon" className="rounded-full -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-destructive flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Overdue
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Loading…" : `${followups.length} follow-up${followups.length !== 1 ? "s" : ""} need attention`}
          </p>
        </div>
      </div>

      {/* Alert banner */}
      {!isLoading && followups.length > 0 && (
        <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
              {followups.length} customer{followups.length !== 1 ? "s are" : " is"} waiting for contact
            </p>
            <p className="text-xs text-red-600/80 dark:text-red-400/80">
              Complete, convert, or reschedule each follow-up below
            </p>
          </div>
        </div>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : followups.length > 0 ? (
        <div className="space-y-3">
          {followups.map((f) => (
            <Card key={f.id} className="border-l-4 border-l-red-500 overflow-hidden">
              <CardContent className="p-4 space-y-2.5">

                {/* Top row: name + overdue badge */}
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-semibold text-sm flex items-center gap-1.5 truncate">
                      <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {f.customer?.name ?? "—"}
                    </h3>
                    {f.customer?.mobile && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {f.customer.mobile}
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                      <CalendarClock className="h-3 w-3" />
                      {f.followupDate ? format(parseISO(f.followupDate), "MMM d, yyyy") : "—"}
                      <span className="font-semibold">· Overdue</span>
                    </div>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300">
                    Pending
                  </span>
                </div>

                {/* Notes */}
                {f.notes && (
                  <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 line-clamp-2">
                    {f.notes}
                  </p>
                )}

                {/* Visit tags */}
                {f.visit && (
                  <div className="text-xs text-muted-foreground flex gap-1.5 flex-wrap">
                    {f.visit.area && (
                      <span className="bg-muted px-2 py-0.5 rounded">{f.visit.area}</span>
                    )}
                    {f.visit.siteStage && (
                      <span className="bg-muted px-2 py-0.5 rounded">{f.visit.siteStage}</span>
                    )}
                    {f.visit.feedback && (
                      <span className={`px-2 py-0.5 rounded font-medium ${
                        f.visit.feedback === "Interested"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : f.visit.feedback === "Potential"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                      }`}>
                        {f.visit.feedback}
                      </span>
                    )}
                  </div>
                )}

                {/* Action button */}
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full mt-1 text-xs h-8"
                  onClick={() => setReportDialog({ open: true, followup: f, mode: "complete" })}
                >
                  <ClipboardList className="h-3.5 w-3.5 mr-1.5" />
                  Update Follow-up
                </Button>

              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl border-dashed bg-card/30">
          <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-medium">No overdue follow-ups</h3>
          <p className="text-muted-foreground text-sm">Great job staying on top of things!</p>
        </div>
      )}

      <ReportDialog state={reportDialog} onClose={() => setReportDialog({ open: false })} />
    </div>
  );
}
