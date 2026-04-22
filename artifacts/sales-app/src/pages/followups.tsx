import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import {
  CalendarClock,
  Phone,
  User,
  CheckCircle2,
  TrendingUp,
  RotateCcw,
  IndianRupee,
  FileText,
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
  customer: { id: number; name: string; mobile: string; companyName: string | null } | null;
  visit: { id: number; area: string; siteStage: string; feedback: string } | null;
  assignedTo: { id: number; name: string; userId: string } | null;
};

function apiHeaders() {
  const token = localStorage.getItem("auth_token");
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
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

function useUpdateFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      saleAmount,
      invoiceNumber,
      followupDate,
    }: {
      id: number;
      status: string;
      saleAmount?: string;
      invoiceNumber?: string;
      followupDate?: string;
    }) => {
      const res = await fetch(`/api/followups/${id}`, {
        method: "PUT",
        headers: apiHeaders(),
        body: JSON.stringify({ status, sale_amount: saleAmount, invoice_number: invoiceNumber, followup_date: followupDate }),
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

type ConvertDialogState = { open: false } | { open: true; followupId: number };
type RescheduleDialogState = { open: false } | { open: true; followupId: number };

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    Completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    Converted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    Missed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles[status] ?? "bg-muted text-muted-foreground"}`}>
      {status}
    </span>
  );
}

function FollowupCard({
  f,
  onConvert,
  onComplete,
  onReschedule,
}: {
  f: Followup;
  onConvert: () => void;
  onComplete: () => void;
  onReschedule: () => void;
}) {
  const isConverted = f.status === "Converted";
  const isCompleted = f.status === "Completed";
  const isMissed = f.status === "Missed";
  const locked = isConverted;

  return (
    <Card className={`border-l-4 overflow-hidden ${isConverted ? "border-l-green-500" : isCompleted ? "border-l-blue-500" : isMissed ? "border-l-red-400" : "border-l-primary"}`}>
      <CardContent className="p-5 space-y-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1.5">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground shrink-0" />
              {f.customer?.name ?? "—"}
            </h3>
            {f.customer?.mobile && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" />
                {f.customer.mobile}
              </div>
            )}
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarClock className="h-3.5 w-3.5" />
              {f.followupDate ? format(new Date(f.followupDate + "T00:00:00"), "MMM d, yyyy") : "—"}
            </div>
          </div>
          <StatusBadge status={f.status} />
        </div>

        {f.notes && (
          <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">{f.notes}</p>
        )}

        {isConverted && f.saleAmount && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-3 py-2 rounded-lg">
              <IndianRupee className="h-4 w-4" />
              {parseFloat(f.saleAmount).toLocaleString("en-IN")}
              {f.convertedAt && (
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  · {format(new Date(f.convertedAt), "MMM d, yyyy")}
                </span>
              )}
            </div>
            {f.invoiceNumber && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-lg">
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">Invoice:</span>
                <span className="font-mono">{f.invoiceNumber}</span>
              </div>
            )}
          </div>
        )}

        {f.visit && (
          <div className="text-xs text-muted-foreground flex gap-2 flex-wrap">
            <span className="bg-muted px-2 py-0.5 rounded">{f.visit.area}</span>
            <span className="bg-muted px-2 py-0.5 rounded">{f.visit.siteStage}</span>
            <span className="bg-muted px-2 py-0.5 rounded">{f.visit.feedback}</span>
          </div>
        )}

        {!locked && (
          <div className="flex gap-2 pt-1 flex-wrap">
            {!isCompleted && !isConverted && (
              <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20" onClick={onConvert}>
                <TrendingUp className="h-3.5 w-3.5 mr-1" />
                Mark Converted
              </Button>
            )}
            {!isCompleted && (
              <Button size="sm" variant="outline" className="text-blue-600 border-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20" onClick={onComplete}>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Mark Completed
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onReschedule}>
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reschedule
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-center py-16 border rounded-xl border-dashed bg-card/30">
      <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
      <h3 className="text-lg font-medium">No {label} follow-ups</h3>
      <p className="text-muted-foreground text-sm">Nothing to show here</p>
    </div>
  );
}

export default function Followups() {
  const { toast } = useToast();
  const { data: all = [], isLoading } = useFollowups();
  const update = useUpdateFollowup();

  const [convertDialog, setConvertDialog] = useState<ConvertDialogState>({ open: false });
  const [saleInput, setSaleInput] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");
  const [rescheduleDialog, setRescheduleDialog] = useState<RescheduleDialogState>({ open: false });
  const [rescheduleDate, setRescheduleDate] = useState("");

  const pending = all.filter((f) => f.status === "Pending");
  const completed = all.filter((f) => f.status === "Completed");
  const converted = all.filter((f) => f.status === "Converted");

  const handleComplete = async (id: number) => {
    try {
      await update.mutateAsync({ id, status: "Completed" });
      toast({ title: "Marked as Completed" });
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleConvertSubmit = async () => {
    if (!convertDialog.open) return;
    if (!saleInput.trim() || isNaN(Number(saleInput)) || Number(saleInput) <= 0) {
      toast({ variant: "destructive", title: "Invalid amount", description: "Enter a valid positive sale amount" });
      return;
    }
    if (!invoiceInput.trim()) {
      toast({ variant: "destructive", title: "Invoice required", description: "Enter an invoice number to proceed" });
      return;
    }
    try {
      await update.mutateAsync({
        id: convertDialog.followupId,
        status: "Converted",
        saleAmount: saleInput.trim(),
        invoiceNumber: invoiceInput.trim(),
      });
      toast({ title: "Marked as Converted", description: `Sale of ₹${parseFloat(saleInput).toLocaleString("en-IN")} · Invoice ${invoiceInput.trim()}` });
      setConvertDialog({ open: false });
      setSaleInput("");
      setInvoiceInput("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const handleRescheduleSubmit = async () => {
    if (!rescheduleDialog.open) return;
    if (!rescheduleDate) {
      toast({ variant: "destructive", title: "Date required", description: "Please select a new follow-up date" });
      return;
    }
    try {
      await update.mutateAsync({ id: rescheduleDialog.followupId, status: "Pending", followupDate: rescheduleDate });
      toast({ title: "Rescheduled", description: `Follow-up moved to ${format(new Date(rescheduleDate + "T00:00:00"), "MMM d, yyyy")}` });
      setRescheduleDialog({ open: false });
      setRescheduleDate("");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Error", description: e.message });
    }
  };

  const skeletons = (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
        <p className="text-sm text-muted-foreground">Track and manage customer follow-ups</p>
      </div>

      <Tabs defaultValue="pending">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="pending">
            Pending
            {!isLoading && pending.length > 0 && (
              <span className="ml-1.5 bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 text-xs px-1.5 py-0.5 rounded-full font-semibold">{pending.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed
            {!isLoading && completed.length > 0 && (
              <span className="ml-1.5 bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs px-1.5 py-0.5 rounded-full font-semibold">{completed.length}</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="converted">
            Converted
            {!isLoading && converted.length > 0 && (
              <span className="ml-1.5 bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 text-xs px-1.5 py-0.5 rounded-full font-semibold">{converted.length}</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-4">
          {isLoading ? skeletons : pending.length === 0 ? <EmptyState label="pending" /> : pending.map((f) => (
            <FollowupCard
              key={f.id}
              f={f}
              onConvert={() => { setConvertDialog({ open: true, followupId: f.id }); setSaleInput(""); }}
              onComplete={() => handleComplete(f.id)}
              onReschedule={() => { setRescheduleDialog({ open: true, followupId: f.id }); setRescheduleDate(""); }}
            />
          ))}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-4">
          {isLoading ? skeletons : completed.length === 0 ? <EmptyState label="completed" /> : completed.map((f) => (
            <FollowupCard
              key={f.id}
              f={f}
              onConvert={() => { setConvertDialog({ open: true, followupId: f.id }); setSaleInput(""); }}
              onComplete={() => handleComplete(f.id)}
              onReschedule={() => { setRescheduleDialog({ open: true, followupId: f.id }); setRescheduleDate(""); }}
            />
          ))}
        </TabsContent>

        <TabsContent value="converted" className="mt-4 space-y-4">
          {isLoading ? skeletons : converted.length === 0 ? <EmptyState label="converted" /> : (
            <>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Total Sales Value</p>
                  <p className="text-2xl font-bold text-green-800 dark:text-green-200 flex items-center gap-1">
                    <IndianRupee className="h-5 w-5" />
                    {converted.reduce((sum, f) => sum + parseFloat(f.saleAmount ?? "0"), 0).toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">Conversions</p>
                  <p className="text-2xl font-bold text-green-800 dark:text-green-200">{converted.length}</p>
                </div>
              </div>
              {converted.map((f) => (
                <FollowupCard
                  key={f.id}
                  f={f}
                  onConvert={() => {}}
                  onComplete={() => {}}
                  onReschedule={() => {}}
                />
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Convert Dialog */}
      <Dialog
        open={convertDialog.open}
        onOpenChange={(open) => {
          if (!open) { setConvertDialog({ open: false }); setSaleInput(""); setInvoiceInput(""); }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              Mark as Converted
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">Both fields are required to record a conversion.</p>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Sale Amount *</label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={saleInput}
                  onChange={(e) => setSaleInput(e.target.value)}
                  className="pl-9 h-11"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium">Invoice Number *</label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="e.g. INV-2024-001"
                  value={invoiceInput}
                  onChange={(e) => setInvoiceInput(e.target.value)}
                  className="pl-9 h-11 font-mono"
                  onKeyDown={(e) => e.key === "Enter" && handleConvertSubmit()}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConvertDialog({ open: false }); setSaleInput(""); setInvoiceInput(""); }}>
              Cancel
            </Button>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConvertSubmit} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Confirm Conversion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialog.open} onOpenChange={(open) => !open && setRescheduleDialog({ open: false })}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-primary" />
              Reschedule Follow-up
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">Choose a new date for this follow-up.</p>
            <Input
              type="date"
              min={new Date().toISOString().slice(0, 10)}
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="h-11"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRescheduleDialog({ open: false })}>Cancel</Button>
            <Button onClick={handleRescheduleSubmit} disabled={update.isPending}>
              {update.isPending ? "Saving…" : "Reschedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
