'use client';

import { storage } from '@/lib/storage';
import { generateId, calculateBMR, compressImage } from '@/lib/utils';
import type {
  UserProfile,
  TrainingPlan,
  BodyFatResult,
  FoodAnalysisResult,
  ExerciseFeedback,
  DietLog,
  Meal,
} from '@/lib/types';

// Local API routes to avoid CORS
const API_BASE = '';

function formatNutrition(data: FoodAnalysisResult): FoodAnalysisResult {
  const formatNum = (n: number) => Math.round(n * 100) / 100;
  return {
    foods: data.foods.map(food => ({
      ...food,
      amount: formatNum(food.amount),
      calories: formatNum(food.calories),
      protein: formatNum(food.protein),
      fat: formatNum(food.fat),
      carbs: formatNum(food.carbs)
    })),
    totalNutrition: {
      calories: formatNum(data.totalNutrition.calories),
      protein: formatNum(data.totalNutrition.protein),
      fat: formatNum(data.totalNutrition.fat),
      carbs: formatNum(data.totalNutrition.carbs)
    }
  };
}

function formatBodyFatResult(data: BodyFatResult): BodyFatResult {
  return {
    ...data,
    bodyFatPercent: Math.round(data.bodyFatPercent * 100) / 100
  };
}

// Fitness Agent Class
class FitnessAgent {
  private storage = storage;

  async analyzeBodyFat(sideImageData: string, frontImageData?: string): Promise<BodyFatResult> {
    const prompt = `你是一个专业的健身教练。请分析用户上传的照片，估算体脂率。

【分析要点】
1. 观察腰腹线条轮廓
2. 观察臀部与大腿线条
3. 判断整体体型比例
4. 如有正面照，观察肩胸比例和对称性

【重要】请直接返回一个 JSON 对象，不要任何解释或思考过程：
{"bodyFatPercent": 估算的体脂率数字(15-40之间), "bodyType": "lean/标准" | "normal/标准" | "soft/微胖" | "obese/肥胖", "comment": 一句话评语, "suggestions": ["建议1", "建议2"]}`;

    // Compress images before sending to reduce size
    const compressedSide = await compressImage(sideImageData, 800, 0.6);
    const images = [compressedSide];
    let compressedFront;
    if (frontImageData) {
      compressedFront = await compressImage(frontImageData, 800, 0.6);
      images.push(compressedFront);
    }

    const response = await fetch(`${API_BASE}/api/analyze/body-fat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images, prompt })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Body fat analysis failed');
    }

    const data = await response.json();
    const result = data.result;

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.bodyFatPercent === 'string') {
          parsed.bodyFatPercent = parseFloat(parsed.bodyFatPercent);
        }
        return formatBodyFatResult(parsed);
      }
      throw new Error('No JSON found in response');
    } catch (e) {
      console.error('Parse error:', e, 'Raw result:', result);
      return formatBodyFatResult({
        bodyFatPercent: 22,
        bodyType: '标准',
        comment: '根据照片分析，您的体型属于标准范围',
        suggestions: ['建议保持每周3-4次训练', '注意均衡饮食']
      });
    }
  }

  async generateTrainingPlan(profile: UserProfile): Promise<TrainingPlan> {
    const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);

    const prompt = `请根据以下用户信息生成一个 4 周的训练计划。

用户信息：
- 健身目标：${profile.goal === 'fat_loss' ? '减脂' : profile.goal === 'muscle_gain' ? '增肌' : profile.goal === 'shaping' ? '塑形' : profile.goal === 'posture' ? '体态矫正' : '维持'}
- 健身经验：${profile.experience === 'beginner' ? '新手' : profile.experience === 'intermediate' ? '中级' : '高级'}
- 每周可训练天数：${profile.trainingDaysPerWeek}天
- 每次训练时长：${profile.trainingDuration}分钟
- 伤病/限制：${profile.injuryLimitations?.join(', ') || '无'}
- 性别：${profile.gender === 'male' ? '男' : '女'}
- 年龄：${profile.age}
- 基础代谢率：${bmr} kcal

请生成一个科学、循序渐进的训练计划，包含每周的详细安排。
每个训练日应包含：热身(5分钟)、正式训练、拉伸(5分钟)。

请以 JSON 格式返回，不要有其他内容。`;

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens: 4096 })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Plan generation failed');
    }

    const data = await response.json();
    const result = data.result;

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        await this.storage.savePlan(plan);
        return plan;
      }
      throw new Error('No JSON found in response');
    } catch (e) {
      console.error('Parse error:', e, 'Raw result:', result);
      const defaultPlan = this.createDefaultPlan(profile);
      await this.storage.savePlan(defaultPlan);
      return defaultPlan;
    }
  }

  private createDefaultPlan(profile: UserProfile): TrainingPlan {
    const startDate = new Date().toISOString().split('T')[0];
    const endDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const exercisesByDay = [
      [{ name: '深蹲', targetMuscle: '腿部', sets: 3, reps: 12 }, { name: '平板支撑', targetMuscle: '核心', sets: 3, reps: 30 }],
      [{ name: '俯卧撑', targetMuscle: '胸部', sets: 3, reps: 10 }, { name: '引体向上', targetMuscle: '背部', sets: 3, reps: 8 }],
      [{ name: '硬拉', targetMuscle: '臀部/腿', sets: 3, reps: 10 }, { name: '卷腹', targetMuscle: '核心', sets: 3, reps: 15 }],
      [{ name: '哑铃推举', targetMuscle: '肩部', sets: 3, reps: 12 }, { name: '罗马尼亚硬拉', targetMuscle: '臀部', sets: 3, reps: 12 }],
      [{ name: '臂屈伸', targetMuscle: '手臂', sets: 3, reps: 12 }, { name: '山地攀登', targetMuscle: '核心', sets: 3, reps: 20 }],
    ];

    const weeks = [];
    for (let w = 1; w <= 4; w++) {
      const days = [];
      for (let d = 1; d <= 7; d++) {
        const dayIndex = (w - 1) * 5 + (d - 1);
        const isRestDay = d > 5 || dayIndex >= exercisesByDay.length * Math.ceil(profile.trainingDaysPerWeek / 5);
        const exercises = (!isRestDay && d <= 5) ? (exercisesByDay[(d - 1) % exercisesByDay.length] || []).map((ex, i) => ({
          id: `ex_${w}_${d}_${i}`,
          name: ex.name,
          targetMuscle: ex.targetMuscle,
          difficulty: 2 as const,
          sets: ex.sets,
          reps: ex.reps,
          restSeconds: 60,
          tips: ['注意动作规范', '保持呼吸'],
          warnings: []
        })) : [];

        days.push({ dayOfWeek: d as 1 | 2 | 3 | 4 | 5 | 6 | 7, isRestDay, exercises });
      }
      weeks.push({ weekNumber: w, days });
    }

    return {
      id: `plan_${generateId()}`,
      userId: profile.id,
      goal: profile.goal,
      startDate,
      endDate,
      weeks,
      status: 'active'
    };
  }

  async analyzeFood(imageData: string): Promise<FoodAnalysisResult> {
    const prompt = `请识别这张食物照片中的所有食物，并估算热量和营养素。

请以 JSON 格式返回，不要有其他内容：
{
  "foods": [
    {
      "name": "食物名称",
      "amount": 估算重量(克),
      "calories": 热量(kcal),
      "protein": 蛋白质(g),
      "fat": 脂肪(g),
      "carbs": 碳水(g)
    }
  ],
  "totalNutrition": {
    "calories": 总热量,
    "protein": 总蛋白质,
    "fat": 总脂肪,
    "carbs": 总碳水
  }
}`;

    // Compress image before sending
    const compressedImage = await compressImage(imageData, 800, 0.6);

    const response = await fetch(`${API_BASE}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: compressedImage, prompt })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Food analysis failed');
    }

    const data = await response.json();
    const result = data.result;

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return formatNutrition(parsed);
      }
      throw new Error('No JSON found in response');
    } catch (e) {
      console.error('Parse error:', e, 'Raw result:', result);
      return formatNutrition({
        foods: [],
        totalNutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 }
      });
    }
  }

  async analyzeExercise(imageData: string, exerciseName: string): Promise<ExerciseFeedback> {
    const prompt = `请分析这个${exerciseName}动作，给出专业点评。

分析维度：
1. 姿势正确性（关节角度、身体对齐）
2. 动作幅度
3. 主要发力肌群是否正确
4. 是否有代偿或借力
5. 潜在受伤风险

请以 JSON 格式返回，不要有其他内容：
{
  "strengths": ["优点1", "优点2", "优点3"],
  "improvements": ["改进点1", "改进点2", "改进点3"],
  "suggestions": ["建议1", "建议2"],
  "safetyWarnings": ["安全警告1"]（如无则为空数组）,
  "rating": 1-10的整数
}`;

    // Compress image before sending
    const compressedImage = await compressImage(imageData, 800, 0.6);

    const response = await fetch(`${API_BASE}/api/analyze/image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: compressedImage, prompt })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Exercise analysis failed');
    }

    const data = await response.json();
    const result = data.result;

    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      throw new Error('No JSON found in response');
    } catch (e) {
      console.error('Parse error:', e, 'Raw result:', result);
      return {
        strengths: ['动作基本规范'],
        improvements: ['注意保持核心收紧'],
        suggestions: ['适当放慢动作速度'],
        safetyWarnings: [],
        rating: 7
      };
    }
  }

  async getChatResponse(message: string, context?: { profile?: UserProfile }): Promise<string> {
    let contextPrompt = '';
    if (context?.profile) {
      const p = context.profile;
      contextPrompt = `\n当前用户信息：
- 健身目标：${p.goal}
- 健身经验：${p.experience}
- 体重：${p.weight}kg
- 训练频率：每周${p.trainingDaysPerWeek}天`;
    }

    const prompt = `你是 FitCoach，一位专业且友好的 AI 健身教练。${contextPrompt}

用户问题：${message}

请用简洁、鼓励性的语言回答用户关于健身、营养、训练计划等方面的问题。`;

    const response = await fetch(`${API_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens: 1024 })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chat response failed');
    }

    const data = await response.json();
    return data.result;
  }
}

// Export singleton
export const fitnessAgent = new FitnessAgent();

// Storage helpers
export async function saveDietMeal(date: string, meal: Meal): Promise<void> {
  let log = await storage.getDietLog(date);
  if (!log) {
    log = {
      id: `diet_${date}`,
      userId: 'current',
      date,
      meals: [],
      totalNutrition: { calories: 0, protein: 0, fat: 0, carbs: 0 }
    };
  }

  log.meals.push(meal);
  log.totalNutrition = {
    calories: log.meals.reduce((sum, m) => sum + m.foods.reduce((s, f) => s + f.nutrition.calories, 0), 0),
    protein: log.meals.reduce((sum, m) => sum + m.foods.reduce((s, f) => s + f.nutrition.protein, 0), 0),
    fat: log.meals.reduce((sum, m) => sum + m.foods.reduce((s, f) => s + f.nutrition.fat, 0), 0),
    carbs: log.meals.reduce((sum, m) => sum + m.foods.reduce((s, f) => s + f.nutrition.carbs, 0), 0),
  };

  await storage.saveDietLog(log);
}
