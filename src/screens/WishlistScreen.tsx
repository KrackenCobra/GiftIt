import React, { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { BackLink, Badge, Button, Card, Field, H1, Notice, Screen, T } from '../components/ui';
import { ScopePicker } from '../components/ScopePicker';
import { Icon } from '../components/Icon';
import { colors, swatchFor } from '../theme';
import { displayDomain } from '../crypto/links';
import type { Favorite, Scope } from '../services/items';
import { addWishlistItem, myWishlist, openProductLink } from '../services/wishlist';

/** Your own wishlist. Reached from Settings and from a friend's wishlist. */
export function WishlistScreen() {
  const nav = useNavigation();
  const [items, setItems] = useState<Favorite[]>([]);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [note, setNote] = useState('');
  const [scope, setScope] = useState<Scope>({ type: 'private' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setItems(await myWishlist()), []);
  useFocusEffect(useCallback(() => void load(), [load]));

  async function save() {
    setBusy(true);
    try {
      await addWishlistItem({ name, url, note }, scope); // sanitizes the link before encrypting
      setName('');
      setUrl('');
      setNote('');
      setAdding(false);
      await load();
    } catch (e) {
      Alert.alert('Could not add', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {nav.canGoBack() ? <BackLink label="Back" onPress={() => nav.goBack()} /> : null}
      <H1 style={{ marginTop: 6 }}>My wishlist</H1>
      <Notice tone="safe" style={{ marginTop: 12, alignItems: 'flex-start' }}>
        Links are encrypted. People in your circle can mark an item "I'll get this". You won't see who, so it stays a surprise.
      </Notice>

      <View style={{ marginTop: 16, gap: 10 }}>
        {items.map((it) => (
          <Card
            key={it.id}
            onPress={() => it.url && openProductLink(it.url).catch((e) => Alert.alert("Can't open this link", e instanceof Error ? e.message : ''))}
            style={{ flexDirection: 'row', gap: 12 }}
          >
            <View style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: swatchFor('wishlist', it.value) }} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T weight="semibold" style={{ fontSize: 15 }}>{it.value}</T>
              {it.url ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                  <Icon name="external" size={12} color={colors.accent} strokeWidth={2.4} />
                  <T style={{ fontSize: 13, color: colors.accent }}>{displayDomain(it.url)}</T>
                </View>
              ) : null}
              {it.note ? <T style={{ fontSize: 12, color: colors.ink2, marginTop: 4 }}>{it.note}</T> : null}
            </View>
            <View style={{ alignSelf: 'flex-start' }}>
              {it.scope === 'private' ? <Badge label="Private" bg={colors.neutralSoft} fg={colors.ink2} /> : <Badge label="Shared" bg={colors.safeSoft} fg={colors.safe} />}
            </View>
          </Card>
        ))}
      </View>

      {adding ? (
        <View style={{ marginTop: 20, gap: 14 }}>
          <Field label="What is it?" value={name} onChangeText={setName} maxLength={120} />
          <Field label="Product link (https)" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Field label="Size, color, notes (optional)" value={note} onChangeText={setNote} maxLength={280} />
          <T style={{ fontSize: 12, color: colors.muted }}>Tracking codes are removed from links before saving.</T>
          <ScopePicker value={scope} onChange={setScope} />
          <Button title="Encrypt and add" icon="lock" busy={busy} disabled={!name.trim() || !url.trim()} onPress={save} />
          <Button kind="secondary" title="Cancel" onPress={() => setAdding(false)} />
        </View>
      ) : (
        <Button title="Add a product link" icon="plus" style={{ marginTop: 20 }} onPress={() => setAdding(true)} />
      )}
    </Screen>
  );
}
