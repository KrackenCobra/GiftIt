import React, { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Button, Chip, Field, Notice, Screen, SectionLabel, T } from '../components/ui';
import { ScopePicker } from '../components/ScopePicker';
import { colors } from '../theme';
import { saveFavorite, type Category, type Scope } from '../services/items';

/** Order matches the design; Scent and Books & films also feed gift matching. */
const CATS: { id: Category; label: string }[] = [
  { id: 'color', label: 'Color' },
  { id: 'flower', label: 'Flower' },
  { id: 'food', label: 'Food' },
  { id: 'size', label: 'Size' },
  { id: 'brand', label: 'Brand' },
  { id: 'hobby', label: 'Hobby' },
  { id: 'scent', label: 'Scent' },
  { id: 'genre', label: 'Books & films' },
  { id: 'custom', label: 'Custom' },
];

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
    <Screen contentStyle={{ gap: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Pressable accessibilityRole="button" onPress={() => nav.goBack()} hitSlop={8} style={{ paddingVertical: 10, width: 64 }}>
          <T style={{ fontSize: 16, color: colors.ink2 }}>Cancel</T>
        </Pressable>
        <T weight="semibold" accessibilityRole="header" style={{ fontSize: 17 }}>New favorite</T>
        <View style={{ width: 64 }} />
      </View>

      <SectionLabel style={{ marginTop: 20 }}>Category</SectionLabel>
      <View style={{ marginTop: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {CATS.map((c) => (
          <Chip key={c.id} label={c.label} selected={c.id === category} onPress={() => setCategory(c.id)} />
        ))}
      </View>

      <View style={{ marginTop: 22, gap: 16 }}>
        <Field label="Your favorite" value={value} onChangeText={setValue} maxLength={120} placeholder="Peonies, pale pink" />
        <Field label="Note for gift-givers (optional)" value={note} onChangeText={setNote} maxLength={280} placeholder="Not roses, please" />
        <Notice tone="warn">Don't use anything you share here as a security-question answer for your bank or email.</Notice>
      </View>

      <View style={{ marginTop: 20 }}>
        <ScopePicker value={scope} onChange={setScope} />
      </View>

      <Button title="Encrypt and save" icon="lock" busy={busy} disabled={!value.trim()} onPress={save} style={{ marginTop: 28 }} />
    </Screen>
  );
}
