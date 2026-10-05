import React, { useRef, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';

const PRODUCTION_URL = 'https://web-production-48670.up.railway.app/login';

export default function App() {
  const webViewRef = useRef(null);
  const [loading, setLoading]         = useState(true);
  const [canGoBack, setCanGoBack]     = useState(false);

  // Android back button: navigate within WebView instead of exiting
  const handleAndroidBack = useCallback(() => {
    if (Platform.OS === 'android' && canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
      return true; // event consumed — do not close app
    }
    return false;  // default behaviour (exit / go to previous app)
  }, [canGoBack]);

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', handleAndroidBack);
    return () => sub.remove();
  }, [handleAndroidBack]);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      <WebView
        ref={webViewRef}
        source={{ uri: PRODUCTION_URL }}
        style={s.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={()  => setLoading(false)}
        onNavigationStateChange={(state) => setCanGoBack(state.canGoBack)}
        // Allow the WebView to use cookies and session storage so login persists
        sharedCookiesEnabled
        domStorageEnabled
        javaScriptEnabled
        // Allow the site to open links in the same WebView
        setSupportMultipleWindows={false}
      />

      {loading && (
        <View style={s.loader}>
          <ActivityIndicator size="large" color="#1A3A5C" />
        </View>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  webview:   { flex: 1 },
  loader: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
