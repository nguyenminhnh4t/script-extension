import { useEffect, useRef, useState } from 'react';
import type { Scenario, ScenarioTab, Step, StepType } from '../types';
import { saveScenario, saveDraft, clearDraft, normalizeScenario } from '../storage';

const STEP_TYPES: StepType[] = ['open_url', 'fill', 'click', 'select', 'wait', 'wait_for_element', 'press'];

function emptyStep(): Step {
  return { type: 'fill', selector: '', value: '' };
}

function emptyTab(index: number): ScenarioTab {
  return {
    id: crypto.randomUUID(),
    name: `Tab ${index + 1}`,
    startUrl: '',
    openInNewWindow: false,
    windowTargetTabId: undefined,
    windowScreenX: 0,
    windowScreenY: 0,
    windowWidth: 1280,
    windowHeight: 800,
    steps: [],
  };
}

function newScenario(): Scenario {
  return {
    id: crypto.randomUUID(),
    name: '',
    tabs: [emptyTab(0)],
  };
}

interface Props {
  initial?: Scenario;
  pickedSelector?: { tabIndex: number; stepIndex: number; selector: string } | null;
  onPickedSelectorConsumed?: () => void;
  onStartPick?: (tabIndex: number, stepIndex: number) => void;
  recordedKey?: { tabIndex: number; stepIndex: number; key: string } | null;
  onRecordedKeyConsumed?: () => void;
  onStartRecordKey?: (tabIndex: number, stepIndex: number) => void;
  onSave: () => void;
  onCancel: () => void;
}

// ── SVG icons ──────────────────────────────────────────────────────────────
const IconClose = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);
const IconChevronDown = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);
const IconGrip = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="19" r="1" />
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
const IconKeyboard = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <line x1="6" y1="10" x2="6" y2="10" strokeWidth="3" strokeLinecap="round" />
    <line x1="10" y1="10" x2="10" y2="10" strokeWidth="3" strokeLinecap="round" />
    <line x1="14" y1="10" x2="14" y2="10" strokeWidth="3" strokeLinecap="round" />
    <line x1="18" y1="10" x2="18" y2="10" strokeWidth="3" strokeLinecap="round" />
    <line x1="8" y1="14" x2="16" y2="14" strokeWidth="2" strokeLinecap="round" />
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
  press: '⌨',
};

// ── Component ──────────────────────────────────────────────────────────────
export default function ScenarioEditor({ initial, pickedSelector, onPickedSelectorConsumed, onStartPick, recordedKey, onRecordedKeyConsumed, onStartRecordKey, onSave, onCancel }: Props) {
  const [scenario, setScenario] = useState<Scenario>(() => normalizeScenario(initial) ?? newScenario());
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const [error, setError] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStepRef = useRef<{ tabIndex: number; stepIndex: number } | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [draggingStep, setDraggingStep] = useState<{ tabIndex: number; stepIndex: number } | null>(null);
  const [dragOverStep, setDragOverStep] = useState<{ tabIndex: number; stepIndex: number } | null>(null);
  const [isTabMenuOpen, setIsTabMenuOpen] = useState(false);
  const [isWindowTargetMenuOpen, setIsWindowTargetMenuOpen] = useState(false);
  const [openStepTypeMenu, setOpenStepTypeMenu] = useState<number | null>(null);
  const [showWarning, setShowWarning] = useState(true);

  useEffect(() => {
    if (!pickedSelector) return;
    updateStep(pickedSelector.tabIndex, pickedSelector.stepIndex, { selector: pickedSelector.selector } as Partial<Step>);
    onPickedSelectorConsumed?.();
  }, [pickedSelector]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!recordedKey) return;
    updateStep(recordedKey.tabIndex, recordedKey.stepIndex, { key: recordedKey.key } as Partial<Step>);
    onRecordedKeyConsumed?.();
  }, [recordedKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (activeTabIndex >= scenario.tabs.length) {
      setActiveTabIndex(Math.max(0, scenario.tabs.length - 1));
    }
  }, [activeTabIndex, scenario.tabs.length]);

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

  function updateTabField<K extends keyof ScenarioTab>(tabIndex: number, key: K, value: ScenarioTab[K]) {
    setScenario((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab, i) => (i === tabIndex ? { ...tab, [key]: value } : tab)),
    }));
  }

  function updateStep(tabIndex: number, index: number, partial: Partial<Step>) {
    setScenario((prev) => {
      const tab = prev.tabs[tabIndex];
      if (!tab) return prev;
      const steps = [...tab.steps];
      if (!steps[index]) return prev;
      steps[index] = { ...steps[index], ...partial } as Step;
      const tabs = [...prev.tabs];
      tabs[tabIndex] = { ...tab, steps };
      return { ...prev, tabs };
    });
  }

  function changeStepType(tabIndex: number, index: number, type: StepType) {
    const defaults: Record<StepType, Step> = {
      open_url: { type: 'open_url', url: '' },
      fill: { type: 'fill', selector: '', value: '' },
      click: { type: 'click', selector: '' },
      select: { type: 'select', selector: '', value: '' },
      wait: { type: 'wait', duration: 1000 },
      wait_for_element: { type: 'wait_for_element', selector: '', timeout: 10000 },
      press: { type: 'press', key: '' },
    };
    setScenario((prev) => {
      const tab = prev.tabs[tabIndex];
      if (!tab) return prev;
      const steps = [...tab.steps];
      steps[index] = defaults[type];
      const tabs = [...prev.tabs];
      tabs[tabIndex] = { ...tab, steps };
      return { ...prev, tabs };
    });
  }

  function addTab() {
    const nextIndex = scenario.tabs.length;
    setScenario((prev) => ({ ...prev, tabs: [...prev.tabs, emptyTab(prev.tabs.length)] }));
    setActiveTabIndex(nextIndex);
    setIsTabMenuOpen(false);
    setOpenStepTypeMenu(null);
  }

  function removeTab(tabIndex: number) {
    const tab = scenario.tabs[tabIndex];
    if (scenario.tabs.length <= 1) return;
    if (!confirm(`Delete ${tab?.name || `URL ${tabIndex + 1}`}?`)) return;
    setScenario((prev) => {
      if (prev.tabs.length <= 1) return prev;
      const removedTabId = prev.tabs[tabIndex]?.id;
      return {
        ...prev,
        tabs: prev.tabs
          .filter((_, i) => i !== tabIndex)
          .map((item) => (
            item.windowTargetTabId === removedTabId ? { ...item, windowTargetTabId: undefined } : item
          )),
      };
    });
    setIsWindowTargetMenuOpen(false);
  }

  function toggleTabWindow(tabIndex: number) {
    setScenario((prev) => {
      const targetTab = prev.tabs[tabIndex];
      if (!targetTab) return prev;
      const enabled = !targetTab.openInNewWindow;
      return {
        ...prev,
        tabs: prev.tabs.map((tab, i) => {
          if (i === tabIndex) {
            return {
              ...tab,
              openInNewWindow: enabled,
              windowTargetTabId: enabled ? tab.windowTargetTabId : undefined,
            };
          }
          if (!enabled && tab.windowTargetTabId === targetTab.id) {
            return { ...tab, windowTargetTabId: undefined };
          }
          return tab;
        }),
      };
    });
    setIsWindowTargetMenuOpen(false);
  }

  function addStep(tabIndex: number) {
    setScenario((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab, i) => (
        i === tabIndex ? { ...tab, steps: [...tab.steps, emptyStep()] } : tab
      )),
    }));
    requestAnimationFrame(() => {
      scrollContainerRef.current?.scrollTo({
        top: scrollContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    });
  }

  function removeStep(tabIndex: number, index: number) {
    setScenario((prev) => ({
      ...prev,
      tabs: prev.tabs.map((tab, i) => (
        i === tabIndex ? { ...tab, steps: tab.steps.filter((_, stepIndex) => stepIndex !== index) } : tab
      )),
    }));
  }

  function reorderStep(tabIndex: number, fromIndex: number, toIndex: number) {
    setScenario((prev) => {
      const tab = prev.tabs[tabIndex];
      if (!tab) return prev;
      const steps = [...tab.steps];
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= steps.length || toIndex >= steps.length) {
        return prev;
      }
      const [movedStep] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, movedStep);
      const tabs = [...prev.tabs];
      tabs[tabIndex] = { ...tab, steps };
      return { ...prev, tabs };
    });
  }

  function handleStepDragStart(e: React.DragEvent, tabIndex: number, stepIndex: number) {
    dragStepRef.current = { tabIndex, stepIndex };
    setDraggingStep({ tabIndex, stepIndex });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${tabIndex}:${stepIndex}`);
  }

  function handleStepDragOver(e: React.DragEvent, tabIndex: number, stepIndex: number) {
    const source = dragStepRef.current;
    if (!source || source.tabIndex !== tabIndex) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStep({ tabIndex, stepIndex });
  }

  function handleStepDrop(e: React.DragEvent, tabIndex: number, stepIndex: number) {
    e.preventDefault();
    const source = dragStepRef.current;
    dragStepRef.current = null;
    setDraggingStep(null);
    setDragOverStep(null);
    if (!source || source.tabIndex !== tabIndex) return;
    reorderStep(tabIndex, source.stepIndex, stepIndex);
  }

  function handleStepDragEnd() {
    dragStepRef.current = null;
    setDraggingStep(null);
    setDragOverStep(null);
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
  const inputCls = 'h-8 bg-gray-900 border border-gray-700/80 rounded px-2.5 text-xs text-gray-100 w-full focus:outline-none focus:border-blue-500/80 placeholder:text-gray-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const iconBtn = 'flex items-center justify-center w-8 h-8 rounded transition-colors cursor-pointer';
  const labelCls = 'block text-[10px] font-medium uppercase tracking-wider text-gray-500 mb-1';
  const menuBtnCls = 'h-8 w-full rounded border border-gray-700/80 bg-gray-900 px-2.5 text-left text-xs text-gray-100 transition-colors hover:border-gray-600 hover:bg-gray-800 focus:outline-none focus:border-blue-500/80 cursor-pointer';
  const activeTab = scenario.tabs[activeTabIndex] ?? scenario.tabs[0];
  const shareableWindowTabs = scenario.tabs
    .slice(0, activeTabIndex)
    .filter((tab) => tab.openInNewWindow);
  const activeUsesSharedWindow = Boolean(
    activeTab?.windowTargetTabId && shareableWindowTabs.some((tab) => tab.id === activeTab.windowTargetTabId)
  );

  function formatTabOption(tab: ScenarioTab, index: number): string {
    return `${index + 1}. ${tab.name || `URL ${index + 1}`} · ${tab.steps.length} step${tab.steps.length !== 1 ? 's' : ''}${tab.openInNewWindow ? ' · new window' : ''}`;
  }

  function getWindowTargetLabel(tab: ScenarioTab): string {
    const target = shareableWindowTabs.find((item) => item.id === tab.windowTargetTabId);
    return target ? `With ${target.name || 'tab'}` : 'Own window';
  }

  function selectorRow(value: string, onChange: (v: string) => void, tabIndex: number, stepIndex: number) {
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
          onClick={() => onStartPick?.(tabIndex, stepIndex)}
          className={`${iconBtn} shrink-0 text-gray-400 hover:text-blue-300 hover:bg-blue-950 border border-gray-700/80 hover:border-blue-700/60`}
        >
          <IconCrosshair />
        </button>
      </div>
    );
  }

  function stepFields(step: Step, tabIndex: number, index: number) {
    switch (step.type) {
      case 'open_url':
        return (
          <input
            className={inputCls}
            placeholder="https://..."
            value={step.url}
            onChange={(e) => updateStep(tabIndex, index, { url: e.target.value })}
          />
        );
      case 'fill':
        return (
          <>
            {selectorRow(step.selector, (v) => updateStep(tabIndex, index, { selector: v }), tabIndex, index)}
            <input className={inputCls} placeholder="Value to fill" value={step.value} onChange={(e) => updateStep(tabIndex, index, { value: e.target.value })} />
          </>
        );
      case 'click':
        return selectorRow(step.selector, (v) => updateStep(tabIndex, index, { selector: v }), tabIndex, index);
      case 'select':
        return (
          <>
            {selectorRow(step.selector, (v) => updateStep(tabIndex, index, { selector: v }), tabIndex, index)}
            <input className={inputCls} placeholder="Option value" value={step.value} onChange={(e) => updateStep(tabIndex, index, { value: e.target.value })} />
          </>
        );
      case 'wait':
        return (
          <input
            className={inputCls}
            type="number"
            placeholder="Duration (ms)"
            value={step.duration}
            onChange={(e) => updateStep(tabIndex, index, { duration: Number(e.target.value) })}
          />
        );
      case 'wait_for_element':
        return (
          <>
            {selectorRow(step.selector, (v) => updateStep(tabIndex, index, { selector: v }), tabIndex, index)}
            <input
              className={inputCls}
              type="number"
              placeholder="Timeout (ms)"
              value={step.timeout}
              onChange={(e) => updateStep(tabIndex, index, { timeout: Number(e.target.value) })}
            />
          </>
        );
      case 'press':
        return (
          <div className="flex gap-1.5">
            <input
              className={inputCls}
              placeholder='Key — e.g. Enter, Tab, Escape, a'
              value={step.key}
              onChange={(e) => updateStep(tabIndex, index, { key: e.target.value })}
            />
            <button
              type="button"
              title="Record key from page"
              onClick={() => onStartRecordKey?.(tabIndex, index)}
              className={`${iconBtn} shrink-0 text-gray-400 hover:text-purple-300 hover:bg-purple-950 border border-gray-700/80 hover:border-purple-700/60`}
            >
              <IconKeyboard />
            </button>
          </div>
        );
    }
  }

  return (
    <div className="w-full h-screen overflow-hidden bg-gray-950 text-gray-100 flex flex-col">

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800/80">
        <div className="min-w-0 flex-1">
          <input
            className="h-8 w-full border-0 border-b border-transparent bg-transparent px-0 text-sm font-medium text-gray-100 placeholder:text-gray-600 transition-colors hover:border-gray-800 focus:outline-none focus:border-blue-500/80"
            placeholder="Scenario name"
            value={scenario.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
        </div>
        <button
          onClick={handleCancel}
          className={`${iconBtn} shrink-0 text-gray-500 hover:text-gray-100 hover:bg-gray-800`}
        >
          <IconClose />
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 border-b border-gray-800/80 bg-gray-950 px-4 py-2.5 space-y-2">
        <div className="grid grid-cols-[1fr_auto] gap-1.5">
          <div className="relative min-w-0">
            <button
              type="button"
              onClick={() => setIsTabMenuOpen((open) => !open)}
              className={`${menuBtnCls} flex items-center justify-between gap-2`}
            >
              <span className="truncate">{activeTab ? formatTabOption(activeTab, activeTabIndex) : 'Select URL'}</span>
              <span className={`shrink-0 text-gray-500 transition-transform ${isTabMenuOpen ? 'rotate-180' : ''}`}>
                <IconChevronDown />
              </span>
            </button>
            {isTabMenuOpen && (
              <div className="absolute left-0 right-0 top-9 z-30 max-h-56 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 shadow-xl shadow-gray-950/70">
                {scenario.tabs.map((tab, i) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTabIndex(i);
                      setIsTabMenuOpen(false);
                      setIsWindowTargetMenuOpen(false);
                      setOpenStepTypeMenu(null);
                    }}
                    className={`w-full px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                      i === activeTabIndex
                        ? 'bg-blue-950/70 text-blue-200'
                        : 'text-gray-300 hover:bg-gray-800'
                    }`}
                  >
                    <span className="block truncate">{tab.name || `URL ${i + 1}`}</span>
                    <span className="mt-0.5 block text-[10px] text-gray-500">
                      {i + 1} · {tab.steps.length} step{tab.steps.length !== 1 ? 's' : ''}{tab.openInNewWindow ? ' · new window' : ''}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              title="Add URL"
              onClick={addTab}
              className={`${iconBtn} border border-blue-900/60 bg-blue-950/40 text-blue-300 hover:bg-blue-950 hover:text-blue-200`}
            >
              <IconPlus />
            </button>
            <button
              type="button"
              title="Delete current URL"
              onClick={() => removeTab(activeTabIndex)}
              disabled={scenario.tabs.length <= 1}
              className={`${iconBtn} border border-gray-800 text-gray-600 hover:text-red-400 hover:bg-red-950/30 disabled:opacity-25 disabled:cursor-not-allowed`}
            >
              <IconTrash />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1 pb-0.5">
          {scenario.tabs.map((tab, i) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTabIndex(i);
                setIsWindowTargetMenuOpen(false);
                setOpenStepTypeMenu(null);
              }}
              title={tab.startUrl || tab.name || `URL ${i + 1}`}
              className={`h-1.5 rounded-full transition-colors cursor-pointer ${
                i === activeTabIndex
                  ? 'w-8 bg-blue-500'
                  : 'w-4 bg-gray-700 hover:bg-gray-500'
              }`}
            />
          ))}
        </div>
      </div>

      <div ref={scrollContainerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3 space-y-3">

        {/* Security notice */}
        {showWarning && (
          <div className="flex items-start gap-2 bg-amber-900/20 border border-amber-700/30 rounded-md px-3 py-2 text-xs text-amber-400/80">
            <span className="shrink-0 mt-px"><IconWarning /></span>
            <span className="min-w-0 flex-1">Config is saved in plaintext locally. Do not store production credentials.</span>
            <button
              type="button"
              title="Dismiss"
              onClick={() => setShowWarning(false)}
              className="shrink-0 text-amber-500/70 hover:text-amber-300 transition-colors cursor-pointer"
            >
              <IconClose />
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-400">{error}</p>}

          {activeTab && (
            <div className="overflow-visible rounded-md border border-gray-800/80 bg-gray-900/40">
              <div className="flex items-center justify-between border-b border-gray-800/70 px-2.5 py-2">
                <div>
                  <p className="text-xs font-medium text-gray-300">Tab settings</p>
                  <p className="text-[10px] text-gray-600">URL {activeTabIndex + 1}</p>
                </div>
              </div>
            <div className="space-y-2.5 p-2.5">
                <label className="block">
                  <span className={labelCls}>Tab name</span>
                  <input
                    className={inputCls}
                    placeholder="Tab name"
                    value={activeTab.name}
                    onChange={(e) => updateTabField(activeTabIndex, 'name', e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className={labelCls}>Start URL</span>
                  <input
                    className={inputCls}
                    placeholder="Blank uses active tab for first URL"
                    value={activeTab.startUrl}
                    onChange={(e) => updateTabField(activeTabIndex, 'startUrl', e.target.value)}
                  />
                </label>
                <div className="rounded-md bg-gray-950/30 p-2.5">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-gray-300">Window settings</p>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={activeTab.openInNewWindow}
                      onClick={() => toggleTabWindow(activeTabIndex)}
                      className={`flex h-6 shrink-0 items-center gap-1.5 rounded px-1.5 text-xs transition-colors cursor-pointer ${
                        activeTab.openInNewWindow
                          ? 'text-blue-300'
                          : 'text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      <span className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                        activeTab.openInNewWindow ? 'bg-blue-600' : 'bg-gray-700'
                      }`}>
                        <span className={`h-3 w-3 rounded-full bg-white shadow-sm transition-transform ${
                          activeTab.openInNewWindow ? 'translate-x-3' : 'translate-x-0'
                        }`} />
                      </span>
                      <span>Window</span>
                    </button>
                  </div>
                  {activeTab.openInNewWindow && (
                    <div className="space-y-2">
                      {shareableWindowTabs.length > 0 && (
                        <div className="relative">
                          <span className={labelCls}>Share</span>
                          <button
                            type="button"
                            onClick={() => setIsWindowTargetMenuOpen((open) => !open)}
                            className={`${menuBtnCls} flex items-center justify-between gap-2`}
                          >
                            <span className="truncate">{getWindowTargetLabel(activeTab)}</span>
                            <span className={`shrink-0 text-gray-500 transition-transform ${isWindowTargetMenuOpen ? 'rotate-180' : ''}`}>
                              <IconChevronDown />
                            </span>
                          </button>
                          {isWindowTargetMenuOpen && (
                            <div className="absolute left-0 right-0 top-14 z-40 max-h-44 overflow-y-auto rounded-md border border-gray-700 bg-gray-900 shadow-xl shadow-gray-950/70">
                              <button
                                type="button"
                                onClick={() => {
                                  updateTabField(activeTabIndex, 'windowTargetTabId', undefined);
                                  setIsWindowTargetMenuOpen(false);
                                }}
                                className={`w-full px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                                  !activeUsesSharedWindow
                                    ? 'bg-blue-950/70 text-blue-200'
                                    : 'text-gray-300 hover:bg-gray-800'
                                }`}
                              >
                                Own window
                              </button>
                              {shareableWindowTabs.map((tab) => (
                                <button
                                  key={tab.id}
                                  type="button"
                                  onClick={() => {
                                    updateTabField(activeTabIndex, 'windowTargetTabId', tab.id);
                                    setIsWindowTargetMenuOpen(false);
                                  }}
                                  className={`w-full px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                                    activeTab.windowTargetTabId === tab.id
                                      ? 'bg-blue-950/70 text-blue-200'
                                      : 'text-gray-300 hover:bg-gray-800'
                                  }`}
                                >
                                  <span className="block truncate">{tab.name || 'Tab'}</span>
                                  <span className="mt-0.5 block text-[10px] text-gray-500">Use the same window</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                      {!activeUsesSharedWindow && (
                        <div className="grid grid-cols-2 gap-2">
                          <label className="block min-w-0">
                            <span className={labelCls}>Screen X</span>
                            <input
                              className={`${inputCls} min-w-0`}
                              type="number"
                              placeholder="X"
                              value={activeTab.windowScreenX}
                              onChange={(e) => updateTabField(activeTabIndex, 'windowScreenX', Number(e.target.value))}
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className={labelCls}>Screen Y</span>
                            <input
                              className={`${inputCls} min-w-0`}
                              type="number"
                              placeholder="Y"
                              value={activeTab.windowScreenY}
                              onChange={(e) => updateTabField(activeTabIndex, 'windowScreenY', Number(e.target.value))}
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className={labelCls}>Width</span>
                            <input
                              className={`${inputCls} min-w-0`}
                              type="number"
                              min={320}
                              placeholder="Width"
                              value={activeTab.windowWidth}
                              onChange={(e) => updateTabField(activeTabIndex, 'windowWidth', Number(e.target.value))}
                            />
                          </label>
                          <label className="block min-w-0">
                            <span className={labelCls}>Height</span>
                            <input
                              className={`${inputCls} min-w-0`}
                              type="number"
                              min={240}
                              placeholder="Height"
                              value={activeTab.windowHeight}
                              onChange={(e) => updateTabField(activeTabIndex, 'windowHeight', Number(e.target.value))}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
        )}

        {/* Steps */}
        {activeTab && (
        <div className="space-y-1.5">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wider px-0.5">Steps</p>

          {activeTab.steps.map((step, i) => {
            const isDragging = draggingStep?.tabIndex === activeTabIndex && draggingStep.stepIndex === i;
            const isDragTarget = dragOverStep?.tabIndex === activeTabIndex && dragOverStep.stepIndex === i && !isDragging;

            return (
              <div
                key={i}
                onDragOver={(e) => handleStepDragOver(e, activeTabIndex, i)}
                onDrop={(e) => handleStepDrop(e, activeTabIndex, i)}
                className={`bg-gray-900/70 border rounded-md overflow-visible transition-all duration-150 ${
                  isDragging
                    ? 'border-blue-400 bg-blue-950/20 opacity-55 scale-[0.985] shadow-lg shadow-blue-950/40'
                    : isDragTarget
                      ? 'border-blue-500 bg-blue-950/35 translate-y-0.5 shadow-md shadow-blue-950/30'
                      : 'border-gray-800/80'
                }`}
              >

              {/* Step header row */}
              <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-gray-800/60">
                <button
                  type="button"
                  title="Drag to reorder"
                  draggable
                  onDragStart={(e) => handleStepDragStart(e, activeTabIndex, i)}
                  onDragEnd={handleStepDragEnd}
                  className={`${iconBtn} cursor-grab active:cursor-grabbing ${
                    isDragging ? 'text-blue-300 bg-blue-950/70' : 'text-gray-600 hover:text-gray-300'
                  }`}
                >
                  <IconGrip />
                </button>
                <span className="text-xs w-4 text-center shrink-0">{STEP_ICONS[step.type]}</span>
                <div className="relative flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() => setOpenStepTypeMenu((openIndex) => openIndex === i ? null : i)}
                    className="flex h-8 w-full items-center justify-between gap-2 rounded border border-transparent bg-gray-950/30 px-2 text-left text-xs text-gray-300 transition-colors hover:border-gray-700 hover:bg-gray-800/70 cursor-pointer"
                  >
                    <span className="truncate">{step.type}</span>
                    <span className={`shrink-0 text-gray-500 transition-transform ${openStepTypeMenu === i ? 'rotate-180' : ''}`}>
                      <IconChevronDown />
                    </span>
                  </button>
                  {openStepTypeMenu === i && (
                    <div className="absolute left-0 right-0 top-9 z-50 overflow-hidden rounded-md border border-gray-700 bg-gray-900 shadow-xl shadow-gray-950/60">
                      {STEP_TYPES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => {
                            changeStepType(activeTabIndex, i, t);
                            setOpenStepTypeMenu(null);
                          }}
                          className={`flex w-full items-center gap-2 px-2.5 py-2 text-left text-xs transition-colors cursor-pointer ${
                            step.type === t
                              ? 'bg-blue-950/70 text-blue-200'
                              : 'text-gray-300 hover:bg-gray-800'
                          }`}
                        >
                          <span className="w-4 text-center">{STEP_ICONS[t]}</span>
                          <span>{t}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-0.5 ml-auto">
                  <button
                    onClick={() => removeStep(activeTabIndex, i)}
                    className={`${iconBtn} text-gray-600 hover:text-red-400`}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>

              {/* Step fields */}
              <div className="px-2 py-2 space-y-1.5">
                {stepFields(step, activeTabIndex, i)}
              </div>
            </div>
          );
          })}

          <button
            onClick={() => addStep(activeTabIndex)}
          className="w-full flex items-center justify-center gap-1.5 text-xs border border-dashed border-gray-700/80 hover:border-gray-500 text-gray-600 hover:text-gray-300 py-2 rounded-md transition-colors cursor-pointer"
          >
            <IconPlus />
            Add step
          </button>
        </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-gray-800/80 flex items-center justify-end gap-2">
        <button
          onClick={handleCancel}
          className="text-xs text-gray-500 hover:text-gray-200 px-3 py-1.5 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          className="flex items-center gap-1.5 text-xs bg-blue-600 hover:bg-blue-500 px-3 py-1.5 rounded text-white transition-colors cursor-pointer"
        >
          <IconSave />
          Save
        </button>
      </div>
    </div>
  );
}
