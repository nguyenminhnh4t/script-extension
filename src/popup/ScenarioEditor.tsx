import { useEffect, useRef, useState } from 'react';
import type { Scenario, Step, StepType } from '../types';
import { saveScenario, saveDraft, clearDraft } from '../storage';

const STEP_TYPES: StepType[] = ['open_url', 'fill', 'click', 'select', 'wait', 'wait_for_element'];

function emptyStep(): Step {
  return { type: 'fill', selector: '', value: '' };
}

function newScenario(): Scenario {
  return {
    id: crypto.randomUUID(),
    name: '',
    startUrl: '',
    steps: [],
  };
}

interface Props {
  initial?: Scenario;
  pickedSelector?: { stepIndex: number; selector: string } | null;
  onPickedSelectorConsumed?: () => void;
  onStartPick?: (stepIndex: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

export default function ScenarioEditor({ initial, pickedSelector, onPickedSelectorConsumed, onStartPick, onSave, onCancel }: Props) {
  const [scenario, setScenario] = useState<Scenario>(initial ?? newScenario());
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Apply picked selector when popup reopens with a pick result
  useEffect(() => {
    if (!pickedSelector) return;
    updateStep(pickedSelector.stepIndex, { selector: pickedSelector.selector } as Partial<Step>);
    onPickedSelectorConsumed?.();
  }, [pickedSelector]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist draft to storage whenever scenario changes so popup restore works
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveDraft({ scenario, editingId: initial?.id });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [scenario, initial?.id]);

  function updateField<K extends keyof Scenario>(key: K, value: Scenario[K]) {
    setScenario((prev) => ({ ...prev, [key]: value }));
  }

  function updateStep(index: number, partial: Partial<Step>) {
    setScenario((prev) => {
      const steps = [...prev.steps];
      steps[index] = { ...steps[index], ...partial } as Step;
      return { ...prev, steps };
    });
  }

  function changeStepType(index: number, type: StepType) {
    const defaults: Record<StepType, Step> = {
      open_url: { type: 'open_url', url: '' },
      fill: { type: 'fill', selector: '', value: '' },
      click: { type: 'click', selector: '' },
      select: { type: 'select', selector: '', value: '' },
      wait: { type: 'wait', duration: 1000 },
      wait_for_element: { type: 'wait_for_element', selector: '', timeout: 10000 },
    };
    setScenario((prev) => {
      const steps = [...prev.steps];
      steps[index] = defaults[type];
      return { ...prev, steps };
    });
  }

  function addStep() {
    setScenario((prev) => ({ ...prev, steps: [...prev.steps, emptyStep()] }));
  }

  function removeStep(index: number) {
    setScenario((prev) => ({ ...prev, steps: prev.steps.filter((_, i) => i !== index) }));
  }

  function moveStep(index: number, direction: -1 | 1) {
    setScenario((prev) => {
      const steps = [...prev.steps];
      const target = index + direction;
      if (target < 0 || target >= steps.length) return prev;
      [steps[index], steps[target]] = [steps[target], steps[index]];
      return { ...prev, steps };
    });
  }

  async function handleSave() {
    if (!scenario.name.trim()) {
      setError('Scenario name is required');
      return;
    }
    await saveScenario(scenario);
    await clearDraft();
    onSave();
  }

  async function handleCancel() {
    await clearDraft();
    onCancel();
  }

  function selectorRow(value: string, onChange: (v: string) => void, stepIndex: number) {
    return (
      <div className="flex gap-1">
        <input
          className={inputCls}
          placeholder="CSS Selector"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          title="Pick element from page"
          onClick={() => onStartPick?.(stepIndex)}
          className="shrink-0 px-2 py-1 rounded bg-gray-700 hover:bg-blue-600 text-gray-300 hover:text-white text-xs transition-colors"
        >
          ⊕
        </button>
      </div>
    );
  }

  function stepFields(step: Step, index: number) {
    switch (step.type) {
      case 'open_url':
        return (
          <input
            className={inputCls}
            placeholder="URL"
            value={step.url}
            onChange={(e) => updateStep(index, { url: e.target.value })}
          />
        );
      case 'fill':
        return (
          <>
            {selectorRow(step.selector, (v) => updateStep(index, { selector: v }), index)}
            <input className={inputCls} placeholder="Value" value={step.value} onChange={(e) => updateStep(index, { value: e.target.value })} />
          </>
        );
      case 'click':
        return selectorRow(step.selector, (v) => updateStep(index, { selector: v }), index);
      case 'select':
        return (
          <>
            {selectorRow(step.selector, (v) => updateStep(index, { selector: v }), index)}
            <input className={inputCls} placeholder="Option value" value={step.value} onChange={(e) => updateStep(index, { value: e.target.value })} />
          </>
        );
      case 'wait':
        return (
          <input
            className={inputCls}
            type="number"
            placeholder="Duration (ms)"
            value={step.duration}
            onChange={(e) => updateStep(index, { duration: Number(e.target.value) })}
          />
        );
      case 'wait_for_element':
        return (
          <>
            {selectorRow(step.selector, (v) => updateStep(index, { selector: v }), index)}
            <input
              className={inputCls}
              type="number"
              placeholder="Timeout (ms)"
              value={step.timeout}
              onChange={(e) => updateStep(index, { timeout: Number(e.target.value) })}
            />
          </>
        );
    }
  }

  const inputCls = 'bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-100 w-full focus:outline-none focus:border-blue-500';

  return (
    <div className="w-[420px] min-h-[500px] bg-gray-950 text-gray-100 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <h1 className="text-base font-semibold">{initial ? 'Edit Scenario' : 'New Scenario'}</h1>
        <button onClick={handleCancel} className="text-gray-400 hover:text-white text-sm">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded px-3 py-2 text-xs text-yellow-400">
          ⚠ Do not store production credentials. Config is saved in plaintext locally.
        </div>

        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="Scenario name"
            value={scenario.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Start URL (optional — leave blank to use active tab)"
            value={scenario.startUrl}
            onChange={(e) => updateField('startUrl', e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        <div className="space-y-2">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Steps</p>
          {scenario.steps.map((step, i) => (
            <div key={i} className="bg-gray-900 border border-gray-800 rounded p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <select
                  className="bg-gray-800 border border-gray-700 rounded px-1.5 py-1 text-xs text-gray-100 flex-shrink-0 focus:outline-none"
                  value={step.type}
                  onChange={(e) => changeStepType(i, e.target.value as StepType)}
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                <div className="flex gap-1 ml-auto">
                  <button onClick={() => moveStep(i, -1)} disabled={i === 0} className="text-gray-500 hover:text-gray-200 disabled:opacity-30 text-xs px-1">↑</button>
                  <button onClick={() => moveStep(i, 1)} disabled={i === scenario.steps.length - 1} className="text-gray-500 hover:text-gray-200 disabled:opacity-30 text-xs px-1">↓</button>
                  <button onClick={() => removeStep(i)} className="text-red-500 hover:text-red-400 text-xs px-1">✕</button>
                </div>
              </div>
              {stepFields(step, i)}
            </div>
          ))}
          <button
            onClick={addStep}
            className="w-full text-xs border border-dashed border-gray-700 hover:border-gray-500 text-gray-500 hover:text-gray-300 py-2 rounded"
          >
            + Add Step
          </button>
        </div>
      </div>

      <div className="px-4 py-3 border-t border-gray-800 flex justify-end gap-2">
        <button onClick={handleCancel} className="text-sm text-gray-400 hover:text-white px-3 py-1.5">Cancel</button>
        <button onClick={handleSave} className="text-sm bg-blue-600 hover:bg-blue-700 px-4 py-1.5 rounded text-white">Save</button>
      </div>
    </div>
  );
}
