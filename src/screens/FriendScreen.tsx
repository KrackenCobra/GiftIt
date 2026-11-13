import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { Chip, Notice, s } from '../components/ui';
import { colors } from '../theme';
import { displayDomain } from '../crypto/links';
import type { Budget } from '../crypto/tags';
import { listSharedBy, type Favorite } from '../services/items';
import { getGiftIdeas, type Product } from '../services/suggestions';
import { claimItem, friendWishlist, openProductLink, unclaimItem, type FriendWishlistItem } from '../services/wishlist';

const BUDGETS: { id: Budget; label: string }[] = [
  { id: 'under-25', label: 'Under $25' },
  { id: '25-75', label: '$25–75' },
  { id: '75-plus', label: '$75+' },
];

export function FriendScreen() {
  const { userId, name } = useRoute<any>().params as { userId: string; name: string };
  const [favs, setFavs] = useState<Favorite[]>([]);
  const [wish, setWish] = useState<FriendWishlistItem[]>([]);
  const [budget, setBudget] = useState<Budget>('25-75');
  const [ideas, setIdeas] = useState<Product[]>([]);

  const load = useCallback(async () => {
    const [f, w] = await Promise.all([listSharedBy(userId), friendWishlist(userId)]);
    const nonWish = f.filter((x) => x.category !== 'wishlist');
    setFavs(nonWish);
    setWish(w);
    setIdeas(await getGiftIdeas(nonWish.map((x) => ({ category: x.category, value: x.value })), budget, 'birthday').catch(() => []));
  }, [userId, budget]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const toggleClaim = (it: FriendWishlistItem) => async () => {
    try {
      if (it.claimedByMe) await unclaimItem(it.id);
      else await claimItem(it.id);
      await load();
    } catch (e) {
      Alert.alert('Could not update', e instanceof Error ? e.message : 'Please try again');
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 24, gap: 14 }}>
      <Text style={s.h1}>{name}</Text>

      <Text style={s.label}>Shared with you</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {favs.map((f) => (
          <View key={f.id} style={[s.card, { paddingVertical: 8 }]}>
            <Text style={{ fontSize: 11, color: colors.muted, textTransform: 'uppercase' }}>{f.category}</Text>
            <Text style={{ color: colors.ink, fontWeight: '600' }}>{f.value}</Text>
            {f.note ? <Text style={{ color: colors.ink2, fontSize: 12 }}>{f.note}</Text> : null}
          </View>
        ))}
      </View>

      {wish.length > 0 && (
        <>
          <Text style={[s.label, { marginTop: 8 }]}>{name}'s wishlist</Text>
          {wish.map((it) => (
            <View key={it.id} style={[s.card, { gap: 6 }]}>
              <Pressable accessibilityRole="link" onPress={() => it.url && openProductLink(it.url)}>
                <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{it.value}</Text>
                {it.url ? <Text style={{ fontSize: 13, color: colors.accent }}>{displayDomain(it.url)}</Text> : null}
                {it.note ? <Text style={{ fontSize: 13, color: colors.ink2 }}>{it.note}</Text> : null}
              </Pressable>
              <Pressable accessibilityRole="button" onPress={toggleClaim(it)} disabled={it.claimedBySomeone && !it.claimedByMe} style={{ paddingVertical: 8 }}>
                <Text style={{ fontWeight: '600', color: it.claimedByMe ? colors.safe : it.claimedBySomeone ? colors.muted : colors.accent }}>
                  {it.claimedByMe ? "You're getting this · undo" : it.claimedBySomeone ? 'Someone is getting this' : "I'll get this"}
                </Text>
              </Pressable>
            </View>
          ))}
        </>
      )}

      <Text style={[s.label, { marginTop: 8 }]}>Gift ideas</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {BUDGETS.map((b) => (
          <Chip key={b.id} label={b.label} selected={b.id === budget} onPress={() => setBudget(b.id)} />
        ))}
      </View>
      {ideas.map((p, i) => (
        <Pressable key={i} accessibilityRole="link" style={s.card} onPress={() => WebBrowser.openBrowserAsync(p.url)}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: colors.ink }}>{p.title}</Text>
          <Text style={{ fontSize: 12, color: colors.muted }}>{p.priceText} · {p.retailer}</Text>
        </Pressable>
      ))}
      <Notice tone="safe">Matched on your phone. Stores only see anonymous tags like "color:teal". GiftIt may earn a commission on purchases.</Notice>
    </ScrollView>
  );
}
