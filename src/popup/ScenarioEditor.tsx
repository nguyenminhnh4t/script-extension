import { useEffect, useRef, useState } from 'react';
import type { Scenario, Step, StepType } from '../types';
import { saveScenario, saveDraft, clearDraft } from '../storage';

const STEP_TYPES: StepType[] = ['open_url', 'fill', 'click', 'select', 'wait', 'wait_for_element'];

function emptyStep(): Step {
  return { type: 'fill', selector: '', value: '' };
}

function newScenario(): Scenario {
  return { id: crypto.randomUUID(), name: '', startUrl: '', steps: [] };
}

interface Props {
  initial?: Scenario;
  pickedSelector?: { stepIndex: number; selector: string } | null;
  onPickedSelectorConsumed?: () => void;
  onStartPick?: (stepIndex: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

// ── SVG icons ──────────────────────────────────────────────────────────────
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconChevronUp = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);
const IconChevronDown = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconTrash = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
);
const IconPlus = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);
const IconCrosshair = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="12" cy="12" r="4" />
    <line x1="12" y1="2" x2="12" y2="7" />
    <line x1="12" y1="17" x2="12" y2="22" />
    <line x1="2" y1="12" x2="7" y2="12" />
    <line x1="17" y1="12" x2="22" y2="12" />
  </svg>
);
const IconSave = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);
const IconWarning = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// Step type icon labels
const STEP_ICONS: Record<StepType, string> = {
  open_url: '🔗',
  fill: '✏️',
  click: '👆',
  select: '☰',
  wait: '⏱',
  wait_for_element: '⏳',
};

// ── Component ──────────────────────────────────────────────────────────────
export default function ScenarioEditor({ initial, pickedSelector, onPickedSelectorConsumed, onStartPick, onSave, onCancel }: Props) {
  const [scenario, setScenario] = useState<Scenario>(initial ?? newScenario());
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pickedSelector) return;
    updateStep(pickedSelector.stepIndex, { selector: pickedSelector.selector } as Partial<Step>);
    onPickedSelectorConsumed?.();
  }, [pickedSelector]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      saveDraft({ scenario, editingId: initial?.id });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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
    if (!scenario.name.trim()) { setError('Scenario name is required'); return; }
    await saveScenario(scenario);
    await clearDraft();
    onSave();
  }

  async function handleCancel() {
    await clearDraft();
    onCancel();
  }

  // Shared styles
  const inputCls = 'bg-gray-900 border border-gray-700/80 rounded px-2.5 py-1.5 text-xs text-gray-100 w-full focus:outline-none focus:border-blue-500/80 placeholder:text-gray-600 transition-colors';
  const iconBtn = 'flex items-center justify-center w-6 h-6 rounded transition-colors';

  function selectorRow(value: string, onChange: (v: string) => void, stepIndex: number) {
    return (
      <div className="flex gap-1.5">
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
          className={`${iconBtn} shrink-0 text-gray-400 hover:text-blue-300 hover:bg-blue-950 border border-gray-700/80 hover:border-blue-700/60`}
        >
          <IconCrosshair />
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
            placeholder="https://..."
            value={step.url}
            onChange={(e) => updateStep(index, { url: e.target.value })}
          />
        );
      case 'fill':
        return (
          <>
            {selectorRow(step.selector, (v) => updateStep(index, { selector: v }), index)}
            <input className={inputCls} placeholder="Value to fill" value={step.value} onChange={(e) => updateStep(index, { value: e.target.value })} />
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

  return (
    <div className="w-full min-h-screen bg-gray-950 text-gray-100 flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/80">
        <h1 className="text-sm font-semibold text-gray-100">
          {initial ? 'Edit Scenario' : 'New Scenario'}
        </h1>
        <button
          onClick={handleCancel}
          className={`${iconBtn} text-gray-500 hover:text-gray-100 hover:bg-gray-800`}
        >
          <IconClose />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* Security notice */}
        <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-md px-3 py-2 text-xs text-amber-400/80">
          <span className="shrink-0 mt-px"><IconWarning /></span>
          <span>Config is saved in plaintext locally. Do not store production credentials.</span>
        </div>

        {/* Scenario meta */}
        <div className="space-y-2">
          <input
            className={inputCls}
            placeholder="Scenario name"
            value={scenario.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
          <input
            className={inputCls}
            placeholder="Start URL (leave blank to use active tab)"
            value={scenario.startUrl}
            onChange={(e) => updateField('startUrl', e.target.value)}
          />
        </div>

        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Steps */}
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider px-0.5">Steps</p>

          {scenario.steps.map((step, i) => (
            <div key={i} className="bg-gray-900/70 border border-gray-800/80 rounded-md overflow-hidden">

              {/* Step header row */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-800/60">
                <span className="text-xs w-4 text-center shrink-0">{STEP_ICONS[step.type]}</span>
                <select
                  className="flex-1 bg-transparent border-0 text-xs text-gray-300 focus:outline-none cursor-pointer"
                  value={step.type}
                  onChange={(e) => changeStepType(i, e.target.value as StepType)}
                >
                  {STEP_TYPES.map((t) => (
                    <option key={t} value={t} className="bg-gray-800">{t}</option>
                  ))}
                </select>

                <div className="flex items-center gap-0.5 ml-auto">
                  <button
                    onClick={() => moveStep(i, -1)}
                    disabled={i === 0}
                    className={`${iconBtn} text-gray-600 hover:text-gray-300 disabled:opacity-20`}
                  >
                    <IconChevronUp />
                  </button>
                  <button
                    onClick={() => moveStep(i, 1)}
                    disabled={i === scenario.steps.length - 1}
                    className={`${iconBtn} text-gray-600 hover:text-gray-300 disabled:opacity-20`}
                  >
                    <IconChevronDown />
                  </button>
                  <button
                    onClick={() => removeStep(i)}
                    className={`${iconBtn} text-gray-600 hover:text-red-400`}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>

              {/* Step fields */}
              <div className="px-2 py-2 space-y-1.5">
                {stepFields(step, i)}
              </div>
            </div>
          ))}

          <button
            onClick={addStep}
            className="w-full flex items-center justify-center gap-1.5 text-xs border border-dashed border-gray-700/80 hover:border-gray-500 text-gray-600 hover:text-gray-300 py-2 rounded-md transition-colors"
          >
            <IconPlus />
            Add step
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-800/80 flex items-center justify-end gap-2">
        <button
          onClick={handleCancel}
          className="text-xs text-gray-500 hover:text-gray-200 px-3 py-1.5 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-white transition-colors"
        >
          <IconSave />
          Save
        </button>
      </div>
    </div>
  );
}
