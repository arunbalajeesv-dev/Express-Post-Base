import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { startOfDay, startOfWeek, startOfMonth } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type CallRow = {
  id: number;
  customer_id: number | null;
  call_status: string;
  call_date: string;
  sale_value: number | null;
  agent_id: number;
  agent: { id: number; name: string } | null;
};

type Period = "today" | "week" | "month";

// ─── Constants ────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  today: "Today",
  week:  "This Week",
  month: "This Month",
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  "Connected":          { label: "Connected",          color: "#3b82f6" },
  "Not Connected":      { label: "Not Connected",      color: "#94a3b8" },
  "Callback Requested": { label: "Callback Requested", color: "#f97316" },
  "Quotation Sent":     { label: "Quotation Sent",     color: "#f59e0b" },
  "Converted":          { label: "Converted",          color: "#22c55e" },
  "Not Interested":     { label: "Not Interested",     color: "#ef4444" },
};

const FUNNEL_COLORS = ["#6366f1", "#8b5cf6", "#f59e0b", "#22c55e"];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeader(): HeadersInit {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function periodStart(p: Period): Date {
  const now = new Date();
  if (p === "today")  return startOfDay(now);
  if (p === "week")   return startOfWeek(now, { weekStartsOn: 1 });
  return startOfMonth(now);
}

function filterPeriod(calls: CallRow[], p: Period) {
  const start = periodStart(p);
  return calls.filter((c) => new Date(c.call_date) >= start);
}

function heatCell(count: number, max: number): string {
  if (count === 0) return "bg-muted/40";
  const r = count / max;
  if (r < 0.25) return "bg-green-200";
  if (r < 0.5)  return "bg-green-400";
  if (r < 0.75) return "bg-green-600";
  return "bg-green-700";
}

function fmtHour(h: number): string {
  if (h === 0)  return "12a";
  if (h < 12)   return `${h}a`;
  if (h === 12) return "12p";
  return `${h - 12}p`;
}

// ─── Data hooks ───────────────────────────────────────────────────────────────

function useCallsData() {
  return useQuery<CallRow[]>({
    queryKey: ["reports-calls"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs")
        .select("id, customer_id, call_status, call_date, sale_value, agent_id, agent:users!agent_id(id, name)")
        .order("call_date", { ascending: false });
      if (error) return [];
      return (data ?? []) as unknown as CallRow[];
    },
    staleTime: 60_000,
    retry: false,
  });
}

function useTeam() {
  return useQuery<{ id: number; name: string }[]>({
    queryKey: ["users-list"],
    queryFn: async () => {
      const res = await fetch("/api/users", { headers: authHeader() });
      const json = await res.json();
      return json.data ?? [];
    },
  });
}

// ─── Section 1: Calls Per Rep ─────────────────────────────────────────────────

function CallsPerRep({ calls, period, onPeriodChange }: {
  calls: CallRow[];
  period: Period;
  onPeriodChange: (p: Period) => void;
}) {
  const data = useMemo(() => {
    const filtered = filterPeriod(calls, period);
    const map = new Map<number, { name: string; count: number }>();
    for (const c of filtered) {
      const existing = map.get(c.agent_id);
      const name = c.agent?.name ?? `Agent ${c.agent_id}`;
      if (existing) existing.count++;
      else map.set(c.agent_id, { name, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [calls, period]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Calls Per Rep</CardTitle>
            <CardDescription>{total} calls — {PERIOD_LABELS[period]}</CardDescription>
          </div>
          <div className="flex gap-1">
            {(["today", "week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  period === p
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No calls in this period.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={data}
              margin={{ top: 5, right: 8, left: -20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                interval={0}
                tickFormatter={(v: string) =>
                  v.length > 8 ? v.slice(0, 8) + "…" : v
                }
              />
              <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                formatter={(val: number) => [val, "Calls"]}
                contentStyle={{ fontSize: 12 }}
              />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
                maxBarSize={56}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 2: Status Breakdown ────────────────────────────────────────────

function OutcomeBreakdown({ calls, period, team }: {
  calls: CallRow[];
  period: Period;
  team: { id: number; name: string }[];
}) {
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const data = useMemo(() => {
    let filtered = filterPeriod(calls, period);
    if (agentFilter !== "all") filtered = filtered.filter((c) => c.agent_id === Number(agentFilter));
    const map: Record<string, number> = {};
    for (const c of filtered) {
      map[c.call_status] = (map[c.call_status] ?? 0) + 1;
    }
    return Object.entries(map)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count);
  }, [calls, period, agentFilter]);

  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="text-base">Call Status Breakdown</CardTitle>
            <CardDescription>
              {total} calls — {PERIOD_LABELS[period]}
            </CardDescription>
          </div>
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="h-8 w-36 text-xs">
              <SelectValue placeholder="All agents" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {team.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No call data available.
          </p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            {/* Donut */}
            <div className="w-[180px] h-[180px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={2}
                  >
                    {data.map((entry) => (
                      <Cell
                        key={entry.status}
                        fill={STATUS_CONFIG[entry.status]?.color ?? "#94a3b8"}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: number, name: string) => [
                      val,
                      STATUS_CONFIG[name]?.label ?? name,
                    ]}
                    contentStyle={{ fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2 w-full">
              {data.map((entry) => {
                const cfg = STATUS_CONFIG[entry.status] ?? { label: entry.status, color: "#94a3b8" };
                const pct = total > 0 ? Math.round((entry.count / total) * 100) : 0;
                return (
                  <div key={entry.status} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cfg.color }} />
                    <span className="text-xs flex-1 truncate">{cfg.label}</span>
                    <span className="text-xs font-semibold tabular-nums">{entry.count}</span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 3: Conversion Funnel ────────────────────────────────────────────

function ConversionFunnel({ calls, period }: { calls: CallRow[]; period: Period }) {
  const stages = useMemo(() => {
    const filtered = filterPeriod(calls, period);

    // Unique customers ever called in period
    const custIds = [...new Set(filtered.map((c) => c.customer_id).filter(Boolean))] as number[];

    // Per-customer "best" status (Converted > Quotation Sent > Connected > others)
    const STATUS_RANK: Record<string, number> = {
      "Converted": 4, "Quotation Sent": 3, "Connected": 2,
      "Callback Requested": 1, "Not Interested": 0, "Not Connected": 0,
    };
    const bestStatus = new Map<number, string>();
    for (const c of filtered) {
      if (!c.customer_id) continue;
      const cur = bestStatus.get(c.customer_id);
      const curRank = cur ? (STATUS_RANK[cur] ?? 0) : -1;
      const newRank = STATUS_RANK[c.call_status] ?? 0;
      if (newRank > curRank) bestStatus.set(c.customer_id, c.call_status);
    }

    const connected      = custIds.filter((id) => (STATUS_RANK[bestStatus.get(id) ?? ""] ?? 0) >= 2).length;
    const quotationSent  = custIds.filter((id) => (STATUS_RANK[bestStatus.get(id) ?? ""] ?? 0) >= 3).length;
    const converted      = custIds.filter((id) => bestStatus.get(id) === "Converted").length;

    return [
      { label: "Total Contacts", count: custIds.length },
      { label: "Connected",      count: connected },
      { label: "Quotation Sent", count: quotationSent },
      { label: "Converted",      count: converted },
    ];
  }, [calls, period]);

  const maxCount = stages[0]?.count ?? 1;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Conversion Funnel</CardTitle>
        <CardDescription>Unique contacts — {PERIOD_LABELS[period]}</CardDescription>
      </CardHeader>
      <CardContent>
        {maxCount === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No data in this period.
          </p>
        ) : (
          <div className="space-y-1">
            {stages.map((stage, i) => {
              const prev = stages[i - 1];
              const convPct =
                i > 0 && prev && prev.count > 0
                  ? Math.round((stage.count / prev.count) * 100)
                  : null;
              const widthPct =
                maxCount > 0 ? (stage.count / maxCount) * 100 : 0;

              return (
                <div key={stage.label}>
                  {/* Conversion arrow between stages */}
                  {i > 0 && (
                    <div className="flex items-center gap-2 py-1 px-2">
                      <div className="h-px flex-1 border-t border-dashed border-border" />
                      <span className="text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                        {convPct !== null ? `${convPct}%` : "—"} converted
                      </span>
                      <div className="h-px flex-1 border-t border-dashed border-border" />
                    </div>
                  )}

                  {/* Bar */}
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground w-24 shrink-0 text-right leading-tight">
                      {stage.label}
                    </span>
                    <div className="flex-1 h-9 bg-muted rounded-lg relative overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full rounded-lg transition-all duration-500"
                        style={{
                          width: `${widthPct}%`,
                          background: FUNNEL_COLORS[i],
                          opacity: 0.85,
                        }}
                      />
                      <div className="absolute inset-0 flex items-center justify-between px-3">
                        <span
                          className="text-sm font-bold"
                          style={{
                            color:
                              widthPct > 30
                                ? "white"
                                : FUNNEL_COLORS[i],
                          }}
                        >
                          {stage.count}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">
                          {maxCount > 0
                            ? `${Math.round((stage.count / maxCount) * 100)}%`
                            : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section 4: Best Time to Call Heatmap ────────────────────────────────────

function BestTimeHeatmap({ calls }: { calls: CallRow[] }) {
  const { grid, maxVal } = useMemo(() => {
    // 7 rows (days 0=Sun…6=Sat) × 24 cols (hours)
    const g: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
    for (const c of calls) {
      if (c.call_status !== "Connected") continue;
      const dt = new Date(c.call_date);
      g[dt.getDay()][dt.getHours()]++;
    }
    const flat = g.flat();
    return { grid: g, maxVal: Math.max(...flat, 1) };
  }, [calls]);

  const answered = calls.filter((c) => c.call_status === "Connected").length;

  // Show every 3rd hour label to avoid crowding
  const hourLabels = Array.from({ length: 24 }, (_, h) =>
    h % 3 === 0 ? fmtHour(h) : ""
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Best Time to Call</CardTitle>
        <CardDescription>
          {answered} connected calls — all time · green = more connections
        </CardDescription>
      </CardHeader>
      <CardContent>
        {answered === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No connected calls yet. Data will appear once calls are logged.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <div className="min-w-[340px]">
              {/* Hour labels row */}
              <div className="flex ml-8 mb-0.5">
                {hourLabels.map((label, h) => (
                  <div
                    key={h}
                    className="text-[9px] text-muted-foreground text-center"
                    style={{ width: "calc(100% / 24)" }}
                  >
                    {label}
                  </div>
                ))}
              </div>

              {/* Grid rows */}
              {DAY_NAMES.map((day, d) => (
                <div key={day} className="flex items-center gap-1 mb-0.5">
                  <span className="text-[10px] text-muted-foreground w-7 shrink-0 text-right">
                    {day}
                  </span>
                  <div className="flex flex-1 gap-px">
                    {grid[d].map((count, h) => (
                      <div
                        key={h}
                        title={
                          count > 0
                            ? `${day} ${fmtHour(h)}: ${count} answered`
                            : undefined
                        }
                        className={`flex-1 h-5 rounded-[2px] transition-colors ${heatCell(count, maxVal)}`}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {/* Legend */}
              <div className="flex items-center gap-2 mt-3 justify-end">
                <span className="text-[10px] text-muted-foreground">Fewer</span>
                {["bg-muted/40", "bg-green-200", "bg-green-400", "bg-green-600", "bg-green-700"].map(
                  (cls, i) => (
                    <div key={i} className={`w-4 h-3 rounded-[2px] ${cls}`} />
                  )
                )}
                <span className="text-[10px] text-muted-foreground">More</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Reports() {
  const [period, setPeriod] = useState<Period>("month");

  const { data: calls = [], isLoading } = useCallsData();
  const { data: team = [] } = useTeam();

  if (isLoading) {
    return (
      <div className="p-4 max-w-2xl mx-auto space-y-4">
        <div className="pt-1 pb-2">
          <h1 className="text-xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Cold calling analytics</p>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-64 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 pb-28 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="pt-1">
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">
          {calls.length} total calls in database
        </p>
      </div>

      <CallsPerRep calls={calls} period={period} onPeriodChange={setPeriod} />
      <OutcomeBreakdown calls={calls} period={period} team={team} />
      <ConversionFunnel calls={calls} period={period} />
      <BestTimeHeatmap calls={calls} />
    </div>
  );
}
