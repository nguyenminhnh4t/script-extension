export type StepType =
  | 'open_url'
  | 'fill'
  | 'click'
  | 'select'
  | 'wait'
  | 'wait_for_element';

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

export type Step =
  | OpenUrlStep
  | FillStep
  | ClickStep
  | SelectStep
  | WaitStep
  | WaitForElementStep;

export interface Scenario {
  id: string;
  name: string;
  startUrl: string;
  steps: Step[];
}

export type StepStatus = 'pending' | 'success' | 'error';

export interface StepLog {
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
}

export type RuntimeMessage =
  | { type: 'RUN_SCENARIO'; scenario: Scenario }
  | { type: 'RUN_STEP'; step: Step }
  | { type: 'RUN_COMPLETE'; log: RunLog }
  | { type: 'RUN_PROGRESS'; stepIndex: number; stepLog: StepLog };
