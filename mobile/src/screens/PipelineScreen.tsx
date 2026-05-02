import React, { useState, useCallback } from "react";
import { View, StyleSheet, SectionList, Linking } from "react-native";
import {
  Text,
  Card,
  Chip,
  ActivityIndicator,
  Searchbar,
} from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { format, parseISO } from "date-fns";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Visit, SITE_STAGES } from "../types";

const STAGE_COLORS: Record<string, string> = {
  "New Site/ Foundation": "#6366f1",
  Brickwork: "#8b5cf6",
  Plastering: "#3b82f6",
  Roofing: "#0ea5e9",
  "Painting/ Tiles": "#f59e0b",
  "Plumbing/ Electrical": "#f97316",
  "Finishing Stage": "#22c55e",
};

const FEEDBACK_COLORS: Record<string, string> = {
  Interested: "#16a34a",
  Potential: "#d97706",
  "Not Interested": "#dc2626",
};

type Lead = {
  id: number;
  customer_name: string;
  customer_mobile: string | null;
  area: string | null;
  site_stage: string;
  feedback: string | null;
  visit_date: string;
};

export default function PipelineScreen() {
  const { user } = useAuth();
  const [sections, setSections] = useState<{ title: string; data: Lead[] }[]>([]);
  const [allLeads, setAllLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchPipeline = useCallback(async () => {
    if (!user) return;

    const { data } = await supabase
      .from("visits")
      .select(
        "id, customer_name, customer_mobile, area, site_stage, feedback, visit_date"
      )
      .eq("user_id", user.id)
      .order("visit_date", { ascending: false });

    if (data) {
      // Deduplicate: keep only latest visit per customer_name
      const seen = new Set<string>();
      const deduped: Lead[] = [];
      for (const v of data as any[]) {
        const key = (v.customer_name as string).toLowerCase().trim();
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push({
            id: v.id,
            customer_name: v.customer_name,
            customer_mobile: v.customer_mobile,
            area: v.area,
            site_stage: v.site_stage ?? "New Site/ Foundation",
            feedback: v.feedback,
            visit_date: v.visit_date,
          });
        }
      }
      setAllLeads(deduped);
      buildSections(deduped, "");
    }
    setLoading(false);
  }, [user]);

  const buildSections = (leads: Lead[], q: string) => {
    const filtered = q
      ? leads.filter((l) =>
          l.customer_name.toLowerCase().includes(q.toLowerCase())
        )
      : leads;

    const grouped = SITE_STAGES.map((stage) => ({
      title: stage,
      data: filtered.filter((l) => l.site_stage === stage),
    })).filter((s) => s.data.length > 0);

    setSections(grouped);
  };

  useFocusEffect(fetchPipeline);

  const onSearch = (q: string) => {
    setSearch(q);
    buildSections(allLeads, q);
  };

  const totalLeads = allLeads.length;
  const interestedCount = allLeads.filter((l) => l.feedback === "Interested").length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Pipeline
        </Text>
        <View style={styles.headerMeta}>
          <Text variant="bodyMedium" style={styles.subtitle}>
            {totalLeads} leads · {interestedCount} interested
          </Text>
        </View>
        <Searchbar
          placeholder="Search customer…"
          value={search}
          onChangeText={onSearch}
          style={styles.searchbar}
          inputStyle={{ fontSize: 14 }}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a56db" />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          renderSectionHeader={({ section: { title, data } }) => {
            const color = STAGE_COLORS[title] ?? "#64748b";
            return (
              <View style={styles.sectionHeader}>
                <View style={[styles.stageDot, { backgroundColor: color }]} />
                <Text
                  variant="titleSmall"
                  style={[styles.stageName, { color }]}
                >
                  {title}
                </Text>
                <View style={[styles.stageCount, { backgroundColor: color + "22" }]}>
                  <Text style={[styles.stageCountText, { color }]}>
                    {data.length}
                  </Text>
                </View>
              </View>
            );
          }}
          renderItem={({ item }) => (
            <Card style={styles.leadCard} mode="elevated">
              <Card.Content>
                <View style={styles.leadRow}>
                  <View style={styles.leadLeft}>
                    <Text variant="titleMedium" style={styles.customerName}>
                      {item.customer_name}
                    </Text>
                    {item.area && (
                      <Text variant="bodySmall" style={styles.meta}>
                        {item.area}
                      </Text>
                    )}
                    {item.customer_mobile && (
                      <Text
                        variant="bodySmall"
                        style={[styles.meta, styles.phone]}
                        onPress={() =>
                          Linking.openURL(`tel:${item.customer_mobile}`)
                        }
                      >
                        {item.customer_mobile}
                      </Text>
                    )}
                    <Text variant="bodySmall" style={styles.meta}>
                      Last visit: {format(parseISO(item.visit_date), "d MMM yyyy")}
                    </Text>
                  </View>
                  {item.feedback && (
                    <Chip
                      compact
                      textStyle={{
                        fontSize: 11,
                        color: FEEDBACK_COLORS[item.feedback] ?? "#64748b",
                      }}
                      style={{
                        backgroundColor:
                          (FEEDBACK_COLORS[item.feedback] ?? "#64748b") + "22",
                        alignSelf: "flex-start",
                      }}
                    >
                      {item.feedback}
                    </Chip>
                  )}
                </View>
              </Card.Content>
            </Card>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          SectionSeparatorComponent={() => <View style={{ height: 4 }} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                {search ? "No matches found" : "No leads yet"}
              </Text>
              <Text variant="bodyMedium" style={styles.emptyHint}>
                {search ? "Try a different search" : "Log a call to start building your pipeline"}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 12,
    backgroundColor: "#fff",
    elevation: 2,
  },
  title: { fontWeight: "700", color: "#1e293b" },
  headerMeta: { marginTop: 2, marginBottom: 12 },
  subtitle: { color: "#64748b" },
  searchbar: { borderRadius: 12 },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 32 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  stageDot: { width: 10, height: 10, borderRadius: 5 },
  stageName: { flex: 1, fontWeight: "700" },
  stageCount: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  stageCountText: { fontSize: 12, fontWeight: "700" },
  leadCard: { borderRadius: 14 },
  leadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  leadLeft: { flex: 1, marginRight: 12 },
  customerName: { fontWeight: "700", color: "#1e293b" },
  meta: { color: "#64748b", marginTop: 2 },
  phone: { color: "#1a56db" },
  empty: { alignItems: "center", marginTop: 64 },
  emptyTitle: { fontWeight: "600", color: "#475569" },
  emptyHint: { color: "#94a3b8", marginTop: 4 },
});
