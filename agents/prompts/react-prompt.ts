import type { ReActStep, MemoryContext } from '../core/types';

export function buildReActPrompt(
  userMessage: string,
  context: MemoryContext,
  history: ReActStep[]
): string {
  const historySection = buildHistorySection(history);
  const contextSection = buildContextSection(context);

  return `## 用户消息
${userMessage}

${contextSection}

${historySection}

## 可用工具
${getToolList()}

## 输出格式

请用以下 JSON 格式输出你的思考过程：
{
  "thought": "你的思考：用户想要什么？我需要做什么？",
  "action": "工具名称（如果需要调用工具）",
  "actionInput": { "参数": "值" }（如果调用工具）
}

如果不需要调用工具，直接给出回答。

## 规则

1. 每次只执行一个 action
2. 如果用户问题模糊，先尝试理解，必要时主动询问
3. 如果需要用户信息但没有，主动调用工具获取
4. 分析照片时，先调用相应工具
5. 给出最终回答后就不用再调用工具了`;
}

function buildHistorySection(history: ReActStep[]): string {
  if (history.length === 0) {
    return '## 对话历史\n（暂无历史记录）';
  }

  const steps = history.map((step, i) => {
    let s = `### 步骤 ${i + 1}\n`;
    s += `- Thought: ${step.thought}\n`;
    if (step.action) {
      s += `- Action: ${step.action}\n`;
      s += `- Action Input: ${JSON.stringify(step.actionInput)}\n`;
    }
    if (step.observation) {
      s += `- Observation: ${step.observation}\n`;
    }
    return s;
  }).join('\n');

  return `## 对话历史\n${steps}`;
}

function buildContextSection(context: MemoryContext): string {
  const parts: string[] = ['## 用户上下文'];

  if (context.userProfile) {
    const p = context.userProfile;
    const profileLines = [
      `### 用户Profile`,
      `- 目标：${getGoalText(p.goal)}`,
      `- 经验：${getExperienceText(p.experience)}`,
      `- 体重：${p.weight}kg | 身高：${p.height}cm`,
      `- 训练频率：${p.trainingDaysPerWeek}天/周`
    ];
    if (p.bodyFatPercent !== undefined) {
      profileLines.push(`- 体脂率：${p.bodyFatPercent}%`);
    }
    parts.push(profileLines.join('\n'));
  } else {
    parts.push('### 用户Profile\n（暂无profile信息）');
  }

  if (context.currentPlan) {
    const plan = context.currentPlan;
    parts.push(`### 当前计划
- 状态：${plan.status}
- 周期：${plan.startDate} ~ ${plan.endDate}
- 目标：${plan.goal}`);
    if (plan.weeks && plan.weeks.length > 0) {
      const currentWeekIndex = 0;
      const currentWeek = plan.weeks[currentWeekIndex];
      if (currentWeek) {
        const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        const workoutDays = currentWeek.days
          .filter(d => !d.isRestDay)
          .map(d => `${dayNames[d.dayOfWeek - 1]}: ${d.exercises.slice(0, 3).map(e => e.name).join(', ')}`)
          .join('\n  ');
        if (workoutDays) {
          parts.push(`- 本周训练安排：\n  ${workoutDays}`);
        }
      }
    }
  }

  if (context.recentWorkouts.length > 0) {
    const recent = context.recentWorkouts.slice(0, 5);
    const workoutSummary = recent.map(w => {
      const exerciseNames = w.exercises.slice(0, 4).map(e => e.exerciseName).join(', ');
      return `${w.date}: ${w.status} - ${exerciseNames}`;
    }).join('\n');
    parts.push(`### 最近训练记录\n${workoutSummary}`);
  }

  if (context.recentDiet.length > 0) {
    const recent = context.recentDiet.slice(0, 3);
    const dietSummary = recent.map(d => {
      const mealTypes = d.meals.map(m => m.type).join(', ');
      const totalCal = d.totalNutrition.calories;
      return `${d.date}: ${mealTypes} 共${Math.round(totalCal)}kcal`;
    }).join('\n');
    parts.push(`### 近期饮食记录\n${dietSummary}`);
  }

  if (context.pendingTasks.length > 0) {
    const tasks = context.pendingTasks.map(t =>
      `- [${t.status}] ${t.description}`
    ).join('\n');
    parts.push(`### 待办任务\n${tasks}`);
  }

  if (context.statusAnalysis) {
    const sa = context.statusAnalysis;

    if (sa.workoutAnalysis.trend !== 'insufficient_data') {
      const trendText: Record<string, string> = {
        improving: '上升 📈',
        stable: '稳定',
        declining: '下降 📉'
      };
      const missedText = sa.workoutAnalysis.missedDays > 0
        ? `，距离上次训练 ${sa.workoutAnalysis.missedDays} 天`
        : '';

      parts.push(`### 运动状态分析
- 趋势：${trendText[sa.workoutAnalysis.trend]}${missedText}
- 完成率：${Math.round(sa.workoutAnalysis.completionRate * 100)}%
- 平均强度：${sa.workoutAnalysis.averageIntensity.toFixed(1)}/5`);
    }

    if (sa.dietAnalysis.trend !== 'insufficient_data') {
      const dietText: Record<string, string> = {
        healthy: '健康 ✅',
        unhealthy: '需改善 ⚠️',
        inconsistent: '不够规律'
      };

      parts.push(`### 饮食状态分析
- 趋势：${dietText[sa.dietAnalysis.trend]}
- 平均热量：${sa.dietAnalysis.averageCalories} kcal/天
- 饮食规律性：${Math.round(sa.dietAnalysis.mealRegularity * 100)}%`);
    }

    if (sa.warnings.length > 0) {
      parts.push('### ⚠️ 需要关注的问题');
      sa.warnings.forEach(w => parts.push(`- ${w}`));
    }

    if (sa.observations.length > 0) {
      parts.push('### 📝 积极观察');
      sa.observations.forEach(o => parts.push(`- ${o}`));
    }
  }

  return parts.join('\n\n');
}

function getToolList(): string {
  return `1. analyze_body_fat(sideImageData, frontImageData?) - 分析体脂率
2. generate_plan(profile) - 生成训练计划
3. analyze_food(imageData) - 分析食物热量
4. analyze_exercise(imageData, exerciseName) - 分析动作
5. calculate_nutrition(profile, trainingIntensity?) - 计算营养需求
6. query_knowledge(question, category?) - 健身知识问答
7. assess_progress(profile, workoutHistory, dietHistory) - 评估进度
8. update_plan(currentPlan, feedback) - 更新计划
9. generate_motivation(userName?, context?) - 生成激励消息`;
}

function getGoalText(goal: string): string {
  const goals: Record<string, string> = {
    fat_loss: '减脂',
    muscle_gain: '增肌',
    shaping: '塑形',
    maintain: '维持',
    posture: '体态矫正'
  };
  return goals[goal] || goal;
}

function getExperienceText(exp: string): string {
  const levels: Record<string, string> = {
    beginner: '新手',
    intermediate: '中级',
    advanced: '高级'
  };
  return levels[exp] || exp;
}

export function extractJSON(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export function isFinalAnswer(thought: string): boolean {
  const finalIndicators = [
    '最终回答',
    '最终回复',
    '可以直接回复用户',
    '不需要再调用工具',
    '无需再执行'
  ];

  return finalIndicators.some(indicator =>
    thought.toLowerCase().includes(indicator.toLowerCase())
  );
}

export function parseAction(text: string): { name: string; input: unknown } | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.action && parsed.actionInput) {
      return {
        name: parsed.action,
        input: parsed.actionInput
      };
    }

    return null;
  } catch {
    return null;
  }
}
