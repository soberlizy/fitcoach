import type { Evaluation, ProactiveSuggestion, PlanAdjustment, MemoryContext, Reminder, AgentResponse } from './types';
import type { MemorySystem } from '../memory';
import { generateId } from '@/lib/utils';

export class Evaluator {
  private memory: MemorySystem;

  constructor(memory: MemorySystem) {
    this.memory = memory;
  }

  async evaluate(response: AgentResponse, context?: MemoryContext): Promise<Evaluation> {
    const evaluation: Evaluation = {
      responseQuality: this.assessResponseQuality(response),
      shouldRemind: false,
      shouldAdjustPlan: false,
      proactiveSuggestions: []
    };

    if (!context) {
      return evaluation;
    }

    const { recentWorkouts, userProfile } = context;

    if (userProfile && recentWorkouts.length >= 3) {
      const completionRate = this.calculateCompletionRate(recentWorkouts);

      if (completionRate < 0.5) {
        evaluation.shouldRemind = true;
        evaluation.proactiveSuggestions.push({
          type: 'motivation',
          message: `我注意到最近训练完成率不太高（${Math.round(completionRate * 100)}%），是遇到什么困难了吗？`
        });
      }

      const recentRatings = recentWorkouts
        .slice(-3)
        .map(w => w.exercises[0]?.selfRating || 3);

      if (recentRatings.every(r => r <= 2)) {
        evaluation.shouldAdjustPlan = true;
        evaluation.planAdjustment = {
          type: 'reduce_difficulty',
          amount: 1,
          reason: '用户连续自评分较低，建议降低难度',
          planId: context.currentPlan?.id || ''
        };
        evaluation.proactiveSuggestions.push({
          type: 'adjustment',
          message: '根据你的反馈，我建议适当降低训练难度，你觉得怎么样？'
        });
      }

      if (recentRatings.every(r => r >= 4) && recentWorkouts.length >= 6) {
        evaluation.proactiveSuggestions.push({
          type: 'tip',
          message: '💪 你最近表现很棒！可以考虑挑战更高难度，需要我帮你调整计划吗？'
        });
      }
    }

    const missedDays = await this.getConsecutiveMissedDays(recentWorkouts);
    if (missedDays >= 3) {
      evaluation.shouldRemind = true;
      evaluation.proactiveSuggestions.push({
        type: 'warning',
        message: `你已经 ${missedDays} 天没有训练了，别让懒惰打败你！哪怕做 10 分钟拉伸也好。`
      });
    }

    return evaluation;
  }

  private assessResponseQuality(response: AgentResponse): 'excellent' | 'good' | 'needs_improvement' {
    if (response.error) {
      return 'needs_improvement';
    }

    if (response.maxIterationsReached) {
      return 'needs_improvement';
    }

    if (response.content.length < 10) {
      return 'needs_improvement';
    }

    if (response.steps && response.steps.length > 5) {
      return 'excellent';
    }

    if (response.content.length > 50 && response.steps && response.steps.length >= 2) {
      return 'good';
    }

    return 'good';
  }

  private calculateCompletionRate(workouts: { status: string }[]): number {
    if (workouts.length === 0) return 1;
    const completed = workouts.filter(w => w.status === 'completed').length;
    return completed / workouts.length;
  }

  private async getConsecutiveMissedDays(recentWorkouts: { date: string }[]): Promise<number> {
    if (recentWorkouts.length === 0) {
      return 0;
    }

    const sortedDates = recentWorkouts
      .map(w => w.date)
      .sort((a, b) => b.localeCompare(a));

    const today = new Date().toISOString().split('T')[0];
    const latestDate = sortedDates[0];

    const todayMs = new Date(today).getTime();
    const latestMs = new Date(latestDate).getTime();
    const daysDiff = Math.floor((todayMs - latestMs) / (24 * 60 * 60 * 1000));

    if (daysDiff <= 1) {
      return 0;
    }

    return daysDiff;
  }

  async createReminder(type: ProactiveSuggestion['type'], message: string): Promise<Reminder> {
    const reminder: Reminder = {
      id: generateId(),
      type: type === 'motivation' ? 'motivation' :
            type === 'warning' ? 'warning' :
            type === 'adjustment' ? 'education' : 'checkin',
      message,
      createdAt: new Date().toISOString()
    };

    await this.memory.addReminder(reminder);
    return reminder;
  }
}
