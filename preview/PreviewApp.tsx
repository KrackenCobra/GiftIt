/**
 * Browser preview of the real screens with sample data (`npm run preview`).
 * Pick a screen with ?screen=<name>; on a wide window it renders inside a 390×844 phone frame.
 * metro.config.js only swaps this in for web bundles started with EXPO_PUBLIC_PREVIEW=1.
 */
import React from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import type { InitialState } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { APP_FONTS } from '../src/theme/fontAssets';
import { colors } from '../src/theme';
import { RootNavigator } from '../src/RootNavigator';
import { SignInScreen } from '../src/screens/SignInScreen';
import { SessionContext } from '../src/lib/session';
import { MOM } from './data';

const mom = { userId: MOM, name: 'Mom' };
const tab = (name: string) => ({ name: 'Main', state: { routes: [{ name }] } });
const friendTab = { name: 'Main', state: { index: 0, routes: [{ name: 'Gifts', state: { index: 1, routes: [{ name: 'GiftsHome' }, { name: 'Friend', params: { userId: MOM, name: 'Mom' } }] } }] } };
const stack = (...routes: object[]) => ({ routes }) as unknown as InitialState;

export const SCREENS: Record<string, { label: string; state?: InitialState }> = {
  welcome: { label: '1 · Welcome' },
  favorites: { label: '2 · My favorites', state: stack(tab('Favorites')) },
  add: { label: '3 · Add a favorite', state: stack(tab('Favorites'), { name: 'AddFavorite' }) },
  circles: { label: '4 · Circles', state: stack(tab('Circles')) },
  friend: { label: '5 · Friend profile', state: stack(friendTab) },
  surprise: { label: '6 · Surprise plan', state: stack(friendTab, { name: 'Surprise', params: mom }) },
  wishlist: { label: '7 · Friend wishlist', state: stack(friendTab, { name: 'FriendWishlist', params: mom }) },
  gifts: { label: 'Gifts tab', state: stack(tab('Gifts')) },
  settings: { label: 'Settings', state: stack(tab('Settings')) },
  mywishlist: { label: 'My wishlist', state: stack(tab('Settings'), { name: 'MyWishlist' }) },
};

function current(): string {
  const q = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('screen') : null;
  return q && SCREENS[q] ? q : 'welcome';
}

export default function PreviewApp() {
  const [fontsLoaded] = useFonts(APP_FONTS);
  const { width } = useWindowDimensions();
  const key = current();
  if (!fontsLoaded) return null;

  const app = (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, bottom: 34, left: 0, right: 0 } }}>
      <SessionContext.Provider value={{ onSignedOut: () => go('welcome') }}>
        {key === 'welcome' ? <SignInScreen onReady={() => go('favorites')} /> : <RootNavigator initialState={SCREENS[key]!.state} />}
      </SessionContext.Provider>
    </SafeAreaProvider>
  );

  if (width < 600) return <View style={{ flex: 1 }}>{app}</View>;

  return (
    <View style={{ flex: 1, flexDirection: 'row', gap: 32, padding: 32, backgroundColor: '#E9E4DC', justifyContent: 'center' }}>
      <View style={{ gap: 6, width: 200 }}>
        <Text style={{ fontWeight: '700', fontSize: 16, color: colors.ink, marginBottom: 8 }}>GiftIt preview</Text>
        <Text style={{ fontSize: 12, color: colors.ink2, marginBottom: 12 }}>Real screens, sample data. Nothing is saved or sent.</Text>
        {Object.entries(SCREENS).map(([k, v]) => (
          <Pressable key={k} accessibilityRole="link" onPress={() => go(k)}>
            <Text style={{ fontSize: 14, paddingVertical: 4, color: k === key ? colors.accent : colors.ink, fontWeight: k === key ? '700' : '400' }}>{v.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ width: 406, height: 860, borderRadius: 36, overflow: 'hidden', borderWidth: 8, borderColor: colors.ink, backgroundColor: colors.bg }}>{app}</View>
    </View>
  );
}

function go(screen: string) {
  window.location.search = `?screen=${screen}`;
}
