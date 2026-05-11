import type { AgentConfig, AgentResponse, MemoryContext, Reminder, Message } from './types';
import { ReasoningEngine } from './reasoning';
import { Planner } from './planner';
import { Evaluator } from './evaluator';
import { MemorySystem } from '../memory';
import { ToolRegistry, createToolRegistry } from '../tools';
import { generateId } from '@/lib/utils';
import { analyzeUserStatus } from './status-analyzer';
import { setAgentContext, clearAgentContext } from './context-holder';

const DEFAULT_CONFIG: AgentConfig = {
  model: process.env.AI_TEST_AGENT_MODEL || 'kimi-k2.6-latest',
  maxTokens: 4096,
  temperature: 0.7,
  maxIterations: 10
};

export class FitCoachAgent {
  private reasoning: ReasoningEngine;
  private planner: Planner;
  private evaluator: Evaluator;
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private config: AgentConfig;

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.memory = new MemorySystem(10);
    this.tools = createToolRegistry();
    this.planner = new Planner(this.memory, this.tools);
    this.reasoning = new ReasoningEngine(this.memory, this.tools, {
      maxIterations: this.config.maxIterations,
      model: this.config.model,
      maxTokens: this.config.maxTokens
    });
    this.evaluator = new Evaluator(this.memory);
  }

  async process(userMessage: string): Promise<AgentResponse> {
    await this.memory.addMessage('user', userMessage);

    const context = await this.memory.getContext();

    const response = await this.reasoning.run(userMessage, context);

    await this.memory.addMessage('assistant', response.content);

    const evaluation = await this.evaluator.evaluate(response, context);

    if (evaluation.shouldRemind && evaluation.proactiveSuggestions.length > 0) {
      response.shouldRemind = true;
      response.suggestions = evaluation.proactiveSuggestions.map(s => s.message);

      const reminder = await this.evaluator.createReminder(
        evaluation.proactiveSuggestions[0].type,
        evaluation.proactiveSuggestions[0].message
      );
      response.reminder = reminder;
    }

    if (evaluation.shouldAdjustPlan && evaluation.planAdjustment) {
      response.planAdjustment = evaluation.planAdjustment;
    }

    return response;
  }

  async processWithContext(
    userMessage: string,
    contextOverrides: Partial<MemoryContext>
  ): Promise<AgentResponse> {
    const baseContext = await this.memory.getContext();
    const mergedContext: MemoryContext = {
      ...baseContext,
      ...contextOverrides
    };

    if (contextOverrides.recentWorkouts || contextOverrides.recentDiet || contextOverrides.userProfile) {
      const statusAnalysis = analyzeUserStatus(
        mergedContext.userProfile,
        mergedContext.recentWorkouts,
        mergedContext.recentDiet
      );
      mergedContext.statusAnalysis = statusAnalysis;
    }

    setAgentContext(mergedContext);

    await this.memory.addMessage('user', userMessage);

    let response: AgentResponse;
    try {
      response = await this.reasoning.run(userMessage, mergedContext);
    } finally {
      clearAgentContext();
    }

    await this.memory.addMessage('assistant', response.content);

    return response;
  }

  async updateUserProfile(profile: Partial<NonNullable<MemoryContext['userProfile']>>): Promise<void> {
    await this.memory.updateProfile(profile);
  }

  async saveTrainingPlan(plan: MemoryContext['currentPlan']): Promise<void> {
    if (plan) {
      await this.memory.savePlan(plan);
    }
  }

  async logWorkout(workout: MemoryContext['recentWorkouts'][0]): Promise<void> {
    await this.memory.addWorkout(workout);
  }

  async adjustPlan(adjustment: Parameters<typeof this.planner.adjustCurrentPlan>[0]): Promise<void> {
    await this.planner.adjustCurrentPlan(adjustment);
  }

  getConversationHistory(): Message[] {
    return this.memory.shortTerm.getHistory();
  }

  clearShortTermMemory(): void {
    this.memory.clearShortTerm();
  }

  getTools(): ToolRegistry {
    return this.tools;
  }

  static createSession(): FitCoachAgent {
    return new FitCoachAgent();
  }
}

const agentInstances: Map<string, FitCoachAgent> = new Map();

export function getOrCreateAgent(sessionId: string): FitCoachAgent {
  let agent = agentInstances.get(sessionId);
  if (!agent) {
    agent = FitCoachAgent.createSession();
    agentInstances.set(sessionId, agent);
  }
  return agent;
}

export function removeAgent(sessionId: string): void {
  agentInstances.delete(sessionId);
}
