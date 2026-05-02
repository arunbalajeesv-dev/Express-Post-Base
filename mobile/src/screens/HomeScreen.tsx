import React, { useCallback, useState } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from "react-native";
import {
  Text,
  Card,
  Button,
  ActivityIndicator,
  Surface,
} from "react-native-paper";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { format } from "date-fns";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";

type Stats = {
  callsToday: number;
  followupsDueToday: number;
  overdueCount: number;
};

export default function HomeScreen() {
  const { user, profile, signOut } = useAuth();
  const navigation = useNavigation<any>();
  const [stats, setStats] = useState<Stats>({ callsToday: 0, followupsDueToday: 0, overdueCount: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    const today = format(new Date(), "yyyy-MM-dd");

    const [visitsRes, visitIdsRes] = await Promise.all([
      supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("visit_date", today),
      supabase
        .from("visits")
        .select("id")
        .eq("user_id", user.id),
    ]);

    const visitIds = (visitIdsRes.data ?? []).map((v: any) => v.id as number);

    if (visitIds.length === 0) {
      setStats({ callsToday: visitsRes.count ?? 0, followupsDueToday: 0, overdueCount: 0 });
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const [dueTodayRes, overdueRes] = await Promise.all([
      supabase
        .from("followups")
        .select("id", { count: "exact", head: true })
        .in("visit_id", visitIds)
        .eq("status", "Pending")
        .eq("followup_date", today),
      supabase
        .from("followups")
        .select("id", { count: "exact", head: true })
        .in("visit_id", visitIds)
        .eq("status", "Pending")
        .lt("followup_date", today),
    ]);

    setStats({
      callsToday: visitsRes.count ?? 0,
      followupsDueToday: dueTodayRes.count ?? 0,
      overdueCount: overdueRes.count ?? 0,
    });
    setLoading(false);
    setRefreshing(false);
  }, [user]);

  useFocusEffect(fetchStats);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        <View>
          <Text variant="bodySmall" style={styles.greetingLabel}>
            {greeting()}
          </Text>
          <Text variant="titleLarge" style={styles.agentName}>
            {profile?.name ?? "Agent"}
          </Text>
        </View>
        <Button
          mode="text"
          icon="logout"
          onPress={signOut}
          textColor="#64748b"
          compact
        >
          Sign out
        </Button>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Text variant="labelLarge" style={styles.sectionLabel}>
          {format(new Date(), "EEEE, MMMM d")}
        </Text>

        {loading ? (
          <ActivityIndicator style={styles.loader} size="large" color="#1a56db" />
        ) : (
          <>
            {/* Stat cards */}
            <View style={styles.statsRow}>
              <Surface style={styles.statCard} elevation={2}>
                <Text variant="displaySmall" style={styles.statNumber}>
                  {stats.callsToday}
                </Text>
                <Text variant="labelMedium" style={styles.statLabel}>
                  Calls Today
                </Text>
              </Surface>

              <Surface
                style={[
                  styles.statCard,
                  stats.overdueCount > 0 && styles.statCardUrgent,
                ]}
                elevation={2}
              >
                <Text
                  variant="displaySmall"
                  style={[
                    styles.statNumber,
                    stats.overdueCount > 0 && styles.statNumberUrgent,
                  ]}
                >
                  {stats.overdueCount}
                </Text>
                <Text variant="labelMedium" style={styles.statLabel}>
                  Overdue
                </Text>
              </Surface>

              <Surface style={styles.statCard} elevation={2}>
                <Text variant="displaySmall" style={[styles.statNumber, styles.statNumberAccent]}>
                  {stats.followupsDueToday}
                </Text>
                <Text variant="labelMedium" style={styles.statLabel}>
                  Due Today
                </Text>
              </Surface>
            </View>

            {/* Quick actions */}
            <Card style={styles.actionsCard} mode="elevated">
              <Card.Content>
                <Text variant="titleMedium" style={styles.actionsTitle}>
                  Quick Actions
                </Text>
              </Card.Content>
              <Card.Actions style={styles.actions}>
                <Button
                  mode="contained"
                  icon="phone-plus-outline"
                  onPress={() => navigation.navigate("Call Log")}
                  style={styles.actionBtn}
                  contentStyle={styles.actionBtnContent}
                  labelStyle={styles.actionBtnLabel}
                >
                  Log a Call
                </Button>
                <Button
                  mode="contained-tonal"
                  icon="clipboard-list-outline"
                  onPress={() => navigation.navigate("Follow-ups")}
                  style={styles.actionBtn}
                  contentStyle={styles.actionBtnContent}
                  labelStyle={styles.actionBtnLabel}
                >
                  Follow-ups
                </Button>
              </Card.Actions>
            </Card>

            {/* Tip */}
            {stats.overdueCount > 0 && (
              <Surface style={styles.alertBanner} elevation={0}>
                <Text variant="bodyMedium" style={styles.alertText}>
                  ⚠️  You have {stats.overdueCount} overdue follow-up
                  {stats.overdueCount !== 1 ? "s" : ""}. Tap Follow-ups to clear them.
                </Text>
              </Surface>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: "#fff",
    elevation: 2,
  },
  greetingLabel: { color: "#64748b" },
  agentName: { fontWeight: "700", color: "#1e293b" },
  scroll: { padding: 20, paddingBottom: 32 },
  sectionLabel: { color: "#64748b", marginBottom: 16 },
  loader: { marginTop: 48 },
  statsRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  statCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    paddingHorizontal: 8,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  statCardUrgent: { backgroundColor: "#fef2f2" },
  statNumber: { fontWeight: "800", color: "#1a56db" },
  statNumberUrgent: { color: "#dc2626" },
  statNumberAccent: { color: "#d97706" },
  statLabel: { color: "#64748b", marginTop: 4, textAlign: "center" },
  actionsCard: { borderRadius: 16, marginBottom: 16 },
  actionsTitle: { fontWeight: "700", marginBottom: 4, color: "#1e293b" },
  actions: { paddingHorizontal: 16, paddingBottom: 16, gap: 10, flexWrap: "wrap" },
  actionBtn: { flex: 1, borderRadius: 12 },
  actionBtnContent: { paddingVertical: 8 },
  actionBtnLabel: { fontWeight: "600" },
  alertBanner: {
    backgroundColor: "#fff7ed",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fed7aa",
  },
  alertText: { color: "#9a3412" },
});
