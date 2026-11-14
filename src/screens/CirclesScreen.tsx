import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, Share, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import QRCode from 'react-native-qrcode-svg';
import { Avatar, Button, Card, Chip, Field, H1, Notice, Screen, SectionLabel, T } from '../components/ui';
import { Icon } from '../components/Icon';
import { colors, radius } from '../theme';
import {
  approveMember,
  confirmSafetyNumber,
  createCircle,
  createInvite,
  declineRequest,
  listMyCircles,
  redeemInvite,
  removeMemberAndRotate,
  safetyNumberWith,
  type CircleSummary,
} from '../services/circles';
import { friendRoute, type RootStackParamList } from '../navigation';

const INVITE_TTL_MS = 24 * 60 * 60 * 1000; // enforced server-side; mirrored here for the countdown

function ask(title: string, body: string, yes: string, no: string, destructive = false) {
  return new Promise<boolean>((resolve) =>
    Alert.alert(title, body, [
      { text: no, style: destructive ? 'cancel' : 'destructive', onPress: () => resolve(false) },
      { text: yes, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ]),
  );
}

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function CirclesScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [inviteLink, setInviteLink] = useState('');

  const load = useCallback(async () => setCircles(await listMyCircles()), []);
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
  const verifyAndApprove = (circleId: string, userId: string, name: string) =>
    guard(async () => {
      const { number, theirIdentity } = await safetyNumberWith(userId);
      const ok = await ask(
        `Verify ${name}`,
        `Ask ${name} to open GiftIt and read their safety number. It must match exactly:\n\n${number}\n\nOnly approve in person or on a call you started.`,
        'Matches, approve',
        "Doesn't match",
      );
      if (!ok) return;
      await confirmSafetyNumber(userId, theirIdentity);
      await approveMember(circleId, userId);
    });

  const requests = circles.flatMap((c) => c.members.filter((m) => m.pending).map((m) => ({ circle: c, member: m })));

  return (
    <Screen>
      <H1>Circles</H1>

      <View style={{ marginTop: 18, gap: 10 }}>
        {circles.length === 0 ? (
          <T style={{ color: colors.muted }}>Make a circle for the people you'd share with: Family, Close friends…</T>
        ) : null}
        {circles.map((c) => {
          const approved = c.members.filter((m) => !m.pending);
          const expanded = open === c.id;
          return (
            <Card key={c.id} style={{ padding: 0 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                accessibilityLabel={`${c.name}, ${plural(approved.length, 'person', 'people')}`}
                onPress={() => setOpen(expanded ? null : c.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 }}
              >
                <View style={{ flexDirection: 'row', width: 34 + Math.max(0, Math.min(approved.length, 3) - 1) * 26 }}>
                  {approved.length === 0 ? (
                    <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong }} />
                  ) : (
                    approved.slice(0, 3).map((m, i) => (
                      <View key={m.userId} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                        <Avatar name={m.displayName ?? '?'} ring />
                      </View>
                    ))
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <T weight="semibold" style={{ fontSize: 16 }}>{c.name}</T>
                  <T style={{ fontSize: 13, color: colors.muted, marginTop: 2 }}>{plural(approved.length, 'person', 'people')}</T>
                </View>
                <View style={{ transform: [{ rotate: expanded ? '90deg' : '0deg' }] }}>
                  <Icon name="chevron" size={18} color={colors.muted} />
                </View>
              </Pressable>

              {expanded ? (
                <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingHorizontal: 14, paddingVertical: 4 }}>
                  {approved.length === 0 ? <T style={{ color: colors.muted, paddingVertical: 12 }}>No one yet. Invite someone below.</T> : null}
                  {approved.map((m) => {
                    const name = m.displayName ?? 'Someone';
                    return (
                      <View key={m.userId} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 }}>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => nav.navigate(...friendRoute({ userId: m.userId, name }))}
                          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 }}
                        >
                          <Avatar name={name} size={30} />
                          <T style={{ fontSize: 15 }}>{name}</T>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${name} from ${c.name}`}
                          hitSlop={8}
                          style={{ padding: 8 }}
                          onPress={guard(async () => {
                            const yes = await ask(
                              `Remove ${name}?`,
                              "They lose access to this circle and its key is replaced. Anything they already saw can't be taken back.",
                              'Remove',
                              'Cancel',
                              true,
                            );
                            if (yes) await removeMemberAndRotate(c.id, m.userId);
                          })}
                        >
                          <T style={{ color: colors.muted, fontSize: 14 }}>Remove</T>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : null}
            </Card>
          );
        })}
      </View>

      {requests.map(({ circle, member }) => {
        const name = member.displayName ?? 'Someone';
        return (
          <View key={`${circle.id}:${member.userId}`} style={{ marginTop: 16, padding: 14, borderRadius: radius.lg, backgroundColor: colors.warnSoft, borderWidth: 1, borderColor: colors.warnLine }}>
            <T weight="semibold" style={{ fontSize: 15, color: colors.warn }}>Request to join {circle.name}</T>
            <T style={{ fontSize: 13, color: colors.warn, marginTop: 4, lineHeight: 19 }}>
              {name} used your invite. Check their safety number in person or on a call before approving.
            </T>
            <View style={{ marginTop: 10, flexDirection: 'row', gap: 8 }}>
              <Button kind="dark" title="Verify & approve" height={44} style={{ flex: 1 }} onPress={verifyAndApprove(circle.id, member.userId, name)} />
              <Pressable
                accessibilityRole="button"
                onPress={guard(() => declineRequest(circle.id, member.userId))}
                style={{ height: 44, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.warnButtonLine, justifyContent: 'center' }}
              >
                <T weight="semibold" style={{ color: colors.warn, fontSize: 14 }}>Decline</T>
              </Pressable>
            </View>
          </View>
        );
      })}

      {circles.length > 0 ? <InviteCard circles={circles} /> : null}

      <View style={{ marginTop: 28, gap: 12 }}>
        <Field label="New circle" value={newName} onChangeText={setNewName} maxLength={40} placeholder="Family, Close friends…" />
        <Button kind="secondary" title="Create circle" disabled={!newName.trim()} onPress={guard(async () => { await createCircle(newName); setNewName(''); })} />
      </View>

      <View style={{ marginTop: 24, gap: 12 }}>
        <Field label="Got an invite link?" value={inviteLink} onChangeText={setInviteLink} autoCapitalize="none" autoCorrect={false} placeholder="giftit://invite/…" />
        <Button
          kind="secondary"
          title="Ask to join"
          disabled={!inviteLink.trim()}
          onPress={guard(async () => {
            await redeemInvite(inviteLink.trim());
            setInviteLink('');
            Alert.alert('Request sent', 'You can see their items once they check your safety number and approve you.');
          })}
        />
      </View>
    </Screen>
  );
}

/** One-time invite shown as a QR code. The link lives only in this component's state. */
function InviteCard({ circles }: { circles: CircleSummary[] }) {
  const [circleId, setCircleId] = useState(circles[0]!.id);
  const [made, setInvite] = useState<{ link: string; expires: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const circle = circles.find((c) => c.id === circleId) ?? circles[0]!;

  useEffect(() => {
    if (!made) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [made]);

  const left = made ? made.expires - now : 0;
  const invite = left > 0 ? made : null; // an expired invite disappears on the next tick
  const mins = Math.ceil(left / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const remaining = h === 0 ? `${m} m` : m === 0 ? `${h} h` : `${h} h ${m} m`;

  async function make() {
    setBusy(true);
    try {
      const link = await createInvite(circle.id);
      setInvite({ link, expires: Date.now() + INVITE_TTL_MS });
      setNow(Date.now());
    } catch (e) {
      Alert.alert('Could not create invite', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card style={{ marginTop: 16, padding: 18, gap: 12 }}>
      {circles.length > 1 ? (
        <View style={{ gap: 8 }}>
          <SectionLabel>Invite to</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
            {circles.map((c) => (
              <Chip key={c.id} role="radio" small label={c.name} selected={c.id === circle.id} onPress={() => { setCircleId(c.id); setInvite(null); }} />
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={invite ? `Invite QR code for ${circle.name}` : 'No invite yet'}
          style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: invite ? colors.card : colors.neutralSoft }}
        >
          {invite ? <QRCode value={invite.link} size={96} color={colors.ink} backgroundColor={colors.card} ecl="M" /> : <Icon name="lock" size={28} color={colors.muted} />}
        </View>
        <View style={{ flex: 1 }}>
          <T weight="semibold" style={{ fontSize: 16 }}>Invite to {circle.name}</T>
          <T style={{ fontSize: 13, color: colors.ink2, marginTop: 4, lineHeight: 19 }}>
            {invite
              ? `Works once. Expires in ${remaining}. Show it in person or send the one-time link.`
              : 'Each invite works once and expires within 24 hours.'}
          </T>
          {invite ? (
            <Button
              kind="secondary"
              title="Share link"
              height={40}
              style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14 }}
              onPress={() => void Share.share({ message: `Join my ${circle.name} circle on GiftIt (works once, expires in 24 hours): ${invite.link}` })}
            />
          ) : (
            <Button kind="secondary" title="Create invite" height={40} busy={busy} style={{ marginTop: 10, alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 14 }} onPress={make} />
          )}
        </View>
      </View>
      <Notice tone="safe">Nobody can find you by searching. People only join with an invite, and you approve each one.</Notice>
    </Card>
  );
}
