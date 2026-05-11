import type { Message, UserProfile, WorkoutLog, DietLog, TrainingPlan, Task, Reminder } from '../core/types';
import type { StatusAnalysis } from '../core/status-analyzer';

export interface MemoryContext {
  userProfile?: UserProfile;
  recentWorkouts: WorkoutLog[];
  recentDiet: DietLog[];
  conversationHistory: Message[];
  currentPlan?: TrainingPlan;
  pendingTasks: Task[];
  lastObservation?: string;
  statusAnalysis?: StatusAnalysis;
}

export class ShortTermMemory {
  private messages: Message[] = [];
  private windowSize: number;

  constructor(windowSize = 10) {
    this.windowSize = windowSize;
  }

  add(message: Message): void {
    this.messages.push(message);
    if (this.messages.length > this.windowSize) {
      this.messages.shift();
    }
  }

  getHistory(): Message[] {
    return [...this.messages];
  }

  getLastN(n: number): Message[] {
    return this.messages.slice(-n);
  }

  clear(): void {
    this.messages = [];
  }

  summarize(): string {
    if (this.messages.length === 0) return '';
    const summaryParts = this.messages.slice(-5).map(m =>
      `${m.role}: ${m.content.substring(0, 100)}${m.content.length > 100 ? '...' : ''}`
    );
    return summaryParts.join('\n');
  }
}

export class WorkingMemory {
  private tasks: Task[] = [];
  private currentPlan?: TrainingPlan;
  private evaluationCache: Map<string, unknown> = new Map();
  private currentTaskContext: Record<string, unknown> = {};

  addTask(task: Task): void {
    this.tasks.push(task);
  }

  completeTask(taskId: string): void {
    this.tasks = this.tasks.filter(t => t.id !== taskId);
  }

  getTasks(): Task[] {
    return [...this.tasks];
  }

  clearTasks(): void {
    this.tasks = [];
  }

  setCurrentPlan(plan: TrainingPlan): void {
    this.currentPlan = plan;
  }

  getCurrentPlan(): TrainingPlan | undefined {
    return this.currentPlan;
  }

  cacheEvaluation(key: string, value: unknown): void {
    this.evaluationCache.set(key, value);
  }

  getCachedEvaluation(key: string): unknown | undefined {
    return this.evaluationCache.get(key);
  }

  setContext(key: string, value: unknown): void {
    this.currentTaskContext[key] = value;
  }

  getContext(key: string): unknown {
    return this.currentTaskContext[key];
  }

  clearContext(): void {
    this.currentTaskContext = {};
  }
}

const DB_NAME = 'fitcoach-agent';
const DB_VERSION = 1;
const isServer = typeof window === 'undefined';

export class LongTermMemory {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;
  private isInitialized = false;

  constructor() {
    if (!isServer) {
      this.initPromise = this.initDB();
    }
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('profile')) {
          db.createObjectStore('profile', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('workouts')) {
          const workoutStore = db.createObjectStore('workouts', { keyPath: 'id' });
          workoutStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('diet')) {
          const dietStore = db.createObjectStore('diet', { keyPath: 'id' });
          dietStore.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('plans')) {
          db.createObjectStore('plans', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('reminders')) {
          db.createObjectStore('reminders', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('memory')) {
          db.createObjectStore('memory', { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureDB(): Promise<IDBDatabase | null> {
    if (isServer) return null;
    if (this.db) return this.db;
    await this.initPromise;
    if (!this.db) throw new Error('Failed to initialize IndexedDB');
    return this.db;
  }

  private async get<T>(storeName: string, key: string): Promise<T | undefined> {
    const db = await this.ensureDB();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  private async put<T>(storeName: string, value: T): Promise<void> {
    const db = await this.ensureDB();
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(value);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private async getAll<T>(storeName: string): Promise<T[]> {
    const db = await this.ensureDB();
    if (!db) return [];
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getProfile(): Promise<UserProfile | undefined> {
    return this.get<UserProfile>('profile', 'current');
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    const current = await this.getProfile();
    const updated: UserProfile = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    } as UserProfile;
    await this.put('profile', updated);
  }

  async saveProfile(profile: UserProfile): Promise<void> {
    await this.put('profile', { ...profile, id: 'current' });
  }

  async getRecentWorkouts(days: number): Promise<WorkoutLog[]> {
    const all = await this.getAll<WorkoutLog>('workouts');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return all
      .filter(w => w.date >= cutoffStr)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async addWorkout(workout: WorkoutLog): Promise<void> {
    await this.put('workouts', workout);
  }

  async getWorkoutHistory(limit = 30): Promise<WorkoutLog[]> {
    const all = await this.getAll<WorkoutLog>('workouts');
    return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
  }

  async getRecentDiet(days: number): Promise<DietLog[]> {
    const all = await this.getAll<DietLog>('diet');
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return all
      .filter(d => d.date >= cutoffStr)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  async addDietLog(diet: DietLog): Promise<void> {
    await this.put('diet', diet);
  }

  async getCurrentPlan(): Promise<TrainingPlan | undefined> {
    return this.get<TrainingPlan>('plans', 'current');
  }

  async savePlan(plan: TrainingPlan): Promise<void> {
    await this.put('plans', { ...plan, id: 'current' });
  }

  async getAllPlans(): Promise<TrainingPlan[]> {
    return this.getAll<TrainingPlan>('plans');
  }

  async addReminder(reminder: Reminder): Promise<void> {
    await this.put('reminders', reminder);
  }

  async getReminders(dismissed = false): Promise<Reminder[]> {
    const all = await this.getAll<Reminder>('reminders');
    return all.filter(r => r.dismissed === dismissed);
  }

  async dismissReminder(id: string): Promise<void> {
    const reminder = await this.get<Reminder>('reminders', id);
    if (reminder) {
      reminder.dismissed = true;
      await this.put('reminders', reminder);
    }
  }

  async storeMemory(key: string, value: unknown): Promise<void> {
    await this.put('memory', { key, value, updatedAt: new Date().toISOString() });
  }

  async getMemory<T>(key: string): Promise<T | undefined> {
    const result = await this.get<{ key: string; value: T }>('memory', key);
    return result?.value;
  }
}

export class MemorySystem {
  shortTerm: ShortTermMemory;
  longTerm: LongTermMemory;
  working: WorkingMemory;

  constructor(windowSize = 10) {
    this.shortTerm = new ShortTermMemory(windowSize);
    this.longTerm = new LongTermMemory();
    this.working = new WorkingMemory();
  }

  async addMessage(role: 'user' | 'assistant', content: string): Promise<void> {
    this.shortTerm.add({
      role,
      content,
      timestamp: Date.now()
    });
  }

  async getContext(): Promise<MemoryContext> {
    const [profile, recentWorkouts, recentDiet, currentPlan] = await Promise.all([
      this.longTerm.getProfile(),
      this.longTerm.getRecentWorkouts(7),
      this.longTerm.getRecentDiet(7),
      this.longTerm.getCurrentPlan()
    ]);

    return {
      userProfile: profile,
      recentWorkouts,
      recentDiet,
      conversationHistory: this.shortTerm.getHistory(),
      currentPlan,
      pendingTasks: this.working.getTasks()
    };
  }

  async updateProfile(updates: Partial<UserProfile>): Promise<void> {
    await this.longTerm.updateProfile(updates);
  }

  async addReminder(reminder: Reminder): Promise<void> {
    await this.longTerm.addReminder(reminder);
  }

  async savePlan(plan: TrainingPlan): Promise<void> {
    await this.longTerm.savePlan(plan);
    this.working.setCurrentPlan(plan);
  }

  async addWorkout(workout: WorkoutLog): Promise<void> {
    await this.longTerm.addWorkout(workout);
  }

  async getWorkoutCompletionRate(days = 7): Promise<number> {
    const workouts = await this.longTerm.getRecentWorkouts(days);
    if (workouts.length === 0) return 1;
    const completed = workouts.filter(w => w.status === 'completed').length;
    return completed / workouts.length;
  }

  getConversationSummary(): string {
    return this.shortTerm.summarize();
  }

  clearShortTerm(): void {
    this.shortTerm.clear();
  }
}
