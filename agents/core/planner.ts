import type { Task, PlanAdjustment, TrainingPlan, MemoryContext } from './types';
import type { MemorySystem } from '../memory';
import type { ToolRegistry } from '../tools';
import { generateId } from '@/lib/utils';

const API_BASE = '';

export class Planner {
  private memory: MemorySystem;
  private tools: ToolRegistry;

  constructor(memory: MemorySystem, tools: ToolRegistry) {
    this.memory = memory;
    this.tools = tools;
  }

  async createTasksFromGoal(goal: string, context: MemoryContext): Promise<Task[]> {
    const tasks: Task[] = [];

    if (!context.userProfile) {
      tasks.push({
        id: generateId(),
        type: 'primary',
        description: '收集用户健身信息以制定计划',
        status: 'pending',
        priority: 'high'
      });
    }

    if (goal.includes('训练计划') || goal.includes('计划')) {
      tasks.push({
        id: generateId(),
        type: 'primary',
        description: '生成个性化训练计划',
        status: 'pending',
        priority: 'high',
        dependsOn: tasks.length > 0 ? [tasks[0].id] : undefined
      });
    }

    if (goal.includes('饮食') || goal.includes('营养')) {
      tasks.push({
        id: generateId(),
        type: 'primary',
        description: '分析营养需求并给出饮食建议',
        status: 'pending',
        priority: 'medium'
      });
    }

    if (goal.includes('进度') || goal.includes('评估')) {
      tasks.push({
        id: generateId(),
        type: 'primary',
        description: '评估用户当前进度',
        status: 'pending',
        priority: 'medium'
      });
    }

    if (goal.includes('体脂') || goal.includes('分析')) {
      tasks.push({
        id: generateId(),
        type: 'primary',
        description: '分析身体数据',
        status: 'pending',
        priority: 'medium'
      });
    }

    tasks.push({
      id: generateId(),
      type: 'follow-up',
      description: '总结建议和下一步行动',
      status: 'pending',
      priority: 'medium',
      dependsOn: tasks.filter(t => t.type === 'primary').map(t => t.id)
    });

    return tasks;
  }

  async adjustCurrentPlan(adjustment: PlanAdjustment): Promise<TrainingPlan | null> {
    const context = await this.memory.getContext();
    const currentPlan = context.currentPlan;

    if (!currentPlan) {
      return null;
    }

    let adjustedPlan: TrainingPlan;

    switch (adjustment.type) {
      case 'reduce_difficulty':
        adjustedPlan = this.reduceDifficulty(currentPlan, adjustment.amount || 1);
        break;
      case 'increase_difficulty':
        adjustedPlan = this.increaseDifficulty(currentPlan, adjustment.amount || 1);
        break;
      case 'add_rest':
        adjustedPlan = this.addRestDays(currentPlan);
        break;
      case 'change_focus':
        adjustedPlan = await this.changeFocus(currentPlan, adjustment);
        break;
      default:
        return null;
    }

    await this.memory.savePlan(adjustedPlan);
    return adjustedPlan;
  }

  private reduceDifficulty(plan: TrainingPlan, amount: number): TrainingPlan {
    return {
      ...plan,
      weeks: plan.weeks.map(week => ({
        ...week,
        days: week.days.map(day => ({
          ...day,
          exercises: day.exercises.map(ex => ({
            ...ex,
            difficulty: Math.max(1, (ex.difficulty - amount)) as 1|2|3|4|5,
            sets: Math.max(1, ex.sets - 1),
            reps: Math.max(8, ex.reps - 2)
          }))
        }))
      }))
    };
  }

  private increaseDifficulty(plan: TrainingPlan, amount: number): TrainingPlan {
    return {
      ...plan,
      weeks: plan.weeks.map(week => ({
        ...week,
        days: week.days.map(day => ({
          ...day,
          exercises: day.exercises.map(ex => ({
            ...ex,
            difficulty: Math.min(5, (ex.difficulty + amount)) as 1|2|3|4|5,
            sets: Math.min(6, ex.sets + 1),
            reps: Math.min(20, ex.reps + 2)
          }))
        }))
      }))
    };
  }

  private addRestDays(plan: TrainingPlan): TrainingPlan {
    return {
      ...plan,
      weeks: plan.weeks.map((week, weekIndex) => {
        if (weekIndex < 2) {
          return week;
        }

        const days = [...week.days];
        const restDayIndex = (weekIndex % 2 === 0) ? 4 : 2;

        if (days[restDayIndex] && !days[restDayIndex].isRestDay) {
          days[restDayIndex] = {
            ...days[restDayIndex],
            isRestDay: true,
            exercises: []
          };
        }

        return { ...week, days };
      })
    };
  }

  private async changeFocus(plan: TrainingPlan, adjustment: PlanAdjustment): Promise<TrainingPlan> {
    return plan;
  }

  determineAdjustmentFromFeedback(context: MemoryContext): PlanAdjustment | null {
    const { recentWorkouts, userProfile } = context;

    if (recentWorkouts.length < 3) {
      return null;
    }

    const recentRatings = recentWorkouts.slice(-3).map(w =>
      w.exercises[0]?.selfRating || 3
    );

    const avgRating = recentRatings.reduce((a, b) => a + b, 0) / recentRatings.length;

    if (avgRating <= 2) {
      return {
        type: 'reduce_difficulty',
        amount: 1,
        reason: '用户连续评分较低，降低难度',
        planId: context.currentPlan?.id || ''
      };
    }

    if (avgRating >= 4.5 && recentWorkouts.length >= 6) {
      return {
        type: 'increase_difficulty',
        amount: 1,
        reason: '用户表现优秀，可以挑战更高难度',
        planId: context.currentPlan?.id || ''
      };
    }

    const completionRate = recentWorkouts.filter(w => w.status === 'completed').length / recentWorkouts.length;

    if (completionRate < 0.5) {
      return {
        type: 'add_rest',
        reason: '训练完成率较低，增加休息日',
        planId: context.currentPlan?.id || ''
      };
    }

    return null;
  }
}
