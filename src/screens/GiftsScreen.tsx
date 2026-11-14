import React, { useCallback, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Avatar, Card, H1, Screen, T } from '../components/ui';
import { Icon } from '../components/Icon';
import { colors } from '../theme';
import { listFriends } from '../services/circles';
import type { GiftsStackParamList } from '../navigation';

/** Gifts tab: everyone whose circle you're in. Each opens their profile, the hub for gifting. */
export function GiftsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<GiftsStackParamList>>();
  const [friends, setFriends] = useState<{ userId: string; displayName: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFriends(await listFriends());
    } finally {
      setLoading(false);
    }
  }, []);
  useFocusEffect(useCallback(() => void load(), [load]));

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <H1>Gifts</H1>
      <T style={{ marginTop: 6, fontSize: 15, color: colors.ink2 }}>People who share their favorites with you.</T>
      <View style={{ marginTop: 18, gap: 10 }}>
        {friends.length === 0 && !loading ? (
          <T style={{ color: colors.muted }}>No one yet. When someone adds you to their circle, they'll show up here.</T>
        ) : null}
        {friends.map((f) => {
          const name = f.displayName ?? 'Friend';
          return (
            <Card
              key={f.userId}
              onPress={() => nav.navigate('Friend', { userId: f.userId, name })}
              accessibilityLabel={`${name}, gift ideas and wishlist`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}
            >
              <Avatar name={name} size={44} />
              <T weight="semibold" style={{ flex: 1, fontSize: 16 }}>{name}</T>
              <Icon name="chevron" size={18} color={colors.muted} />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
