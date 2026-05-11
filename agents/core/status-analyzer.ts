import type { WorkoutLog, DietLog, UserProfile } from './types';

export interface StatusAnalysis {
  overall: 'good' | 'warning' | 'concerning';
  workoutAnalysis: {
    trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
    volumeChange: number;
    completionRate: number;
    averageIntensity: number;
    missedDays: number;
  };
  dietAnalysis: {
    trend: 'healthy' | 'unhealthy' | 'inconsistent' | 'insufficient_data';
    averageCalories: number;
    proteinAdequacy: number;
    mealRegularity: number;
  };
  observations: string[];
  warnings: string[];
}

export function analyzeUserStatus(
  profile: UserProfile | undefined,
  workouts: WorkoutLog[],
  diet: DietLog[]
): StatusAnalysis {
  const analysis: StatusAnalysis = {
    overall: 'good',
    workoutAnalysis: {
      trend: 'stable',
      volumeChange: 0,
      completionRate: 1,
      averageIntensity: 3,
      missedDays: 0
    },
    dietAnalysis: {
      trend: 'healthy',
      averageCalories: 0,
      proteinAdequacy: 1,
      mealRegularity: 1
    },
    observations: [],
    warnings: []
  };

  if (workouts.length === 0 && diet.length === 0) {
    analysis.overall = 'insufficient_data' as any;
    return analysis;
  }

  analyzeWorkoutStatus(workouts, analysis);
  analyzeDietStatus(profile, diet, analysis);
  determineOverallStatus(analysis);

  return analysis;
}

function analyzeWorkoutStatus(workouts: WorkoutLog[], analysis: StatusAnalysis): void {
  if (workouts.length === 0) {
    analysis.workoutAnalysis.trend = 'insufficient_data';
    analysis.workoutAnalysis.missedDays = 0;
    return;
  }

  const sortedWorkouts = [...workouts].sort((a, b) =>
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  const completionRate = workouts.filter(w => w.status === 'completed').length / workouts.length;
  analysis.workoutAnalysis.completionRate = Math.round(completionRate * 100) / 100;

  const selfRatings = workouts
    .filter(w => w.exercises[0]?.selfRating)
    .map(w => w.exercises[0].selfRating!);
  if (selfRatings.length > 0) {
    analysis.workoutAnalysis.averageIntensity = selfRatings.reduce((a, b) => a + b, 0) / selfRatings.length;
  }

  const today = new Date();
  const latestWorkout = sortedWorkouts[sortedWorkouts.length - 1];
  const daysSinceLastWorkout = latestWorkout
    ? Math.floor((today.getTime() - new Date(latestWorkout.date).getTime()) / (24 * 60 * 60 * 1000))
    : 999;
  analysis.workoutAnalysis.missedDays = daysSinceLastWorkout;

  if (sortedWorkouts.length >= 4) {
    const firstHalf = sortedWorkouts.slice(0, Math.floor(sortedWorkouts.length / 2));
    const secondHalf = sortedWorkouts.slice(Math.floor(sortedWorkouts.length / 2));

    const firstHalfVolume = calculateVolume(firstHalf);
    const secondHalfVolume = calculateVolume(secondHalf);

    if (secondHalfVolume > firstHalfVolume * 1.1) {
      analysis.workoutAnalysis.trend = 'improving';
    } else if (secondHalfVolume < firstHalfVolume * 0.9) {
      analysis.workoutAnalysis.trend = 'declining';
    }
  }

  if (completionRate < 0.5) {
    analysis.warnings.push('训练完成率较低，最近只有一半的训练完成了');
  }

  if (daysSinceLastWorkout >= 3) {
    analysis.warnings.push(`已经 ${daysSinceLastWorkout} 天没有训练了`);
  }

  if (analysis.workoutAnalysis.trend === 'declining') {
    analysis.warnings.push('运动量呈现下降趋势，注意保持训练节奏');
  }
}

function analyzeDietStatus(profile: UserProfile | undefined, diet: DietLog[], analysis: StatusAnalysis): void {
  if (diet.length === 0) {
    analysis.dietAnalysis.trend = 'insufficient_data';
    return;
  }

  const totalCalories = diet.reduce((sum, d) => sum + d.totalNutrition.calories, 0);
  const avgCalories = totalCalories / diet.length;
  analysis.dietAnalysis.averageCalories = Math.round(avgCalories);

  const proteinPerKg = profile ? avgCalories * 0.15 / 4 / profile.weight : 2;
  analysis.dietAnalysis.proteinAdequacy = proteinPerKg >= 1.5 ? 1 : proteinPerKg >= 1 ? 0.7 : 0.4;

  const mealTypes = diet.flatMap(d => d.meals.map(m => m.type));
  const uniqueMealTypes = new Set(mealTypes).size;
  analysis.dietAnalysis.mealRegularity = uniqueMealTypes / 4;

  if (profile && profile.goal === 'muscle_gain') {
    const targetCalories = 2500;
    if (avgCalories < targetCalories * 0.8) {
      analysis.dietAnalysis.trend = 'unhealthy';
      analysis.warnings.push(`热量摄入偏低（${Math.round(avgCalories)}kcal），增肌需要充足的热量摄入`);
    } else if (avgCalories > targetCalories * 1.15) {
      if (analysis.workoutAnalysis.trend === 'declining' || analysis.workoutAnalysis.missedDays > 2) {
        analysis.dietAnalysis.trend = 'unhealthy';
        analysis.warnings.push('热量摄入偏高但训练量下降，可能导致脂肪堆积');
      }
    }
  }

  if (profile && profile.goal === 'fat_loss') {
    const targetCalories = 1800;
    if (avgCalories > targetCalories * 1.1) {
      analysis.dietAnalysis.trend = 'unhealthy';
      analysis.warnings.push(`热量摄入偏高（${Math.round(avgCalories)}kcal），减脂需要控制热量缺口`);
    }
  }

  if (analysis.dietAnalysis.trend !== 'unhealthy') {
    if (analysis.dietAnalysis.mealRegularity < 0.5) {
      analysis.dietAnalysis.trend = 'inconsistent';
      analysis.warnings.push('饮食不够规律，建议固定用餐时间');
    }
  }
}

function determineOverallStatus(analysis: StatusAnalysis): void {
  if (analysis.warnings.length >= 2) {
    analysis.overall = 'concerning';
  } else if (analysis.warnings.length === 1) {
    analysis.overall = 'warning';
  } else {
    if (analysis.workoutAnalysis.trend === 'improving' && analysis.dietAnalysis.trend === 'healthy') {
      analysis.overall = 'good';
    } else {
      analysis.overall = 'good';
    }
  }

  if (analysis.workoutAnalysis.trend === 'improving') {
    analysis.observations.push('💪 训练状态呈上升趋势，保持这个势头！');
  }

  if (analysis.dietAnalysis.trend === 'healthy' && analysis.dietAnalysis.mealRegularity > 0.7) {
    analysis.observations.push('🥗 饮食管理做得不错，营养摄入比较均衡');
  }

  if (analysis.workoutAnalysis.completionRate >= 0.8) {
    analysis.observations.push('✅ 训练完成率很高，自律性很强');
  }
}

function calculateVolume(workouts: WorkoutLog[]): number {
  return workouts.reduce((sum, w) => {
    const exerciseVolume = w.exercises.reduce((eSum, e) => {
      return eSum + (e.setsCompleted * e.repsCompleted);
    }, 0);
    return sum + exerciseVolume + w.duration;
  }, 0);
}

export function formatStatusForPrompt(analysis: StatusAnalysis): string {
  if (analysis.workoutAnalysis.trend === 'insufficient_data' && analysis.dietAnalysis.trend === 'insufficient_data') {
    return '暂无足够的用户数据分析';
  }

  const parts: string[] = ['## 用户最近状态分析'];

  if (analysis.workoutAnalysis.trend !== 'insufficient_data') {
    const trendText: Record<string, string> = {
      improving: '上升 📈',
      stable: '稳定',
      declining: '下降 📉',
      insufficient_data: '数据不足'
    };
    const missedText = analysis.workoutAnalysis.missedDays > 0
      ? `，距离上次训练 ${analysis.workoutAnalysis.missedDays} 天`
      : '';

    parts.push(`### 运动状态
- 趋势：${trendText[analysis.workoutAnalysis.trend]}${missedText}
- 完成率：${Math.round(analysis.workoutAnalysis.completionRate * 100)}%
- 平均强度：${analysis.workoutAnalysis.averageIntensity.toFixed(1)}/5`);
  }

  if (analysis.dietAnalysis.trend !== 'insufficient_data') {
    const dietText: Record<string, string> = {
      healthy: '健康 ✅',
      unhealthy: '需改善 ⚠️',
      inconsistent: '不够规律',
      insufficient_data: '数据不足'
    };

    parts.push(`### 饮食状态
- 趋势：${dietText[analysis.dietAnalysis.trend]}
- 平均热量：${analysis.dietAnalysis.averageCalories} kcal/天
- 蛋白质充足度：${Math.round(analysis.dietAnalysis.proteinAdequacy * 100)}%
- 饮食规律性：${Math.round(analysis.dietAnalysis.mealRegularity * 100)}%`);
  }

  if (analysis.warnings.length > 0) {
    parts.push('### ⚠️ 需要关注的问题');
    analysis.warnings.forEach(w => parts.push(`- ${w}`));
  }

  if (analysis.observations.length > 0) {
    parts.push('### 📝 积极观察');
    analysis.observations.forEach(o => parts.push(`- ${o}`));
  }

  return parts.join('\n');
}
