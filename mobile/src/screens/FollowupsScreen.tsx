import React, { useState, useCallback } from "react";
import { View, StyleSheet, FlatList, Linking } from "react-native";
import {
  Text,
  Card,
  Button,
  Chip,
  ActivityIndicator,
  Divider,
} from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { format, parseISO, isPast, isToday, addDays } from "date-fns";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { Followup } from "../types";

type RawFollowup = {
  id: number;
  followup_date: string;
  status: string;
  notes: string | null;
  spoke_to_customer: boolean | null;
  visit_id: number;
  visits: {
    customer_name: string;
    customer_mobile: string | null;
    user_id: string;
  };
};

function urgencyFor(dateStr: string): "overdue" | "today" | "upcoming" {
  const d = parseISO(dateStr);
  if (isToday(d)) return "today";
  if (isPast(d)) return "overdue";
  return "upcoming";
}

export default function FollowupsScreen() {
  const { user } = useAuth();
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<number | null>(null);

  const fetchFollowups = useCallback(async () => {
    if (!user) return;

    // Get agent's visit IDs first (most reliable cross-version approach)
    const { data: visitRows } = await supabase
      .from("visits")
      .select("id, customer_name, customer_mobile")
      .eq("user_id", user.id);

    if (!visitRows || visitRows.length === 0) {
      setFollowups([]);
      setLoading(false);
      return;
    }

    const visitMap: Record<number, { customer_name: string; customer_mobile: string | null }> = {};
    visitRows.forEach((v: any) => {
      visitMap[v.id as number] = {
        customer_name: v.customer_name,
        customer_mobile: v.customer_mobile,
      };
    });
    const visitIds = Object.keys(visitMap).map(Number);

    const { data } = await supabase
      .from("followups")
      .select("id, followup_date, status, notes, spoke_to_customer, visit_id")
      .in("visit_id", visitIds)
      .eq("status", "Pending")
      .order("followup_date", { ascending: true });

    if (data) {
      setFollowups(
        data.map((f: any) => ({
          id: f.id,
          visit_id: f.visit_id,
          followup_date: f.followup_date,
          status: f.status,
          notes: f.notes,
          spoke_to_customer: f.spoke_to_customer,
          quotation_sent: null,
          sale_amount: null,
          invoice_number: null,
          customer_name: visitMap[f.visit_id as number]?.customer_name ?? "Unknown",
          customer_mobile: visitMap[f.visit_id as number]?.customer_mobile ?? null,
        }))
      );
    }
    setLoading(false);
  }, [user]);

  useFocusEffect(fetchFollowups);

  const markDone = async (id: number) => {
    setUpdating(id);
    await supabase
      .from("followups")
      .update({ status: "Completed" })
      .eq("id", id);
    setFollowups((prev) => prev.filter((f) => f.id !== id));
    setUpdating(null);
  };

  const snooze = async (id: number) => {
    setUpdating(id);
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");
    await supabase
      .from("followups")
      .update({ followup_date: tomorrow })
      .eq("id", id);
    await fetchFollowups();
    setUpdating(null);
  };

  const callCustomer = (mobile: string | null) => {
    if (!mobile) return;
    Linking.openURL(`tel:${mobile}`);
  };

  const overdueCount = followups.filter(
    (f) => urgencyFor(f.followup_date) === "overdue"
  ).length;
  const todayCount = followups.filter(
    (f) => urgencyFor(f.followup_date) === "today"
  ).length;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Follow-ups
        </Text>
        <View style={styles.badges}>
          {overdueCount > 0 && (
            <Chip
              compact
              textStyle={{ fontSize: 12, color: "#dc2626" }}
              style={{ backgroundColor: "#fef2f2" }}
            >
              {overdueCount} overdue
            </Chip>
          )}
          {todayCount > 0 && (
            <Chip
              compact
              textStyle={{ fontSize: 12, color: "#d97706" }}
              style={{ backgroundColor: "#fffbeb" }}
            >
              {todayCount} today
            </Chip>
          )}
        </View>
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a56db" />
      ) : (
        <FlatList
          data={followups}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const urgency = urgencyFor(item.followup_date);
            const isUpdating = updating === item.id;
            return (
              <Card
                style={[
                  styles.card,
                  urgency === "overdue" && styles.cardOverdue,
                  urgency === "today" && styles.cardToday,
                ]}
                mode="elevated"
              >
                <Card.Content>
                  <View style={styles.cardTop}>
                    <View style={styles.cardTopLeft}>
                      <Text variant="titleMedium" style={styles.customerName}>
                        {item.customer_name}
                      </Text>
                      {item.customer_mobile && (
                        <Text variant="bodySmall" style={styles.mobile}>
                          {item.customer_mobile}
                        </Text>
                      )}
                    </View>
                    <View style={styles.cardTopRight}>
                      <Chip
                        compact
                        textStyle={{
                          fontSize: 11,
                          color:
                            urgency === "overdue"
                              ? "#dc2626"
                              : urgency === "today"
                              ? "#d97706"
                              : "#1a56db",
                        }}
                        style={{
                          backgroundColor:
                            urgency === "overdue"
                              ? "#fef2f2"
                              : urgency === "today"
                              ? "#fffbeb"
                              : "#eff6ff",
                        }}
                      >
                        {urgency === "overdue"
                          ? "Overdue"
                          : urgency === "today"
                          ? "Today"
                          : format(parseISO(item.followup_date), "MMM d")}
                      </Chip>
                    </View>
                  </View>

                  {item.notes && (
                    <Text
                      variant="bodySmall"
                      style={styles.notes}
                      numberOfLines={2}
                    >
                      {item.notes}
                    </Text>
                  )}
                </Card.Content>

                <Divider />

                <Card.Actions style={styles.cardActions}>
                  {item.customer_mobile && (
                    <Button
                      mode="text"
                      icon="phone"
                      compact
                      onPress={() => callCustomer(item.customer_mobile)}
                      textColor="#1a56db"
                      style={styles.actionBtn}
                      contentStyle={{ paddingHorizontal: 8 }}
                    >
                      Call
                    </Button>
                  )}
                  <Button
                    mode="contained"
                    icon="check"
                    compact
                    loading={isUpdating}
                    disabled={isUpdating}
                    onPress={() => markDone(item.id)}
                    style={styles.actionBtn}
                    contentStyle={{ paddingHorizontal: 12 }}
                    labelStyle={{ fontSize: 13, fontWeight: "600" }}
                  >
                    Done
                  </Button>
                  <Button
                    mode="outlined"
                    icon="alarm"
                    compact
                    loading={isUpdating}
                    disabled={isUpdating}
                    onPress={() => snooze(item.id)}
                    style={styles.actionBtn}
                    contentStyle={{ paddingHorizontal: 12 }}
                    labelStyle={{ fontSize: 13 }}
                  >
                    Snooze
                  </Button>
                </Card.Actions>
              </Card>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                All caught up! 🎉
              </Text>
              <Text variant="bodyMedium" style={styles.emptyHint}>
                No pending follow-ups
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
  title: { fontWeight: "700", color: "#1e293b", marginBottom: 8 },
  badges: { flexDirection: "row", gap: 8 },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 32 },
  card: { borderRadius: 14 },
  cardOverdue: { borderLeftWidth: 4, borderLeftColor: "#dc2626" },
  cardToday: { borderLeftWidth: 4, borderLeftColor: "#d97706" },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  cardTopLeft: { flex: 1, marginRight: 8 },
  cardTopRight: {},
  customerName: { fontWeight: "700", color: "#1e293b" },
  mobile: { color: "#64748b", marginTop: 2 },
  notes: { color: "#64748b", marginTop: 8 },
  cardActions: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexWrap: "wrap",
    gap: 4,
  },
  actionBtn: { borderRadius: 8 },
  empty: { alignItems: "center", marginTop: 64 },
  emptyTitle: { fontWeight: "700", color: "#475569" },
  emptyHint: { color: "#94a3b8", marginTop: 4 },
});
