import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const APP_URL = "https://web-production-48670.up.railway.app/login";

export default function App() {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" backgroundColor="#ffffff" />
      {failed ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>Condofy</Text>
          <Text style={styles.title}>Não foi possível abrir o sistema</Text>
          <Text style={styles.body}>
            O app tentou carregar o sistema dentro da tela nativa, mas o conteúdo não respondeu.
          </Text>
          <Pressable style={styles.button} onPress={() => setFailed(false)}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </Pressable>
        </View>
      ) : (
        <>
          {loading ? (
            <View style={styles.loader}>
              <ActivityIndicator size="large" color="#2563eb" />
            </View>
          ) : null}
          <WebView
            source={{ uri: APP_URL }}
            style={styles.webview}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={() => setFailed(true)}
            onHttpError={() => setFailed(true)}
            javaScriptEnabled
            domStorageEnabled
            startInLoadingState
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff"
  },
  webview: {
    flex: 1
  },
  loader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    zIndex: 10
  },
  card: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#ffffff"
  },
  kicker: {
    color: "#2563eb",
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    marginBottom: 10
  },
  title: {
    color: "#0f172a",
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
    marginBottom: 12
  },
  body: {
    color: "#475569",
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 22
  },
  button: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center"
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700"
  }
});
