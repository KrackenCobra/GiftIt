import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, toneFor } from '../theme';
import { Icon, type IconName } from './Icon';

/* ---------- Text ---------- */

type Weight = 'regular' | 'medium' | 'semibold' | 'heading';
const FAMILY: Record<Weight, string> = { regular: fonts.body, medium: fonts.medium, semibold: fonts.semibold, heading: fonts.heading };

/** Text in the app's fonts. Custom fonts carry their own weight, so pick `weight` rather than fontWeight. */
export function T({ weight = 'regular', style, ...rest }: TextProps & { weight?: Weight }) {
  return <Text {...rest} style={[{ fontFamily: FAMILY[weight], color: colors.ink }, style]} />;
}

export function H1({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <T weight="heading" accessibilityRole="header" style={[s.h1, style]}>
      {children}
    </T>
  );
}

export function SectionLabel({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <T weight="semibold" style={[s.label, style]}>{children}</T>;
}

/* ---------- Layout ---------- */

/** Scrolling screen body with the canvas's 24px gutters and room for the status bar. */
export function Screen({ children, contentStyle, ...rest }: ScrollViewProps & { contentStyle?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[{ paddingHorizontal: 24, paddingTop: insets.top + 12, paddingBottom: 32 }, contentStyle]}
      keyboardShouldPersistTaps="handled"
      {...rest}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style, onPress, accessibilityLabel }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; accessibilityLabel?: string }) {
  if (!onPress) return <View style={[s.card, style]}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [s.card, style, pressed && { opacity: 0.85 }]}>
      {children}
    </Pressable>
  );
}

/* ---------- Buttons ---------- */

type ButtonKind = 'primary' | 'secondary' | 'dark';

export function Button(props: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  icon?: IconName;
  busy?: boolean;
  disabled?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const kind = props.kind ?? 'primary';
  const fg = kind === 'secondary' ? colors.ink : '#FFFFFF';
  const off = !!props.disabled || !!props.busy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy: !!props.busy }}
      onPress={props.onPress}
      disabled={off}
      style={({ pressed }) => [
        s.btn,
        { height: props.height ?? 54 },
        kind === 'primary' && { backgroundColor: pressed ? colors.accentPressed : colors.accent },
        kind === 'secondary' && s.btnSecondary,
        kind === 'dark' && { backgroundColor: colors.ink },
        (pressed && kind !== 'primary') || props.disabled ? { opacity: 0.6 } : null,
        props.style,
      ]}
    >
      {props.busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {props.icon ? <Icon name={props.icon} size={20} color={fg} /> : null}
          <T weight="semibold" style={{ color: fg, fontSize: (props.height ?? 54) <= 44 ? 14 : kind === 'secondary' ? 16 : 17 }}>{props.title}</T>
        </>
      )}
    </Pressable>
  );
}

/** "‹ Family" style back link used on stack screens instead of a native header. */
export function BackLink({ label, onPress, light }: { label: string; onPress: () => void; light?: boolean }) {
  return (
    <Pressable accessibilityRole="link" accessibilityLabel={`Back to ${label}`} onPress={onPress} hitSlop={8} style={{ alignSelf: 'flex-start', paddingVertical: 8 }}>
      <T style={{ fontSize: 15, color: light ? '#CFC9DA' : colors.ink2 }}>‹ {label}</T>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.iconBtn, { backgroundColor: pressed ? colors.accentPressed : colors.accent }]}
    >
      <Icon name={icon} size={22} color="#FFFFFF" strokeWidth={2.2} />
    </Pressable>
  );
}

/* ---------- Inputs ---------- */

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>{label}</SectionLabel>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={[s.input, style]} {...rest} />
    </View>
  );
}

/** Pill toggle. 36px tall as drawn, with hit slop so the touch target is still 44px. */
export function Chip(props: { label: string; selected?: boolean; onPress?: () => void; small?: boolean; role?: 'button' | 'radio' }) {
  const on = !!props.selected;
  return (
    <Pressable
      accessibilityRole={props.role ?? 'button'}
      accessibilityState={props.role === 'radio' ? { checked: on } : { selected: on }}
      onPress={props.onPress}
      hitSlop={props.small ? 7 : 4}
      style={[s.chip, props.small && s.chipSmall, on && { backgroundColor: colors.ink, borderColor: colors.ink }]}
    >
      <T weight={props.small ? 'semibold' : 'regular'} style={{ color: on ? '#FFFFFF' : colors.ink, fontSize: props.small ? 12 : 14 }}>
        {props.label}
      </T>
    </Pressable>
  );
}

/** Full-width radio row ("Only me · Default"). */
export function RadioRow({ label, hint, checked, onPress }: { label: string; hint?: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={hint ? `${label}, ${hint}` : label}
      onPress={onPress}
      style={[s.radioRow, checked ? { borderColor: colors.accent, backgroundColor: colors.accentSoft } : null]}
    >
      <View style={[s.radioDot, checked ? { borderWidth: 6, borderColor: colors.accent } : null]} />
      <T style={{ flex: 1, fontSize: 15 }}>{label}</T>
      {hint ? <T style={{ fontSize: 12, color: colors.muted }}>{hint}</T> : null}
    </Pressable>
  );
}

/* ---------- Status ---------- */

/** Teal = security/privacy; amber = warnings. Icon defaults to a lock or a warning sign. */
export function Notice(props: { tone: 'safe' | 'warn'; icon?: IconName | null; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const safe = props.tone === 'safe';
  const fg = safe ? colors.safe : colors.warn;
  const icon = props.icon === undefined ? (safe ? 'lock' : 'warning') : props.icon;
  return (
    <View accessibilityRole={safe ? undefined : 'alert'} style={[s.notice, { backgroundColor: safe ? colors.safeSoft : colors.warnSoft }, props.style]}>
      {icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <T style={{ flex: 1, color: fg, fontSize: 13, lineHeight: 18 }}>{props.children}</T>
    </View>
  );
}

/** Small teal line: "Matched on your phone…" */
export function SafeNote({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
      <Icon name="lock" size={14} color={colors.safe} strokeWidth={2.2} />
      <T style={{ flex: 1, fontSize: 12, color: colors.safe }}>{children}</T>
    </View>
  );
}

export function Badge({ label, bg, fg }: { label: string; bg: string; fg: string }) {
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: bg }}>
      <T weight="medium" style={{ fontSize: 12, color: fg }}>{label}</T>
    </View>
  );
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const i = parts.length > 1 ? parts[0]![0]! + parts[parts.length - 1]![0]! : (parts[0] ?? '?').slice(0, 1);
  return i.toUpperCase();
}

export function Avatar({ name, size = 34, ring }: { name: string; size?: number; ring?: boolean }) {
  const t = toneFor(name);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: t.bg,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: colors.card,
      }}
    >
      <T weight="semibold" style={{ color: t.fg, fontSize: size >= 50 ? 18 : 12 }}>{initials(name)}</T>
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 30, color: colors.ink },
  label: { fontSize: 13, color: colors.ink2 },
  input: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  btn: { borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, flexDirection: 'row', gap: 10 },
  btnSecondary: { borderWidth: 1.5, borderColor: colors.lineStrong, backgroundColor: 'transparent' },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  notice: { borderRadius: radius.md, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    backgroundColor: colors.card,
    justifyContent: 'center',
  },
  chipSmall: { height: 30, paddingHorizontal: 10 },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.card,
  },
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.radioOff },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: 14 },
});
