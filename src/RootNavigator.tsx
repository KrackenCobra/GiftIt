import React from 'react';
import { DefaultTheme, NavigationContainer, type InitialState } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { colors, fonts } from './theme';
import { Icon, type IconName } from './components/Icon';
import type { GiftsStackParamList, RootStackParamList, TabParamList } from './navigation';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { AddFavoriteScreen } from './screens/AddFavoriteScreen';
import { CirclesScreen } from './screens/CirclesScreen';
import { GiftsScreen } from './screens/GiftsScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { FriendScreen } from './screens/FriendScreen';
import { FriendWishlistScreen } from './screens/FriendWishlistScreen';
import { SurpriseScreen } from './screens/SurpriseScreen';
import { WishlistScreen } from './screens/WishlistScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();
const Gifts = createNativeStackNavigator<GiftsStackParamList>();

function GiftsTab() {
  return (
    <Gifts.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Gifts.Screen name="GiftsHome" component={GiftsScreen} />
      <Gifts.Screen name="Friend" component={FriendScreen} />
    </Gifts.Navigator>
  );
}

const TAB_ICONS: Record<keyof TabParamList, IconName> = { Favorites: 'heart', Circles: 'people', Gifts: 'giftbox', Settings: 'settings' };

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.accent } };

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.line },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11 },
        tabBarIcon: ({ color }) => <Icon name={TAB_ICONS[route.name]} size={24} color={color} />,
      })}
    >
      <Tabs.Screen name="Favorites" component={FavoritesScreen} />
      <Tabs.Screen name="Circles" component={CirclesScreen} />
      <Tabs.Screen name="Gifts" component={GiftsTab} />
      <Tabs.Screen name="Settings" component={SettingsScreen} />
    </Tabs.Navigator>
  );
}

/**
 * Signed-in app: 4 tabs (Favorites, Circles, Gifts, Settings) plus stack screens with back links.
 * Friend profile is the hub: wishlist and surprise plan both branch from it.
 */
export function RootNavigator({ initialState }: { initialState?: InitialState }) {
  return (
    <NavigationContainer theme={navTheme} initialState={initialState}>
      <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="AddFavorite" component={AddFavoriteScreen} options={{ presentation: 'modal' }} />
        <Stack.Screen name="FriendWishlist" component={FriendWishlistScreen} />
        <Stack.Screen name="Surprise" component={SurpriseScreen} />
        <Stack.Screen name="MyWishlist" component={WishlistScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
