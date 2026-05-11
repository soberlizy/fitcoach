import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { UserProfile, TrainingPlan, WorkoutLog, DietLog, PostureRecord } from './types';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

interface FitCoachDB extends DBSchema {
  user_profile: {
    key: string;
    value: UserProfile;
  };
  training_plans: {
    key: string;
    value: TrainingPlan;
    indexes: { 'by-status': string };
  };
  workout_logs: {
    key: string;
    value: WorkoutLog;
    indexes: { 'by-date': string };
  };
  diet_logs: {
    key: string;
    value: DietLog;
  };
  posture_records: {
    key: string;
    value: PostureRecord;
    indexes: { 'by-date': string };
  };
  chat_sessions: {
    key: string;
    value: ChatSession;
    indexes: { 'by-updatedAt': number };
  };
}

const DB_NAME = 'FitCoachDB';
const DB_VERSION = 2;

class FitCoachStorage {
  private db: IDBPDatabase<FitCoachDB> | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    console.log('[storage] init called, DB_VERSION:', DB_VERSION);

    this.db = await openDB<FitCoachDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        console.log('[storage] upgrade called, oldVersion:', oldVersion, 'newVersion:', DB_VERSION);
        // User profile
        if (!db.objectStoreNames.contains('user_profile')) {
          db.createObjectStore('user_profile', { keyPath: 'id' });
        }

        // Training plans
        if (!db.objectStoreNames.contains('training_plans')) {
          const planStore = db.createObjectStore('training_plans', { keyPath: 'id' });
          planStore.createIndex('by-status', 'status');
        }

        // Workout logs
        if (!db.objectStoreNames.contains('workout_logs')) {
          const workoutStore = db.createObjectStore('workout_logs', { keyPath: 'id' });
          workoutStore.createIndex('by-date', 'date');
        }

        // Diet logs (keyed by date YYYY-MM-DD)
        if (!db.objectStoreNames.contains('diet_logs')) {
          db.createObjectStore('diet_logs', { keyPath: 'date' });
        }

        // Posture records
        if (!db.objectStoreNames.contains('posture_records')) {
          const postureStore = db.createObjectStore('posture_records', { keyPath: 'id' });
          postureStore.createIndex('by-date', 'date');
        }

        // Chat sessions
        if (!db.objectStoreNames.contains('chat_sessions')) {
          const chatStore = db.createObjectStore('chat_sessions', { keyPath: 'id' });
          chatStore.createIndex('by-updatedAt', 'updatedAt');
        }
      }
    });
  }

  private async ensureDB(): Promise<IDBPDatabase<FitCoachDB>> {
    if (!this.db) {
      await this.init();
    }
    return this.db!;
  }

  // User Profile
  async saveProfile(profile: UserProfile): Promise<void> {
    const db = await this.ensureDB();
    await db.put('user_profile', profile);
  }

  async getProfile(): Promise<UserProfile | undefined> {
    const db = await this.ensureDB();
    const profiles = await db.getAll('user_profile');
    return profiles[0];
  }

  async deleteProfile(): Promise<void> {
    const db = await this.ensureDB();
    await db.clear('user_profile');
  }

  // Training Plans
  async savePlan(plan: TrainingPlan): Promise<void> {
    const db = await this.ensureDB();
    await db.put('training_plans', plan);
  }

  async getPlan(id: string): Promise<TrainingPlan | undefined> {
    const db = await this.ensureDB();
    return db.get('training_plans', id);
  }

  async getActivePlan(): Promise<TrainingPlan | undefined> {
    const db = await this.ensureDB();
    const plans = await db.getAllFromIndex('training_plans', 'by-status', 'active');
    return plans[0];
  }

  async getAllPlans(): Promise<TrainingPlan[]> {
    const db = await this.ensureDB();
    return db.getAll('training_plans');
  }

  async deletePlan(id: string): Promise<void> {
    const db = await this.ensureDB();
    await db.delete('training_plans', id);
  }

  // Workout Logs
  async saveWorkout(workout: WorkoutLog): Promise<void> {
    const db = await this.ensureDB();
    await db.put('workout_logs', workout);
  }

  async getWorkout(id: string): Promise<WorkoutLog | undefined> {
    const db = await this.ensureDB();
    return db.get('workout_logs', id);
  }

  async getWorkoutsByDate(date: string): Promise<WorkoutLog[]> {
    const db = await this.ensureDB();
    return db.getAllFromIndex('workout_logs', 'by-date', date);
  }

  async getRecentWorkouts(days: number): Promise<WorkoutLog[]> {
    const db = await this.ensureDB();
    const allWorkouts = await db.getAll('workout_logs');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return allWorkouts.filter(w => new Date(w.date) >= cutoff);
  }

  // Diet Logs
  async saveDietLog(log: DietLog): Promise<void> {
    const db = await this.ensureDB();
    await db.put('diet_logs', log);
  }

  async getDietLog(date: string): Promise<DietLog | undefined> {
    const db = await this.ensureDB();
    return db.get('diet_logs', date);
  }

  async getRecentDietLogs(days: number): Promise<DietLog[]> {
    const db = await this.ensureDB();
    const allLogs = await db.getAll('diet_logs');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return allLogs.filter(l => new Date(l.date) >= cutoff);
  }

  // Posture Records
  async savePostureRecord(record: PostureRecord): Promise<void> {
    const db = await this.ensureDB();
    await db.put('posture_records', record);
  }

  async getPostureRecord(id: string): Promise<PostureRecord | undefined> {
    const db = await this.ensureDB();
    return db.get('posture_records', id);
  }

  async getPostureHistory(): Promise<PostureRecord[]> {
    const db = await this.ensureDB();
    return db.getAll('posture_records');
  }

  // Chat Sessions
  async saveChatSession(session: ChatSession): Promise<void> {
    try {
      const db = await this.ensureDB();
      session.updatedAt = Date.now();
      console.log('[storage] saveChatSession:', session.id, session.title, 'messages:', session.messages.length);
      await db.put('chat_sessions', session);
      console.log('[storage] saveChatSession success');
    } catch (error) {
      console.error('[storage] saveChatSession error:', error);
      throw error;
    }
  }

  async getChatSession(id: string): Promise<ChatSession | undefined> {
    const db = await this.ensureDB();
    return db.get('chat_sessions', id);
  }

  async getAllChatSessions(): Promise<ChatSession[]> {
    const db = await this.ensureDB();
    const sessions = await db.getAllFromIndex('chat_sessions', 'by-updatedAt');
    return sessions.reverse();
  }

  async deleteChatSession(id: string): Promise<void> {
    const db = await this.ensureDB();
    await db.delete('chat_sessions', id);
  }

  async clearAllChatSessions(): Promise<void> {
    const db = await this.ensureDB();
    await db.clear('chat_sessions');
  }


  // Clear all data
  async clearAll(): Promise<void> {
    const db = await this.ensureDB();
    await db.clear('user_profile');
    await db.clear('training_plans');
    await db.clear('workout_logs');
    await db.clear('diet_logs');
    await db.clear('posture_records');
  }
}

export const storage = new FitCoachStorage();
