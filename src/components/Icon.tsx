import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

/** Stroke icons drawn for the GiftIt canvas. Decorative unless the parent labels them. */
export type IconName =
  | 'gift' | 'lock' | 'people' | 'fingerprint' | 'key' | 'plus' | 'heart' | 'giftbox' | 'settings'
  | 'chevron' | 'warning' | 'eyeOff' | 'external' | 'check' | 'bell';

export function Icon({ name, size = 24, color, strokeWidth = 2 }: { name: IconName; size?: number; color: string; strokeWidth?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {shapes(name, p)}
      </Svg>
    </View>
  );
}

function shapes(name: IconName, p: Record<string, unknown>) {
  switch (name) {
    case 'gift':
      return (<><Rect x={3} y={8} width={18} height={13} rx={2} {...p} /><Path d="M12 8v13M3 12h18M12 8c-2-4-6-4-6-1s6 1 6 1zm0 0c2-4 6-4 6-1s-6 1-6 1z" {...p} /></>);
    case 'giftbox':
      return (<><Rect x={3} y={8} width={18} height={13} rx={2} {...p} /><Path d="M12 8v13M3 12h18" {...p} /></>);
    case 'lock':
      return (<><Rect x={5} y={11} width={14} height={10} rx={2} {...p} /><Path d="M8 11V7a4 4 0 0 1 8 0v4" {...p} /></>);
    case 'people':
      return (<><Circle cx={9} cy={8} r={3.5} {...p} /><Circle cx={17} cy={9} r={2.5} {...p} /><Path d="M3 20c0-3.5 2.7-6 6-6s6 2.5 6 6M15 14.5c3 0 6 2 6 5.5" {...p} /></>);
    case 'fingerprint':
      return <Path d="M12 3a6 6 0 0 0-6 6v3M18 12V9a6 6 0 0 0-3-5.2M9 21v-6a3 3 0 0 1 6 0v6M12 15v6" {...p} />;
    case 'key':
      return (<><Circle cx={8} cy={15} r={4} {...p} /><Path d="M11 12l9-9M17 6l3 3M15 8l2 2" {...p} /></>);
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'heart':
      return <Path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" {...p} />;
    case 'settings':
      return (<><Circle cx={12} cy={12} r={3} {...p} /><Path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2" {...p} /></>);
    case 'chevron':
      return <Path d="M9 6l6 6-6 6" {...p} />;
    case 'warning':
      return <Path d="M12 3l9 16H3zM12 10v4M12 17v.5" {...p} />;
    case 'eyeOff':
      return <Path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM3 3l18 18" {...p} />;
    case 'external':
      return <Path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" {...p} />;
    case 'check':
      return <Path d="M5 12l5 5 9-10" {...p} />;
    case 'bell':
      return <Path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" {...p} />;
  }
}
