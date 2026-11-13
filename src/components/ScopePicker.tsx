import React, { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Chip, s } from './ui';
import { listMyCircles, type CircleSummary } from '../services/circles';
import type { Scope } from '../services/items';

/** Visibility picker. Defaults to "Only me". */
export function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  useEffect(() => {
    listMyCircles().then(setCircles).catch(() => setCircles([]));
  }, []);
  return (
    <View style={{ gap: 8 }}>
      <Text style={s.label}>Who can see it</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }} accessibilityRole="radiogroup">
        <Chip label="Only me" selected={value.type === 'private'} onPress={() => onChange({ type: 'private' })} />
        {circles.map((c) => (
          <Chip
            key={c.id}
            label={`${c.name} (${c.members.filter((m) => !m.pending).length})`}
            selected={value.type === 'circle' && value.circleId === c.id}
            onPress={() => onChange({ type: 'circle', circleId: c.id })}
          />
        ))}
      </View>
    </View>
  );
}
