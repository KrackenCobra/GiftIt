import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { initCrypto } from './src/crypto';
import { AppLock } from './src/lib/appLock';
import { SessionContext } from './src/lib/session';
import { colors } from './src/theme';
import { APP_FONTS } from './src/theme/fontAssets';
import { RootNavigator } from './src/RootNavigator';
import { SignInScreen } from './src/screens/SignInScreen';

export default function App() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  // Fonts ship inside the app bundle; nothing is fetched at runtime.
  const [fontsLoaded] = useFonts(APP_FONTS);

  useEffect(() => {
    // Crypto must be ready before the Supabase client (its session storage is encrypted).
    initCrypto()
      .then(async () => {
        const { supabase } = await import('./src/lib/supabase');
        const { enrollThisDevice } = await import('./src/services/auth');
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const r = await enrollThisDevice('My phone').catch(() => null);
          setSignedIn(r?.status === 'ready');
        }
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready || !fontsLoaded) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AppLock>
        <StatusBar style="dark" />
        {signedIn ? (
          <SessionContext.Provider value={{ onSignedOut: () => setSignedIn(false) }}>
            <RootNavigator />
          </SessionContext.Provider>
        ) : (
          <SignInScreen onReady={() => setSignedIn(true)} />
        )}
      </AppLock>
    </SafeAreaProvider>
  );
}
