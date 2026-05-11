import { BaseTool } from './base';
import type { ToolResult, UserProfile } from '../core/types';

const API_BASE = '';

async function callChatAPI(prompt: string, maxTokens = 1024): Promise<string> {
  const response = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, maxTokens })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API call failed');
  }

  const data = await response.json();
  return data.result;
}

interface QueryKnowledgeInput {
  question: string;
  category?: 'training' | 'nutrition' | 'recovery' | 'general';
}

export class QueryKnowledgeTool extends BaseTool {
  name = 'query_knowledge';
  description = '回答用户关于健身、营养、训练计划等方面的知识性问题。';
  parameterDescriptions = {
    question: '用户的问题',
    category: '问题类别：training(训练)、nutrition(营养)、recovery(恢复)、general(通用)'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { question, category = 'general' } = input as QueryKnowledgeInput;

    const categoryContext: Record<string, string> = {
      training: '请从专业健身教练的角度回答，重点关注训练方法、动作要领、训练计划设计等。',
      nutrition: '请从专业营养师的角度回答，重点关注食物营养素、热量计算、饮食搭配等。',
      recovery: '请从运动康复专家的角度回答，重点关注恢复方法、伤病预防、休息质量等。',
      general: '请作为专业的健身教练回答这个问题。'
    };

    const prompt = `${categoryContext[category]}

用户问题：${question}

请用简洁、专业的语言回答。如果不确定答案，请诚实地说明。`;

    try {
      const result = await callChatAPI(prompt, 1024);
      return { success: true, output: result };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Query failed'
      };
    }
  }
}

interface AssessProgressInput {
  profile: UserProfile;
  workoutHistory: unknown[];
  dietHistory: unknown[];
}

export class AssessProgressTool extends BaseTool {
  name = 'assess_progress';
  description = '根据用户的训练和饮食历史评估进度，给出综合报告。';
  parameterDescriptions = {
    profile: '用户profile对象',
    workoutHistory: '最近的训练日志数组',
    dietHistory: '最近的饮食日志数组'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { profile, workoutHistory, dietHistory } = input as AssessProgressInput;

    const prompt = `请根据以下用户信息评估其健身进度。

用户基本信息：
- 健身目标：${profile.goal === 'fat_loss' ? '减脂' : profile.goal === 'muscle_gain' ? '增肌' : profile.goal === 'shaping' ? '塑形' : profile.goal === 'maintain' ? '维持' : '体态矫正'}
- 当前体重：${profile.weight}kg
- 身高：${profile.height}cm
- 经验水平：${profile.experience === 'beginner' ? '新手' : profile.experience === 'intermediate' ? '中级' : '高级'}

训练历史（最近7天）：
${JSON.stringify(workoutHistory, null, 2)}

饮食历史（最近7天）：
${JSON.stringify(dietHistory, null, 2)}

请给出：
1. 进度评估（优秀/良好/一般/需改进）
2. 具体分析
3. 改进建议（2-3条）

请用 JSON 格式返回：
{
  "rating": "优秀" | "良好" | "一般" | "需改进",
  "analysis": "具体分析说明",
  "suggestions": ["建议1", "建议2", "建议3"]
}`;

    try {
      const result = await callChatAPI(prompt, 1024);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, output: jsonMatch[0] };
      }

      return {
        success: true,
        output: JSON.stringify({
          rating: '良好',
          analysis: '整体进度正常，请继续保持',
          suggestions: ['注意休息', '坚持规律训练']
        })
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Assessment failed'
      };
    }
  }
}

interface UpdatePlanInput {
  currentPlan: unknown;
  feedback: {
    type: 'reduce_difficulty' | 'increase_difficulty' | 'add_rest' | 'modify_exercises';
    reason: string;
    workoutData?: unknown;
  };
}

export class UpdatePlanTool extends BaseTool {
  name = 'update_plan';
  description = '根据用户反馈更新训练计划。';
  parameterDescriptions = {
    currentPlan: '当前训练计划',
    feedback: '反馈信息，包含类型和原因'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { currentPlan, feedback } = input as UpdatePlanInput;

    const adjustmentDescriptions: Record<string, string> = {
      reduce_difficulty: '降低训练难度，减少动作组数和重量',
      increase_difficulty: '增加训练强度，提高动作难度',
      add_rest: '增加休息日，减少训练频率',
      modify_exercises: '根据用户反馈修改特定动作'
    };

    const prompt = `请根据以下反馈调整训练计划。

当前计划：
${JSON.stringify(currentPlan, null, 2)}

调整类型：${adjustmentDescriptions[feedback.type] || feedback.type}
调整原因：${feedback.reason}

${feedback.workoutData ? `用户最近训练数据：${JSON.stringify(feedback.workoutData, null, 2)}` : ''}

请生成调整后的训练计划，保持 JSON 格式。`;

    try {
      const result = await callChatAPI(prompt, 2048);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, output: jsonMatch[0] };
      }

      return {
        success: false,
        output: '',
        error: 'Failed to parse updated plan'
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Plan update failed'
      };
    }
  }
}

export class GenerateMotivationTool extends BaseTool {
  name = 'generate_motivation';
  description = '生成激励性消息鼓励用户坚持训练。';
  parameterDescriptions = {
    userName: '用户昵称（可选）',
    context: '当前情境描述，如"用户连续3天未训练"'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { userName, context } = input as { userName?: string; context?: string };

    const prompt = `请生成一条激励性的消息，鼓励用户坚持健身。

${userName ? `用户昵称：${userName}` : ''}
${context ? `当前情况：${context}` : ''}

要求：
1. 语言温暖、正向
2. 简短有力（50字以内）
3. 符合中文表达习惯
4. 不要过于鸡汤，要实际可行

直接返回消息文本，不要其他内容。`;

    try {
      const result = await callChatAPI(prompt, 256);
      return { success: true, output: result.trim() };
    } catch (error) {
      return {
        success: true,
        output: '休息也是训练的一部分，明天继续加油！'
      };
    }
  }
}
