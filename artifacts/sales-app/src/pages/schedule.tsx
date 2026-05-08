import { useQuery } from "@tanstack/react-query";
import { format, parseISO, isPast } from "date-fns";
import { CalendarClock, Phone, PhoneCall, AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";

type ScheduledCall = {
  id: number;
  call_summary: string | null;
  next_schedule_date: string;
  customer: { id: number; name: string; mobile: string } | null;
};

function fmtScheduled(s: string) {
  try { return format(parseISO(s), "EEE, MMM d · h:mm a"); } catch { return s; }
}

export default function Schedule() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { data: allScheduled = [], isLoading } = useQuery<ScheduledCall[]>({
    queryKey: ["scheduled-calls", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, call_summary, next_schedule_date, customer:customers!customer_id(id, name, mobile)")
        .eq("agent_id", parseInt(user!.id))
        .not("next_schedule_date", "is", null)
        .order("next_schedule_date", { ascending: true });
      if (error) return [];
      return (data ?? []) as unknown as ScheduledCall[];
    },
    enabled: !!user?.id,
  });

  const now = new Date().toISOString();
  const overdue  = allScheduled.filter((c) => c.next_schedule_date < now);
  const upcoming = allScheduled.filter((c) => c.next_schedule_date >= now);

  const handleCallNow = (call: ScheduledCall) => {
    if (call.customer?.mobile) {
      window.location.href = `tel:${call.customer.mobile}`;
    }
    navigate(`/calls/new?customerId=${call.customer?.id}`);
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-7 w-40" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  const CallCard = ({ call, isOverdue }: { call: ScheduledCall; isOverdue?: boolean }) => (
    <Card key={call.id} className={isOverdue ? "border-red-300 dark:border-red-800" : ""}>
      <CardContent className="p-4 flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="font-semibold text-base">{call.customer?.name ?? "Unknown"}</div>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5" />
            {call.customer?.mobile ?? "—"}
          </div>
          <div className={`flex items-center gap-1.5 text-sm font-medium ${isOverdue ? "text-red-500" : "text-primary"}`}>
            <CalendarClock className="h-3.5 w-3.5" />
            {fmtScheduled(call.next_schedule_date)}
            {isOverdue && <span className="text-xs font-normal ml-1">(overdue)</span>}
          </div>
          {call.call_summary && (
            <p className="text-xs text-muted-foreground line-clamp-2 pt-0.5">{call.call_summary}</p>
          )}
        </div>
        <Button
          size="sm"
          className={`shrink-0 text-white ${isOverdue ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
          onClick={() => handleCallNow(call)}
        >
          <PhoneCall className="h-4 w-4 mr-1.5" /> Call Now
        </Button>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-2xl mx-auto pb-24">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Schedule</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upcoming callbacks from call logs</p>
      </div>

      {allScheduled.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarClock className="h-12 w-12 mb-3 opacity-20" />
          <p className="text-sm font-medium">No scheduled calls</p>
          <p className="text-xs mt-1">When you log a call with a callback date, it will appear here</p>
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-semibold">Overdue ({overdue.length})</span>
              </div>
              {overdue.map((call) => <CallCard key={call.id} call={call} isOverdue />)}
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-3">
              {overdue.length > 0 && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <CalendarClock className="h-4 w-4" />
                  <span className="text-sm font-semibold">Upcoming ({upcoming.length})</span>
                </div>
              )}
              {upcoming.map((call) => <CallCard key={call.id} call={call} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
