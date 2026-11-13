import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Notice, s } from '../components/ui';
import { colors } from '../theme';
import { listMyFavorites, type Favorite } from '../services/items';

export function FavoritesScreen() {
  const nav = useNavigation<any>();
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems((await listMyFavorites()).filter((f) => f.category !== 'wishlist'));
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <View style={[s.screen, { paddingHorizontal: 24, paddingTop: 60 }]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={s.h1}>My favorites</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add a favorite"
          onPress={() => nav.navigate('AddFavorite')}
          style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}
        >
          <Text style={{ color: '#fff', fontSize: 26, lineHeight: 28 }}>+</Text>
        </Pressable>
      </View>
      <View style={{ marginTop: 14 }}>
        <Notice tone="safe">Encrypted on this phone. Only people you choose can see an item.</Notice>
      </View>
      <FlatList
        style={{ marginTop: 12 }}
        data={items}
        keyExtractor={(i) => i.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        ListEmptyComponent={!loading ? <Text style={{ color: colors.muted, marginTop: 24 }}>Add your first favorite: a color, a flower, your coffee order…</Text> : null}
        renderItem={({ item }) => (
          <View style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 12, color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 }}>{item.category}</Text>
              <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink, marginTop: 2 }}>{item.value}</Text>
              {item.note ? <Text style={{ fontSize: 13, color: colors.ink2, marginTop: 2 }}>{item.note}</Text> : null}
            </View>
            <Text style={{ fontSize: 12, color: item.scope === 'private' ? colors.ink2 : colors.safe }}>
              {item.scope === 'private' ? 'Only me' : 'Shared'}
            </Text>
          </View>
        )}
      />
    </View>
  );
}
