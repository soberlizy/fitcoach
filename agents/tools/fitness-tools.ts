import { BaseTool } from './base';
import type { ToolResult, BodyFatResult, FoodAnalysisResult, ExerciseFeedback, UserProfile, TrainingPlan, Nutrition } from '../core/types';
import { generateId, calculateBMR } from '@/lib/utils';

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

async function callChatAPI(prompt: string, maxTokens = 4096): Promise<string> {
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

async function compressImage(dataUrl: string, maxWidth = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

interface AnalyzeBodyFatInput {
  sideImageData: string;
  frontImageData?: string;
}

export class AnalyzeBodyFatTool extends BaseTool {
  name = 'analyze_body_fat';
  description = '分析用户上传的照片来估算体脂率。需要用户上传至少一张侧面照片。';
  parameterDescriptions = {
    sideImageData: '侧面照片的 base64 数据（必需）',
    frontImageData: '正面照片的 base64 数据（可选）'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { sideImageData, frontImageData } = input as AnalyzeBodyFatInput;

    const prompt = `你是一个专业的健身教练。请分析用户上传的照片，估算体脂率。

【分析要点】
1. 观察腰腹线条轮廓
2. 观察臀部与大腿线条
3. 判断整体体型比例
4. 如有正面照，观察肩胸比例和对称性

【重要】请直接返回一个 JSON 对象，不要任何解释或思考过程：
{"bodyFatPercent": 估算的体脂率数字(15-40之间), "bodyType": "lean/偏瘦" | "normal/标准" | "soft/微胖" | "obese/肥胖", "comment": 一句话评语, "suggestions": ["建议1", "建议2"]}`;

    try {
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
      console.log('Food analysis - API response:', JSON.stringify(data).substring(0, 500));
      const result = data.result || '';

      if (!result) {
        throw new Error('API returned empty result');
      }

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (typeof parsed.bodyFatPercent === 'string') {
          parsed.bodyFatPercent = parseFloat(parsed.bodyFatPercent);
        }
        const formatted = formatBodyFatResult(parsed);
        return { success: true, output: JSON.stringify(formatted) };
      }

      throw new Error('Failed to parse body fat analysis result');
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Analysis failed'
      };
    }
  }
}

interface GeneratePlanInput {
  profile: UserProfile;
}

export class GeneratePlanTool extends BaseTool {
  name = 'generate_plan';
  description = '根据用户的profile信息生成一个4周训练计划。';
  parameterDescriptions = {
    profile: '用户profile对象，包含年龄、性别、体重、目标、经验水平等'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { profile } = input as GeneratePlanInput;

    const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);

    const prompt = `请根据以下用户信息生成一个 4 周的训练计划。

用户信息：
- 健身目标：${profile.goal === 'fat_loss' ? '减脂' : profile.goal === 'muscle_gain' ? '增肌' : profile.goal === 'shaping' ? '塑形' : profile.goal === 'maintain' ? '维持' : profile.goal === 'posture' ? '体态矫正' : '维持'}
- 健身经验：${profile.experience === 'beginner' ? '新手' : profile.experience === 'intermediate' ? '中级' : '高级'}
- 每周可训练天数：${profile.trainingDaysPerWeek}天
- 每次训练时长：${profile.trainingDuration}分钟
- 伤病/限制：${profile.injuryLimitations?.join(', ') || '无'}
- 性别：${profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '其他'}
- 年龄：${profile.age}
- 体重：${profile.weight}kg
- 身高：${profile.height}cm
- 基础代谢率：${bmr} kcal

请生成一个科学、循序渐进的训练计划，包含每周的详细安排。
每个训练日应包含：热身(5分钟)、正式训练、拉伸(5分钟)。

请以 JSON 格式返回，不要有其他内容。格式要求：
{
  "weeks": [
    {
      "weekNumber": 1,
      "days": [
        {
          "dayOfWeek": 1,
          "isRestDay": false,
          "exercises": [
            {
              "id": "ex_1",
              "name": "动作名称",
              "targetMuscle": "目标肌群",
              "difficulty": 2,
              "sets": 3,
              "reps": 12,
              "restSeconds": 60,
              "tips": ["提示1"],
              "warnings": []
            }
          ]
        }
      ]
    }
  ]
}`;

    try {
      const result = await callChatAPI(prompt);

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const plan = JSON.parse(jsonMatch[0]);
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        const trainingPlan: TrainingPlan = {
          id: `plan_${generateId()}`,
          userId: profile.id,
          goal: profile.goal,
          startDate,
          endDate,
          weeks: plan.weeks || [],
          status: 'active'
        };

        return { success: true, output: JSON.stringify(trainingPlan), parsedPlan: trainingPlan };
      }

      return { success: false, output: '', error: 'Failed to parse plan' };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Plan generation failed'
      };
    }
  }
}

interface AnalyzeFoodInput {
  imageData: string;
}

export class AnalyzeFoodTool extends BaseTool {
  name = 'analyze_food';
  description = '分析用户上传的食物照片，识别食物并估算热量和营养素。';
  parameterDescriptions = {
    imageData: '食物照片的 base64 数据'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { imageData } = input as AnalyzeFoodInput;

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

    try {
      const compressedImage = await compressImage(imageData, 800, 0.6);
      console.log('Food analysis - compressed image length:', compressedImage.length);

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
      const result = data.result || '';

      if (!result) {
        throw new Error('API returned empty result');
      }

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, output: jsonMatch[0] };
      }

      console.error('Food analysis raw result:', result.substring(0, 500));
      throw new Error(`Failed to parse food analysis result, got: ${result.substring(0, 200)}`);
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Food analysis failed'
      };
    }
  }
}

interface AnalyzeExerciseInput {
  imageData: string;
  exerciseName: string;
}

export class AnalyzeExerciseTool extends BaseTool {
  name = 'analyze_exercise';
  description = '分析用户上传的动作照片，给出专业点评和反馈。';
  parameterDescriptions = {
    imageData: '动作照片的 base64 数据',
    exerciseName: '动作名称'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { imageData, exerciseName } = input as AnalyzeExerciseInput;

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

    try {
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
      const result = data.result || '';

      if (!result) {
        throw new Error('API returned empty result');
      }

      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { success: true, output: jsonMatch[0] };
      }

      throw new Error('Failed to parse exercise analysis result');
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Exercise analysis failed'
      };
    }
  }
}

interface CalculateNutritionInput {
  profile: UserProfile;
  trainingIntensity?: 'light' | 'moderate' | 'intense';
}

export class CalculateNutritionTool extends BaseTool {
  name = 'calculate_nutrition';
  description = '根据用户profile和训练强度计算每日营养需求。';
  parameterDescriptions = {
    profile: '用户profile对象',
    trainingIntensity: '训练强度：light(轻度)、moderate(中度)、intense(高强度)'
  };

  async execute(input: unknown): Promise<ToolResult> {
    const { profile, trainingIntensity = 'moderate' } = input as CalculateNutritionInput;

    const bmr = calculateBMR(profile.weight, profile.height, profile.age, profile.gender);

    let activityMultiplier = 1.2;
    if (trainingIntensity === 'light') activityMultiplier = 1.375;
    else if (trainingIntensity === 'moderate') activityMultiplier = 1.55;
    else if (trainingIntensity === 'intense') activityMultiplier = 1.725;

    let goalAdjustment = 0;
    if (profile.goal === 'fat_loss') goalAdjustment = -500;
    else if (profile.goal === 'muscle_gain') goalAdjustment = 300;

    const tdee = Math.round(bmr * activityMultiplier);
    const targetCalories = tdee + goalAdjustment;

    let proteinRatio = 0.3;
    let fatRatio = 0.3;
    let carbRatio = 0.4;

    if (profile.goal === 'fat_loss') {
      proteinRatio = 0.4;
      fatRatio = 0.3;
      carbRatio = 0.3;
    } else if (profile.goal === 'muscle_gain') {
      proteinRatio = 0.35;
      fatRatio = 0.25;
      carbRatio = 0.4;
    }

    const nutrition: Nutrition = {
      calories: targetCalories,
      protein: Math.round((targetCalories * proteinRatio) / 4),
      fat: Math.round((targetCalories * fatRatio) / 9),
      carbs: Math.round((targetCalories * carbRatio) / 4)
    };

    return { success: true, output: JSON.stringify(nutrition) };
  }
}
