import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Linking,
  ScrollView,
  TouchableOpacity,
  Image,
} from "react-native";
import {
  Text,
  Searchbar,
  Card,
  FAB,
  Modal,
  Portal,
  TextInput,
  Button,
  ActivityIndicator,
  Chip,
  RadioButton,
  Divider,
  HelperText,
} from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { format, parseISO } from "date-fns";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import {
  Visit,
  SITE_STAGES,
  FEEDBACK_OPTIONS,
  CUSTOMER_TYPES,
  AREA_OPTIONS,
} from "../types";

type FormState = {
  customerName: string;
  customerMobile: string;
  companyName: string;
  customerType: string;
  customCustomerType: string;
  area: string;
  areaOther: string;
  locationLink: string;
  siteStage: string;
  feedback: string;
  notes: string;
  imageUri: string;
};

const DEFAULT_FORM: FormState = {
  customerName: "",
  customerMobile: "",
  companyName: "",
  customerType: "",
  customCustomerType: "",
  area: "",
  areaOther: "",
  locationLink: "",
  siteStage: "",
  feedback: "",
  notes: "",
  imageUri: "",
};

const FEEDBACK_COLORS: Record<string, string> = {
  Interested: "#16a34a",
  Potential: "#d97706",
  "Not Interested": "#dc2626",
};

export default function CallLogScreen() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const setField = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const fetchVisits = useCallback(async () => {
    if (!user) return;
    let query = supabase
      .from("visits")
      .select(
        "id, user_id, customer_name, customer_mobile, area, site_stage, feedback, visit_date, notes, image_url"
      )
      .eq("user_id", user.id)
      .order("visit_date", { ascending: false })
      .limit(60);

    if (search.trim()) {
      query = query.ilike("customer_name", `%${search.trim()}%`);
    }

    const { data } = await query;
    setVisits((data ?? []) as Visit[]);
    setLoading(false);
  }, [user, search]);

  useFocusEffect(fetchVisits);
  useEffect(() => { fetchVisits(); }, [search]);

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.customerName.trim()) e.customerName = "Customer name is required.";
    if (!form.customerMobile.trim() || !/^[6-9]\d{9}$/.test(form.customerMobile.trim()))
      e.customerMobile = "Enter a valid 10-digit mobile number.";
    if (!form.customerType) e.customerType = "Select a customer type.";
    if (form.customerType === "Others" && !form.customCustomerType.trim())
      e.customCustomerType = "Specify the customer type.";
    if (!form.area) e.area = "Select an area.";
    if (form.area === "Other" && !form.areaOther.trim()) e.areaOther = "Specify the area.";
    if (!form.siteStage) e.siteStage = "Select a site stage.";
    if (!form.feedback) e.feedback = "Select an outcome.";
    if (!form.notes.trim()) e.notes = "Notes are required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      uploadImage(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri: string) => {
    if (!user) return;
    setUploadingImage(true);
    try {
      const ext = uri.split(".").pop() ?? "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const response = await fetch(uri);
      const blob = await response.blob();
      const { data, error } = await supabase.storage
        .from("visit-images")
        .upload(path, blob, { contentType: `image/${ext}` });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("visit-images").getPublicUrl(path);
      setField("imageUri", urlData.publicUrl);
    } catch {
      // silently fail — image is optional
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setSubmitting(true);
    const { error } = await supabase.from("visits").insert({
      user_id: user.id,
      customer_name: form.customerName.trim(),
      customer_mobile: form.customerMobile.trim(),
      company_name: form.companyName.trim() || null,
      customer_type:
        form.customerType === "Others"
          ? form.customCustomerType.trim()
          : form.customerType,
      area: form.area === "Other" ? form.areaOther.trim() : form.area,
      location_link: form.locationLink.trim() || null,
      site_stage: form.siteStage,
      feedback: form.feedback,
      notes: form.notes.trim(),
      image_url: form.imageUri || null,
      visit_date: format(new Date(), "yyyy-MM-dd"),
    });
    setSubmitting(false);
    if (!error) {
      setModalVisible(false);
      setForm(DEFAULT_FORM);
      setErrors({});
      fetchVisits();
    }
  };

  const dialNumber = (mobile: string | null) => {
    if (!mobile) return;
    Linking.openURL(`tel:${mobile}`);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.title}>
          Call Log
        </Text>
        <Searchbar
          placeholder="Search customer…"
          value={search}
          onChangeText={setSearch}
          style={styles.searchbar}
          inputStyle={{ fontSize: 14 }}
        />
      </View>

      {loading ? (
        <ActivityIndicator style={styles.loader} size="large" color="#1a56db" />
      ) : (
        <FlatList
          data={visits}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <Card style={styles.visitCard} mode="elevated">
              <Card.Content>
                <View style={styles.cardRow}>
                  <View style={styles.cardLeft}>
                    <Text variant="titleMedium" style={styles.customerName}>
                      {item.customer_name}
                    </Text>
                    {item.area && (
                      <Text variant="bodySmall" style={styles.meta}>
                        {item.area}
                      </Text>
                    )}
                    <Text variant="bodySmall" style={styles.meta}>
                      {format(parseISO(item.visit_date), "d MMM yyyy")}
                    </Text>
                    {item.site_stage && (
                      <Text variant="bodySmall" style={styles.meta}>
                        {item.site_stage}
                      </Text>
                    )}
                  </View>
                  <View style={styles.cardRight}>
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
                        }}
                      >
                        {item.feedback}
                      </Chip>
                    )}
                    {item.customer_mobile && (
                      <Button
                        mode="contained-tonal"
                        icon="phone"
                        compact
                        onPress={() => dialNumber(item.customer_mobile)}
                        style={styles.callBtn}
                        contentStyle={{ paddingHorizontal: 8 }}
                        labelStyle={{ fontSize: 13 }}
                      >
                        Call
                      </Button>
                    )}
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
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text variant="titleMedium" style={styles.emptyTitle}>
                No calls logged yet
              </Text>
              <Text variant="bodyMedium" style={styles.emptyHint}>
                Tap + to record your first visit
              </Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        label="Log Call"
        style={styles.fab}
        onPress={() => {
          setForm(DEFAULT_FORM);
          setErrors({});
          setModalVisible(true);
        }}
      />

      {/* Log Call Modal */}
      <Portal>
        <Modal
          visible={modalVisible}
          onDismiss={() => setModalVisible(false)}
          contentContainerStyle={styles.modal}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text variant="titleLarge" style={styles.modalTitle}>
              Log a Call
            </Text>

            {/* Customer Info */}
            <Text variant="labelLarge" style={styles.section}>
              Customer Info
            </Text>
            <TextInput
              label="Customer Name *"
              value={form.customerName}
              onChangeText={(v) => setField("customerName", v)}
              mode="outlined"
              style={styles.input}
              contentStyle={styles.inputContent}
              error={!!errors.customerName}
            />
            {errors.customerName ? (
              <HelperText type="error">{errors.customerName}</HelperText>
            ) : null}

            <TextInput
              label="Mobile Number *"
              value={form.customerMobile}
              onChangeText={(v) => setField("customerMobile", v)}
              mode="outlined"
              keyboardType="phone-pad"
              maxLength={10}
              style={styles.input}
              contentStyle={styles.inputContent}
              error={!!errors.customerMobile}
            />
            {errors.customerMobile ? (
              <HelperText type="error">{errors.customerMobile}</HelperText>
            ) : null}

            <TextInput
              label="Company / Builder Name"
              value={form.companyName}
              onChangeText={(v) => setField("companyName", v)}
              mode="outlined"
              style={styles.input}
              contentStyle={styles.inputContent}
            />

            <Text variant="labelMedium" style={styles.radioLabel}>
              Customer Type *
            </Text>
            <RadioButton.Group
              value={form.customerType}
              onValueChange={(v) => setField("customerType", v)}
            >
              {CUSTOMER_TYPES.map((t) => (
                <RadioButton.Item
                  key={t}
                  label={t}
                  value={t}
                  style={styles.radioItem}
                  labelStyle={styles.radioText}
                />
              ))}
            </RadioButton.Group>
            {errors.customerType ? (
              <HelperText type="error">{errors.customerType}</HelperText>
            ) : null}
            {form.customerType === "Others" && (
              <>
                <TextInput
                  label="Specify Type *"
                  value={form.customCustomerType}
                  onChangeText={(v) => setField("customCustomerType", v)}
                  mode="outlined"
                  style={styles.input}
                  contentStyle={styles.inputContent}
                  error={!!errors.customCustomerType}
                />
                {errors.customCustomerType ? (
                  <HelperText type="error">{errors.customCustomerType}</HelperText>
                ) : null}
              </>
            )}

            <Divider style={styles.divider} />

            {/* Site Details */}
            <Text variant="labelLarge" style={styles.section}>
              Site Details
            </Text>

            <Text variant="labelMedium" style={styles.radioLabel}>
              Area *
            </Text>
            <RadioButton.Group
              value={form.area}
              onValueChange={(v) => setField("area", v)}
            >
              {AREA_OPTIONS.map((a) => (
                <RadioButton.Item
                  key={a}
                  label={a}
                  value={a}
                  style={styles.radioItem}
                  labelStyle={styles.radioText}
                />
              ))}
            </RadioButton.Group>
            {errors.area ? (
              <HelperText type="error">{errors.area}</HelperText>
            ) : null}
            {form.area === "Other" && (
              <>
                <TextInput
                  label="Specify Area *"
                  value={form.areaOther}
                  onChangeText={(v) => setField("areaOther", v)}
                  mode="outlined"
                  style={styles.input}
                  contentStyle={styles.inputContent}
                  error={!!errors.areaOther}
                />
                {errors.areaOther ? (
                  <HelperText type="error">{errors.areaOther}</HelperText>
                ) : null}
              </>
            )}

            <Text variant="labelMedium" style={styles.radioLabel}>
              Site Stage *
            </Text>
            <RadioButton.Group
              value={form.siteStage}
              onValueChange={(v) => setField("siteStage", v)}
            >
              {SITE_STAGES.map((s) => (
                <RadioButton.Item
                  key={s}
                  label={s}
                  value={s}
                  style={styles.radioItem}
                  labelStyle={styles.radioText}
                />
              ))}
            </RadioButton.Group>
            {errors.siteStage ? (
              <HelperText type="error">{errors.siteStage}</HelperText>
            ) : null}

            <TextInput
              label="Location Link"
              value={form.locationLink}
              onChangeText={(v) => setField("locationLink", v)}
              mode="outlined"
              style={styles.input}
              contentStyle={styles.inputContent}
              placeholder="Google Maps URL"
            />

            <Divider style={styles.divider} />

            {/* Outcome */}
            <Text variant="labelLarge" style={styles.section}>
              Outcome
            </Text>

            <Text variant="labelMedium" style={styles.radioLabel}>
              Feedback *
            </Text>
            <RadioButton.Group
              value={form.feedback}
              onValueChange={(v) => setField("feedback", v)}
            >
              {FEEDBACK_OPTIONS.map((f) => (
                <RadioButton.Item
                  key={f}
                  label={f}
                  value={f}
                  style={styles.radioItem}
                  labelStyle={[
                    styles.radioText,
                    { color: FEEDBACK_COLORS[f] ?? "#1e293b" },
                  ]}
                />
              ))}
            </RadioButton.Group>
            {errors.feedback ? (
              <HelperText type="error">{errors.feedback}</HelperText>
            ) : null}

            <TextInput
              label="Notes *"
              value={form.notes}
              onChangeText={(v) => setField("notes", v)}
              mode="outlined"
              multiline
              numberOfLines={4}
              style={[styles.input, { marginTop: 8 }]}
              error={!!errors.notes}
            />
            {errors.notes ? (
              <HelperText type="error">{errors.notes}</HelperText>
            ) : null}

            <Divider style={styles.divider} />

            {/* Photo */}
            <Text variant="labelLarge" style={styles.section}>
              Site Photo
            </Text>

            {form.imageUri ? (
              <View style={styles.imagePreview}>
                <Image
                  source={{ uri: form.imageUri }}
                  style={styles.previewImg}
                  resizeMode="cover"
                />
                <Button
                  mode="text"
                  onPress={() => setField("imageUri", "")}
                  textColor="#dc2626"
                  compact
                >
                  Remove
                </Button>
              </View>
            ) : (
              <View style={styles.photoButtons}>
                <Button
                  mode="outlined"
                  icon="camera"
                  onPress={pickImage}
                  loading={uploadingImage}
                  style={styles.photoBtn}
                  contentStyle={styles.photoBtnContent}
                >
                  Camera
                </Button>
                <Button
                  mode="outlined"
                  icon="image"
                  onPress={pickFromGallery}
                  loading={uploadingImage}
                  style={styles.photoBtn}
                  contentStyle={styles.photoBtnContent}
                >
                  Gallery
                </Button>
              </View>
            )}

            {/* Submit */}
            <View style={styles.modalActions}>
              <Button
                mode="outlined"
                onPress={() => setModalVisible(false)}
                style={styles.modalActionBtn}
                contentStyle={styles.modalActionContent}
              >
                Cancel
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                loading={submitting}
                disabled={submitting || uploadingImage}
                style={styles.modalActionBtn}
                contentStyle={styles.modalActionContent}
                labelStyle={{ fontWeight: "600" }}
              >
                Save Visit
              </Button>
            </View>
          </ScrollView>
        </Modal>
      </Portal>
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
  title: { fontWeight: "700", marginBottom: 12, color: "#1e293b" },
  searchbar: { borderRadius: 12 },
  loader: { marginTop: 48 },
  list: { padding: 16, paddingBottom: 100 },
  visitCard: { borderRadius: 14 },
  cardRow: { flexDirection: "row", justifyContent: "space-between" },
  cardLeft: { flex: 1, marginRight: 12 },
  cardRight: { alignItems: "flex-end", gap: 8 },
  customerName: { fontWeight: "700", color: "#1e293b" },
  meta: { color: "#64748b", marginTop: 2 },
  callBtn: { borderRadius: 8, marginTop: 4 },
  notes: { color: "#64748b", marginTop: 8 },
  empty: { alignItems: "center", marginTop: 64 },
  emptyTitle: { fontWeight: "600", color: "#475569" },
  emptyHint: { color: "#94a3b8", marginTop: 4 },
  fab: { position: "absolute", right: 16, bottom: 16 },
  modal: {
    backgroundColor: "#fff",
    margin: 12,
    padding: 24,
    borderRadius: 20,
    maxHeight: "92%",
  },
  modalTitle: { fontWeight: "700", marginBottom: 20, color: "#1e293b" },
  section: { color: "#1a56db", fontWeight: "700", marginBottom: 12, marginTop: 4 },
  input: { marginBottom: 4 },
  inputContent: { height: 52 },
  radioLabel: { color: "#374151", marginBottom: 4, marginTop: 8 },
  radioItem: { paddingVertical: 4, minHeight: 48 },
  radioText: { fontSize: 14, color: "#1e293b" },
  divider: { marginVertical: 16 },
  imagePreview: { alignItems: "center", marginBottom: 12 },
  previewImg: { width: "100%", height: 160, borderRadius: 12, marginBottom: 8 },
  photoButtons: { flexDirection: "row", gap: 12, marginBottom: 12 },
  photoBtn: { flex: 1, borderRadius: 10 },
  photoBtnContent: { paddingVertical: 6 },
  modalActions: { flexDirection: "row", gap: 12, marginTop: 20 },
  modalActionBtn: { flex: 1, borderRadius: 10 },
  modalActionContent: { paddingVertical: 8 },
});
