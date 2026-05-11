export interface ReActStep {
  thought: string;
  action?: string;
  actionInput?: unknown;
  observation?: string;
}

export interface AgentConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt?: string;
  maxIterations?: number;
}

export interface AgentResponse {
  content: string;
  steps: ReActStep[];
  isComplete: boolean;
  maxIterationsReached?: boolean;
  shouldRemind?: boolean;
  reminder?: Reminder;
  planAdjustment?: PlanAdjustment;
  suggestions?: string[];
  error?: string;
  generatedPlan?: TrainingPlan;
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
  dependsOn?: string[];
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

export interface MemoryContext {
  userProfile?: UserProfile;
  recentWorkouts: WorkoutLog[];
  recentDiet: DietLog[];
  conversationHistory: Message[];
  currentPlan?: TrainingPlan;
  pendingTasks: Task[];
  lastObservation?: string;
  statusAnalysis?: {
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
  };
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  output: string;
  error?: string;
  parsedPlan?: TrainingPlan;
}

export type UserProfile = {
  id: string;
  nickname: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  height: number;
  weight: number;
  goal: 'fat_loss' | 'muscle_gain' | 'shaping' | 'maintain' | 'posture';
  experience: 'beginner' | 'intermediate' | 'advanced';
  trainingDaysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  trainingDuration: 15 | 30 | 45 | 60;
  injuryLimitations?: string[];
  bodyFatPercent?: number;
  bodyFatPhoto?: string;
  bodyType?: 'lean' | 'normal' | 'soft' | 'obese';
  bmi?: number;
  bmr?: number;
  createdAt: string;
  updatedAt: string;
};

export type TrainingPlan = {
  id: string;
  userId: string;
  goal: string;
  startDate: string;
  endDate: string;
  weeks: TrainingWeek[];
  status: 'active' | 'completed' | 'paused';
};

export type TrainingWeek = {
  weekNumber: number;
  days: TrainingDay[];
};

export type TrainingDay = {
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  isRestDay: boolean;
  exercises: Exercise[];
};

export type Exercise = {
  id: string;
  name: string;
  targetMuscle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  sets: number;
  reps: number;
  restSeconds: number;
  tips: string[];
  warnings: string[];
};

export type WorkoutLog = {
  id: string;
  userId: string;
  planId: string;
  date: string;
  exercises: WorkoutExercise[];
  duration: number;
  status: 'completed' | 'partial' | 'skipped';
  notes?: string;
};

export type WorkoutExercise = {
  exerciseId: string;
  exerciseName: string;
  setsCompleted: number;
  repsCompleted: number;
  selfRating?: 1 | 2 | 3 | 4 | 5;
  aiFeedback?: string;
};

export type DietLog = {
  id: string;
  userId: string;
  date: string;
  meals: Meal[];
  totalNutrition: Nutrition;
};

export type Meal = {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: FoodItem[];
  time?: string;
};

export type FoodItem = {
  id: string;
  name: string;
  amount: number;
  nutrition: Nutrition;
};

export type Nutrition = {
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
};

export type BodyFatResult = {
  bodyFatPercent: number;
  bodyType: 'lean' | 'normal' | 'soft' | 'obese' | '偏瘦' | '标准' | '微胖' | '肥胖';
  comment: string;
  suggestions: string[];
};

export type FoodAnalysisResult = {
  foods: {
    name: string;
    amount: number;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  }[];
  totalNutrition: Nutrition;
};

export type ExerciseFeedback = {
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  safetyWarnings: string[];
  rating: number;
};
