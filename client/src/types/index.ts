export interface QueryRequest {
  question: string;
  provider?: 'anthropic' | 'openai';
  projectId: string;
  sessionToken: string;
  activeEvent?: string;
}

export interface MixpanelProject {
  id: string;
  name: string;
}

export interface MixpanelAuthRequest {
  username: string;
  secret: string;
}

export interface MixpanelAuthResponse {
  sessionToken: string;
  projects: MixpanelProject[];
}

export interface QueryMetadata {
  toolCalls: string[];
  dateRange: string;
  dimensions: string[];
  metrics: string[];
  cohortDefinition?: string;
}

export interface TableData {
  columns: string[];
  rows: (string | number | null)[][];
  totalRows: number;
}

export interface ChartData {
  type: 'line' | 'bar';
  labels: string[];
  datasets: { label: string; data: number[] }[];
}

export interface QueryResponse {
  answer: string;
  metadata: QueryMetadata;
  table: TableData;
  chart?: ChartData;
}

export interface QueryErrorResponse {
  error: true;
  code: 'LLM_ERROR' | 'MIXPANEL_ERROR' | 'NO_DATA' | 'TIMEOUT' | 'MAX_ITERATIONS';
  message: string;
}
