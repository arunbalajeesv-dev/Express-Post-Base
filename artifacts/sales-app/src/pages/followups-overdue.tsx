import { useGetOverdueFollowups, getGetOverdueFollowupsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { AlertCircle, Phone, User, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export default function OverdueFollowups() {
  const { data, isLoading } = useGetOverdueFollowups({
    query: { queryKey: getGetOverdueFollowupsQueryKey() }
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/followups">
          <Button variant="ghost" size="icon" className="rounded-full -ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-destructive">Overdue</h1>
          <p className="text-sm text-muted-foreground">Follow-ups missed</p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1,2].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)}
        </div>
      ) : data?.followups && data.followups.length > 0 ? (
        <div className="space-y-4">
          {data.followups.map((f) => (
            <Card key={f.id} className="border-l-4 border-l-destructive overflow-hidden bg-destructive/5 border-destructive/20">
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
                    <div className="flex items-center gap-2 mt-2 text-sm font-medium text-destructive flex-wrap">
                      <AlertCircle className="h-4 w-4" />
                      Missed on {format(new Date(f.scheduled_date), "MMM d, yyyy")}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl border-dashed bg-card/30">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-medium text-foreground">No overdue follow-ups</h3>
          <p className="text-muted-foreground text-sm">Great job staying on top of things!</p>
        </div>
      )}
    </div>
  );
}
