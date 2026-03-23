# Mixpanel 자연어 질의 인터페이스 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 자연어로 Mixpanel 데이터를 질의하고, 결과를 자연어 답변 + 메타데이터 + 테이블 + 차트로 보여주는 웹 애플리케이션 구축

**Architecture:** Express 백엔드가 LLM(Claude/OpenAI)에 Mixpanel 도구 스키마를 전달하고, LLM의 tool-use 응답을 받아 Mixpanel REST API를 직접 호출. 원본 데이터는 백엔드 파서가 결정적으로 테이블/차트로 변환. React 프론트엔드가 결과를 렌더링.

**Tech Stack:** React, TypeScript, Vite, Express, Chart.js (react-chartjs-2), Anthropic SDK, OpenAI SDK

**Design Guide:** Swiss Style — 배경 #F0F0F0, 텍스트 #000000, 강조 #FF0000, Helvetica 타이포, 모듈러 그리드, 절제된 여백

**Spec:** `docs/superpowers/specs/2026-03-23-mixpanel-nl-query-design.md`

---

## File Structure

```
├── .env                          # 환경 변수 (이미 존재)
├── .gitignore                    # .env, node_modules 등
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # Express 앱 진입점
│       ├── types/index.ts        # 공유 타입 (QueryRequest, QueryResponse 등)
│       ├── mixpanel/client.ts    # Mixpanel REST API 클라이언트
│       ├── mixpanel/tools.ts     # LLM tool-use용 도구 스키마
│       ├── mixpanel/parser.ts    # 원본 데이터 → 테이블/차트 변환
│       ├── llm/prompt.ts         # 공유 시스템 프롬프트
│       ├── llm/provider.ts       # LLM 프로바이더 인터페이스 + 팩토리
│       ├── llm/claude.ts         # Claude API 구현
│       ├── llm/openai.ts         # OpenAI API 구현
│       └── routes/query.ts       # POST /api/query 엔드포인트
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── types/index.ts        # 프론트 타입 (서버와 공유)
│       ├── hooks/useQuery.ts     # API 호출 + 상태 관리
│       ├── hooks/useHistory.ts   # 세션 히스토리 관리
│       ├── components/QueryInput.tsx
│       ├── components/AnswerPanel.tsx
│       ├── components/MetadataPanel.tsx
│       ├── components/DataTable.tsx
│       ├── components/ChartPanel.tsx
│       ├── components/HistoryList.tsx
│       ├── components/ErrorMessage.tsx
│       ├── components/LoadingSpinner.tsx
│       └── styles/global.css
```

---

## Task 1: 프로젝트 초기화 및 .gitignore

**Files:**
- Create: `.gitignore`
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `client/package.json`
- Create: `client/tsconfig.json`
- Create: `client/vite.config.ts`
- Create: `client/index.html`

- [ ] **Step 1: .gitignore 생성**

```gitignore
node_modules/
dist/
.env
*.log
```

- [ ] **Step 2: 서버 프로젝트 초기화**

```bash
cd server
npm init -y
npm install express cors dotenv
npm install -D typescript @types/node @types/express @types/cors ts-node nodemon
```

- [ ] **Step 3: server/tsconfig.json 생성**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 4: server/package.json scripts 추가**

```json
{
  "scripts": {
    "dev": "nodemon --exec ts-node src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

- [ ] **Step 5: 클라이언트 프로젝트 초기화**

```bash
cd client
npm create vite@latest . -- --template react-ts
npm install
```

- [ ] **Step 6: client/vite.config.ts에 프록시 설정**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001'
    }
  }
})
```

- [ ] **Step 7: 커밋**

```bash
git add .gitignore server/package.json server/tsconfig.json client/
git commit -m "chore: initialize server and client projects"
```

---

## Task 2: 공유 타입 정의

**Files:**
- Create: `server/src/types/index.ts`
- Create: `client/src/types/index.ts`

- [ ] **Step 1: server/src/types/index.ts 작성**

```typescript
export interface QueryRequest {
  question: string;
  provider?: 'anthropic' | 'openai';
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

export interface LLMToolCall {
  name: string;
  input: Record<string, unknown>;
  toolUseId?: string;   // Claude용 (tool_use block id)
  toolCallId?: string;  // OpenAI용 (tool_call id)
}

export interface ToolResult {
  toolName: string;
  result: unknown;
  toolUseId?: string;   // Claude용
  toolCallId?: string;  // OpenAI용
}
```

- [ ] **Step 2: client/src/types/index.ts 작성**

프론트엔드에 필요한 타입만 복사 (LLM 내부 타입인 `LLMToolCall`, `ToolResult`는 제외):

```typescript
export interface QueryRequest {
  question: string;
  provider?: 'anthropic' | 'openai';
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
```

- [ ] **Step 3: 커밋**

```bash
git add server/src/types/ client/src/types/
git commit -m "feat: define shared request/response types"
```

---

## Task 3: Mixpanel REST API 클라이언트

**Files:**
- Create: `server/src/mixpanel/client.ts`

- [ ] **Step 1: Mixpanel API 클라이언트 구현**

```typescript
import fetch from 'node-fetch';

interface MixpanelConfig {
  projectId: string;
  username: string;
  secret: string;
}

export class MixpanelClient {
  private config: MixpanelConfig;
  private baseUrl = 'https://mixpanel.com/api';

  constructor(config: MixpanelConfig) {
    this.config = config;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(
      `${this.config.username}:${this.config.secret}`
    ).toString('base64');
    return `Basic ${credentials}`;
  }

  async queryInsights(params: {
    from_date: string;
    to_date: string;
    event?: string;
    where?: string;
    group_by?: string[];
  }): Promise<unknown> {
    const url = new URL(`${this.baseUrl}/2.0/insights`);
    url.searchParams.set('project_id', this.config.projectId);

    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  async getEvents(): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/names?project_id=${this.config.projectId}`;
    const response = await fetch(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async getEventProperties(event: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/properties/names?project_id=${this.config.projectId}&event=${encodeURIComponent(event)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  async getPropertyValues(property: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/events/properties/values?project_id=${this.config.projectId}&name=${encodeURIComponent(property)}`;
    const response = await fetch(url, {
      headers: { 'Authorization': this.getAuthHeader() },
    });
    if (!response.ok) {
      throw new Error(`Mixpanel API error: ${response.status}`);
    }
    return response.json();
  }

  // JQL 쿼리 실행 (유연한 쿼리용)
  async runJql(script: string): Promise<unknown> {
    const url = `${this.baseUrl}/2.0/jql`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.getAuthHeader(),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `project_id=${this.config.projectId}&script=${encodeURIComponent(script)}`,
    });
    if (!response.ok) {
      throw new Error(`Mixpanel JQL error: ${response.status}`);
    }
    return response.json();
  }
}
```

- [ ] **Step 2: npm install node-fetch**

```bash
cd server
npm install node-fetch@2
npm install -D @types/node-fetch
```

(node-fetch v2 for CommonJS compatibility)

- [ ] **Step 3: 커밋**

```bash
git add server/src/mixpanel/client.ts server/package.json server/package-lock.json
git commit -m "feat: add Mixpanel REST API client"
```

---

## Task 4: Mixpanel LLM 도구 스키마

**Files:**
- Create: `server/src/mixpanel/tools.ts`

- [ ] **Step 1: LLM tool-use 도구 스키마 정의**

LLM에 전달할 도구 정의. Claude와 OpenAI 모두 호환되는 형식으로 작성.

```typescript
export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const mixpanelTools: ToolDefinition[] = [
  {
    name: 'query_insights',
    description: 'Mixpanel Insights 보고서를 실행합니다. 이벤트 집계, 트렌드, breakdown 분석에 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {
        from_date: { type: 'string', description: 'YYYY-MM-DD 시작일' },
        to_date: { type: 'string', description: 'YYYY-MM-DD 종료일' },
        event: { type: 'string', description: '분석할 이벤트 이름' },
        where: { type: 'string', description: '필터 조건 (Mixpanel 표현식)' },
        group_by: {
          type: 'array',
          items: { type: 'string' },
          description: '그룹 바이 속성 (dimension breakdown)',
        },
      },
      required: ['from_date', 'to_date'],
    },
  },
  {
    name: 'get_events',
    description: '프로젝트에서 사용 가능한 이벤트 이름 목록을 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_event_properties',
    description: '특정 이벤트의 속성(property) 이름 목록을 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        event: { type: 'string', description: '이벤트 이름' },
      },
      required: ['event'],
    },
  },
  {
    name: 'get_property_values',
    description: '특정 속성의 고유 값 목록을 조회합니다.',
    input_schema: {
      type: 'object',
      properties: {
        property: { type: 'string', description: '속성 이름' },
      },
      required: ['property'],
    },
  },
  {
    name: 'run_jql',
    description: 'Mixpanel JQL(JavaScript Query Language) 스크립트를 실행합니다. 복잡한 쿼리, 코호트 분석, 커스텀 집계에 사용합니다.',
    input_schema: {
      type: 'object',
      properties: {
        script: { type: 'string', description: 'JQL JavaScript 스크립트' },
      },
      required: ['script'],
    },
  },
];
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/mixpanel/tools.ts
git commit -m "feat: define Mixpanel tool schemas for LLM tool-use"
```

---

## Task 5: Data Parser (결정적 변환)

**Files:**
- Create: `server/src/mixpanel/parser.ts`

- [ ] **Step 1: 파서 구현**

Mixpanel 원본 응답을 `TableData`와 `ChartData`로 결정적 변환.

```typescript
import { TableData, ChartData } from '../types';

export function parseToTable(rawData: unknown): TableData {
  // Case 1: 배열 형태 (JQL 결과 등)
  if (Array.isArray(rawData)) {
    if (rawData.length === 0) {
      return { columns: [], rows: [], totalRows: 0 };
    }
    const columns = Object.keys(rawData[0]);
    const rows = rawData.map(item =>
      columns.map(col => {
        const val = (item as Record<string, unknown>)[col];
        return val === undefined ? null : (val as string | number | null);
      })
    );
    return { columns, rows, totalRows: rows.length };
  }

  // Case 2: Insights 응답 형태 { series: [...], data: { values: { ... } } }
  if (typeof rawData === 'object' && rawData !== null) {
    const obj = rawData as Record<string, unknown>;

    // Insights 형식: { data: { values: { "event": { "date": count } } } }
    if (obj.data && typeof obj.data === 'object') {
      const data = obj.data as Record<string, unknown>;
      if (data.values && typeof data.values === 'object') {
        const values = data.values as Record<string, Record<string, number>>;
        const events = Object.keys(values);
        if (events.length === 0) {
          return { columns: [], rows: [], totalRows: 0 };
        }
        const dates = Object.keys(values[events[0]]).sort();
        const columns = ['날짜', ...events];
        const rows: (string | number | null)[][] = dates.map(date => [
          date,
          ...events.map(event => values[event][date] ?? null),
        ]);
        return { columns, rows, totalRows: rows.length };
      }
    }

    // 단일 객체 → 1행 테이블
    const columns = Object.keys(obj);
    const rows = [columns.map(col => {
      const val = obj[col];
      if (typeof val === 'string' || typeof val === 'number') return val;
      if (val === null) return null;
      return JSON.stringify(val);
    })];
    return { columns, rows, totalRows: 1 };
  }

  return { columns: [], rows: [], totalRows: 0 };
}

export function parseToChart(table: TableData): ChartData | undefined {
  if (table.columns.length < 2 || table.rows.length === 0) {
    return undefined;
  }

  const labels = table.rows.map(row => String(row[0] ?? ''));
  const datasets = table.columns.slice(1).map(col => {
    const colIndex = table.columns.indexOf(col);
    const data = table.rows.map(row => {
      const val = row[colIndex];
      return typeof val === 'number' ? val : 0;
    });
    return { label: col, data };
  });

  // 시계열(날짜 라벨) → line, 그 외 → bar
  const isTimeSeries = labels.length > 1 && /^\d{4}-\d{2}-\d{2}/.test(labels[0]);
  const type: 'line' | 'bar' = isTimeSeries ? 'line' : 'bar';

  return { type, labels, datasets };
}
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/mixpanel/parser.ts
git commit -m "feat: add deterministic data parser for table/chart conversion"
```

---

## Task 6: LLM 프로바이더 인터페이스 + Claude 구현

**Files:**
- Create: `server/src/llm/prompt.ts`
- Create: `server/src/llm/provider.ts`
- Create: `server/src/llm/claude.ts`

- [ ] **Step 1: npm install**

```bash
cd server
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: 공유 시스템 프롬프트 작성**

```typescript
// server/src/llm/prompt.ts
export const SYSTEM_PROMPT = `당신은 Mixpanel 데이터 분석가입니다. 사용자의 자연어 질문을 분석하여 적절한 Mixpanel 도구를 호출하고, 결과를 한국어로 요약합니다.

도구 호출이 완료되면 반드시 다음 JSON 형식으로 답변하세요:
{
  "answer": "자연어 답변 (한국어)",
  "metadata": {
    "toolCalls": ["호출한 도구와 파라미터 요약"],
    "dateRange": "조회 기간",
    "dimensions": ["사용한 차원"],
    "metrics": ["사용한 지표"],
    "cohortDefinition": "코호트 정의 (있을 경우)"
  }
}

답변에는 데이터의 주요 인사이트를 포함하세요. 숫자는 읽기 쉽게 포맷하세요.`;
```

- [ ] **Step 3: LLM 프로바이더 인터페이스 작성**

`ToolResult`는 `types/index.ts`에 정의되어 있으므로 거기서 import.

```typescript
// server/src/llm/provider.ts
import { LLMToolCall, ToolResult, QueryMetadata } from '../types';
import { ToolDefinition } from '../mixpanel/tools';

export type LLMStepResult =
  | { type: 'tool_use'; toolCalls: LLMToolCall[] }
  | { type: 'answer'; answer: string; metadata: QueryMetadata };

export interface LLMProvider {
  chat(
    question: string,
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    previousMessages: unknown[]
  ): Promise<{ stepResult: LLMStepResult; messages: unknown[] }>;
}

export function createProvider(provider: 'anthropic' | 'openai'): LLMProvider {
  if (provider === 'anthropic') {
    const { ClaudeProvider } = require('./claude');
    return new ClaudeProvider();
  } else {
    const { OpenAIProvider } = require('./openai');
    return new OpenAIProvider();
  }
}
```

- [ ] **Step 4: Claude 프로바이더 구현**

```typescript
// server/src/llm/claude.ts
import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, LLMStepResult } from './provider';
import { ToolDefinition } from '../mixpanel/tools';
import { ToolResult, QueryMetadata } from '../types';
import { SYSTEM_PROMPT } from './prompt';

export class ClaudeProvider implements LLMProvider {
  private client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async chat(
    question: string,
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    previousMessages: unknown[]
  ): Promise<{ stepResult: LLMStepResult; messages: unknown[] }> {
    const messages: Anthropic.MessageParam[] = previousMessages.length > 0
      ? (previousMessages as Anthropic.MessageParam[])
      : [{ role: 'user', content: question }];

    // tool_result 메시지 추가
    if (toolResults.length > 0) {
      const toolResultContents = toolResults.map(tr => ({
        type: 'tool_result' as const,
        tool_use_id: tr.toolUseId!,
        content: JSON.stringify(tr.result),
      }));
      messages.push({ role: 'user', content: toolResultContents });
    }

    const anthropicTools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema as Anthropic.Tool['input_schema'],
    }));

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

    const response = await this.client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages,
    });

    // assistant 메시지를 히스토리에 추가
    const updatedMessages = [...messages, { role: 'assistant' as const, content: response.content }];

    // tool_use 블록이 있으면 tool-use 결과 반환
    const toolUseBlocks = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (toolUseBlocks.length > 0) {
      return {
        stepResult: {
          type: 'tool_use',
          toolCalls: toolUseBlocks.map(block => ({
            name: block.name,
            input: block.input as Record<string, unknown>,
            toolUseId: block.id,
          })),
        },
        messages: updatedMessages,
      };
    }

    // 텍스트 응답 → answer + metadata 파싱
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === 'text'
    );
    const text = textBlock?.text ?? '';

    let answer = text;
    let metadata: QueryMetadata = {
      toolCalls: [],
      dateRange: '',
      dimensions: [],
      metrics: [],
    };

    // JSON 파싱 시도
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        answer = parsed.answer ?? text;
        metadata = {
          toolCalls: parsed.metadata?.toolCalls ?? [],
          dateRange: parsed.metadata?.dateRange ?? '',
          dimensions: parsed.metadata?.dimensions ?? [],
          metrics: parsed.metadata?.metrics ?? [],
          cohortDefinition: parsed.metadata?.cohortDefinition,
        };
      } catch {
        // JSON 파싱 실패 시 텍스트 그대로 사용
      }
    }

    return {
      stepResult: { type: 'answer', answer, metadata },
      messages: updatedMessages,
    };
  }
}
```

- [ ] **Step 5: 커밋**

```bash
git add server/src/llm/
git commit -m "feat: add LLM provider interface, shared prompt, and Claude implementation"
```

---

## Task 7: OpenAI 프로바이더 구현

**Files:**
- Create: `server/src/llm/openai.ts`

- [ ] **Step 1: npm install**

```bash
cd server
npm install openai
```

- [ ] **Step 2: OpenAI 프로바이더 구현**

```typescript
// server/src/llm/openai.ts
import OpenAI from 'openai';
import { LLMProvider, LLMStepResult } from './provider';
import { ToolDefinition } from '../mixpanel/tools';
import { ToolResult, QueryMetadata } from '../types';
import { SYSTEM_PROMPT } from './prompt';

export class OpenAIProvider implements LLMProvider {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  async chat(
    question: string,
    tools: ToolDefinition[],
    toolResults: ToolResult[],
    previousMessages: unknown[]
  ): Promise<{ stepResult: LLMStepResult; messages: unknown[] }> {
    const messages: OpenAI.ChatCompletionMessageParam[] = previousMessages.length > 0
      ? (previousMessages as OpenAI.ChatCompletionMessageParam[])
      : [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: question },
        ];

    // tool call 결과 추가
    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        messages.push({
          role: 'tool',
          tool_call_id: tr.toolCallId!,
          content: JSON.stringify(tr.result),
        });
      }
    }

    const openaiTools: OpenAI.ChatCompletionTool[] = tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }));

    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const response = await this.client.chat.completions.create({
      model,
      max_tokens: 4096,
      messages,
      tools: openaiTools,
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;
    const updatedMessages = [...messages, assistantMessage];

    // tool_calls가 있으면
    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      return {
        stepResult: {
          type: 'tool_use',
          toolCalls: assistantMessage.tool_calls.map(tc => ({
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments),
            toolCallId: tc.id,
          })),
        },
        messages: updatedMessages,
      };
    }

    // 텍스트 응답
    const text = assistantMessage.content ?? '';
    let answer = text;
    let metadata: QueryMetadata = {
      toolCalls: [],
      dateRange: '',
      dimensions: [],
      metrics: [],
    };

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        answer = parsed.answer ?? text;
        metadata = {
          toolCalls: parsed.metadata?.toolCalls ?? [],
          dateRange: parsed.metadata?.dateRange ?? '',
          dimensions: parsed.metadata?.dimensions ?? [],
          metrics: parsed.metadata?.metrics ?? [],
          cohortDefinition: parsed.metadata?.cohortDefinition,
        };
      } catch {
        // 파싱 실패 시 원본 텍스트 사용
      }
    }

    return {
      stepResult: { type: 'answer', answer, metadata },
      messages: updatedMessages,
    };
  }
}
```

- [ ] **Step 3: 커밋**

```bash
git add server/src/llm/openai.ts server/package.json server/package-lock.json
git commit -m "feat: add OpenAI LLM provider"
```

---

## Task 8: 쿼리 라우트 + Tool-Use 오케스트레이션 루프

**Files:**
- Create: `server/src/routes/query.ts`

- [ ] **Step 1: 쿼리 라우트 구현**

Tool-use 루프 (최대 5회, 60초 타임아웃), 에러 처리 포함.

```typescript
// server/src/routes/query.ts
import { Router, Request, Response } from 'express';
import { QueryRequest, QueryResponse, QueryErrorResponse, ToolResult } from '../types';
import { createProvider } from '../llm/provider';
import { mixpanelTools } from '../mixpanel/tools';
import { MixpanelClient } from '../mixpanel/client';
import { parseToTable, parseToChart } from '../mixpanel/parser';

const router = Router();
const MAX_ITERATIONS = 5;
const TIMEOUT_MS = 60_000;

function createMixpanelClient(): MixpanelClient {
  return new MixpanelClient({
    projectId: process.env.MIXPANEL_PROJECT_ID!,
    username: process.env.MIXPANEL_SERVICE_ACCOUNT_USERNAME!,
    secret: process.env.MIXPANEL_SERVICE_ACCOUNT_SECRET!,
  });
}

async function executeTool(
  client: MixpanelClient,
  toolName: string,
  input: Record<string, unknown>
): Promise<unknown> {
  switch (toolName) {
    case 'query_insights':
      return client.queryInsights(input as any);
    case 'get_events':
      return client.getEvents();
    case 'get_event_properties':
      return client.getEventProperties(input.event as string);
    case 'get_property_values':
      return client.getPropertyValues(input.property as string);
    case 'run_jql':
      return client.runJql(input.script as string);
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

router.post('/query', async (req: Request, res: Response) => {
  const { question, provider: providerName } = req.body as QueryRequest;

  if (!question || question.trim().length === 0) {
    const err: QueryErrorResponse = {
      error: true,
      code: 'LLM_ERROR',
      message: '질문을 입력해 주세요.',
    };
    return res.status(400).json(err);
  }

  const llmProvider = createProvider(providerName ?? (process.env.LLM_PROVIDER as any) ?? 'anthropic');
  const mixpanel = createMixpanelClient();

  const startTime = Date.now();
  let messages: unknown[] = [];
  let iteration = 0;
  let lastRawData: unknown = null;
  const allToolCallSummaries: string[] = [];

  try {
    let toolResults: ToolResult[] = [];

    while (iteration < MAX_ITERATIONS) {
      // 타임아웃 체크
      if (Date.now() - startTime > TIMEOUT_MS) {
        const err: QueryErrorResponse = {
          error: true,
          code: 'TIMEOUT',
          message: '질의 처리 시간이 초과되었습니다. 더 간단한 질문으로 시도해 주세요.',
        };
        return res.status(504).json(err);
      }

      const { stepResult, messages: updatedMessages } = await llmProvider.chat(
        question,
        mixpanelTools,
        toolResults,
        messages
      );
      messages = updatedMessages;
      iteration++;

      if (stepResult.type === 'answer') {
        // 최종 답변
        const table = lastRawData ? parseToTable(lastRawData) : { columns: [], rows: [], totalRows: 0 };
        const chart = parseToChart(table);

        // toolCalls 보강
        if (allToolCallSummaries.length > 0 && stepResult.metadata.toolCalls.length === 0) {
          stepResult.metadata.toolCalls = allToolCallSummaries;
        }

        const response: QueryResponse = {
          answer: stepResult.answer,
          metadata: stepResult.metadata,
          table,
          chart: chart ?? undefined,
        };
        return res.json(response);
      }

      // tool-use → Mixpanel API 호출
      toolResults = [];
      for (const toolCall of stepResult.toolCalls) {
        try {
          const result = await executeTool(mixpanel, toolCall.name, toolCall.input);
          lastRawData = result;
          allToolCallSummaries.push(`${toolCall.name}(${JSON.stringify(toolCall.input)})`);
          toolResults.push({
            toolName: toolCall.name,
            result,
            toolUseId: toolCall.toolUseId,
            toolCallId: toolCall.toolCallId,
          });
        } catch (err: any) {
          toolResults.push({
            toolName: toolCall.name,
            result: { error: err.message },
            toolUseId: toolCall.toolUseId,
            toolCallId: toolCall.toolCallId,
          });
        }
      }
    }

    // 최대 반복 초과
    const err: QueryErrorResponse = {
      error: true,
      code: 'MAX_ITERATIONS',
      message: '질의가 너무 복잡합니다. 더 구체적인 질문으로 시도해 주세요.',
    };
    return res.status(422).json(err);
  } catch (error: any) {
    console.error('Query error:', error);

    // 부분 결과가 있으면 에러와 함께 반환
    if (lastRawData) {
      const table = parseToTable(lastRawData);
      const chart = parseToChart(table);
      const partialResponse: QueryResponse = {
        answer: `처리 중 오류가 발생했지만, 수집된 데이터를 표시합니다: ${error.message}`,
        metadata: {
          toolCalls: allToolCallSummaries,
          dateRange: '',
          dimensions: [],
          metrics: [],
        },
        table,
        chart: chart ?? undefined,
      };
      return res.status(200).json(partialResponse);
    }

    const err: QueryErrorResponse = {
      error: true,
      code: 'LLM_ERROR',
      message: `처리 중 오류가 발생했습니다: ${error.message}`,
    };
    return res.status(500).json(err);
  }
});

export default router;
```

- [ ] **Step 2: 커밋**

```bash
git add server/src/routes/query.ts
git commit -m "feat: add query route with tool-use orchestration loop"
```

---

## Task 9: Express 서버 진입점

**Files:**
- Create: `server/src/index.ts`

- [ ] **Step 1: Express 앱 작성**

```typescript
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import queryRouter from './routes/query';

// .env는 프로젝트 루트에 있음 (dev: __dirname=server/src, prod: __dirname=server/dist)
// 두 경우 모두 ../../.env가 프로젝트 루트를 가리킴
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api', queryRouter);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
```

- [ ] **Step 2: 서버 실행 테스트**

```bash
cd server
npm run dev
```

서버가 `Server running on http://localhost:3001`을 출력하고 에러 없이 실행되는지 확인.

- [ ] **Step 3: 커밋**

```bash
git add server/src/index.ts
git commit -m "feat: add Express server entry point"
```

---

## Task 10: 프론트엔드 — 글로벌 스타일 (Swiss Style)

**Files:**
- Create: `client/src/styles/global.css`

- [ ] **Step 1: Swiss Style 글로벌 CSS 작성**

`design_guide.txt` 기반: 배경 #F0F0F0, 텍스트 #000000, 강조 #FF0000, Helvetica.

```css
/* Swiss Style Design System */
:root {
  --bg-primary: #F0F0F0;
  --text-primary: #000000;
  --accent: #FF0000;
  --white: #FFFFFF;
  --border: #D0D0D0;
  --text-secondary: #666666;

  --font-heading: 'Helvetica Neue', Helvetica, Arial, sans-serif;
  --font-body: 'Helvetica Neue', Helvetica, Arial, sans-serif;

  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-heading);
  font-weight: 700;
  letter-spacing: -0.02em;
}

button {
  cursor: pointer;
  font-family: var(--font-body);
}

input, textarea {
  font-family: var(--font-body);
}

/* 스크롤바 */
::-webkit-scrollbar {
  width: 6px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}
```

- [ ] **Step 2: main.tsx에서 스타일 import**

```typescript
import './styles/global.css'
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/styles/global.css client/src/main.tsx
git commit -m "feat: add Swiss Style global CSS"
```

---

## Task 11: 프론트엔드 — QueryInput 컴포넌트

**Files:**
- Create: `client/src/components/QueryInput.tsx`

- [ ] **Step 1: 컴포넌트 작성**

```tsx
import { useState, KeyboardEvent } from 'react';

interface QueryInputProps {
  onSubmit: (question: string) => void;
  isLoading: boolean;
}

export default function QueryInput({ onSubmit, isLoading }: QueryInputProps) {
  const [question, setQuestion] = useState('');

  const handleSubmit = () => {
    const trimmed = question.trim();
    if (trimmed && !isLoading) {
      onSubmit(trimmed);
      setQuestion('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div style={{
      display: 'flex',
      gap: 'var(--space-sm)',
      padding: 'var(--space-md)',
      background: 'var(--white)',
      borderBottom: '1px solid var(--border)',
    }}>
      <textarea
        value={question}
        onChange={e => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Mixpanel 데이터에 대해 질문하세요..."
        disabled={isLoading}
        rows={2}
        style={{
          flex: 1,
          padding: 'var(--space-sm) var(--space-md)',
          border: '1px solid var(--border)',
          borderRadius: 0,
          fontSize: '14px',
          resize: 'none',
          outline: 'none',
          fontFamily: 'var(--font-body)',
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={isLoading || !question.trim()}
        style={{
          padding: 'var(--space-sm) var(--space-lg)',
          background: question.trim() && !isLoading ? 'var(--text-primary)' : 'var(--border)',
          color: 'var(--white)',
          border: 'none',
          fontSize: '14px',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {isLoading ? '분석 중...' : '전송'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/components/QueryInput.tsx
git commit -m "feat: add QueryInput component"
```

---

## Task 12: 프론트엔드 — AnswerPanel, MetadataPanel, ErrorMessage, LoadingSpinner

**Files:**
- Create: `client/src/components/AnswerPanel.tsx`
- Create: `client/src/components/MetadataPanel.tsx`
- Create: `client/src/components/ErrorMessage.tsx`
- Create: `client/src/components/LoadingSpinner.tsx`

- [ ] **Step 1: AnswerPanel 작성**

```tsx
interface AnswerPanelProps {
  answer: string;
}

export default function AnswerPanel({ answer }: AnswerPanelProps) {
  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-sm)' }}>
        분석 결과
      </h3>
      <p style={{ fontSize: '15px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{answer}</p>
    </div>
  );
}
```

- [ ] **Step 2: MetadataPanel 작성**

```tsx
import { Fragment } from 'react';
import { QueryMetadata } from '../types';

interface MetadataPanelProps {
  metadata: QueryMetadata;
}

export default function MetadataPanel({ metadata }: MetadataPanelProps) {
  const items = [
    { label: '도구 호출', value: metadata.toolCalls.join(', ') },
    { label: '기간', value: metadata.dateRange },
    { label: '차원', value: metadata.dimensions.join(', ') },
    { label: '지표', value: metadata.metrics.join(', ') },
    ...(metadata.cohortDefinition
      ? [{ label: '코호트', value: metadata.cohortDefinition }]
      : []),
  ].filter(item => item.value);

  if (items.length === 0) return null;

  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        쿼리 메타데이터
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 'var(--space-xs) var(--space-md)', fontSize: '13px' }}>
        {items.map(item => (
          <Fragment key={item.label}>
            <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{item.label}</span>
            <span style={{ fontFamily: 'monospace', fontSize: '12px', wordBreak: 'break-all' }}>{item.value}</span>
          </Fragment>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: ErrorMessage 작성**

```tsx
interface ErrorMessageProps {
  message: string;
}

export default function ErrorMessage({ message }: ErrorMessageProps) {
  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      borderLeft: '3px solid var(--accent)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent)', marginBottom: 'var(--space-sm)' }}>
        오류
      </h3>
      <p style={{ fontSize: '14px' }}>{message}</p>
    </div>
  );
}
```

- [ ] **Step 4: LoadingSpinner 작성**

```tsx
export default function LoadingSpinner() {
  return (
    <div style={{
      padding: 'var(--space-2xl)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 'var(--space-md)',
    }}>
      <div style={{
        width: '24px',
        height: '24px',
        border: '2px solid var(--border)',
        borderTop: '2px solid var(--text-primary)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontSize: '13px', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
        Mixpanel 데이터 분석 중...
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
```

- [ ] **Step 5: 커밋**

```bash
git add client/src/components/AnswerPanel.tsx client/src/components/MetadataPanel.tsx client/src/components/ErrorMessage.tsx client/src/components/LoadingSpinner.tsx
git commit -m "feat: add AnswerPanel, MetadataPanel, ErrorMessage, LoadingSpinner"
```

---

## Task 13: 프론트엔드 — DataTable (10행 페이지네이션)

**Files:**
- Create: `client/src/components/DataTable.tsx`

- [ ] **Step 1: DataTable 컴포넌트 작성**

```tsx
import { useState } from 'react';
import { TableData } from '../types';

interface DataTableProps {
  table: TableData;
}

const PAGE_SIZE = 10;

export default function DataTable({ table }: DataTableProps) {
  const [page, setPage] = useState(0);

  if (table.columns.length === 0 || table.rows.length === 0) return null;

  const totalPages = Math.ceil(table.rows.length / PAGE_SIZE);
  const start = page * PAGE_SIZE;
  const pageRows = table.rows.slice(start, start + PAGE_SIZE);

  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        데이터 ({table.totalRows}행)
      </h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr>
              {table.columns.map(col => (
                <th key={col} style={{
                  textAlign: 'left',
                  padding: 'var(--space-sm) var(--space-md)',
                  borderBottom: '2px solid var(--text-primary)',
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  fontWeight: 700,
                }}>
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} style={{
                    padding: 'var(--space-sm) var(--space-md)',
                    borderBottom: '1px solid var(--border)',
                    fontVariantNumeric: typeof cell === 'number' ? 'tabular-nums' : undefined,
                  }}>
                    {cell === null ? '—' : typeof cell === 'number' ? cell.toLocaleString() : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 'var(--space-md)',
          fontSize: '13px',
        }}>
          <button
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              border: '1px solid var(--border)',
              background: page === 0 ? 'var(--bg-primary)' : 'var(--white)',
              color: page === 0 ? 'var(--border)' : 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            &lt; 이전
          </button>
          <span style={{ color: 'var(--text-secondary)' }}>
            {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages - 1}
            style={{
              padding: 'var(--space-xs) var(--space-md)',
              border: '1px solid var(--border)',
              background: page >= totalPages - 1 ? 'var(--bg-primary)' : 'var(--white)',
              color: page >= totalPages - 1 ? 'var(--border)' : 'var(--text-primary)',
              fontWeight: 600,
            }}
          >
            다음 &gt;
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/components/DataTable.tsx
git commit -m "feat: add DataTable with 10-row pagination"
```

---

## Task 14: 프론트엔드 — ChartPanel (Chart.js)

**Files:**
- Create: `client/src/components/ChartPanel.tsx`

- [ ] **Step 1: npm install**

```bash
cd client
npm install chart.js react-chartjs-2
```

- [ ] **Step 2: ChartPanel 작성**

```tsx
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { ChartData } from '../types';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);

interface ChartPanelProps {
  chart: ChartData;
}

const COLORS = ['#000000', '#FF0000', '#666666', '#999999', '#333333'];

export default function ChartPanel({ chart }: ChartPanelProps) {
  const data = {
    labels: chart.labels,
    datasets: chart.datasets.map((ds, i) => ({
      label: ds.label,
      data: ds.data,
      borderColor: COLORS[i % COLORS.length],
      backgroundColor: chart.type === 'bar'
        ? COLORS[i % COLORS.length]
        : 'transparent',
      borderWidth: 2,
      pointRadius: 3,
      tension: 0,
    })),
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          font: { family: 'Helvetica Neue, Helvetica, Arial, sans-serif', size: 12 },
          boxWidth: 12,
          padding: 16,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
      y: {
        grid: { color: '#E0E0E0' },
        ticks: { font: { size: 11 } },
      },
    },
  };

  return (
    <div style={{
      padding: 'var(--space-lg)',
      background: 'var(--white)',
      marginBottom: 'var(--space-md)',
    }}>
      <h3 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)', marginBottom: 'var(--space-md)' }}>
        차트
      </h3>
      <div style={{ height: '300px' }}>
        {chart.type === 'line' ? <Line data={data} options={options} /> : <Bar data={data} options={options} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/components/ChartPanel.tsx client/package.json client/package-lock.json
git commit -m "feat: add ChartPanel with Chart.js line/bar charts"
```

---

## Task 15: 프론트엔드 — HistoryList + useHistory 훅

**Files:**
- Create: `client/src/hooks/useHistory.ts`
- Create: `client/src/components/HistoryList.tsx`

- [ ] **Step 1: useHistory 훅 작성**

```typescript
import { useState, useCallback } from 'react';
import { QueryResponse } from '../types';

export interface HistoryEntry {
  id: number;
  question: string;
  response: QueryResponse;
  timestamp: Date;
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const addEntry = useCallback((question: string, response: QueryResponse) => {
    const entry: HistoryEntry = {
      id: Date.now(),
      question,
      response,
      timestamp: new Date(),
    };
    setEntries(prev => [entry, ...prev]);
    setSelectedId(entry.id);
  }, []);

  const selectedEntry = entries.find(e => e.id === selectedId) ?? null;

  return { entries, selectedId, selectedEntry, setSelectedId, addEntry };
}
```

- [ ] **Step 2: HistoryList 컴포넌트 작성**

```tsx
import { HistoryEntry } from '../hooks/useHistory';

interface HistoryListProps {
  entries: HistoryEntry[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}

export default function HistoryList({ entries, selectedId, onSelect }: HistoryListProps) {
  return (
    <div style={{
      width: '220px',
      borderRight: '1px solid var(--border)',
      background: 'var(--white)',
      overflowY: 'auto',
      flexShrink: 0,
    }}>
      <h3 style={{
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: 'var(--text-secondary)',
        padding: 'var(--space-md)',
        borderBottom: '1px solid var(--border)',
      }}>
        히스토리
      </h3>
      {entries.length === 0 && (
        <p style={{ padding: 'var(--space-md)', fontSize: '13px', color: 'var(--text-secondary)' }}>
          질의 내역이 없습니다
        </p>
      )}
      {entries.map(entry => (
        <button
          key={entry.id}
          onClick={() => onSelect(entry.id)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: 'var(--space-sm) var(--space-md)',
            border: 'none',
            borderBottom: '1px solid var(--border)',
            background: entry.id === selectedId ? 'var(--bg-primary)' : 'transparent',
            borderLeft: entry.id === selectedId ? '3px solid var(--accent)' : '3px solid transparent',
            fontSize: '13px',
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {entry.question}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: 커밋**

```bash
git add client/src/hooks/useHistory.ts client/src/components/HistoryList.tsx
git commit -m "feat: add session history list and useHistory hook"
```

---

## Task 16: 프론트엔드 — useQuery 훅

**Files:**
- Create: `client/src/hooks/useQuery.ts`

- [ ] **Step 1: useQuery 훅 작성**

```typescript
import { useState, useCallback } from 'react';
import { QueryResponse, QueryErrorResponse } from '../types';

interface UseQueryReturn {
  isLoading: boolean;
  result: QueryResponse | null;
  error: string | null;
  submitQuery: (question: string, provider?: 'anthropic' | 'openai') => Promise<QueryResponse | null>;
}

export function useQuery(): UseQueryReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<QueryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submitQuery = useCallback(async (
    question: string,
    provider?: 'anthropic' | 'openai'
  ): Promise<QueryResponse | null> => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, provider }),
      });

      const data = await response.json();

      if (!response.ok || data.error) {
        const errData = data as QueryErrorResponse;
        setError(errData.message);
        return null;
      }

      const queryResult = data as QueryResponse;
      setResult(queryResult);
      return queryResult;
    } catch (err: any) {
      setError('서버에 연결할 수 없습니다.');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { isLoading, result, error, submitQuery };
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/hooks/useQuery.ts
git commit -m "feat: add useQuery hook for API communication"
```

---

## Task 17: 프론트엔드 — App.tsx 조립

**Files:**
- Modify: `client/src/App.tsx`

- [ ] **Step 1: App.tsx 작성**

모든 컴포넌트를 조합하여 최종 레이아웃 구성.

```tsx
import { useState } from 'react';
import QueryInput from './components/QueryInput';
import AnswerPanel from './components/AnswerPanel';
import MetadataPanel from './components/MetadataPanel';
import DataTable from './components/DataTable';
import ChartPanel from './components/ChartPanel';
import HistoryList from './components/HistoryList';
import ErrorMessage from './components/ErrorMessage';
import LoadingSpinner from './components/LoadingSpinner';
import { useQuery } from './hooks/useQuery';
import { useHistory } from './hooks/useHistory';

type Provider = 'anthropic' | 'openai';

export default function App() {
  const [provider, setProvider] = useState<Provider>('anthropic');
  const { isLoading, error, submitQuery } = useQuery();
  const { entries, selectedId, selectedEntry, setSelectedId, addEntry } = useHistory();

  const handleSubmit = async (question: string) => {
    const result = await submitQuery(question, provider);
    if (result) {
      addEntry(question, result);
    }
  };

  const displayResult = selectedEntry?.response ?? null;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-md) var(--space-lg)',
        borderBottom: '1px solid var(--border)',
        background: 'var(--white)',
      }}>
        <h1 style={{ fontSize: '18px', fontWeight: 700 }}>
          Mixpanel <span style={{ color: 'var(--accent)' }}>Query</span>
        </h1>
        <select
          value={provider}
          onChange={e => setProvider(e.target.value as Provider)}
          style={{
            padding: 'var(--space-xs) var(--space-md)',
            border: '1px solid var(--border)',
            background: 'var(--white)',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          <option value="anthropic">Claude</option>
          <option value="openai">GPT</option>
        </select>
      </header>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Sidebar */}
        <HistoryList
          entries={entries}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        {/* Main */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <QueryInput onSubmit={handleSubmit} isLoading={isLoading} />

          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--space-md)' }}>
            {isLoading && <LoadingSpinner />}
            {error && <ErrorMessage message={error} />}
            {displayResult && (
              <>
                <AnswerPanel answer={displayResult.answer} />
                <MetadataPanel metadata={displayResult.metadata} />
                {displayResult.chart && <ChartPanel chart={displayResult.chart} />}
                <DataTable table={displayResult.table} />
              </>
            )}
            {!isLoading && !error && !displayResult && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
                color: 'var(--text-secondary)',
                fontSize: '14px',
              }}>
                Mixpanel 데이터에 대해 자연어로 질문하세요
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add client/src/App.tsx
git commit -m "feat: assemble App layout with all components"
```

---

## Task 18: 통합 테스트 및 최종 점검

- [ ] **Step 1: .gitignore에 .env 포함 확인**

```bash
cat .gitignore
```

`.env`가 포함되어 있는지 확인.

- [ ] **Step 2: 서버 실행 확인**

```bash
cd server && npm run dev
```

에러 없이 `Server running on http://localhost:3001` 출력 확인.

- [ ] **Step 3: 클라이언트 실행 확인**

```bash
cd client && npm run dev
```

`http://localhost:5173`에서 페이지가 로드되는지 확인.

- [ ] **Step 4: 실제 질의 테스트**

브라우저에서 "최근 7일간 이벤트 목록을 보여줘" 입력 후:
- 로딩 스피너 표시
- 자연어 답변 표시
- 메타데이터 패널 표시
- 테이블 데이터 표시
- 히스토리에 추가

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "chore: final integration and cleanup"
```
