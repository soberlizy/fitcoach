import { BaseTool, ToolRegistry } from './base';

export { BaseTool, ToolRegistry } from './base';
export { AnalyzeBodyFatTool, GeneratePlanTool, AnalyzeFoodTool, AnalyzeExerciseTool, CalculateNutritionTool } from './fitness-tools';
export { QueryKnowledgeTool, AssessProgressTool, UpdatePlanTool, GenerateMotivationTool } from './knowledge-tools';
export { QueryUserProfileTool, QueryTrainingPlanTool, QueryWorkoutLogsTool, QueryDietLogsTool, QueryRecentActivityTool } from './query-tools';

import {
  AnalyzeBodyFatTool,
  GeneratePlanTool,
  AnalyzeFoodTool,
  AnalyzeExerciseTool,
  CalculateNutritionTool
} from './fitness-tools';

import {
  QueryKnowledgeTool,
  AssessProgressTool,
  UpdatePlanTool,
  GenerateMotivationTool
} from './knowledge-tools';

import { QueryUserProfileTool, QueryTrainingPlanTool, QueryWorkoutLogsTool, QueryDietLogsTool, QueryRecentActivityTool } from './query-tools';

export function createToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(new AnalyzeBodyFatTool());
  registry.register(new GeneratePlanTool());
  registry.register(new AnalyzeFoodTool());
  registry.register(new AnalyzeExerciseTool());
  registry.register(new CalculateNutritionTool());
  registry.register(new QueryKnowledgeTool());
  registry.register(new AssessProgressTool());
  registry.register(new UpdatePlanTool());
  registry.register(new GenerateMotivationTool());

  registry.register(new QueryUserProfileTool());
  registry.register(new QueryTrainingPlanTool());
  registry.register(new QueryWorkoutLogsTool());
  registry.register(new QueryDietLogsTool());
  registry.register(new QueryRecentActivityTool());

  return registry;
}

export function getToolDescriptions(): string[] {
  return [
    'analyze_body_fat - 分析用户上传的照片来估算体脂率',
    'generate_plan - 根据用户profile生成4周训练计划',
    'analyze_food - 分析食物照片，识别食物并估算热量',
    'analyze_exercise - 分析训练动作照片，给出改进建议',
    'calculate_nutrition - 根据用户目标和体重计算每日营养需求',
    'query_knowledge - 回答健身知识问题',
    'assess_progress - 评估用户当前健身进度',
    'update_plan - 根据反馈更新训练计划',
    'generate_motivation - 生成激励消息',
    'query_user_profile - 查询用户档案信息（身高、体重、目标、体脂等）',
    'query_training_plan - 查询当前训练计划详情',
    'query_workout_logs - 查询历史训练记录',
    'query_diet_logs - 查询饮食记录',
    'query_recent_activity - 查询最近活动和状态摘要'
  ];
}
