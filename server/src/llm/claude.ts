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

    const model = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

    const response = await this.client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      tools: anthropicTools,
      messages,
    });

    const updatedMessages = [...messages, { role: 'assistant' as const, content: response.content }];

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
