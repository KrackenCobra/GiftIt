import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

type Person = { userId: string; name: string };

/** Gifts tab: the people list and each friend's profile, so the tab bar stays visible on the profile. */
export type GiftsStackParamList = {
  GiftsHome: undefined;
  Friend: Person;
};

export type TabParamList = {
  Favorites: undefined;
  Circles: undefined;
  Gifts: NavigatorScreenParams<GiftsStackParamList> | undefined;
  Settings: undefined;
};

/** Full-screen routes above the tabs; they use back links instead of the tab bar. */
export type RootStackParamList = {
  Main: NavigatorScreenParams<TabParamList> | undefined;
  AddFavorite: undefined;
  FriendWishlist: Person;
  Surprise: Person;
  MyWishlist: undefined;
};

export type StackProps<K extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, K>;

export type FriendProps = CompositeScreenProps<
  NativeStackScreenProps<GiftsStackParamList, 'Friend'>,
  CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Gifts'>, NativeStackScreenProps<RootStackParamList>>
>;

/** Open a friend's profile from anywhere: switches to the Gifts tab with the people list underneath. */
export const friendRoute = (p: Person) => ['Main', { screen: 'Gifts', params: { screen: 'Friend', params: p, initial: false } }] as const;
