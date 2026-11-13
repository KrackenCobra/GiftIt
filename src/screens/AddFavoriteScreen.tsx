import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Chip, Field, Notice, s } from '../components/ui';
import { ScopePicker } from '../components/ScopePicker';
import { CATEGORIES, saveFavorite, type Category, type Scope } from '../services/items';

const PICKABLE = CATEGORIES.filter((c) => c !== 'wishlist');

export function AddFavoriteScreen() {
  const nav = useNavigation();
  const [category, setCategory] = useState<Category>('color');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [scope, setScope] = useState<Scope>({ type: 'private' });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await saveFavorite(category, { value, note }, scope);
      nav.goBack();
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 24, gap: 18 }} keyboardShouldPersistTaps="handled">
      <View style={{ gap: 8 }}>
        <Text style={s.label}>Category</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PICKABLE.map((c) => (
            <Chip key={c} label={c[0]!.toUpperCase() + c.slice(1)} selected={c === category} onPress={() => setCategory(c)} />
          ))}
        </View>
      </View>
      <Field label="Your favorite" value={value} onChangeText={setValue} maxLength={120} />
      <Field label="Note for gift-givers (optional)" value={note} onChangeText={setNote} maxLength={280} />
      <Notice tone="warn">Don't use anything you share here as a security-question answer for your bank or email.</Notice>
      <ScopePicker value={scope} onChange={setScope} />
      <Button title="Encrypt and save" busy={busy} disabled={!value.trim()} onPress={save} />
    </ScrollView>
  );
}
