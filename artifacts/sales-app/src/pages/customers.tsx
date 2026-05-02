import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, ChevronRight, Phone, Building2, X } from "lucide-react";

const SITE_STAGES = [
  "New Site/ Foundation",
  "Brickwork",
  "Plastering",
  "Roofing",
  "Painting/ Tiles",
  "Plumbing/ Electrical",
  "Finishing Stage",
];

const STATUS_OPTIONS = ["Converted", "In Progress", "Not Converted"];

const apiGet = (path: string) => {
  const token = localStorage.getItem("auth_token");
  return fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
};

function conversionBadge(status: string) {
  if (status === "Converted")
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 border-0 text-[10px] font-semibold uppercase tracking-wide">Converted</Badge>;
  if (status === "In Progress")
    return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400 border-0 text-[10px] font-semibold uppercase tracking-wide">In Progress</Badge>;
  return <Badge className="bg-muted text-muted-foreground hover:bg-muted border-0 text-[10px] font-semibold uppercase tracking-wide">Not Converted</Badge>;
}

export default function Customers() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [filterStage, setFilterStage] = useState("");
  const [filterArea, setFilterArea] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: () => apiGet("/customers"),
  });

  const customers: any[] = data?.data ?? [];

  // Distinct area values from loaded data (sorted, excluding nulls)
  const areaOptions = [...new Set(
    customers.map((c) => c.current_area).filter(Boolean) as string[]
  )].sort();

  const activeFilters = [filterStage, filterArea, filterStatus].filter(Boolean).length;

  const clearFilters = () => {
    setFilterStage("");
    setFilterArea("");
    setFilterStatus("");
  };

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.name?.toLowerCase().includes(q) ||
      c.mobile?.includes(q) ||
      c.company_name?.toLowerCase().includes(q);

    const matchStage  = !filterStage  || c.current_site_stage === filterStage;
    const matchArea   = !filterArea   || c.current_area        === filterArea;
    const matchStatus = !filterStatus || c.conversion_status   === filterStatus;

    return matchSearch && matchStage && matchArea && matchStatus;
  });

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-xl text-primary">
          <Users className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? "Loading…"
              : activeFilters > 0 || search
              ? `${filtered.length} of ${customers.length} customer${customers.length !== 1 ? "s" : ""}`
              : `${customers.length} customer${customers.length !== 1 ? "s" : ""}`}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-10"
          placeholder="Search by name, mobile, or company…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filterStage} onValueChange={setFilterStage}>
          <SelectTrigger className="h-9 text-sm w-auto min-w-[150px]">
            <SelectValue placeholder="Site Stage" />
          </SelectTrigger>
          <SelectContent>
            {SITE_STAGES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filterArea}
          onValueChange={setFilterArea}
          disabled={areaOptions.length === 0}
        >
          <SelectTrigger className="h-9 text-sm w-auto min-w-[130px]">
            <SelectValue placeholder="Area" />
          </SelectTrigger>
          <SelectContent>
            {areaOptions.map((a) => (
              <SelectItem key={a} value={a}>{a}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 text-sm w-auto min-w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {activeFilters > 0 && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors px-1"
          >
            <X className="h-3.5 w-3.5" />
            Clear {activeFilters > 1 ? `${activeFilters} filters` : "filter"}
          </button>
        )}
      </div>

      {/* Results */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
        </div>
      ) : filtered.length > 0 ? (
        <>
          {/* Desktop table */}
          <Card className="border-none shadow-md hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                    <th className="text-left px-5 py-3">Customer</th>
                    <th className="text-left px-4 py-3">Mobile</th>
                    <th className="text-left px-4 py-3">Company</th>
                    <th className="text-center px-4 py-3">Sites</th>
                    <th className="text-left px-4 py-3">Site Stage</th>
                    <th className="text-left px-4 py-3">Area</th>
                    <th className="text-center px-4 py-3">Follow-ups</th>
                    <th className="text-left px-4 py-3">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => navigate(`/customers/${c.id}`)}
                      className="border-b last:border-0 hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5 font-medium">{c.name}</td>
                      <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{c.mobile}</td>
                      <td className="px-4 py-3.5 text-muted-foreground text-xs">{c.company_name || "—"}</td>
                      <td className="px-4 py-3.5 text-center font-semibold">{c.total_visits}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{c.current_site_stage || "—"}</td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">{c.current_area || "—"}</td>
                      <td className="px-4 py-3.5 text-center font-semibold">{c.total_followups}</td>
                      <td className="px-4 py-3.5">{conversionBadge(c.conversion_status)}</td>
                      <td className="px-4 py-3.5 text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((c) => (
              <Card
                key={c.id}
                onClick={() => navigate(`/customers/${c.id}`)}
                className="border-none shadow-md cursor-pointer hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-base truncate">{c.name}</div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3 shrink-0" />
                        <span className="font-mono">{c.mobile}</span>
                      </div>
                      {c.company_name && (
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                          <Building2 className="h-3 w-3 shrink-0" />
                          <span>{c.company_name}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {conversionBadge(c.conversion_status)}
                      <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                    </div>
                  </div>

                  {/* Stage + Area tags */}
                  {(c.current_site_stage || c.current_area) && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {c.current_site_stage && (
                        <span className="text-[10px] bg-primary/8 text-primary font-medium px-2 py-0.5 rounded-full border border-primary/20">
                          {c.current_site_stage}
                        </span>
                      )}
                      {c.current_area && (
                        <span className="text-[10px] bg-muted text-muted-foreground font-medium px-2 py-0.5 rounded-full">
                          {c.current_area}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-base font-bold">{c.total_visits}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Sites</div>
                    </div>
                    <div>
                      <div className="text-base font-bold">{c.total_followups}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Follow-ups</div>
                    </div>
                    <div>
                      <div className="text-base font-bold">{c.converted_count ?? 0}</div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">Converted</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-16 border rounded-xl border-dashed bg-card/30">
          <Users className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-lg font-medium">
            {search || activeFilters > 0 ? "No customers match" : "No customers yet"}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            {search || activeFilters > 0
              ? "Try adjusting your search or filters."
              : "Record a visit to see customers here."}
          </p>
          {activeFilters > 0 && (
            <button
              onClick={clearFilters}
              className="mt-3 text-sm text-primary hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
