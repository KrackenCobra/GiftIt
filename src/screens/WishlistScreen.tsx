import React, { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Field, Notice, s } from '../components/ui';
import { ScopePicker } from '../components/ScopePicker';
import { colors } from '../theme';
import { displayDomain } from '../crypto/links';
import type { Favorite, Scope } from '../services/items';
import { addWishlistItem, myWishlist, openProductLink } from '../services/wishlist';

export function WishlistScreen() {
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
      await addWishlistItem({ name, url, note }, scope);
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
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 24, paddingTop: 60, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>My wishlist</Text>
      <Notice tone="safe">Links are encrypted. People in your circle can mark an item "I'll get this". You won't see who, so it stays a surprise.</Notice>

      {items.map((it) => (
        <Pressable key={it.id} accessibilityRole="link" onPress={() => it.url && openProductLink(it.url)} style={s.card}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink }}>{it.value}</Text>
          {it.url ? <Text style={{ fontSize: 13, color: colors.accent, marginTop: 2 }}>{displayDomain(it.url)}</Text> : null}
          {it.note ? <Text style={{ fontSize: 13, color: colors.ink2, marginTop: 4 }}>{it.note}</Text> : null}
          <Text style={{ fontSize: 12, color: colors.muted, marginTop: 6 }}>{it.scope === 'private' ? 'Only me' : 'Shared with a circle'}</Text>
        </Pressable>
      ))}

      {adding ? (
        <View style={{ gap: 14 }}>
          <Field label="What is it?" value={name} onChangeText={setName} maxLength={120} />
          <Field label="Product link (https)" value={url} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url" />
          <Field label="Size, color, notes (optional)" value={note} onChangeText={setNote} maxLength={280} />
          <Text style={{ fontSize: 12, color: colors.muted }}>Tracking codes are removed from links before saving.</Text>
          <ScopePicker value={scope} onChange={setScope} />
          <Button title="Encrypt and add" busy={busy} disabled={!name.trim() || !url.trim()} onPress={save} />
          <Button kind="secondary" title="Cancel" onPress={() => setAdding(false)} />
        </View>
      ) : (
        <Button title="Add a product link" onPress={() => setAdding(true)} />
      )}
    </ScrollView>
  );
}
