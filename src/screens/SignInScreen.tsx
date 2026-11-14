import React, { useState } from 'react';
import { Alert, View } from 'react-native';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { BackLink, Button, Card, Field, H1, Notice, Screen, T, s } from '../components/ui';
import { Icon, type IconName } from '../components/Icon';
import { colors, fonts } from '../theme';
import { enrollThisDevice, registerPasskey, restoreWithRecoveryPhrase, sendEmailCode, signInWithPasskey, verifyEmailCode, type EnrollResult } from '../services/auth';

type Step = 'start' | 'email' | 'code' | 'phrase' | 'pending' | 'restore';

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'lock', text: 'End-to-end encrypted. Not even GiftIt can read your favorites.' },
  { icon: 'people', text: 'Invite-only. No public profiles, no search.' },
  { icon: 'fingerprint', text: 'Sign in with a passkey. No passwords to steal.' },
];

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

  if (step === 'phrase') {
    // The new account's passkey is registered once the phrase is safely written down.
    return <RecoveryPhrase phrase={phrase} onDone={() => run(async () => { await registerPasskey().catch(() => undefined); setPhrase(''); onReady(); })} />;
  }

  return (
    <Screen contentStyle={{ paddingHorizontal: 28, flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 }}>
        <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="gift" size={24} color="#FFFFFF" />
        </View>
        <T weight="heading" style={{ fontSize: 26 }}>GiftIt</T>
      </View>

      {step === 'start' ? (
        <>
          <H1 style={{ marginTop: 56, fontSize: 38, lineHeight: 42 }}>Know exactly what they love.</H1>
          <T style={{ marginTop: 16, fontSize: 17, lineHeight: 25, color: colors.ink2 }}>
            Share your favorite colors, flowers and more with the people closest to you, and get gift ideas that fit them.
          </T>
          <View style={{ marginTop: 36, gap: 14 }}>
            {PROMISES.map((p) => (
              <View key={p.icon} style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <Icon name={p.icon} size={22} color={colors.safeIcon} />
                <T style={{ flex: 1, fontSize: 15, lineHeight: 22 }}>{p.text}</T>
              </View>
            ))}
          </View>
          <View style={{ flexGrow: 1, minHeight: 32 }} />
          <Button title="Create account with passkey" icon="key" height={56} onPress={() => setStep('email')} />
          <Button
            kind="secondary"
            title="I already have an account"
            height={52}
            busy={busy}
            style={{ marginTop: 12 }}
            onPress={() => run(async () => { await signInWithPasskey(); await afterAuth(); })}
          />
          <T style={{ marginTop: 18, textAlign: 'center', fontSize: 12, color: colors.muted }}>
            For adults 18+. By continuing you agree to the Terms and Privacy Policy.
          </T>
        </>
      ) : (
        <View style={{ marginTop: 40, gap: 14 }}>
          <BackLink label="Back" onPress={() => setStep('start')} />

          {step === 'email' && (
            <>
              <H1 style={{ fontSize: 28 }}>Create your account</H1>
              <T style={{ color: colors.ink2, fontSize: 15, lineHeight: 22 }}>
                We'll email you a code to confirm it's you. Then this phone creates your keys and a passkey. No password, ever.
              </T>
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
              <Button title="Send code" busy={busy} disabled={!email.includes('@')} onPress={() => run(async () => { await sendEmailCode(email); setStep('code'); })} />
              <T style={{ fontSize: 12, color: colors.muted }}>For adults 18+. We never use SMS codes or passwords.</T>
            </>
          )}

          {step === 'code' && (
            <>
              <H1 style={{ fontSize: 28 }}>Check your email</H1>
              <Field label="6-digit code" value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} autoComplete="one-time-code" />
              <Button title="Continue" busy={busy} disabled={code.length !== 6} onPress={() => run(async () => { await verifyEmailCode(email, code); await afterAuth(); })} />
            </>
          )}

          {step === 'pending' && (
            <>
              <H1 style={{ fontSize: 28 }}>Approve this phone</H1>
              <Notice tone="warn">
                This phone is new to your account. Open GiftIt on your other phone and approve it under Settings › Devices, or restore with your recovery phrase.
              </Notice>
              <Button title="I approved it" busy={busy} onPress={() => run(afterAuth)} />
              <Button kind="secondary" title="Use recovery phrase" onPress={() => setStep('restore')} />
            </>
          )}

          {step === 'restore' && (
            <>
              <H1 style={{ fontSize: 28 }}>Restore your account</H1>
              <Field
                label="24-word recovery phrase"
                value={phrase}
                onChangeText={setPhrase}
                autoCapitalize="none"
                autoCorrect={false}
                multiline
                style={[s.input, { height: 120, paddingTop: 12, textAlignVertical: 'top' }]}
              />
              <Button title="Restore" busy={busy} onPress={() => run(async () => { await restoreWithRecoveryPhrase(phrase); setPhrase(''); onReady(); })} />
            </>
          )}
        </View>
      )}
    </Screen>
  );
}

function RecoveryPhrase({ phrase, onDone }: { phrase: string; onDone: () => void }) {
  usePreventScreenCapture(); // no screenshots of the phrase (Android blocks; iOS hides in recordings)
  const words = phrase.split(' ');
  return (
    <Screen contentStyle={{ paddingHorizontal: 28, gap: 16 }}>
      <H1 style={{ marginTop: 24, fontSize: 28 }}>Write down your recovery phrase</H1>
      <Notice tone="warn">
        It's the only way back in if you lose every phone. GiftIt can't reset it. Write it on paper and keep it somewhere safe. Don't store it in photos or notes apps.
      </Notice>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {words.map((w, i) => (
          <Card key={i} style={{ paddingVertical: 8, paddingHorizontal: 10, width: '31%' }}>
            <T style={{ fontSize: 14 }}>
              <T style={{ color: colors.muted, fontFamily: fonts.body }}>{i + 1}. </T>
              {w}
            </T>
          </Card>
        ))}
      </View>
      <Button title="I wrote it down" onPress={onDone} />
    </Screen>
  );
}
