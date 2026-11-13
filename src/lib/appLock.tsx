import React, { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { Button } from '../components/ui';
import { colors } from '../theme';

const LOCK_AFTER_MS = 5 * 60 * 1000;

/**
 * Biometric app lock + privacy shield.
 * - Locks on launch and after 5 minutes in the background.
 * - Covers the screen whenever the app is inactive, so favorites never show in the app switcher.
 */
export function AppLock({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(true);
  const [shielded, setShielded] = useState(false);
  const leftAt = useRef<number | null>(null);

  async function unlock() {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Unlock GiftIt',
      disableDeviceFallback: false,
      cancelLabel: 'Cancel',
    });
    if (res.success) setLocked(false);
  }

  useEffect(() => {
    void unlock();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setShielded(false);
        if (leftAt.current && Date.now() - leftAt.current > LOCK_AFTER_MS) {
          setLocked(true);
          void unlock();
        }
        leftAt.current = null;
      } else {
        setShielded(true);
        leftAt.current ??= Date.now();
      }
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      {children}
      {(locked || shielded) && (
        <View style={[StyleSheet.absoluteFill, styles.cover]} accessibilityViewIsModal>
          <Text style={styles.brand}>GiftIt</Text>
          {locked && !shielded && <Button title="Unlock" onPress={unlock} />}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 },
  brand: { fontSize: 32, fontWeight: '700', color: colors.ink },
});
