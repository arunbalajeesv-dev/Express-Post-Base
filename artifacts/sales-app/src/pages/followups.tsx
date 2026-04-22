import { useGetPendingFollowups, getGetPendingFollowupsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { CalendarClock, Phone, User, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function Followups() {
  const { data, isLoading } = useGetPendingFollowups({
    query: { queryKey: getGetPendingFollowupsQueryKey() }
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Follow-ups</h1>
          <p className="text-sm text-muted-foreground">Pending scheduled visits</p>
        </div>
        <Link href="/followups/overdue">
          <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive/10 hover:text-destructive">
            Overdue
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : data?.followups && data.followups.length > 0 ? (
        <div className="space-y-4">
          {data.followups.map((f) => (
            <Card key={f.id} className="border-l-4 border-l-primary overflow-hidden">
              <CardContent className="p-5">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      {f.customer.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                      <Phone className="h-4 w-4" />
                      {f.customer.mobile}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm font-medium text-primary">
                      <CalendarClock className="h-4 w-4" />
                      {format(new Date(f.scheduled_date), "MMM d, yyyy")}
                    </div>
                  </div>
                  <Link href="/add-visit">
                    <Button size="icon" variant="ghost" className="rounded-full bg-primary/5 text-primary hover:bg-primary/10">
                      <ArrowRight className="h-5 w-5" />
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl border-dashed bg-card/30">
          <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-medium text-foreground">No pending follow-ups</h3>
          <p className="text-muted-foreground text-sm">You're all caught up!</p>
        </div>
      )}
    </div>
  );
}
