import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackLink, Button, T } from '../components/ui';
import { Icon } from '../components/Icon';
import { dark, fonts, radius } from '../theme';
import { newStep, planFor, savePlan, type PlanStep } from '../services/plans';
import type { StackProps } from '../navigation';

/**
 * Surprise mode. Dark on purpose: everything here is encrypted to you only and never shared
 * with the person it's about or with any circle.
 */
export function SurpriseScreen({ route, navigation }: StackProps<'Surprise'>) {
  const { userId, name } = route.params;
  const insets = useSafeAreaInsets();
  const [planId, setPlanId] = useState<string | undefined>();
  const [steps, setSteps] = useState<PlanStep[]>([]);
  const [note, setNote] = useState('');
  const [draft, setDraft] = useState('');
  const [draftWhen, setDraftWhen] = useState('');
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const p = await planFor(userId);
      setPlanId(p?.id);
      setSteps(p?.steps ?? []);
      setNote(p?.note ?? '');
      setDirty(false);
    } catch (e) {
      Alert.alert('Could not open plan', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setLoading(false);
    }
  }, [userId]);
  useFocusEffect(useCallback(() => void load(), [load]));

  const change = (fn: () => void) => {
    fn();
    setDirty(true);
  };

  function addStep() {
    if (!draft.trim()) return;
    change(() => setSteps((s) => [...s, newStep(draft.trim(), draftWhen.trim() || undefined)]));
    setDraft('');
    setDraftWhen('');
  }

  async function save() {
    setBusy(true);
    try {
      setPlanId(await savePlan({ aboutUserId: userId, steps, note }, planId));
      setDirty(false);
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: dark.bg }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <BackLink label={name} light onPress={() => navigation.goBack()} />

        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="eyeOff" size={16} color={dark.alert} />
          <T weight="semibold" style={{ fontSize: 13, color: dark.alert }}>Surprise mode · {name} can never see this</T>
        </View>
        <T weight="heading" accessibilityRole="header" style={{ marginTop: 10, fontSize: 30, lineHeight: 35, color: dark.text }}>
          {name}'s surprise plan
        </T>
        <T style={{ marginTop: 6, fontSize: 14, color: dark.text2 }}>Encrypted to you only · not shared with any circle</T>

        {loading ? (
          <ActivityIndicator color={dark.text2} style={{ marginTop: 32 }} />
        ) : (
          <>
            <View style={{ marginTop: 22, gap: 10 }}>
              {steps.map((st) => (
                <Pressable
                  key={st.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: st.done }}
                  accessibilityHint="Long-press to remove"
                  onPress={() => change(() => setSteps((s) => s.map((x) => (x.id === st.id ? { ...x, done: !x.done } : x))))}
                  onLongPress={() =>
                    Alert.alert('Remove this step?', st.label, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => change(() => setSteps((s) => s.filter((x) => x.id !== st.id))) },
                    ])
                  }
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: dark.line, backgroundColor: dark.card }}
                >
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: st.done ? 0 : 2,
                      borderColor: dark.checkOff,
                      backgroundColor: st.done ? dark.checkOn : 'transparent',
                    }}
                  >
                    {st.done ? <Icon name="check" size={14} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                  <T style={{ flex: 1, fontSize: 15, color: dark.text, textDecorationLine: st.done ? 'line-through' : 'none' }}>{st.label}</T>
                  <T style={{ fontSize: 12, color: dark.muted }}>{st.done ? 'Done' : st.when ?? ''}</T>
                </Pressable>
              ))}

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  accessibilityLabel="New step"
                  placeholder={steps.length ? 'Add a step' : 'First step, e.g. Pick the gift'}
                  placeholderTextColor={dark.muted}
                  value={draft}
                  onChangeText={setDraft}
                  onSubmitEditing={addStep}
                  maxLength={120}
                  returnKeyType="done"
                  style={[inputStyle, { flex: 1, minWidth: 0 }]}
                />
                <TextInput
                  accessibilityLabel="When (optional)"
                  placeholder="When"
                  placeholderTextColor={dark.muted}
                  value={draftWhen}
                  onChangeText={setDraftWhen}
                  maxLength={20}
                  style={[inputStyle, { width: 76, minWidth: 0 }]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Add step"
                  onPress={addStep}
                  disabled={!draft.trim()}
                  style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: dark.card, borderWidth: 1, borderColor: dark.line, alignItems: 'center', justifyContent: 'center', opacity: draft.trim() ? 1 : 0.5 }}
                >
                  <Icon name="plus" size={20} color={dark.text} />
                </Pressable>
              </View>
            </View>

            <T weight="semibold" style={{ marginTop: 18, fontSize: 13, color: dark.text2 }}>Private note</T>
            <TextInput
              accessibilityLabel="Private note"
              placeholder="Ideas, who's helping, what to avoid…"
              placeholderTextColor={dark.muted}
              value={note}
              onChangeText={(t) => change(() => setNote(t))}
              multiline
              maxLength={2000}
              style={[inputStyle, { marginTop: 8, minHeight: 96, paddingTop: 14, lineHeight: 22, textAlignVertical: 'top', color: dark.textSoft }]}
            />

            {dirty ? (
              <Button title="Encrypt and save" icon="lock" busy={busy} onPress={save} style={{ marginTop: 24 }} />
            ) : (
              <View style={{ marginTop: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 54 }}>
                <Icon name="lock" size={16} color={dark.muted} />
                <T style={{ fontSize: 14, color: dark.muted }}>{planId ? 'Saved and encrypted to you' : 'Nothing saved yet'}</T>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const inputStyle = {
  minHeight: 48,
  paddingHorizontal: 14,
  borderRadius: radius.md + 2,
  borderWidth: 1,
  borderColor: dark.line,
  backgroundColor: dark.card,
  color: dark.text,
  fontFamily: fonts.body,
  fontSize: 15,
} as const;
