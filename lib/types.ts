// User Profile
export interface UserProfile {
  id: string;
  nickname: string;
  gender: 'male' | 'female' | 'other';
  age: number;
  height: number; // cm
  weight: number; // kg
  goal: 'fat_loss' | 'muscle_gain' | 'shaping' | 'maintain' | 'posture';
  experience: 'beginner' | 'intermediate' | 'advanced';
  trainingDaysPerWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  trainingDuration: 15 | 30 | 45 | 60; // minutes
  injuryLimitations?: string[];
  bodyFatPercent?: number;
  bodyFatPhoto?: string;
  bodyType?: 'lean' | 'normal' | 'soft' | 'obese';
  bmi?: number;
  bmr?: number;
  createdAt: string;
  updatedAt: string;
}

// Training Plan
export interface TrainingPlan {
  id: string;
  userId: string;
  goal: string;
  startDate: string;
  endDate: string;
  weeks: TrainingWeek[];
  status: 'active' | 'completed' | 'paused';
}

export interface TrainingWeek {
  weekNumber: number;
  days: TrainingDay[];
}

export interface TrainingDay {
  dayOfWeek: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  isRestDay: boolean;
  exercises: Exercise[];
}

export interface Exercise {
  id: string;
  name: string;
  targetMuscle: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  sets: number;
  reps: number;
  restSeconds: number;
  tips: string[];
  warnings: string[];
}

// Workout Log
export interface WorkoutLog {
  id: string;
  userId: string;
  planId: string;
  date: string;
  exercises: WorkoutExercise[];
  duration: number;
  status: 'completed' | 'partial' | 'skipped';
  notes?: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  setsCompleted: number;
  repsCompleted: number;
  selfRating?: 1 | 2 | 3 | 4 | 5;
  aiFeedback?: string;
}

// Diet Log
export interface DietLog {
  id: string;
  userId: string;
  date: string;
  meals: Meal[];
  totalNutrition: Nutrition;
}

export interface Meal {
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: FoodItem[];
  time?: string;
}

export interface FoodItem {
  id: string;
  name: string;
  amount: number; // grams
  nutrition: Nutrition;
}

export interface Nutrition {
  calories: number; // kcal
  protein: number; // g
  fat: number; // g
  carbs: number; // g
}

// Posture Record
export interface PostureRecord {
  id: string;
  userId: string;
  date: string;
  photoUrl: string;
  estimatedBodyFat: number;
  postureType?: string[];
  analysisReport?: string;
}

// AI Analysis Results
export interface BodyFatResult {
  bodyFatPercent: number;
  bodyType: '偏瘦' | '标准' | '微胖' | '肥胖';
  comment: string;
  suggestions: string[];
}

export interface FoodAnalysisResult {
  foods: {
    name: string;
    amount: number;
    calories: number;
    protein: number;
    fat: number;
    carbs: number;
  }[];
  totalNutrition: Nutrition;
}

export interface ExerciseFeedback {
  strengths: string[];
  improvements: string[];
  suggestions: string[];
  safetyWarnings: string[];
  rating: number;
}
