import { Router, Request, Response } from 'express';
import { QueryRequest, QueryResponse, QueryErrorResponse, ToolResult } from '../types';
import { createProvider } from '../llm/provider';
import { mixpanelTools } from '../mixpanel/tools';
import { MixpanelClient } from '../mixpanel/client';
import { parseToTable, parseToChart } from '../mixpanel/parser';
import { getMixpanelSession } from '../lib/sessionStore';
import { getSystemPrompt } from '../llm/prompt';

const router = Router();
const MAX_ITERATIONS = 10;
const TIMEOUT_MS = 60_000;

function createMixpanelClientFromSession(sessionToken: string, projectId: string): MixpanelClient {
  const session = getMixpanelSession(sessionToken);
  if (!session) {
    throw new Error('Mixpanel 세션이 만료되었습니다. 다시 연결해 주세요.');
  }

  const hasAccess = session.projects.some((p) => p.id === projectId);
  if (!hasAccess) {
    throw new Error('선택한 프로젝트에 접근 권한이 없습니다.');
  }

  return new MixpanelClient({
    projectId,
    username: session.username,
    secret: session.secret,
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

// tool call 병렬 실행
async function executeToolsParallel(
  client: MixpanelClient,
  toolCalls: { name: string; input: Record<string, unknown>; toolUseId?: string; toolCallId?: string }[],
  allToolCallSummaries: string[]
): Promise<{ toolResults: ToolResult[]; lastRawData: unknown }> {
  let lastRawData: unknown = null;

  const settled = await Promise.all(
    toolCalls.map(async (toolCall) => {
      try {
        const result = await executeTool(client, toolCall.name, toolCall.input);
        return { ok: true as const, toolCall, result };
      } catch (err: any) {
        return { ok: false as const, toolCall, errorMessage: err.message };
      }
    })
  );

  const toolResults: ToolResult[] = settled.map((s) => {
    allToolCallSummaries.push(`${s.toolCall.name}(${JSON.stringify(s.toolCall.input)})`);
    if (s.ok) {
      lastRawData = s.result;
      return { toolName: s.toolCall.name, result: s.result, toolUseId: s.toolCall.toolUseId, toolCallId: s.toolCall.toolCallId };
    } else {
      return { toolName: s.toolCall.name, result: { error: s.errorMessage }, toolUseId: s.toolCall.toolUseId, toolCallId: s.toolCall.toolCallId };
    }
  });

  return { toolResults, lastRawData };
}

router.post('/query', async (req: Request, res: Response) => {
  const { question, provider: providerName, projectId, sessionToken, activeEvent } = req.body as QueryRequest;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: true, code: 'LLM_ERROR', message: '질문을 입력해 주세요.' } as QueryErrorResponse);
  }

  if (!projectId || !sessionToken) {
    return res.status(400).json({ error: true, code: 'MIXPANEL_ERROR', message: 'Mixpanel 연결과 프로젝트 선택이 필요합니다.' } as QueryErrorResponse);
  }

  let mixpanel: MixpanelClient;
  try {
    mixpanel = createMixpanelClientFromSession(sessionToken, projectId);
  } catch (error: any) {
    return res.status(401).json({ error: true, code: 'MIXPANEL_ERROR', message: error.message } as QueryErrorResponse);
  }

  const llmProvider = createProvider(providerName ?? (process.env.LLM_PROVIDER as any) ?? 'anthropic');
  const startTime = Date.now();
  let messages: unknown[] = [];
  let iteration = 0;
  let lastRawData: unknown = null;
  const allToolCallSummaries: string[] = [];

  try {
    let toolResults: ToolResult[] = [];

    while (iteration < MAX_ITERATIONS) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        return res.status(504).json({ error: true, code: 'TIMEOUT', message: '질의 처리 시간이 초과되었습니다.' } as QueryErrorResponse);
      }

      const systemPrompt = getSystemPrompt(activeEvent);
      const { stepResult, messages: updatedMessages } = await llmProvider.chat(question, mixpanelTools, toolResults, messages, systemPrompt);
      messages = updatedMessages;
      iteration++;

      if (stepResult.type === 'answer') {
        const table = lastRawData ? parseToTable(lastRawData) : { columns: [], rows: [], totalRows: 0 };
        const chart = parseToChart(table);
        if (allToolCallSummaries.length > 0 && stepResult.metadata.toolCalls.length === 0) {
          stepResult.metadata.toolCalls = allToolCallSummaries;
        }
        const response: QueryResponse = { answer: stepResult.answer, metadata: stepResult.metadata, table, chart: chart ?? undefined };
        return res.json(response);
      }

      // tool-use → 병렬 실행
      const parallel = await executeToolsParallel(mixpanel, stepResult.toolCalls, allToolCallSummaries);
      toolResults = parallel.toolResults;
      if (parallel.lastRawData) lastRawData = parallel.lastRawData;
    }

    return res.status(422).json({ error: true, code: 'MAX_ITERATIONS', message: '질의가 너무 복잡합니다.' } as QueryErrorResponse);
  } catch (error: any) {
    console.error('Query error:', error);
    if (lastRawData) {
      const table = parseToTable(lastRawData);
      const chart = parseToChart(table);
      return res.status(200).json({
        answer: `처리 중 오류가 발생했지만, 수집된 데이터를 표시합니다: ${error.message}`,
        metadata: { toolCalls: allToolCallSummaries, dateRange: '', dimensions: [], metrics: [] },
        table, chart: chart ?? undefined,
      } as QueryResponse);
    }
    return res.status(500).json({ error: true, code: 'LLM_ERROR', message: `처리 중 오류가 발생했습니다: ${error.message}` } as QueryErrorResponse);
  }
});

// SSE 스트리밍 엔드포인트
router.post('/query/stream', async (req: Request, res: Response) => {
  const { question, provider: providerName, projectId, sessionToken, activeEvent } = req.body as QueryRequest;

  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: true, code: 'LLM_ERROR', message: '질문을 입력해 주세요.' });
  }

  if (!projectId || !sessionToken) {
    return res.status(400).json({ error: true, code: 'MIXPANEL_ERROR', message: 'Mixpanel 연결과 프로젝트 선택이 필요합니다.' });
  }

  let mixpanel: MixpanelClient;
  try {
    mixpanel = createMixpanelClientFromSession(sessionToken, projectId);
  } catch (error: any) {
    return res.status(401).json({ error: true, code: 'MIXPANEL_ERROR', message: error.message });
  }

  // SSE 헤더 설정
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const llmProvider = createProvider(providerName ?? (process.env.LLM_PROVIDER as any) ?? 'anthropic');
  const startTime = Date.now();
  let messages: unknown[] = [];
  let iteration = 0;
  let lastRawData: unknown = null;
  const allToolCallSummaries: string[] = [];

  try {
    let toolResults: ToolResult[] = [];

    while (iteration < MAX_ITERATIONS) {
      if (Date.now() - startTime > TIMEOUT_MS) {
        send('error', { code: 'TIMEOUT', message: '질의 처리 시간이 초과되었습니다.' });
        return res.end();
      }

      send('status', { step: 'llm', iteration: iteration + 1, message: 'AI가 분석 중...' });

      const systemPrompt = getSystemPrompt(activeEvent);
      const { stepResult, messages: updatedMessages } = await llmProvider.chat(question, mixpanelTools, toolResults, messages, systemPrompt);
      messages = updatedMessages;
      iteration++;

      if (stepResult.type === 'answer') {
        const table = lastRawData ? parseToTable(lastRawData) : { columns: [], rows: [], totalRows: 0 };
        const chart = parseToChart(table);
        if (allToolCallSummaries.length > 0 && stepResult.metadata.toolCalls.length === 0) {
          stepResult.metadata.toolCalls = allToolCallSummaries;
        }
        send('result', { answer: stepResult.answer, metadata: stepResult.metadata, table, chart: chart ?? undefined });
        return res.end();
      }

      // tool-use → 병렬 실행
      send('status', { step: 'tool', tool: stepResult.toolCalls.map(t => t.name).join(', '), message: `${stepResult.toolCalls.map(t => t.name).join(', ')} 호출 중...` });
      const parallel = await executeToolsParallel(mixpanel, stepResult.toolCalls, allToolCallSummaries);
      toolResults = parallel.toolResults;
      if (parallel.lastRawData) lastRawData = parallel.lastRawData;
    }

    send('error', { code: 'MAX_ITERATIONS', message: '질의가 너무 복잡합니다.' });
    res.end();
  } catch (error: any) {
    console.error('Stream query error:', error);
    send('error', { code: 'LLM_ERROR', message: error.message });
    res.end();
  }
});

export default router;
