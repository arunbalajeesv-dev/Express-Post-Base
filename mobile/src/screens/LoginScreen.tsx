import React, { useState } from "react";
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Image,
} from "react-native";
import { Text, TextInput, Button, Surface, HelperText } from "react-native-paper";
import { supabase } from "../lib/supabase";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    if (authError) setError(authError.message);
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior="height">
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoArea}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>SA</Text>
          </View>
          <Text variant="headlineMedium" style={styles.appName}>
            Sales Agent
          </Text>
          <Text variant="bodyMedium" style={styles.tagline}>
            Field sales, simplified.
          </Text>
        </View>

        <Surface style={styles.card} elevation={2}>
          <Text variant="titleLarge" style={styles.cardTitle}>
            Sign in
          </Text>

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            mode="outlined"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
            contentStyle={styles.inputContent}
          />
          <TextInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            mode="outlined"
            secureTextEntry={!showPassword}
            right={
              <TextInput.Icon
                icon={showPassword ? "eye-off" : "eye"}
                onPress={() => setShowPassword((v) => !v)}
              />
            }
            style={styles.input}
            contentStyle={styles.inputContent}
          />

          {error ? (
            <HelperText type="error" visible style={styles.errorText}>
              {error}
            </HelperText>
          ) : null}

          <Button
            mode="contained"
            onPress={handleLogin}
            loading={loading}
            disabled={loading}
            style={styles.button}
            contentStyle={styles.buttonContent}
            labelStyle={styles.buttonLabel}
          >
            Sign In
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logoArea: { alignItems: "center", marginBottom: 40 },
  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#1a56db",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    elevation: 4,
  },
  logoText: { color: "#fff", fontSize: 24, fontWeight: "800" },
  appName: { fontWeight: "700", color: "#1e293b" },
  tagline: { color: "#64748b", marginTop: 4 },
  card: { padding: 24, borderRadius: 20 },
  cardTitle: { fontWeight: "700", marginBottom: 20, color: "#1e293b" },
  input: { marginBottom: 12 },
  inputContent: { height: 52 },
  errorText: { marginBottom: 4 },
  button: { marginTop: 8, borderRadius: 12 },
  buttonContent: { paddingVertical: 10 },
  buttonLabel: { fontSize: 16, fontWeight: "600" },
});
