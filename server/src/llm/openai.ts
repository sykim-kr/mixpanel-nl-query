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

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      return {
        stepResult: {
          type: 'tool_use',
          toolCalls: assistantMessage.tool_calls
            .filter((tc): tc is OpenAI.ChatCompletionMessageFunctionToolCall => tc.type === 'function')
            .map(tc => ({
              name: tc.function.name,
              input: JSON.parse(tc.function.arguments),
              toolCallId: tc.id,
            })),
        },
        messages: updatedMessages,
      };
    }

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
