import { useState } from 'react';
import type { Scenario } from '../types';
import ScenarioList from './ScenarioList';
import ScenarioEditor from './ScenarioEditor';

type View = { name: 'list' } | { name: 'editor'; scenario?: Scenario };

export default function App() {
  const [view, setView] = useState<View>({ name: 'list' });

  if (view.name === 'editor') {
    return (
      <ScenarioEditor
        initial={view.scenario}
        onSave={() => setView({ name: 'list' })}
        onCancel={() => setView({ name: 'list' })}
      />
    );
  }

  return (
    <ScenarioList
      onNew={() => setView({ name: 'editor' })}
      onEdit={(s) => setView({ name: 'editor', scenario: s })}
    />
  );
}
