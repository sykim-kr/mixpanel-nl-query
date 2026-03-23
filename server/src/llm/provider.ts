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
    previousMessages: unknown[],
    systemPrompt?: string
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
