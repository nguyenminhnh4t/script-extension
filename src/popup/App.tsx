import { useEffect, useRef, useState } from 'react';
import type { Scenario } from '../types';
import { getDraft, getPickTarget, clearPickTarget } from '../storage';
import ScenarioList from './ScenarioList';
import ScenarioEditor from './ScenarioEditor';

type View = { name: 'list' } | { name: 'editor'; scenario?: Scenario };

export default function App() {
  const [view, setView] = useState<View | null>(null);
  // stepIndex → selector, fed into ScenarioEditor via pickedSelector prop
  const [pickedSelector, setPickedSelector] = useState<{ tabIndex: number; stepIndex: number; selector: string } | null>(null);
  const [recordedKey, setRecordedKey] = useState<{ tabIndex: number; stepIndex: number; key: string } | null>(null);
  const pickingTargetRef = useRef<{ tabIndex: number; stepIndex: number } | null>(null);
  const recordingTargetRef = useRef<{ tabIndex: number; stepIndex: number } | null>(null);

  useEffect(() => {
    // Restore draft or pick result on popup open
    Promise.all([getDraft(), getPickTarget()]).then(([draft, pick]) => {
      if (pick) {
        clearPickTarget();
        setPickedSelector({ tabIndex: pick.tabIndex, stepIndex: pick.stepIndex, selector: pick.selector });
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
    const handler = (message: unknown) => {
      if (!message || typeof message !== 'object') return;
      const msg = message as Record<string, unknown>;
      if (msg['type'] === 'PICK_COMPLETE' && typeof msg['selector'] === 'string' && pickingTargetRef.current) {
        setPickedSelector({ ...pickingTargetRef.current, selector: msg['selector'] });
        pickingTargetRef.current = null;
      }
      if (msg['type'] === 'RECORD_KEY_COMPLETE' && typeof msg['key'] === 'string' && recordingTargetRef.current) {
        setRecordedKey({ ...recordingTargetRef.current, key: msg['key'] });
        recordingTargetRef.current = null;
      }
    };
    chrome.runtime.onMessage.addListener(handler);
    return () => chrome.runtime.onMessage.removeListener(handler);
  }, []);

  async function handleStartPick(tabIndex: number, stepIndex: number) {
    pickingTargetRef.current = { tabIndex, stepIndex };
    const { savePickTarget } = await import('../storage');
    await savePickTarget({ tabIndex, stepIndex, selector: '' });
    chrome.runtime.sendMessage({ type: 'START_PICK_MODE' }).catch(() => {});
  }

  function handleStartRecordKey(tabIndex: number, stepIndex: number) {
    recordingTargetRef.current = { tabIndex, stepIndex };
    chrome.runtime.sendMessage({ type: 'START_RECORD_KEY' }).catch(() => {});
  }

  if (!view) return null;

  if (view.name === 'editor') {
    return (
      <ScenarioEditor
        initial={view.scenario}
        pickedSelector={pickedSelector}
        onPickedSelectorConsumed={() => setPickedSelector(null)}
        onStartPick={handleStartPick}
        recordedKey={recordedKey}
        onRecordedKeyConsumed={() => setRecordedKey(null)}
        onStartRecordKey={handleStartRecordKey}
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
