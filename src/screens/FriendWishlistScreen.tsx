import React, { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BackLink, Card, H1, Notice, Screen, T } from '../components/ui';
import { Icon } from '../components/Icon';
import { colors, swatchFor } from '../theme';
import { displayDomain } from '../crypto/links';
import { NotVerifiedError } from '../services/items';
import { claimItem, friendWishlist, openProductLink, unclaimItem, type FriendWishlistItem } from '../services/wishlist';
import type { StackProps } from '../navigation';

export function FriendWishlistScreen({ route, navigation }: StackProps<'FriendWishlist'>) {
  const { userId, name } = route.params;
  const [items, setItems] = useState<FriendWishlistItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await friendWishlist(userId));
    } catch (e) {
      if (e instanceof NotVerifiedError) navigation.goBack(); // the profile handles verification
      else throw e;
    }
  }, [userId, navigation]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const toggle = (it: FriendWishlistItem) => async () => {
    setBusyId(it.id);
    try {
      if (it.claimedByMe) await unclaimItem(it.id);
      else await claimItem(it.id);
      await load();
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusyId(null);
    }
  };

  const open = (url?: string) => () => {
    if (url) openProductLink(url).catch((e) => Alert.alert("Can't open this link", e instanceof Error ? e.message : ''));
  };

  return (
    <Screen>
      <BackLink label={name} onPress={() => navigation.goBack()} />
      <H1 style={{ marginTop: 6 }}>{name}'s wishlist</H1>
      <Notice tone="safe" icon="eyeOff" style={{ marginTop: 12, alignItems: 'flex-start' }}>
        {name} can't see who's getting what. Claims are only visible to their circle.
      </Notice>

      <View style={{ marginTop: 16, gap: 10 }}>
        {items.length === 0 ? <T style={{ color: colors.muted }}>{name} hasn't shared any wishlist links with you yet.</T> : null}
        {items.map((it) => {
          const other = it.claimedBySomeone && !it.claimedByMe;
          const label = other ? 'Someone is getting this' : it.claimedByMe ? "You're getting this · undo" : "I'll get this";
          return (
            <Card key={it.id} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: swatchFor('wishlist', it.value) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Pressable accessibilityRole="link" accessibilityHint="Opens in your browser" onPress={open(it.url)}>
                  <T weight="semibold" style={{ fontSize: 15 }}>{it.value}</T>
                  {it.url ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                      <Icon name="external" size={12} color={colors.accent} strokeWidth={2.4} />
                      <T style={{ fontSize: 13, color: colors.accent }}>{displayDomain(it.url)}</T>
                    </View>
                  ) : null}
                  {it.note ? <T style={{ fontSize: 12, color: colors.ink2, marginTop: 4 }}>{it.note}</T> : null}
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: other, busy: busyId === it.id }}
                  disabled={other || busyId === it.id}
                  onPress={toggle(it)}
                  style={{
                    marginTop: 10,
                    alignSelf: 'flex-start',
                    height: 38,
                    paddingHorizontal: 14,
                    borderRadius: 10,
                    justifyContent: 'center',
                    backgroundColor: other ? colors.neutralSoft : it.claimedByMe ? colors.safeSoft : colors.accent,
                    borderWidth: it.claimedByMe ? 1.5 : 0,
                    borderColor: colors.safe,
                    opacity: busyId === it.id ? 0.6 : 1,
                  }}
                >
                  <T weight="semibold" style={{ fontSize: 14, color: other ? colors.neutralInk : it.claimedByMe ? colors.safe : '#FFFFFF' }}>{label}</T>
                </Pressable>
              </View>
            </Card>
          );
        })}
      </View>

      <View style={{ marginTop: 24, padding: 14, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.lineStrong }}>
        <T weight="semibold" style={{ fontSize: 14 }}>On your own wishlist</T>
        <T style={{ marginTop: 2, fontSize: 13, color: colors.ink2, lineHeight: 19 }}>
          Paste any https product link. Tracking codes are removed, the link is encrypted, and you choose which circle sees it.
        </T>
        <Pressable accessibilityRole="link" onPress={() => navigation.navigate('MyWishlist')} hitSlop={8} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
          <T weight="semibold" style={{ fontSize: 14, color: colors.accent }}>Open my wishlist ›</T>
        </Pressable>
      </View>
    </Screen>
  );
}
