import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { Users, Phone, MapPin, Tag } from "lucide-react";

export default function Customers() {
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchCustomers() {
      try {
        const token = localStorage.getItem("auth_token");
        const res = await fetch("/api/visits", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const visits = data.data ?? [];
          const unique = new Map();
          visits.forEach((v: any) => {
            if (v.customer && !unique.has(v.customer.mobile)) {
              const displayType = v.customerType === "Others"
                ? (v.customCustomerType || "Others")
                : (v.customerType || null);
              unique.set(v.customer.mobile, {
                ...v.customer,
                last_feedback: v.feedback,
                last_visit: v.created_at,
                customer_type: displayType,
              });
            }
          });
          setCustomers(Array.from(unique.values()));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchCustomers();
  }, []);

  const getFeedbackColor = (feedback: string) => {
    switch (feedback) {
      case "Interested":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
      case "Potential":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">Recent visits and contacts</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : customers.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {customers.map((c, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-lg">{c.name}</h3>
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5" />
                      {c.mobile}
                    </div>
                    {c.customer_type && (
                      <div className="mt-1 text-xs text-muted-foreground font-medium">
                        {c.customer_type}
                      </div>
                    )}
                  </div>
                  {c.last_feedback && (
                    <div
                      className={`px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-wider uppercase flex items-center gap-1 ${getFeedbackColor(c.last_feedback)}`}
                    >
                      <Tag className="h-3 w-3" />
                      {c.last_feedback}
                    </div>
                  )}
                </div>
                {c.last_visit && (
                  <div className="mt-4 pt-3 border-t flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Last visited {format(new Date(c.last_visit), "MMM d, yyyy")}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 border rounded-xl border-dashed bg-card/30">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-medium text-foreground">No customers found</h3>
          <p className="text-muted-foreground text-sm">
            Record a visit to see customers here.
          </p>
        </div>
      )}
    </div>
  );
}
