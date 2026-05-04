import { useEffect, useRef, useState } from 'react';
import type { Scenario } from '../types';
import { getDraft, getPickTarget, clearPickTarget, savePickTarget } from '../storage';
import ScenarioList from './ScenarioList';
import ScenarioEditor from './ScenarioEditor';

type View = { name: 'list' } | { name: 'editor'; scenario?: Scenario };

export default function App() {
  const [view, setView] = useState<View | null>(null);
  // stepIndex → selector, fed into ScenarioEditor via pickedSelector prop
  const [pickedSelector, setPickedSelector] = useState<{ stepIndex: number; selector: string } | null>(null);
  const pickingStepRef = useRef<number | null>(null);

  useEffect(() => {
    // Restore draft or pick result on popup open
    Promise.all([getDraft(), getPickTarget()]).then(([draft, pick]) => {
      if (pick) {
        clearPickTarget();
        setPickedSelector({ stepIndex: pick.stepIndex, selector: pick.selector });
      }
      if (draft) {
        setView({ name: 'editor', scenario: draft.scenario });
      } else {
        setView({ name: 'list' });
      }
    });
  }, []);

  useEffect(() => {
    // Listen for PICK_COMPLETE coming back from background while popup is open
    const handler = (message: { type: string; selector?: string }) => {
      if (message.type === 'PICK_COMPLETE' && message.selector != null && pickingStepRef.current != null) {
        const result = { stepIndex: pickingStepRef.current, selector: message.selector };
        savePickTarget(result);
        setPickedSelector(result);
        pickingStepRef.current = null;
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function handleStartPick(stepIndex: number) {
    pickingStepRef.current = stepIndex;
    // Save which step is waiting for a pick so we can restore it if popup closes
    await savePickTarget({ stepIndex, selector: '' });
    chrome.runtime.sendMessage({ type: 'START_PICK_MODE' }).catch(() => {});
  }

  if (!view) return null;

  if (view.name === 'editor') {
    return (
      <ScenarioEditor
        initial={view.scenario}
        pickedSelector={pickedSelector}
        onPickedSelectorConsumed={() => setPickedSelector(null)}
        onStartPick={handleStartPick}
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
