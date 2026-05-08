import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
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
  CheckCircle2,
  Clock,
  UserCheck,
  RefreshCw,
  PhoneCall,
  Send,
  CalendarClock,
  MessageSquare,
  AlertTriangle,
} from "lucide-react";
import { format, addDays } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type TeamMember = {
  id: number;
  name: string;
  userId: string;
  role: string;
};

type CallFollowUp = {
  id: number;
  call_id: number;
  customer_id: number;
  assigned_to: number;
  scheduled_at: string;
  type: "call_back" | "send_proposal" | "demo" | "check_in";
  status: "pending" | "done" | "snoozed";
  notes: string | null;
  customer: {
    id: number;
    name: string;
    mobile: string;
    company_name: string | null;
  } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  CallFollowUp["type"],
  { label: string; color: string; icon: React.ElementType }
> = {
  call_back:     { label: "Call Back",     color: "bg-blue-100 text-blue-800",   icon: PhoneCall },
  send_proposal: { label: "Send Proposal", color: "bg-purple-100 text-purple-800", icon: Send },
  demo:          { label: "Demo",          color: "bg-orange-100 text-orange-800", icon: CalendarClock },
  check_in:      { label: "Check In",      color: "bg-teal-100 text-teal-800",   icon: MessageSquare },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
  const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).toISOString();
  return { start, end };
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

function useCallFollowUps(userId: number, isManager: boolean) {
  return useQuery<CallFollowUp[]>({
    queryKey: ["call-follow-ups", userId, isManager],
    queryFn: async () => {
      const { start, end } = todayRange();

      let query = supabase
        .from("call_follow_ups")
        .select("*, customer:customers(id, name, mobile, company_name)")
        .eq("status", "pending")
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });

      if (!isManager) {
        query = query.eq("assigned_to", userId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CallFollowUp[];
    },
    refetchInterval: 60_000,
  });
}

function useTeamMembers() {
  return useQuery<TeamMember[]>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await fetch("/api/users", { headers: authHeader() });
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

function useMarkDone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase
        .from("call_follow_ups")
        .update({ status: "done" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-follow-ups"] }),
  });
}

function useSnooze() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: number; scheduledAt: string }) => {
      const next = addDays(new Date(scheduledAt), 1).toISOString();
      const { error } = await supabase
        .from("call_follow_ups")
        .update({ scheduled_at: next })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-follow-ups"] }),
  });
}

function useReassign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, assignedTo }: { id: number; assignedTo: number }) => {
      const { error } = await supabase
        .from("call_follow_ups")
        .update({ assigned_to: assignedTo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["call-follow-ups"] }),
  });
}

// ─── Follow-up Card ───────────────────────────────────────────────────────────

function FollowUpCard({
  followUp,
  team,
  currentUserId,
}: {
  followUp: CallFollowUp;
  team: TeamMember[];
  currentUserId: number;
}) {
  const { toast } = useToast();
  const [reassignOpen, setReassignOpen] = useState(false);
  const [pickUserId, setPickUserId] = useState<string>("");

  const markDone = useMarkDone();
  const snooze   = useSnooze();
  const reassign = useReassign();

  const cfg      = TYPE_CONFIG[followUp.type];
  const TypeIcon = cfg.icon;
  const assignee = team.find((u) => u.id === followUp.assigned_to);

  async function handleDone() {
    try {
      await markDone.mutateAsync(followUp.id);
      toast({ title: "Marked as done" });
    } catch {
      toast({ title: "Failed to update", variant: "destructive" });
    }
  }

  async function handleSnooze() {
    try {
      await snooze.mutateAsync({ id: followUp.id, scheduledAt: followUp.scheduled_at });
      toast({
        title: "Snoozed",
        description: `Pushed to ${format(addDays(new Date(followUp.scheduled_at), 1), "MMM d")}`,
      });
    } catch {
      toast({ title: "Failed to snooze", variant: "destructive" });
    }
  }

  async function handleReassign() {
    if (!pickUserId) return;
    try {
      await reassign.mutateAsync({ id: followUp.id, assignedTo: Number(pickUserId) });
      toast({ title: "Reassigned" });
      setReassignOpen(false);
    } catch {
      toast({ title: "Failed to reassign", variant: "destructive" });
    }
  }

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Main row */}
          <div className="px-4 pt-3.5 pb-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {/* Type badge + time */}
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.color}`}
                >
                  <TypeIcon className="w-3 h-3" />
                  {cfg.label}
                </span>
                <span className="text-xs font-mono font-semibold">
                  {format(new Date(followUp.scheduled_at), "hh:mm a")}
                </span>
              </div>

              {/* Customer */}
              <p className="font-semibold text-sm leading-tight truncate">
                {followUp.customer?.name ?? "—"}
              </p>
              <p className="text-xs text-muted-foreground">
                {followUp.customer?.mobile}
                {followUp.customer?.company_name
                  ? ` · ${followUp.customer.company_name}`
                  : ""}
              </p>
            </div>

            {/* Assignee badge (only for managers, or when not assigned to self) */}
            {assignee && assignee.id !== currentUserId && (
              <div className="shrink-0 text-right">
                <span className="text-xs bg-muted text-muted-foreground rounded-full px-2 py-0.5">
                  {assignee.name}
                </span>
              </div>
            )}
          </div>

          {/* Notes */}
          {followUp.notes && (
            <p className="px-4 pb-2.5 text-xs text-muted-foreground line-clamp-2 border-b">
              {followUp.notes}
            </p>
          )}

          {/* Action bar */}
          <div className="flex border-t divide-x text-xs font-medium">
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-green-700 hover:bg-green-50 transition-colors disabled:opacity-40"
              onClick={handleDone}
              disabled={markDone.isPending}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Done
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-muted-foreground hover:bg-muted transition-colors disabled:opacity-40"
              onClick={handleSnooze}
              disabled={snooze.isPending}
            >
              <Clock className="w-3.5 h-3.5" />
              Snooze +1d
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-muted-foreground hover:bg-muted transition-colors"
              onClick={() => {
                setPickUserId(String(followUp.assigned_to));
                setReassignOpen(true);
              }}
            >
              <UserCheck className="w-3.5 h-3.5" />
              Reassign
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Reassign dialog */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reassign Follow-up</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <p className="text-sm text-muted-foreground">
              Reassign the follow-up with{" "}
              <span className="font-semibold text-foreground">
                {followUp.customer?.name}
              </span>{" "}
              to:
            </p>
            <Select value={pickUserId} onValueChange={setPickUserId}>
              <SelectTrigger>
                <SelectValue placeholder="Select team member…" />
              </SelectTrigger>
              <SelectContent>
                {team.map((u) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name}
                    {u.id === currentUserId && " (me)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setReassignOpen(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleReassign}
                disabled={!pickUserId || reassign.isPending}
              >
                {reassign.isPending ? "Saving…" : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallFollowUps() {
  const { user } = useAuth();
  const isManager  = user?.role === "Manager";
  const userId     = user ? parseInt(user.id) : 0;
  const today      = new Date();

  const {
    data: followUps = [],
    isLoading,
    isError,
    refetch,
  } = useCallFollowUps(userId, isManager);

  const { data: team = [] } = useTeamMembers();

  // ── Loading ──

  if (isLoading) {
    return (
      <div className="p-4 max-w-lg mx-auto space-y-3">
        <div className="flex items-center justify-between pt-1 pb-2">
          <div>
            <h1 className="text-xl font-bold">Call Follow-ups</h1>
            <p className="text-sm text-muted-foreground">
              {format(today, "EEEE, MMMM d")}
            </p>
          </div>
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
        <p className="text-muted-foreground text-sm">Failed to load follow-ups.</p>
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
      <div className="flex items-start justify-between pt-1">
        <div>
          <h1 className="text-xl font-bold">Call Follow-ups</h1>
          <p className="text-sm text-muted-foreground">
            {format(today, "EEEE, MMMM d")}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold tabular-nums leading-none">
            {followUps.length}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">pending today</p>
        </div>
      </div>

      {/* Type summary pills */}
      {followUps.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {(
            Object.entries(TYPE_CONFIG) as [CallFollowUp["type"], typeof TYPE_CONFIG[CallFollowUp["type"]]][]
          ).map(([type, cfg]) => {
            const count = followUps.filter((f) => f.type === type).length;
            if (!count) return null;
            return (
              <span
                key={type}
                className={`text-xs px-2.5 py-1 rounded-full font-medium ${cfg.color}`}
              >
                {cfg.label} · {count}
              </span>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {followUps.length === 0 ? (
        <Card>
          <CardContent className="py-12 flex flex-col items-center gap-2 text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <p className="font-semibold">All clear for today!</p>
            <p className="text-sm text-muted-foreground">
              No pending call follow-ups scheduled.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {followUps.map((fu) => (
            <FollowUpCard
              key={fu.id}
              followUp={fu}
              team={team}
              currentUserId={userId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
