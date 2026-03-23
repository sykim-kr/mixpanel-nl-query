import { Router, Request, Response } from 'express';
import { QueryRequest, QueryResponse, QueryErrorResponse, ToolResult } from '../types';
import { createProvider } from '../llm/provider';
import { mixpanelTools } from '../mixpanel/tools';
import { MixpanelClient } from '../mixpanel/client';
import { parseToTable, parseToChart } from '../mixpanel/parser';

const router = Router();
const MAX_ITERATIONS = 10;
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
        const table = lastRawData ? parseToTable(lastRawData) : { columns: [], rows: [], totalRows: 0 };
        const chart = parseToChart(table);

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
