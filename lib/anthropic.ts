import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY || '';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || process.env.NEXT_PUBLIC_ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
const AI_MODEL = process.env.AI_TEST_AGENT_MODEL || 'kimi-k2.6-latest';

export const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  baseURL: ANTHROPIC_BASE_URL
});

console.log('Anthropic client initialized - baseURL:', ANTHROPIC_BASE_URL, 'model:', AI_MODEL, 'hasApiKey:', !!ANTHROPIC_API_KEY);

export { AI_MODEL };

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

export interface CreateMessageWithToolsOptions {
  model?: string;
  maxTokens?: number;
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  tools: {
    name: string;
    description: string;
    input_schema: {
      type: 'object';
      properties?: Record<string, { type: string; description?: string }>;
      required?: string[];
    };
  }[];
}

export interface ToolUseResult {
  content: (ToolUseBlock | TextBlock)[];
  stopReason?: string;
}

export async function createMessageWithTools(options: CreateMessageWithToolsOptions): Promise<ToolUseResult> {
  const { model, maxTokens, system, messages, tools } = options;

  console.log('[createMessageWithTools] tools count:', tools?.length);
  console.log('[createMessageWithTools] tools:', JSON.stringify(tools, null, 2));
  console.log('[createMessageWithTools] messages:', messages?.length);

  try {
    const response = await anthropic.messages.create({
      model: model || AI_MODEL,
      max_tokens: maxTokens || 4096,
      system,
      messages,
      tools,
      thinking: {
        type: 'disabled'
      }
    });

    console.log('[createMessageWithTools] response content count:', response.content.length);
    console.log('[createMessageWithTools] response content:', JSON.stringify(response.content, null, 2));

    const content = response.content.map((block) => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id,
          name: block.name,
          input: block.input
        };
      }
      return block;
    });

    return {
      content: content as (ToolUseBlock | TextBlock)[],
      stopReason: response.stop_reason || undefined
    };
  } catch (error) {
    console.error('Anthropic SDK tool use error:', error);
    throw error;
  }
}

export async function createMessage({
  model,
  maxTokens,
  system,
  messages
}: {
  model?: string;
  maxTokens?: number;
  system?: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
}) {
  console.log('createMessage - model:', model || AI_MODEL, 'messages count:', messages.length);

  try {
    const response = await anthropic.messages.create({
      model: model || AI_MODEL,
      max_tokens: maxTokens || 4096,
      system,
      messages,
      thinking: {
        type: 'disabled'
      }
    });

    const textContent = response.content.find((c) => c.type === 'text');
    return textContent?.type === 'text' ? textContent.text : '';
  } catch (error) {
    console.error('Anthropic SDK error:', error);
    throw error;
  }
}

export async function createMultiVisionMessage({
  model,
  maxTokens,
  imagesBase64,
  prompt
}: {
  model?: string;
  maxTokens?: number;
  imagesBase64: string[];
  prompt: string;
}) {
  const content: any[] = imagesBase64.map((imageData) => {
    const cleanData = imageData.replace(/^data:image\/\w+;base64,/, '');
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: cleanData
      }
    };
  });
  content.push({ type: 'text', text: prompt });

  const response = await anthropic.messages.create({
    model: model || AI_MODEL,
    max_tokens: maxTokens || 4096,
    thinking: {
      type: 'disabled'
    },
    messages: [{
      role: 'user',
      content
    }]
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return textContent?.type === 'text' ? textContent.text : '';
}

export async function createVisionMessage({
  model,
  maxTokens,
  imageBase64,
  prompt
}: {
  model?: string;
  maxTokens?: number;
  imageBase64: string;
  prompt: string;
}) {
  const cleanData = imageBase64.replace(/^data:image\/\w+;base64,/, '');

  const response = await anthropic.messages.create({
    model: model || AI_MODEL,
    max_tokens: maxTokens || 4096,
    thinking: {
      type: 'disabled'
    },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: cleanData
          }
        },
        {
          type: 'text',
          text: prompt
        }
      ]
    }]
  });

  const textContent = response.content.find((c) => c.type === 'text');
  return textContent?.type === 'text' ? textContent.text : '';
}
