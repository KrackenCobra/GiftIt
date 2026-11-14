import React, { useCallback, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Card, H1, IconButton, Notice, T, s } from '../components/ui';
import { colors, swatchFor, toneFor } from '../theme';
import { listMyFavorites, type Favorite } from '../services/items';
import { listMyCircles } from '../services/circles';
import type { RootStackParamList } from '../navigation';

const CATEGORY_LABEL: Record<string, string> = { size: 'Size', genre: 'Books & films' };
const label = (c: string) => CATEGORY_LABEL[c] ?? c[0]!.toUpperCase() + c.slice(1);

export function FavoritesScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Favorite[]>([]);
  const [circleNames, setCircleNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [favs, circles] = await Promise.all([listMyFavorites(), listMyCircles().catch(() => [])]);
      setItems(favs.filter((f) => f.category !== 'wishlist'));
      setCircleNames(Object.fromEntries(circles.map((c) => [c.id, c.name])));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <View style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <View style={{ paddingHorizontal: 24, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <H1>My favorites</H1>
        <IconButton icon="plus" label="Add a favorite" onPress={() => nav.navigate('AddFavorite')} />
      </View>
      <Notice tone="safe" style={{ marginHorizontal: 24, marginTop: 14 }}>
        Encrypted on this phone. Only people you choose can see an item.
      </Notice>
      <FlatList
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24, gap: 10 }}
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          !loading ? <T style={{ color: colors.muted, marginTop: 24 }}>Add your first favorite: a color, a flower, your coffee order…</T> : null
        }
        renderItem={({ item }) => {
          const circle = item.circleId ? circleNames[item.circleId] : undefined;
          const badge = item.scope === 'private' ? { label: 'Private', bg: colors.neutralSoft, fg: colors.ink2 } : { label: circle ?? 'Shared', ...toneFor(circle ?? 'Shared') };
          return (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: swatchFor(item.category, item.value) }} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.7 }}>{label(item.category)}</T>
                <T weight="semibold" style={{ fontSize: 16, marginTop: 2 }} numberOfLines={2}>{item.value}</T>
                {item.note ? <T style={{ fontSize: 13, color: colors.ink2, marginTop: 2 }} numberOfLines={2}>{item.note}</T> : null}
              </View>
              <Badge label={badge.label} bg={badge.bg} fg={badge.fg} />
            </Card>
          );
        }}
      />
    </View>
  );
}
