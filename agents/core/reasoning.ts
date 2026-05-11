import type { ReActStep, AgentResponse, MemoryContext, ToolResult, TrainingPlan } from './types';
import type { MemorySystem } from '../memory';
import type { ToolRegistry } from '../tools';
import { getSystemPrompt } from '../prompts/system-prompt';
import { createMessageWithTools, AI_MODEL, type ToolUseBlock, type TextBlock } from '@/lib/anthropic';
import { getAgentContext, setAgentContext, clearAgentContext } from './context-holder';

interface ReasoningConfig {
  maxIterations: number;
  model: string;
  maxTokens: number;
}

const DEFAULT_CONFIG: ReasoningConfig = {
  maxIterations: 10,
  model: process.env.AI_TEST_AGENT_MODEL || 'kimi-k2.6-latest',
  maxTokens: 4096
};

interface SDKMessage {
  role: 'user' | 'assistant';
  content: string;
}

export class ReasoningEngine {
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private config: ReasoningConfig;

  constructor(memory: MemorySystem, tools: ToolRegistry, config: Partial<ReasoningConfig> = {}) {
    this.memory = memory;
    this.tools = tools;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async run(userMessage: string, context: MemoryContext): Promise<AgentResponse> {
    const steps: ReActStep[] = [];
    let generatedPlan: TrainingPlan | undefined;
    let finalContent = '';

    const systemPrompt = getSystemPrompt();
    const sdkTools = this.tools.getSDKTools();
    const messages: SDKMessage[] = [];

    setAgentContext(context);

    try {
      const response = await this.executeLoop(
        userMessage,
        systemPrompt,
        sdkTools,
        messages,
        steps,
        (plan) => { generatedPlan = plan; }
      );

      return {
        content: response,
        steps,
        isComplete: true,
        generatedPlan
      };
    } catch (error) {
      return {
        content: `抱歉，我遇到了一些问题：${error instanceof Error ? error.message : '未知错误'}`,
        steps,
        isComplete: true,
        error: error instanceof Error ? error.message : 'LLM call failed'
      };
    } finally {
      clearAgentContext();
    }
  }

  private async executeLoop(
    userMessage: string,
    systemPrompt: string,
    sdkTools: { name: string; description: string; input_schema: any }[],
    messages: SDKMessage[],
    steps: ReActStep[],
    onPlanGenerated: (plan: TrainingPlan) => void
  ): Promise<string> {
    const maxIterations = this.config.maxIterations;
    let iteration = 0;

    messages.push({ role: 'user', content: userMessage });

    while (iteration < maxIterations) {
      iteration++;
      const result = await createMessageWithTools({
        model: AI_MODEL,
        maxTokens: this.config.maxTokens,
        system: systemPrompt,
        messages: [...messages],
        tools: sdkTools
      });

      const contentBlocks = result.content;

      let textResponse = '';
      let hasToolUse = false;

      for (const block of contentBlocks) {
        if (block.type === 'text') {
          const textBlock = block as TextBlock;
          messages.push({
            role: 'assistant',
            content: textBlock.text
          });
          textResponse = textBlock.text;
        }

        if (block.type === 'tool_use') {
          hasToolUse = true;
          const toolBlock = block as ToolUseBlock;
          const toolName = toolBlock.name;
          const toolInput = toolBlock.input;

          steps.push({
            thought: `调用工具 ${toolName}`,
            action: toolName,
            actionInput: toolInput
          });

          const toolResult = await this.executeTool(toolName, toolInput);

          if (toolResult.parsedPlan) {
            onPlanGenerated(toolResult.parsedPlan);
          }

          const resultContent = toolResult.success
            ? toolResult.output
            : `Error: ${toolResult.error}`;

          messages.push({
            role: 'user' as const,
            content: `tool_result: ${resultContent}`
          });

          steps[steps.length - 1].observation = resultContent;
        }
      }

      if (textResponse && !hasToolUse) {
        return textResponse;
      }

      if (contentBlocks.length === 0) {
        return '抱歉，我无法处理这个请求。';
      }
    }

    return '抱歉，我需要更多时间来处理这个请求。';
  }

  private async executeTool(name: string, input: unknown): Promise<ToolResult> {
    return this.tools.execute(name, input);
  }

  private summarizeSteps(steps: ReActStep[]): string {
    if (steps.length === 0) {
      return '抱歉，我无法处理这个请求。';
    }

    const lastStep = steps[steps.length - 1];
    if (lastStep.observation) {
      return lastStep.observation;
    }

    return '我完成了分析，但结果有些超出预期。建议你直接描述你想要什么，我会更好地帮助你。';
  }
}
