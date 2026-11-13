import React, { useState } from 'react';
import { Alert, ScrollView, Text, View } from 'react-native';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { Button, Field, Notice, s } from '../components/ui';
import { colors } from '../theme';
import { enrollThisDevice, registerPasskey, restoreWithRecoveryPhrase, sendEmailCode, signInWithPasskey, verifyEmailCode, type EnrollResult } from '../services/auth';

type Step = 'start' | 'email' | 'code' | 'phrase' | 'pending' | 'restore';

export function SignInScreen({ onReady }: { onReady: () => void }) {
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phrase, setPhrase] = useState('');
  const [busy, setBusy] = useState(false);

  async function afterAuth() {
    const r: EnrollResult = await enrollThisDevice('My phone');
    if (r.status === 'ready') return onReady();
    if (r.status === 'first-device') {
      setPhrase(r.recoveryPhrase);
      return setStep('phrase');
    }
    setStep('pending');
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : 'Please try again');
    } finally {
      setBusy(false);
    }
  }

  if (step === 'phrase') return <RecoveryPhrase phrase={phrase} onDone={() => run(async () => { await registerPasskey().catch(() => undefined); setPhrase(''); onReady(); })} />;

  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 28, paddingTop: 80, gap: 16 }} keyboardShouldPersistTaps="handled">
      <Text style={s.h1}>GiftIt</Text>
      <Text style={{ fontSize: 17, color: colors.ink2, lineHeight: 25 }}>
        Share your favorites with the people closest to you, and get gift ideas that fit them.
      </Text>
      <Notice tone="safe">End-to-end encrypted. Invite-only. No public profiles.</Notice>

      {step === 'start' && (
        <View style={{ gap: 12, marginTop: 24 }}>
          <Button title="Sign in with passkey" busy={busy} onPress={() => run(async () => { await signInWithPasskey(); await afterAuth(); })} />
          <Button kind="secondary" title="New here? Use email to start" onPress={() => setStep('email')} />
        </View>
      )}

      {step === 'email' && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          <Button title="Send code" busy={busy} disabled={!email.includes('@')} onPress={() => run(async () => { await sendEmailCode(email); setStep('code'); })} />
          <Text style={{ fontSize: 12, color: colors.muted }}>For adults 18+. We never use SMS codes or passwords.</Text>
        </View>
      )}

      {step === 'code' && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
          <Button title="Continue" busy={busy} disabled={code.length !== 6} onPress={() => run(async () => { await verifyEmailCode(email, code); await afterAuth(); })} />
        </View>
      )}

      {step === 'pending' && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Notice tone="warn">
            This phone is new to your account. Open GiftIt on your other phone and approve it under Settings › Devices, or restore with your recovery phrase.
          </Notice>
          <Button title="I approved it" busy={busy} onPress={() => run(afterAuth)} />
          <Button kind="secondary" title="Use recovery phrase" onPress={() => setStep('restore')} />
        </View>
      )}

      {step === 'restore' && (
        <View style={{ gap: 12, marginTop: 12 }}>
          <Field label="24-word recovery phrase" value={phrase} onChangeText={setPhrase} autoCapitalize="none" autoCorrect={false} multiline style={[s.input, { height: 120, paddingTop: 12 }]} />
          <Button title="Restore" busy={busy} onPress={() => run(async () => { await restoreWithRecoveryPhrase(phrase); setPhrase(''); onReady(); })} />
        </View>
      )}
    </ScrollView>
  );
}

function RecoveryPhrase({ phrase, onDone }: { phrase: string; onDone: () => void }) {
  usePreventScreenCapture(); // no screenshots of the phrase (Android blocks; iOS hides in recordings)
  const words = phrase.split(' ');
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ padding: 28, paddingTop: 72, gap: 16 }}>
      <Text style={[s.h1, { fontSize: 26 }]}>Write down your recovery phrase</Text>
      <Notice tone="warn">
        It's the only way back in if you lose every phone. GiftIt can't reset it. Write it on paper and keep it somewhere safe. Don't store it in photos or notes apps.
      </Notice>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {words.map((w, i) => (
          <View key={i} style={[s.card, { paddingVertical: 8, paddingHorizontal: 10, width: '31%' }]}>
            <Text style={{ color: colors.ink, fontSize: 14 }}>
              <Text style={{ color: colors.muted }}>{i + 1}. </Text>
              {w}
            </Text>
          </View>
        ))}
      </View>
      <Button title="I wrote it down" onPress={onDone} />
    </ScrollView>
  );
}
