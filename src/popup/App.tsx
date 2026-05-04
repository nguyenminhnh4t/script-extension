import { useEffect, useState } from 'react';
import type { Scenario } from '../types';
import { getDraft } from '../storage';
import ScenarioList from './ScenarioList';
import ScenarioEditor from './ScenarioEditor';

type View = { name: 'list' } | { name: 'editor'; scenario?: Scenario };

export default function App() {
  const [view, setView] = useState<View | null>(null);

  useEffect(() => {
    getDraft().then((draft) => {
      if (draft) {
        setView({ name: 'editor', scenario: draft.scenario });
      } else {
        setView({ name: 'list' });
      }
    });
  }, []);

  if (!view) return null;

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
