import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { RadioRow, SectionLabel } from './ui';
import { listMyCircles, type CircleSummary } from '../services/circles';
import type { Scope } from '../services/items';

function peopleCount(c: CircleSummary) {
  const n = c.members.filter((m) => !m.pending).length;
  return `${n} ${n === 1 ? 'person' : 'people'}`;
}

/** Visibility picker. Defaults to "Only me". */
export function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  const [circles, setCircles] = useState<CircleSummary[]>([]);
  useEffect(() => {
    listMyCircles().then(setCircles).catch(() => setCircles([]));
  }, []);
  return (
    <View style={{ gap: 8 }}>
      <SectionLabel>Who can see it</SectionLabel>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup" accessibilityLabel="Visibility">
        <RadioRow label="Only me" hint="Default" checked={value.type === 'private'} onPress={() => onChange({ type: 'private' })} />
        {circles.map((c) => (
          <RadioRow
            key={c.id}
            label={c.name}
            hint={peopleCount(c)}
            checked={value.type === 'circle' && value.circleId === c.id}
            onPress={() => onChange({ type: 'circle', circleId: c.id })}
          />
        ))}
      </View>
    </View>
  );
}
