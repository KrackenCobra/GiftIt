import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, radius } from '../theme';

export function Button(props: { title: string; onPress: () => void; kind?: 'primary' | 'secondary'; busy?: boolean; disabled?: boolean }) {
  const primary = (props.kind ?? 'primary') === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!props.disabled || !!props.busy }}
      onPress={props.onPress}
      disabled={props.disabled || props.busy}
      style={({ pressed }) => [s.btn, primary ? s.btnPrimary : s.btnSecondary, (pressed || props.disabled) && { opacity: 0.7 }]}
    >
      {props.busy ? (
        <ActivityIndicator color={primary ? '#fff' : colors.ink} />
      ) : (
        <Text style={[s.btnText, { color: primary ? '#fff' : colors.ink }]}>{props.title}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={s.input} {...rest} />
    </View>
  );
}

export function Notice(props: { tone: 'safe' | 'warn'; children: React.ReactNode }) {
  const safe = props.tone === 'safe';
  return (
    <View style={[s.notice, { backgroundColor: safe ? colors.safeSoft : colors.warnSoft }]}>
      <Text style={{ color: safe ? colors.safe : colors.warn, fontSize: 13, lineHeight: 19 }}>{props.children}</Text>
    </View>
  );
}

export function Chip(props: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!props.selected }}
      onPress={props.onPress}
      style={[s.chip, props.selected ? { backgroundColor: colors.ink, borderColor: colors.ink } : null]}
    >
      <Text style={{ color: props.selected ? '#fff' : colors.ink, fontSize: 14 }}>{props.label}</Text>
    </Pressable>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 30, fontWeight: '700', color: colors.ink },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink2 },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    color: colors.ink,
  },
  btn: { height: 54, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  btnPrimary: { backgroundColor: colors.accent },
  btnSecondary: { borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: colors.card },
  btnText: { fontSize: 17, fontWeight: '600' },
  notice: { borderRadius: radius.md, padding: 12 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14 },
});
