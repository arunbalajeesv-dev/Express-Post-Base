import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Phone,
  Building2,
  PhoneCall,
  TrendingUp,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type PipelineCall = {
  id: number;
  customer_id: number;
  deal_stage: string;
  deal_value: string | null;
  outcome: string | null;
  created_at: string;
  rep_id: number;
  customer: {
    id: number;
    name: string;
    mobile: string;
    company_name: string | null;
  } | null;
  rep: { name: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const DEAL_STAGES = [
  {
    value: "new_lead",
    label: "New Lead",
    header: "bg-slate-100 text-slate-800 border-slate-200",
    dot: "bg-slate-400",
    ring: "border-slate-300",
  },
  {
    value: "contacted",
    label: "Contacted",
    header: "bg-blue-100 text-blue-800 border-blue-200",
    dot: "bg-blue-500",
    ring: "border-blue-200",
  },
  {
    value: "interested",
    label: "Interested",
    header: "bg-violet-100 text-violet-800 border-violet-200",
    dot: "bg-violet-500",
    ring: "border-violet-200",
  },
  {
    value: "proposal",
    label: "Proposal",
    header: "bg-orange-100 text-orange-800 border-orange-200",
    dot: "bg-orange-500",
    ring: "border-orange-200",
  },
  {
    value: "closed_won",
    label: "Closed Won",
    header: "bg-green-100 text-green-800 border-green-200",
    dot: "bg-green-500",
    ring: "border-green-200",
  },
  {
    value: "closed_lost",
    label: "Closed Lost",
    header: "bg-red-100 text-red-800 border-red-200",
    dot: "bg-red-400",
    ring: "border-red-200",
  },
] as const;

const OUTCOME_LABELS: Record<string, string> = {
  answered: "Answered",
  no_answer: "No Answer",
  voicemail: "Voicemail",
  wrong_number: "Wrong #",
  callback_requested: "Callback",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtValue(v: string | null): string {
  const n = parseFloat(v ?? "0");
  if (!v || isNaN(n) || n === 0) return "";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function fmtValueFull(v: number): string {
  if (v === 0) return "₹0";
  return `₹${v.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function usePipeline() {
  return useQuery<PipelineCall[]>({
    queryKey: ["pipeline-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("calls")
        .select(
          "id, customer_id, deal_stage, deal_value, outcome, created_at, rep_id, customer:customers(id, name, mobile, company_name), rep:users!rep_id(name)"
        )
        .not("deal_stage", "is", null)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Keep only the most-recent call per customer
      const seen = new Set<number>();
      const latest: PipelineCall[] = [];
      for (const row of data ?? []) {
        if (!seen.has(row.customer_id)) {
          seen.add(row.customer_id);
          latest.push(row as unknown as PipelineCall);
        }
      }
      return latest;
    },
  });
}

function useMoveStage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      callId,
      newStage,
    }: {
      callId: number;
      newStage: string;
    }) => {
      const { error } = await supabase
        .from("calls")
        .update({ deal_stage: newStage })
        .eq("id", callId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pipeline-calls"] }),
  });
}

// ─── Stage summary pill ───────────────────────────────────────────────────────

function StagePill({
  stage,
  count,
  total,
  active,
  onClick,
}: {
  stage: (typeof DEAL_STAGES)[number];
  count: number;
  total: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 flex flex-col items-center px-3 py-2 rounded-xl border transition-all ${
        active
          ? `${stage.header} shadow-sm`
          : "bg-card border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`w-2 h-2 rounded-full ${stage.dot}`} />
        <span className="text-xs font-semibold whitespace-nowrap">{stage.label}</span>
      </div>
      <span className="text-lg font-bold tabular-nums leading-tight mt-0.5">
        {count}
      </span>
      {total > 0 && (
        <span className="text-[10px] font-medium mt-0.5 opacity-80">
          {fmtValueFull(total)}
        </span>
      )}
    </button>
  );
}

// ─── Customer card ────────────────────────────────────────────────────────────

function CustomerCard({
  call,
  stageCfg,
  onMoveStage,
}: {
  call: PipelineCall;
  stageCfg: (typeof DEAL_STAGES)[number];
  onMoveStage: (call: PipelineCall) => void;
}) {
  const [, navigate] = useLocation();
  const val = fmtValue(call.deal_value);

  return (
    <Card className={`overflow-hidden border ${stageCfg.ring}`}>
      <CardContent className="p-0">
        <div className="px-3.5 pt-3 pb-2.5">
          {/* Name row */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">
                {call.customer?.name ?? "—"}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {call.customer?.mobile && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    {call.customer.mobile}
                  </span>
                )}
                {call.customer?.company_name && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    {call.customer.company_name}
                  </span>
                )}
              </div>
            </div>
            {val && (
              <span className="text-sm font-bold text-green-700 shrink-0">
                {val}
              </span>
            )}
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {call.rep?.name && (
              <span className="text-[11px] text-muted-foreground">
                {call.rep.name}
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">
              {format(new Date(call.created_at), "MMM d")}
            </span>
            {call.outcome && OUTCOME_LABELS[call.outcome] && (
              <span className="text-[11px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">
                {OUTCOME_LABELS[call.outcome]}
              </span>
            )}
          </div>
        </div>

        {/* Action bar */}
        <div className="flex border-t divide-x text-[11px] font-semibold">
          <button
            className="flex-1 flex items-center justify-center gap-1 py-2 text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => navigate(`/customers/${call.customer?.id}`)}
          >
            View Profile
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1 py-2 text-primary hover:bg-primary/5 transition-colors"
            onClick={() => navigate("/calls/new")}
          >
            <PhoneCall className="w-3 h-3" />
            Log Call
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1 py-2 text-muted-foreground hover:bg-muted transition-colors"
            onClick={() => onMoveStage(call)}
          >
            <TrendingUp className="w-3 h-3" />
            Move
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stage section ────────────────────────────────────────────────────────────

function StageSection({
  stage,
  calls,
  onMoveStage,
}: {
  stage: (typeof DEAL_STAGES)[number];
  calls: PipelineCall[];
  onMoveStage: (call: PipelineCall) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = calls.reduce(
    (s, c) => s + parseFloat(c.deal_value ?? "0"),
    0
  );

  return (
    <div className="space-y-2">
      <button
        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border font-semibold text-sm ${stage.header}`}
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
          {stage.label}
          <span className="text-xs opacity-70 font-medium">({calls.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="text-xs font-bold">{fmtValueFull(total)}</span>
          )}
          {open ? (
            <ChevronUp className="w-3.5 h-3.5 opacity-60" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 opacity-60" />
          )}
        </div>
      </button>

      {open && (
        <div className="space-y-2 pl-1">
          {calls.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-3 text-center">
              No customers in this stage
            </p>
          ) : (
            calls.map((call) => (
              <CustomerCard
                key={call.id}
                call={call}
                stageCfg={stage}
                onMoveStage={onMoveStage}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Pipeline() {
  const { toast } = useToast();
  const [activeStageFilter, setActiveStageFilter] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<PipelineCall | null>(null);
  const [moveStageVal, setMoveStageVal] = useState("");

  const { data: calls = [], isLoading, isError, refetch } = usePipeline();
  const moveStage = useMoveStage();

  // Group by deal stage
  const byStage = new Map<string, PipelineCall[]>();
  for (const s of DEAL_STAGES) byStage.set(s.value, []);
  for (const c of calls) {
    const bucket = byStage.get(c.deal_stage);
    if (bucket) bucket.push(c);
  }

  // Stage totals for summary pills
  const stageSummary = DEAL_STAGES.map((s) => ({
    ...s,
    count: byStage.get(s.value)?.length ?? 0,
    total: (byStage.get(s.value) ?? []).reduce(
      (sum, c) => sum + parseFloat(c.deal_value ?? "0"),
      0
    ),
  }));

  const grandTotal = calls.reduce(
    (sum, c) => sum + parseFloat(c.deal_value ?? "0"),
    0
  );

  const visibleStages = activeStageFilter
    ? DEAL_STAGES.filter((s) => s.value === activeStageFilter)
    : DEAL_STAGES;

  async function handleMoveConfirm() {
    if (!moveTarget || !moveStageVal) return;
    try {
      await moveStage.mutateAsync({ callId: moveTarget.id, newStage: moveStageVal });
      toast({ title: "Stage updated" });
      setMoveTarget(null);
      setMoveStageVal("");
    } catch {
      toast({ title: "Failed to update stage", variant: "destructive" });
    }
  }

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-3">
        <div className="flex items-center justify-between pt-1 pb-2">
          <h1 className="text-xl font-bold">Pipeline</h1>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {DEAL_STAGES.map((s) => (
            <Skeleton key={s.value} className="h-16 w-24 rounded-xl shrink-0" />
          ))}
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    );
  }

  // ── Error ──

  if (isError) {
    return (
      <div className="p-4 pt-10 flex flex-col items-center gap-3 text-center">
        <AlertTriangle className="w-8 h-8 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">Failed to load pipeline.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  // ── Content ──

  return (
    <div className="p-4 pb-28 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            {calls.length} customer{calls.length !== 1 ? "s" : ""}
            {grandTotal > 0 && (
              <span className="ml-2 font-semibold text-green-700">
                · {fmtValueFull(grandTotal)} total
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Stage summary pills (horizontal scroll) */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4">
        {stageSummary.map((s) => (
          <StagePill
            key={s.value}
            stage={s}
            count={s.count}
            total={s.total}
            active={activeStageFilter === s.value}
            onClick={() =>
              setActiveStageFilter(
                activeStageFilter === s.value ? null : s.value
              )
            }
          />
        ))}
      </div>

      {/* Stage sections */}
      {calls.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
            <TrendingUp className="w-8 h-8 text-muted-foreground" />
            <p className="font-semibold">No pipeline data yet</p>
            <p className="text-sm text-muted-foreground">
              Log calls with a deal stage to populate your pipeline.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visibleStages.map((stage) => {
            const stageCalls = byStage.get(stage.value) ?? [];
            return (
              <StageSection
                key={stage.value}
                stage={stage}
                calls={stageCalls}
                onMoveStage={(call) => {
                  setMoveTarget(call);
                  setMoveStageVal(call.deal_stage);
                }}
              />
            );
          })}
        </div>
      )}

      {/* Move Stage dialog */}
      <Dialog
        open={!!moveTarget}
        onOpenChange={(open) => {
          if (!open) {
            setMoveTarget(null);
            setMoveStageVal("");
          }
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Move Deal Stage</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Update the deal stage for{" "}
              <span className="font-semibold text-foreground">
                {moveTarget?.customer?.name}
              </span>
              :
            </p>
            <Select value={moveStageVal} onValueChange={setMoveStageVal}>
              <SelectTrigger>
                <SelectValue placeholder="Select stage…" />
              </SelectTrigger>
              <SelectContent>
                {DEAL_STAGES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                      {s.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setMoveTarget(null);
                  setMoveStageVal("");
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleMoveConfirm}
                disabled={!moveStageVal || moveStage.isPending}
              >
                {moveStage.isPending ? "Saving…" : "Update"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
