import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Button, Field, Notice, s } from '../components/ui';
import { colors } from '../theme';
import {
  approveMember,
  confirmSafetyNumber,
  createCircle,
  createInvite,
  listFriends,
  listMyCircles,
  redeemInvite,
  removeMemberAndRotate,
  safetyNumberWith,
  type CircleSummary,
} from '../services/circles';

export function CirclesScreen() {
  const nav = useNavigation<any>();
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [friends, setFriends] = useState<{ userId: string; displayName: string | null }[]>([]);
  const [newName, setNewName] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const load = useCallback(async () => {
    const [c, f] = await Promise.all([listMyCircles(), listFriends()]);
    setCircles(c);
    setFriends(f);
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  const guard = (fn: () => Promise<unknown>) => async () => {
    try {
      await fn();
      await load();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again');
    }
  };

  /** Approval requires both people to read the same safety number aloud first. */
  function verifyAndApprove(circleId: string, userId: string, name: string) {
    return guard(async () => {
      const { number, theirIdentity } = await safetyNumberWith(userId);
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert(
          `Verify ${name}`,
          `Ask ${name} to open GiftIt and read their safety number. It must match exactly:\n\n${number}\n\nOnly approve in person or on a call you started.`,
          [
            { text: "Doesn't match", style: 'destructive', onPress: () => resolve(false) },
            { text: 'Matches, approve', onPress: () => resolve(true) },
          ],
        ),
      );
      if (!ok) return;
      await confirmSafetyNumber(userId, theirIdentity);
      await approveMember(circleId, userId);
    });
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>Circles</Text>

      {circles.map((c) => (
        <View key={c.id} style={[s.card, { gap: 10 }]}>
          <Text style={{ fontSize: 17, fontWeight: '600', color: colors.ink }}>{c.name}</Text>
          {c.members.map((m) => {
            const name = m.displayName ?? 'Someone';
            return (
              <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ flex: 1, color: colors.ink2 }}>{name}{m.pending ? ' · waiting for you' : ''}</Text>
                {m.pending ? (
                  <Pressable accessibilityRole="button" onPress={verifyAndApprove(c.id, m.userId, name)} style={{ padding: 10 }}>
                    <Text style={{ color: colors.accent, fontWeight: '600' }}>Verify & approve</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    onPress={guard(async () => {
                      const yes = await new Promise<boolean>((r) =>
                        Alert.alert(`Remove ${name}?`, "They lose access to this circle and its key is replaced. Anything they already saw can't be taken back.", [
                          { text: 'Cancel', onPress: () => r(false) },
                          { text: 'Remove', style: 'destructive', onPress: () => r(true) },
                        ]),
                      );
                      if (yes) await removeMemberAndRotate(c.id, m.userId);
                    })}
                    style={{ padding: 10 }}
                  >
                    <Text style={{ color: colors.muted }}>Remove</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <Button
            kind="secondary"
            title="Invite someone"
            onPress={guard(async () => {
              const link = await createInvite(c.id);
              await Share.share({ message: `Join my ${c.name} circle on GiftIt (works once, expires in 24 hours): ${link}` });
            })}
          />
        </View>
      ))}

      <Field label="New circle name" value={newName} onChangeText={setNewName} maxLength={40} placeholder="Family, Close friends…" />
      <Button title="Create circle" disabled={!newName.trim()} onPress={guard(async () => { await createCircle(newName); setNewName(''); })} />

      <Text style={[s.label, { marginTop: 12 }]}>Their circles you're in</Text>
      {friends.length === 0 ? <Text style={{ color: colors.muted }}>No one yet.</Text> : null}
      {friends.map((f) => (
        <Pressable key={f.userId} accessibilityRole="button" style={s.card} onPress={() => nav.navigate('Friend', { userId: f.userId, name: f.displayName ?? 'Friend' })}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{f.displayName ?? 'Friend'}</Text>
        </Pressable>
      ))}

      <Field label="Got an invite link?" value={inviteLink} onChangeText={setInviteLink} autoCapitalize="none" autoCorrect={false} />
      <Button kind="secondary" title="Join" disabled={!inviteLink.trim()} onPress={guard(async () => { await redeemInvite(inviteLink.trim()); setInviteLink(''); Alert.alert('Request sent', 'You can see their items once they verify your safety number and approve you.'); })} />
      <Notice tone="safe">Invites work once and expire after 24 hours. Nobody can find you by searching.</Notice>
    </ScrollView>
  );
}
