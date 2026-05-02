import "react-native-url-polyfill/auto";
import "react-native-gesture-handler";
import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { PaperProvider, MD3LightTheme } from "react-native-paper";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "./src/context/AuthContext";
import AppNavigator from "./src/navigation/AppNavigator";

const theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: "#1a56db",
    primaryContainer: "#dbe4ff",
    secondary: "#6b7280",
    secondaryContainer: "#f3f4f6",
    background: "#f8fafc",
    surface: "#ffffff",
    surfaceVariant: "#f1f5f9",
    onSurfaceVariant: "#64748b",
  },
};

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <NavigationContainer>
          <AuthProvider>
            <AppNavigator />
          </AuthProvider>
        </NavigationContainer>
        <StatusBar style="auto" />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
