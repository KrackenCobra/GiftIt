import React, { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Avatar, BackLink, Button, Card, Chip, H1, Notice, SafeNote, Screen, SectionLabel, T } from '../components/ui';
import { Icon } from '../components/Icon';
import { colors, swatchFor } from '../theme';
import type { Budget } from '../crypto/tags';
import { listSharedBy, NotVerifiedError, type Favorite } from '../services/items';
import { confirmSafetyNumber, safetyNumberWith } from '../services/circles';
import { getGiftIdeas, type Product } from '../services/suggestions';
import { friendWishlist } from '../services/wishlist';
import type { FriendProps } from '../navigation';

const BUDGETS: { id: Budget; label: string; a11y: string }[] = [
  { id: 'under-25', label: '<$25', a11y: 'Under $25' },
  { id: '25-75', label: '$25–75', a11y: '$25 to $75' },
  { id: '75-plus', label: '$75+', a11y: 'Over $75' },
];

/** "color:teal" → { category: 'color', value: 'teal' } */
function splitTag(tag: string) {
  const [category = '', value = ''] = tag.split(':');
  return { category, value };
}

export function FriendScreen({ route, navigation }: FriendProps) {
  const { userId, name } = route.params;
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [wishCount, setWishCount] = useState(0);
  const [budget, setBudget] = useState<Budget>('25-75');
  const [ideas, setIdeas] = useState<Product[]>([]);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    let f: Favorite[];
    let wish: unknown[];
    try {
      [f, wish] = await Promise.all([listSharedBy(userId), friendWishlist(userId)]);
    } catch (e) {
      if (e instanceof NotVerifiedError) return setNeedsVerify(true);
      throw e;
    } finally {
      setLoaded(true);
    }
    setNeedsVerify(false);
    const nonWish = f.filter((x) => x.category !== 'wishlist');
    setFavs(nonWish);
    setWishCount(wish.length);
    // Matching runs on this phone; only allow-listed tags, budget and occasion leave it.
    setIdeas(await getGiftIdeas(nonWish.map((x) => ({ category: x.category, value: x.value })), budget, 'birthday').catch(() => []));
  }, [userId, budget]);
  useFocusEffect(useCallback(() => void load(), [load]));

  async function verify() {
    try {
      const { number, theirIdentity } = await safetyNumberWith(userId);
      const ok = await new Promise<boolean>((resolve) =>
        Alert.alert(`Verify ${name}`, `Compare this with the number on ${name}'s phone, in person or on a call you started:\n\n${number}`, [
          { text: "Doesn't match", style: 'destructive', onPress: () => resolve(false) },
          { text: 'Matches', onPress: () => resolve(true) },
        ]),
      );
      if (!ok) return;
      await confirmSafetyNumber(userId, theirIdentity);
      await load();
    } catch (e) {
      Alert.alert('Could not verify', e instanceof Error ? e.message : 'Please try again');
    }
  }

  const header = (
    <>
      <BackLink label="Gifts" onPress={() => navigation.goBack()} />
      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={name} size={56} />
        <View style={{ flex: 1 }}>
          <H1 style={{ fontSize: 26 }}>{name}</H1>
          {loaded && !needsVerify ? (
            <T weight="medium" style={{ marginTop: 2, fontSize: 14, color: colors.accentInk }}>
              {favs.length === 0 ? 'Nothing shared with you yet' : `Shares ${favs.length} ${favs.length === 1 ? 'favorite' : 'favorites'} with you`}
            </T>
          ) : null}
        </View>
      </View>
    </>
  );

  if (needsVerify) {
    return (
      <Screen contentStyle={{ gap: 14 }}>
        {header}
        <Notice tone="warn">Before you see {name}'s items, compare safety numbers so you know nobody is impersonating them.</Notice>
        <Button title={`Verify ${name}`} onPress={verify} />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}

      {favs.length > 0 ? (
        <>
          <SectionLabel style={{ marginTop: 16 }}>Shared with you</SectionLabel>
          <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {favs.map((f) => (
              <View
                key={f.id}
                accessibilityLabel={`${f.category}: ${f.value}${f.note ? `. ${f.note}` : ''}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 32, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line }}
              >
                <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: swatchFor(f.category, f.value) }} />
                <T style={{ fontSize: 13 }}>{f.value}</T>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => navigation.navigate('FriendWishlist', { userId, name })}
        style={({ pressed }) => [
          { marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14, borderRadius: 12, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line },
          pressed && { opacity: 0.85 },
        ]}
      >
        <T weight="semibold" style={{ fontSize: 15 }}>
          {name}'s wishlist · {wishCount} {wishCount === 1 ? 'link' : 'links'}
        </T>
        <Icon name="chevron" size={18} color={colors.muted} />
      </Pressable>

      <View style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <SectionLabel>Gift ideas</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 6 }} accessibilityRole="radiogroup" accessibilityLabel="Budget">
          {BUDGETS.map((b) => (
            <Chip key={b.id} role="radio" small label={b.label} selected={b.id === budget} onPress={() => setBudget(b.id)} />
          ))}
        </View>
      </View>

      <View style={{ marginTop: 10, gap: 10 }}>
        {ideas.length === 0 ? (
          <T style={{ color: colors.muted, fontSize: 14 }}>
            {favs.length === 0 ? `Ideas appear once ${name} shares a few favorites with you.` : 'No ideas in this budget yet. Try another range.'}
          </T>
        ) : null}
        {ideas.map((p, i) => {
          const first = splitTag(p.matchedTags[0] ?? '');
          return (
            <Card key={`${p.url}-${i}`} onPress={() => void WebBrowser.openBrowserAsync(p.url)} accessibilityLabel={`${p.title}, ${p.priceText} at ${p.retailer}`} style={{ flexDirection: 'row', gap: 12, padding: 12 }}>
              <View style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: swatchFor(first.category, first.value) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T weight="semibold" style={{ fontSize: 15 }} numberOfLines={2}>{p.title}</T>
                {p.matchedTags.length ? (
                  <T style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>Matches: {p.matchedTags.map((t) => splitTag(t).value).join(', ')}</T>
                ) : null}
                <T style={{ fontSize: 12, color: colors.ink2, marginTop: 6 }}>{p.priceText} · {p.retailer}</T>
              </View>
            </Card>
          );
        })}
      </View>

      <View style={{ marginTop: 10 }}>
        <SafeNote>Matched on your phone. Stores only see anonymous tags. GiftIt may earn a commission.</SafeNote>
      </View>

      <Button title={`Plan a surprise for ${name}`} height={52} style={{ marginTop: 16 }} onPress={() => navigation.navigate('Surprise', { userId, name })} />
    </Screen>
  );
}
