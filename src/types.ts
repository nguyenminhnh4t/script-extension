export type StepType =
  | 'open_url'
  | 'fill'
  | 'click'
  | 'select'
  | 'wait'
  | 'wait_for_element'
  | 'press';

export interface OpenUrlStep {
  type: 'open_url';
  url: string;
}

export interface FillStep {
  type: 'fill';
  selector: string;
  value: string;
}

export interface ClickStep {
  type: 'click';
  selector: string;
}

export interface SelectStep {
  type: 'select';
  selector: string;
  value: string;
}

export interface WaitStep {
  type: 'wait';
  duration: number;
}

export interface WaitForElementStep {
  type: 'wait_for_element';
  selector: string;
  timeout: number;
}

export interface PressStep {
  type: 'press';
  /** Key value, e.g. "Enter", "Tab", "Escape", "a" */
  key: string;
}

export type Step =
  | OpenUrlStep
  | FillStep
  | ClickStep
  | SelectStep
  | WaitStep
  | WaitForElementStep
  | PressStep;

export interface ScenarioTab {
  id: string;
  name: string;
  startUrl: string;
  openInNewWindow: boolean;
  windowTargetTabId?: string;
  windowScreenX: number;
  windowScreenY: number;
  windowWidth: number;
  windowHeight: number;
  steps: Step[];
}

export interface Scenario {
  id: string;
  name: string;
  tabs: ScenarioTab[];
  /** Legacy window fields, normalized into tabs when loaded. */
  openInNewWindow?: boolean;
  windowScreenX?: number;
  windowScreenY?: number;
  windowWidth?: number;
  windowHeight?: number;
  /** Legacy single-tab fields, normalized into tabs when loaded. */
  startUrl?: string;
  steps?: Step[];
}

export type StepStatus = 'pending' | 'success' | 'error';

export interface StepLog {
  tabIndex: number;
  tabName: string;
  stepIndex: number;
  type: StepType;
  status: StepStatus;
  error?: string;
}

export interface RunLog {
  scenarioId: string;
  scenarioName: string;
  startedAt: string;
  endedAt: string;
  status: 'success' | 'error';
  steps: StepLog[];
  cleanupTabIds: number[];
}

export type RuntimeMessage =
  | { type: 'RUN_SCENARIO'; scenario: Scenario }
  | { type: 'RUN_STEP'; step: Step }
  | { type: 'RUN_COMPLETE'; log: RunLog }
  | { type: 'RUN_PROGRESS'; stepIndex: number; stepLog: StepLog }
  | { type: 'CLEANUP_TABS'; tabIds: number[] }
  | { type: 'START_PICK_MODE' }
  | { type: 'PICK_COMPLETE'; selector: string }
  | { type: 'PICK_CANCELLED' }
  | { type: 'START_RECORD_KEY' }
  | { type: 'RECORD_KEY_COMPLETE'; key: string }
  | { type: 'RECORD_KEY_CANCELLED' };
