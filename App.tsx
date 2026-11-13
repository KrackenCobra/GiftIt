import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { initCrypto } from './src/crypto';
import { AppLock } from './src/lib/appLock';
import { colors } from './src/theme';
import { SignInScreen } from './src/screens/SignInScreen';
import { FavoritesScreen } from './src/screens/FavoritesScreen';
import { AddFavoriteScreen } from './src/screens/AddFavoriteScreen';
import { WishlistScreen } from './src/screens/WishlistScreen';
import { CirclesScreen } from './src/screens/CirclesScreen';
import { FriendScreen } from './src/screens/FriendScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tabs.Navigator screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.accent }}>
      <Tabs.Screen name="Favorites" component={FavoritesScreen} />
      <Tabs.Screen name="Wishlist" component={WishlistScreen} />
      <Tabs.Screen name="Circles" component={CirclesScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    // Crypto must be ready before the Supabase client (its session storage is encrypted).
    initCrypto()
      .then(async () => {
        const { supabase } = await import('./src/lib/supabase');
        const { enrollThisDevice } = await import('./src/services/auth');
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          const r = await enrollThisDevice('My phone').catch(() => null);
          setSignedIn(r?.status === 'ready');
        }
      })
      .finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <AppLock>
      <StatusBar style="dark" />
      {signedIn ? (
        <NavigationContainer>
          <Stack.Navigator>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="AddFavorite" component={AddFavoriteScreen} options={{ title: 'New favorite', presentation: 'modal' }} />
            <Stack.Screen name="Friend" component={FriendScreen} options={{ title: '' }} />
          </Stack.Navigator>
        </NavigationContainer>
      ) : (
        <SignInScreen onReady={() => setSignedIn(true)} />
      )}
    </AppLock>
  );
}
