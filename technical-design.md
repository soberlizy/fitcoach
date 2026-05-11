# FitCoach AI Agent 技术方案

## 1. 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js)                       │
│   chat.tsx ←→ plan.tsx ←→ workout.tsx ←→ diet.tsx           │
└────────────────────────┬─────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      Agent API Layer                         │
│                   pages/api/agent/chat.ts                     │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      FitCoachAgent                            │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Agent Core                           │  │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │ Reasoning   │  │ Planner      │  │ Evaluator      │  │  │
│  │  │ Engine      │  │              │  │                │  │  │
│  │  │ (ReAct)     │  │ Task Decompose│  │ Self-Reflection│  │  │
│  │  └─────────────┘  └──────────────┘  └────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Memory System                         │  │
│  │  ┌────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │ ShortTerm  │ │ LongTerm     │ │ Working          │  │  │
│  │  │ (对话窗口) │ │ (IndexedDB)  │ │ (执行上下文)     │  │  │
│  │  └────────────┘ └──────────────┘ └──────────────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                    Tool Registry                        │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │  │
│  │  │Fitness   │ │Knowledge │ │Planning  │ │Analysis  │  │  │
│  │  │Tools     │ │Tools     │ │Tools     │ │Tools     │  │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │  │
│  └────────────────────────────────────────────────────────┘  │
└────────────────────────┬─────────────────────────────────────┘
                         │ LLM API
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                      LLM Provider                             │
│              (Anthropic Claude / Kimi K2)                    │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 目录结构

```
fitcoach/
├── agents/
│   ├── core/
│   │   ├── agent.ts              # Agent 主入口
│   │   ├── reasoning.ts          # ReAct 推理引擎
│   │   ├── planner.ts            # 任务规划器
│   │   └── evaluator.ts          # 反思评估器
│   ├── memory/
│   │   ├── index.ts              # 记忆系统统一导出
│   │   ├── short-term.ts         # 短期记忆（对话窗口）
│   │   ├── long-term.ts          # 长期记忆（IndexedDB）
│   │   └── working.ts             # 工作记忆
│   ├── tools/
│   │   ├── index.ts              # 工具注册表
│   │   ├── base.ts                # 工具基类
│   │   ├── fitness-tools.ts       # 健身工具
│   │   └── knowledge-tools.ts     # 知识工具
│   ├── prompts/
│   │   ├── system-prompt.ts      # Agent 系统提示词
│   │   └── react-prompt.ts       # ReAct 提示模板
│   └── fitness-agent.ts          # 旧文件（兼容保留）
├── pages/
│   └── api/
│       └── agent/
│           └── chat.ts           # Agent 对话 API
└── lib/
    └── types.ts                  # 扩展类型定义
```

---

## 3. 核心模块设计

### 3.1 Agent Core

```typescript
// agents/core/agent.ts

import { ReasoningEngine } from './reasoning';
import { Planner } from './planner';
import { Evaluator } from './evaluator';
import { MemorySystem } from '../memory';
import { ToolRegistry } from '../tools';
import { AgentConfig, AgentResponse, Message } from '@/lib/types';

export class FitCoachAgent {
  private reasoning: ReasoningEngine;
  private planner: Planner;
  private evaluator: Evaluator;
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.memory = new MemorySystem();
    this.tools = new ToolRegistry();
    this.planner = new Planner(this.memory, this.tools);
    this.reasoning = new ReasoningEngine(this.memory, this.tools, this.planner);
    this.evaluator = new Evaluator(this.memory);
  }

  async process(userMessage: string): Promise<AgentResponse> {
    // 1. 存储用户消息到短期记忆
    await this.memory.addMessage('user', userMessage);

    // 2. 加载用户长期记忆上下文
    const context = await this.memory.getContext();

    // 3. 使用 ReAct 推理
    const response = await this.reasoning.run(userMessage, context);

    // 4. 评估响应质量
    await this.evaluator.evaluate(response);

    // 5. 存储 Agent 响应到记忆
    await this.memory.addMessage('assistant', response.content);

    // 6. 检查是否需要主动干预
    await this.checkProactiveActions(response);

    return response;
  }

  private async checkProactiveActions(response: AgentResponse): Promise<void> {
    // 检查是否需要主动提醒、调整计划等
    if (response.shouldRemind) {
      await this.memory.addReminder(response.reminder);
    }
    if (response.planAdjustment) {
      await this.planner.adjustCurrentPlan(response.planAdjustment);
    }
  }
}
```

### 3.2 Reasoning Engine (ReAct)

```typescript
// agents/core/reasoning.ts

interface ReActStep {
  thought: string;
  action?: string;
  actionInput?: any;
  observation?: string;
}

export class ReasoningEngine {
  private memory: MemorySystem;
  private tools: ToolRegistry;
  private planner: Planner;

  constructor(memory: MemorySystem, tools: ToolRegistry, planner: Planner) {
    this.memory = memory;
    this.tools = tools;
    this.planner = planner;
  }

  async run(userMessage: string, context: MemoryContext): Promise<AgentResponse> {
    const steps: ReActStep[] = [];
    let maxIterations = 10;
    let currentObservation = '';

    while (maxIterations-- > 0) {
      // 1. 生成 Thought
      const thoughtPrompt = this.buildThoughtPrompt(userMessage, context, steps, currentObservation);
      const thought = await this.callLLM(thoughtPrompt);

      // 2. 判断是否需要执行 Action
      if (this.isFinalAnswer(thought)) {
        return this.extractFinalAnswer(thought);
      }

      // 3. 解析 Action 和参数
      const action = this.parseAction(thought);
      if (!action) {
        // 无需工具，直接返回思考结果
        return { content: thought, steps, isComplete: true };
      }

      // 4. 执行 Action
      const tool = this.tools.get(action.name);
      if (!tool) {
        currentObservation = `Error: Tool ${action.name} not found`;
      } else {
        currentObservation = await tool.execute(action.input);
      }

      steps.push({
        thought,
        action: action.name,
        actionInput: action.input,
        observation: currentObservation
      });

      // 5. 更新上下文
      context.lastObservation = currentObservation;
    }

    // 达到最大迭代次数，返回累积结果
    return {
      content: this.summarizeSteps(steps),
      steps,
      isComplete: true,
      maxIterationsReached: true
    };
  }

  private buildThoughtPrompt(
    userMessage: string,
    context: MemoryContext,
    steps: ReActStep[],
    lastObservation: string
  ): string {
    // 构建 ReAct 提示词，包含系统提示、记忆上下文、历史步骤
  }
}
```

### 3.3 Memory System

```typescript
// agents/memory/index.ts

export interface MemoryContext {
  userProfile?: UserProfile;
  recentWorkouts: WorkoutLog[];
  recentDiet: DietLog[];
  conversationHistory: Message[];
  currentPlan?: TrainingPlan;
  pendingTasks: Task[];
  lastObservation?: string;
}

export class MemorySystem {
  private shortTerm: ShortTermMemory;
  private longTerm: LongTermMemory;
  private working: WorkingMemory;

  constructor() {
    this.shortTerm = new ShortTermMemory(10); // 最近10轮
    this.longTerm = new LongTermMemory();
    this.working = new WorkingMemory();
  }

  async addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
    await this.shortTerm.add({ role, content, timestamp: Date.now() });
  }

  async getContext(): Promise<MemoryContext> {
    const [profile, recentWorkouts, recentDiet, currentPlan] = await Promise.all([
      this.longTerm.getProfile(),
      this.longTerm.getRecentWorkouts(7),
      this.longTerm.getRecentDiet(7),
      this.longTerm.getCurrentPlan()
    ]);

    return {
      userProfile: profile,
      recentWorkouts,
      recentDiet,
      conversationHistory: this.shortTerm.getHistory(),
      currentPlan,
      pendingTasks: this.working.getTasks()
    };
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    await this.longTerm.updateProfile(updates);
  }

  async addReminder(reminder: Reminder): Promise<void> {
    await this.longTerm.addReminder(reminder);
  }
}

// 短期记忆 - 固定窗口
class ShortTermMemory {
  private messages: Message[] = [];
  private windowSize: number;

  constructor(windowSize = 10) {
    this.windowSize = windowSize;
  }

  add(message: Message): void {
    this.messages.push(message);
    if (this.messages.length > this.windowSize) {
      this.messages.shift(); // 移除最老的
    }
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  summarize(): string {
    // 使用 LLM 总结对话要点
  }
}

// 长期记忆 - IndexedDB
class LongTermMemory {
  private storage: AgentStorage;

  constructor() {
    this.storage = new AgentStorage();
  }

  async getProfile(): Promise<UserProfile | undefined> {
    return this.storage.get('profile');
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    const current = await this.getProfile();
    await this.storage.put('profile', { ...current, ...updates, updatedAt: new Date().toISOString() });
  }

  async getRecentWorkouts(days: number): Promise<WorkoutLog[]> {
    return this.storage.getRange('workouts', days);
  }

  async addWorkout(workout: WorkoutLog): Promise<void> {
    await this.storage.put('workouts', workout);
  }

  async getCurrentPlan(): Promise<TrainingPlan | undefined> {
    return this.storage.get('currentPlan');
  }

  async savePlan(plan: TrainingPlan): Promise<void> {
    await this.storage.put('currentPlan', plan);
  }

  async addReminder(reminder: Reminder): Promise<void> {
    await this.storage.put('reminders', reminder);
  }
}

// 工作记忆 - 当前任务状态
class WorkingMemory {
  private tasks: Task[] = [];
  private currentPlan?: TrainingPlan;
  private evaluationCache: Map<string, any>;

  addTask(task: Task): void {
    this.tasks.push(task);
  }

  completeTask(taskId: string): void {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
  }

  setCurrentPlan(plan: TrainingPlan): void {
    this.currentPlan = plan;
  }

  cacheEvaluation(key: string, value: any): void {
    this.evaluationCache.set(key, value);
  }
}
```

### 3.4 Tool Registry

```typescript
// agents/tools/index.ts

export abstract class BaseTool {
  abstract name: string;
  abstract description: string;
  abstract parameters: z.ZodSchema;

  abstract execute(input: any): Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  constructor() {
    this.registerDefaultTools();
  }

  private registerDefaultTools(): void {
    // Fitness Tools
    this.register(new AnalyzeBodyFatTool());
    this.register(new GeneratePlanTool());
    this.register(new UpdatePlanTool());
    this.register(new AnalyzeFoodTool());
    this.register(new AnalyzeExerciseTool());

    // Knowledge Tools
    this.register(new QueryKnowledgeTool());
    this.register(new CalculateNutritionTool());
    this.register(new AssessProgressTool());
  }

  register(tool: BaseTool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  getSchema(): object[] {
    return this.getAll().map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
  }
}

// 健身工具示例
export class AnalyzeBodyFatTool extends BaseTool {
  name = 'analyze_body_fat';
  description = '分析用户上传的照片来估算体脂率。输入为包含 sideImageData 和可选 frontImageData 的对象。';
  parameters = z.object({
    sideImageData: z.string(),
    frontImageData: z.string().optional()
  });

  async execute(input: any): Promise<string> {
    // 调用现有的 fitness-agent 的 analyzeBodyFat 方法
    const result = await fitnessAgent.analyzeBodyFat(input.sideImageData, input.frontImageData);
    return JSON.stringify(result);
  }
}
```

### 3.5 Planner

```typescript
// agents/core/planner.ts

interface Task {
  id: string;
  type: 'primary' | 'follow-up' | 'proactive';
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  dependsOn?: string[];
}

export class Planner {
  private memory: MemorySystem;
  private tools: ToolRegistry;

  constructor(memory: MemorySystem, tools: ToolRegistry) {
    this.memory = memory;
    this.tools = tools;
  }

  async createPlan(goal: string, context: MemoryContext): Promise<Task[]> {
    // 使用 LLM 分解目标为具体任务
    const prompt = `
目标: ${goal}

用户信息:
- 目标: ${context.userProfile?.goal}
- 经验: ${context.userProfile?.experience}
- 训练频率: ${context.userProfile?.trainingDaysPerWeek}天/周

请将这个目标分解为具体任务列表。返回 JSON 数组：
[{"id": "t1", "type": "primary", "description": "...", "priority": "high"}, ...]

规则:
1. 第一个任务应该是收集更多信息（如用户没有完整profile）
2. 后续任务按逻辑顺序排列
3. 每个任务应该有明确的执行步骤`;

    const response = await callLLM(prompt);
    const tasks = JSON.parse(extractJSON(response));
    return tasks;
  }

  async adjustCurrentPlan(feedback: PlanAdjustment): Promise<void> {
    const currentPlan = await this.memory.getContext().currentPlan;
    if (!currentPlan) return;

    // 根据反馈规则调整计划
    if (feedback.type === 'reduce_difficulty') {
      const adjustedPlan = this.reduceDifficulty(currentPlan, feedback.amount);
      await this.memory.updatePlan(adjustedPlan);
    } else if (feedback.type === 'increase_difficulty') {
      const adjustedPlan = this.increaseDifficulty(currentPlan, feedback.amount);
      await this.memory.updatePlan(adjustedPlan);
    } else if (feedback.type === 'add_rest') {
      const adjustedPlan = this.addRestDays(currentPlan);
      await this.memory.updatePlan(adjustedPlan);
    }
  }

  private reduceDifficulty(plan: TrainingPlan, amount: number): TrainingPlan {
    // 降低每个动作的难度和组数
    return {
      ...plan,
      weeks: plan.weeks.map(week => ({
        ...week,
        days: week.days.map(day => ({
          ...day,
          exercises: day.exercises.map(ex => ({
            ...ex,
            difficulty: Math.max(1, ex.difficulty - amount) as 1|2|3|4|5,
            sets: Math.max(1, ex.sets - 1)
          }))
        }))
      }))
    };
  }
}
```

### 3.6 Evaluator

```typescript
// agents/core/evaluator.ts

export class Evaluator {
  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  async evaluate(response: AgentResponse): Promise<Evaluation> {
    const evaluation: Evaluation = {
      responseQuality: await this.assessResponseQuality(response),
      shouldRemind: false,
      shouldAdjustPlan: false,
      proactiveSuggestions: []
    };

    // 检查是否需要主动干预
    const context = await this.memory.getContext();

    // 检查训练完成情况
    if (context.recentWorkouts.length >= 3) {
      const completionRate = this.calculateCompletionRate(context.recentWorkouts);
      if (completionRate < 0.5) {
        evaluation.shouldRemind = true;
        evaluation.proactiveSuggestions.push({
          type: 'motivation',
          message: '我注意到最近训练完成率不太高，是遇到什么困难了吗？'
        });
      }
    }

    // 检查是否需要调整计划
    if (this.shouldAdjustPlan(context)) {
      evaluation.shouldAdjustPlan = true;
      evaluation.planAdjustment = this.determineAdjustment(context);
    }

    return evaluation;
  }

  private shouldAdjustPlan(context: MemoryContext): boolean {
    const workouts = context.recentWorkouts;
    if (workouts.length < 3) return false;

    // 连续低评分
    const recentRatings = workouts.slice(-3).map(w =>
      w.exercises[0]?.selfRating || 3
    );
    if (recentRatings.every(r => r <= 2)) return true;

    // 完成率过低
    const completionRate = this.calculateCompletionRate(workouts);
    if (completionRate < 0.5) return true;

    return false;
  }

  private calculateCompletionRate(workouts: WorkoutLog[]): number {
    if (workouts.length === 0) return 1;
    const completed = workouts.filter(w => w.status === 'completed').length;
    return completed / workouts.length;
  }
}
```

---

## 4. API 设计

### 4.1 Agent Chat API

```typescript
// pages/api/agent/chat.ts

interface AgentChatRequest {
  message: string;
  context?: {
    type?: 'workout' | 'diet' | 'general' | 'profile';
    imageData?: string;
  };
  sessionId?: string;
}

interface AgentChatResponse {
  content: string;
  suggestions?: string[];
  actions?: {
    type: 'reminder' | 'plan_adjustment' | 'knowledge_card';
    data: any;
  }[];
  steps?: ReActStep[]; // 调试用
}

// POST /api/agent/chat
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, context, sessionId } = req.body as AgentChatRequest;

  // 初始化 Agent（使用单例）
  const agent = await AgentFactory.getOrCreate(sessionId);

  // 处理消息
  const response = await agent.process(message, context);

  // 返回流式响应
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // 流式发送响应
  for (const chunk of streamResponse(response)) {
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }

  res.end();
}
```

---

## 5. 类型扩展

```typescript
// lib/types.ts 扩展

export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
}

export interface AgentResponse {
  content: string;
  steps?: ReActStep[];
  isComplete: boolean;
  maxIterationsReached?: boolean;
  shouldRemind?: boolean;
  reminder?: Reminder;
  planAdjustment?: PlanAdjustment;
  suggestions?: string[];
}

export interface ReActStep {
  thought: string;
  action?: string;
  actionInput?: any;
  observation?: string;
}

export interface Reminder {
  id: string;
  type: 'motivation' | 'checkin' | 'education' | 'warning';
  message: string;
  createdAt: string;
  dismissed?: boolean;
}

export interface PlanAdjustment {
  type: 'reduce_difficulty' | 'increase_difficulty' | 'add_rest' | 'change_focus';
  amount?: number;
  reason: string;
  planId: string;
}

export interface Task {
  id: string;
  type: 'primary' | 'follow-up' | 'proactive';
  description: string;
  status: 'pending' | 'in-progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
}

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface Evaluation {
  responseQuality: 'excellent' | 'good' | 'needs_improvement';
  shouldRemind: boolean;
  shouldAdjustPlan: boolean;
  proactiveSuggestions: ProactiveSuggestion[];
  planAdjustment?: PlanAdjustment;
}

export interface ProactiveSuggestion {
  type: 'motivation' | 'tip' | 'warning' | 'adjustment';
  message: string;
}
```

---

## 6. 实现顺序

| 阶段 | 任务 | 文件 |
|------|------|------|
| **Phase 1** | 扩展 types.ts | lib/types.ts |
| **Phase 1** | 创建 Agent 基础类型 | agents/core/types.ts |
| **Phase 1** | 实现 Memory System | agents/memory/ |
| **Phase 1** | 实现 Tool 基类 | agents/tools/base.ts |
| **Phase 1** | 实现 Fitness Tools | agents/tools/fitness-tools.ts |
| **Phase 1** | 实现 Tool Registry | agents/tools/index.ts |
| **Phase 2** | 实现 Reasoning Engine | agents/core/reasoning.ts |
| **Phase 2** | 实现 Planner | agents/core/planner.ts |
| **Phase 2** | 实现 Evaluator | agents/core/evaluator.ts |
| **Phase 2** | 实现 FitCoachAgent 主类 | agents/core/agent.ts |
| **Phase 3** | 创建 Agent API | pages/api/agent/chat.ts |
| **Phase 3** | 更新前端集成 | pages/chat.tsx |
| **Phase 4** | 测试和调试 | - |

---

## 7. 关键设计决策

### 7.1 为什么选择 ReAct 而非纯 CoT？

| 模式 | 优点 | 缺点 | 适用场景 |
|------|------|------|----------|
| **ReAct** | 可调用工具、交互式 | 速度较慢 | 需要获取外部信息的任务 |
| **CoT** | 速度快、连贯性强 | 不能主动获取信息 | 纯推理、写作任务 |

健身 Agent 需要分析图片、获取用户数据等，**ReAct 更合适**。

### 7.2 记忆窗口大小

- 短期记忆：10 轮对话（约 5K tokens）
- 长期记忆：全部用户数据（IndexedDB）
- 工作记忆：当前任务状态（内存）

### 7.3 安全策略

1. **输出过滤**：Agent 输出经过安全检查
2. **工具权限**：敏感工具（如修改计划）需要明确用户意图
3. **医疗边界**：涉及伤病描述时，强制输出建议就医提示

---

## 8. 依赖

```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.95.1",
    "idb": "^8.0.3",
    "zod": "^4.4.3"
  }
}
```

现有 package.json 已包含所有必需依赖。
