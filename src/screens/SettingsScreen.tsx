import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Button, H1, Notice, Screen, SectionLabel, T } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { colors, radius } from '../theme';
import { signOutAndWipe } from '../services/auth';
import { useSession } from '../lib/session';
import type { RootStackParamList } from '../navigation';

function Row({ icon, label, hint, onPress }: { icon: IconName; label: string; hint?: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14, backgroundColor: colors.card },
        pressed && { opacity: 0.85 },
      ]}
    >
      <Icon name={icon} size={22} color={colors.ink2} />
      <View style={{ flex: 1 }}>
        <T weight="semibold" style={{ fontSize: 15 }}>{label}</T>
        {hint ? <T style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>{hint}</T> : null}
      </View>
      <Icon name="chevron" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function SettingsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { onSignedOut } = useSession();
  const [busy, setBusy] = useState(false);

  function signOut() {
    Alert.alert(
      'Sign out of this phone?',
      "This phone's keys are erased. To get back in you'll need another signed-in phone or your recovery phrase.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await signOutAndWipe();
              onSignedOut();
            } catch (e) {
              Alert.alert('Could not sign out', e instanceof Error ? e.message : 'Please try again');
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  return (
    <Screen>
      <H1>Settings</H1>

      <SectionLabel style={{ marginTop: 20 }}>Your lists</SectionLabel>
      <View style={{ marginTop: 8, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, overflow: 'hidden' }}>
        <Row icon="giftbox" label="My wishlist" hint="Product links your circles can claim" onPress={() => nav.navigate('MyWishlist')} />
      </View>

      <SectionLabel style={{ marginTop: 24 }}>Privacy</SectionLabel>
      <View style={{ marginTop: 8, gap: 8 }}>
        <Notice tone="safe">Everything you add is encrypted on this phone before it's sent. GiftIt's servers only hold ciphertext.</Notice>
        <Notice tone="safe" icon="fingerprint">GiftIt locks with Face ID or your fingerprint after 5 minutes away.</Notice>
      </View>

      <Button kind="secondary" title="Sign out of this phone" busy={busy} style={{ marginTop: 32 }} onPress={signOut} />
    </Screen>
  );
}
