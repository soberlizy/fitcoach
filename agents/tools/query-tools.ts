import { BaseTool } from './base';
import type { ToolResult } from '../core/types';
import { getAgentContext } from '../core/context-holder';

interface QueryInput {
  query?: string;
  days?: number;
}

export class QueryUserProfileTool extends BaseTool {
  name = 'query_user_profile';
  description = '查询用户档案信息，包括身高、体重、目标、体脂、经验水平等';
  parameterDescriptions = {
    query: '可选，指定要查询的具体信息，如"体脂"、"体重"、"目标"等'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const context = getAgentContext();
    const profile = context?.userProfile;

    if (!profile) {
      return {
        success: true,
        output: '用户尚未创建档案，没有可用的用户信息。'
      };
    }

    const query = (input as QueryInput)?.query?.toLowerCase();

    if (query) {
      if (query.includes('体脂')) {
        return {
          success: true,
          output: `用户体脂率：${profile.bodyFatPercent || '未设置'}%`
        };
      }
      if (query.includes('体重')) {
        return {
          success: true,
          output: `用户当前体重：${profile.weight}kg`
        };
      }
      if (query.includes('目标')) {
        const goalMap: Record<string, string> = {
          fat_loss: '减脂',
          muscle_gain: '增肌',
          shaping: '塑形',
          maintain: '维持',
          posture: '体态矫正'
        };
        return {
          success: true,
          output: `用户目标：${goalMap[profile.goal] || profile.goal}`
        };
      }
      if (query.includes('身高')) {
        return {
          success: true,
          output: `用户身高：${profile.height}cm`
        };
      }
    }

    const goalMap: Record<string, string> = {
      fat_loss: '减脂',
      muscle_gain: '增肌',
      shaping: '塑形',
      maintain: '维持',
      posture: '体态矫正'
    };

    const expMap: Record<string, string> = {
      beginner: '新手',
      intermediate: '中级',
      advanced: '高级'
    };

    return {
      success: true,
      output: `用户档案摘要：
- 昵称：${profile.nickname}
- 性别：${profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '其他'}
- 年龄：${profile.age}岁
- 身高：${profile.height}cm
- 体重：${profile.weight}kg
- 目标：${goalMap[profile.goal] || profile.goal}
- 经验水平：${expMap[profile.experience] || profile.experience}
- 训练频率：${profile.trainingDaysPerWeek}天/周
- 训练时长：${profile.trainingDuration}分钟/次
${profile.bodyFatPercent ? `- 体脂率：${profile.bodyFatPercent}%` : '- 体脂率：未设置'}
${profile.bmi ? `- BMI：${profile.bmi.toFixed(1)}` : ''}
${profile.bmr ? `- 基础代谢：${profile.bmr}kcal` : ''}`
    };
  }
}

export class QueryTrainingPlanTool extends BaseTool {
  name = 'query_training_plan';
  description = '查询当前训练计划，包括每周训练安排、休息日、动作选择等';
  parameterDescriptions = {
    query: '可选，指定要查询的具体信息，如"本周"、"动作"、"休息日"等'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const context = getAgentContext();
    const plan = context?.currentPlan;

    if (!plan) {
      return {
        success: true,
        output: '用户暂无训练计划。可以使用generate_plan工具生成一个新的训练计划。'
      };
    }

    const query = (input as QueryInput)?.query?.toLowerCase();

    if (query) {
      if (query.includes('本周') || query.includes('当前')) {
        const currentWeek = plan.weeks?.[0];
        if (currentWeek) {
          const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
          const daysInfo = currentWeek.days.map((d: { dayOfWeek: number; isRestDay: boolean; exercises: { name: string; sets: number; reps: number }[] }) => {
            if (d.isRestDay) {
              return `${dayNames[d.dayOfWeek - 1]}：休息日`;
            }
            const exercises = d.exercises.slice(0, 3).map((e: { name: string; sets: number; reps: number }) => `${e.name}(${e.sets}x${e.reps})`).join('、');
            return `${dayNames[d.dayOfWeek - 1]}：${exercises}`;
          }).join('\n  ');
          return {
            success: true,
            output: `本周（第${currentWeek.weekNumber}周）训练安排：\n  ${daysInfo}`
          };
        }
      }
      if (query.includes('动作') || query.includes('训练')) {
        const allExercises = plan.weeks?.flatMap((w: { days: { exercises: { name: string }[] }[] }) => w.days.flatMap((d: { exercises: { name: string }[] }) => d.exercises.map((e: { name: string }) => e.name))) || [];
        const uniqueExercises = Array.from(new Set(allExercises));
        return {
          success: true,
          output: `计划中的训练动作：${uniqueExercises.slice(0, 10).join('、')}${uniqueExercises.length > 10 ? '...' : ''}`
        };
      }
    }

    const statusMap: Record<string, string> = {
      active: '进行中',
      completed: '已完成',
      paused: '已暂停'
    };

    return {
      success: true,
      output: `训练计划摘要：
- 计划周期：${plan.startDate} 至 ${plan.endDate}
- 目标：${plan.goal}
- 状态：${statusMap[plan.status] || plan.status}
- 总周数：${plan.weeks?.length || 0}周
${plan.weeks?.[0] ? `- 当前周：第${plan.weeks[0].weekNumber}周` : ''}`
    };
  }
}

export class QueryWorkoutLogsTool extends BaseTool {
  name = 'query_workout_logs';
  description = '查询历史训练记录，包括完成状态、动作、自评分等';
  parameterDescriptions = {
    query: '可选，指定要查询的具体信息，如"最近"、"完成率"、"自评"等',
    days: '可选，查询最近多少天的记录，默认为7天'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const context = getAgentContext();
    const workouts = context?.recentWorkouts || [];
    const params = (input as QueryInput) || {};
    const days = params.days || 7;

    if (workouts.length === 0) {
      return {
        success: true,
        output: `用户最近${days}天没有训练记录。`
      };
    }

    const query = params.query?.toLowerCase();

    if (query?.includes('完成率')) {
      const completed = workouts.filter((w: { status: string }) => w.status === 'completed').length;
      const rate = Math.round((completed / workouts.length) * 100);
      return {
        success: true,
        output: `最近${workouts.length}次训练完成率：${rate}%（${completed}次完成）`
      };
    }

    if (query?.includes('最近')) {
      const recent = workouts.slice(0, 5);
      const recentInfo = recent.map((w: { date: string; status: string; exercises: { exerciseName: string; selfRating?: number }[] }) => {
        const exercises = w.exercises.slice(0, 3).map((e: { exerciseName: string }) => e.exerciseName).join('、');
        const rating = w.exercises[0]?.selfRating ? `⭐${w.exercises[0].selfRating}` : '';
        return `${w.date}：${w.status}${rating} - ${exercises}`;
      }).join('\n');
      return {
        success: true,
        output: `最近训练记录：\n${recentInfo}`
      };
    }

    const completed = workouts.filter((w: { status: string }) => w.status === 'completed').length;
    const totalVolume = workouts.reduce((sum: number, w: { exercises: { setsCompleted: number; repsCompleted: number }[] }) => {
      return sum + w.exercises.reduce((eSum: number, e: { setsCompleted: number; repsCompleted: number }) => eSum + e.setsCompleted * e.repsCompleted, 0);
    }, 0);

    return {
      success: true,
      output: `训练记录摘要（最近${days}天）：
- 总训练次数：${workouts.length}次
- 完成次数：${completed}次
- 完成率：${Math.round((completed / workouts.length) * 100)}%
- 总训练量：${totalVolume}次（组x次数）
最近训练：${workouts[0]?.date || '无'}（${workouts[0]?.status || 'N/A'}）`
    };
  }
}

export class QueryDietLogsTool extends BaseTool {
  name = 'query_diet_logs';
  description = '查询饮食记录，包括每日热量、蛋白质、碳水、脂肪摄入量';
  parameterDescriptions = {
    query: '可选，指定要查询的具体信息，如"热量"、"平均"、"蛋白质"等',
    days: '可选，查询最近多少天的记录，默认为7天'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const context = getAgentContext();
    const dietLogs = context?.recentDiet || [];
    const params = (input as QueryInput) || {};
    const days = params.days || 7;

    if (dietLogs.length === 0) {
      return {
        success: true,
        output: `用户最近${days}天没有饮食记录。`
      };
    }

    const query = params.query?.toLowerCase();

    if (query?.includes('热量')) {
      const avgCalories = dietLogs.reduce((sum: number, d: { totalNutrition: { calories: number } }) => sum + d.totalNutrition.calories, 0) / dietLogs.length;
      return {
        success: true,
        output: `平均每日热量摄入：${Math.round(avgCalories)}kcal`
      };
    }

    if (query?.includes('蛋白质')) {
      const avgProtein = dietLogs.reduce((sum: number, d: { totalNutrition: { protein: number } }) => sum + d.totalNutrition.protein, 0) / dietLogs.length;
      return {
        success: true,
        output: `平均每日蛋白质摄入：${Math.round(avgProtein)}g`
      };
    }

    if (query?.includes('平均')) {
      const avgCalories = dietLogs.reduce((sum: number, d: { totalNutrition: { calories: number } }) => sum + d.totalNutrition.calories, 0) / dietLogs.length;
      const avgProtein = dietLogs.reduce((sum: number, d: { totalNutrition: { protein: number } }) => sum + d.totalNutrition.protein, 0) / dietLogs.length;
      const avgFat = dietLogs.reduce((sum: number, d: { totalNutrition: { fat: number } }) => sum + d.totalNutrition.fat, 0) / dietLogs.length;
      const avgCarbs = dietLogs.reduce((sum: number, d: { totalNutrition: { carbs: number } }) => sum + d.totalNutrition.carbs, 0) / dietLogs.length;
      return {
        success: true,
        output: `平均每日营养摄入：
- 热量：${Math.round(avgCalories)}kcal
- 蛋白质：${Math.round(avgProtein)}g
- 脂肪：${Math.round(avgFat)}g
- 碳水：${Math.round(avgCarbs)}g`
      };
    }

    const totalCalories = dietLogs.reduce((sum: number, d: { totalNutrition: { calories: number } }) => sum + d.totalNutrition.calories, 0);
    const avgCalories = totalCalories / dietLogs.length;
    const mealTypes = Array.from(new Set(dietLogs.flatMap((d: { meals: { type: string }[] }) => d.meals.map((m: { type: string }) => m.type))));
    const mealMap: Record<string, string> = {
      breakfast: '早餐',
      lunch: '午餐',
      dinner: '晚餐',
      snack: '零食'
    };

    return {
      success: true,
      output: `饮食记录摘要（最近${days}天）：
- 记录天数：${dietLogs.length}天
- 平均热量：${Math.round(avgCalories)}kcal/天
- 总热量：${Math.round(totalCalories)}kcal
- 记录的餐次：${mealTypes.map((m: string) => mealMap[m] || m).join('、')}`
    };
  }
}

export class QueryRecentActivityTool extends BaseTool {
  name = 'query_recent_activity';
  description = '查询用户最近的整体活动状态，包括训练和饮食的综合情况';
  parameterDescriptions = {
    query: '可选，指定要查询的具体方面，如"状态"、"总结"、"警告"等'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const context = getAgentContext();
    const userProfile = context?.userProfile;
    const recentWorkouts = context?.recentWorkouts || [];
    const recentDiet = context?.recentDiet || [];

    const query = (input as QueryInput)?.query?.toLowerCase();

    if (query?.includes('警告') || query?.includes('问题')) {
      const warnings: string[] = [];

      if (userProfile?.goal === 'muscle_gain' && recentDiet.length > 0) {
        const avgCalories = recentDiet.reduce((sum: number, d: { totalNutrition: { calories: number } }) => sum + d.totalNutrition.calories, 0) / recentDiet.length;
        if (avgCalories < 2200) {
          warnings.push('热量摄入偏低，可能影响增肌效果');
        }
      }

      if (recentWorkouts.length >= 3) {
        const completed = recentWorkouts.filter((w: { status: string }) => w.status === 'completed').length;
        if (completed / recentWorkouts.length < 0.5) {
          warnings.push('训练完成率偏低，注意保持训练节奏');
        }
      }

      if (warnings.length === 0) {
        return {
          success: true,
          output: '目前没有发现需要特别关注的问题，用户状态良好。'
        };
      }

      return {
        success: true,
        output: `需要关注的问题：\n${warnings.map(w => `- ${w}`).join('\n')}`
      };
    }

    const workoutDays = recentWorkouts.length;
    const dietDays = recentDiet.length;
    const completedWorkouts = recentWorkouts.filter((w: { status: string }) => w.status === 'completed').length;

    let statusSummary = '状态摘要：\n';
    statusSummary += `- 最近训练：${workoutDays}天有记录，完成率${workoutDays > 0 ? Math.round((completedWorkouts / workoutDays) * 100) : 0}%\n`;
    statusSummary += `- 最近饮食：${dietDays}天有记录\n`;

    if (userProfile) {
      const goalMap: Record<string, string> = {
        fat_loss: '减脂',
        muscle_gain: '增肌',
        shaping: '塑形',
        maintain: '维持',
        posture: '体态矫正'
      };
      statusSummary += `- 当前目标：${goalMap[userProfile.goal] || userProfile.goal}\n`;
      statusSummary += `- 体重：${userProfile.weight}kg\n`;
      if (userProfile.bodyFatPercent) {
        statusSummary += `- 体脂率：${userProfile.bodyFatPercent}%\n`;
      }
    }

    return {
      success: true,
      output: statusSummary.trim()
    };
  }
}
