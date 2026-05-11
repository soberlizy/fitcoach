import { useState, useEffect } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { formatDate } from '@/lib/utils';
import type { UserProfile, TrainingPlan, WorkoutLog, DietLog } from '@/lib/types';

export default function Home() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [todayWorkout, setTodayWorkout] = useState<WorkoutLog | null>(null);
  const [todayDiet, setTodayDiet] = useState<DietLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        await storage.init();
        const userProfile = await storage.getProfile();
        const plan = await storage.getActivePlan();
        const workout = await storage.getWorkoutsByDate(formatDate(new Date()));
        const diet = await storage.getDietLog(formatDate(new Date()));

        setProfile(userProfile || null);
        setActivePlan(plan || null);
        setTodayWorkout(workout[0] || null);
        setTodayDiet(diet || null);
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-4xl font-bold mb-4">FitCoach</h1>
          <p className="text-gray-500 mb-8">你的 AI 健身教练</p>
          <Link href="/profile" className="btn-primary inline-block">
            开始使用
          </Link>
        </div>
      </div>
    );
  }

  const today = new Date();
  const dayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const todayStr = formatDate(today);
  const todayDayName = dayNames[today.getDay()];

  // Get today's workout from plan
  const todayDayOfWeek = today.getDay() as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  let todayExercises: any[] = [];
  if (activePlan) {
    for (const week of activePlan.weeks) {
      const day = week.days.find(d => d.dayOfWeek === todayDayOfWeek);
      if (day && !day.isRestDay) {
        todayExercises = day.exercises;
        break;
      }
    }
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 py-6 border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">{todayDayName}，{todayStr}</p>
            <h1 className="text-xl font-semibold">{profile.nickname}，开始今天的训练吧</h1>
          </div>
          <Link href="/profile" className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          <div className="stat-card">
            <p className="text-2xl font-semibold">{profile.weight}</p>
            <p className="text-xs text-gray-500">体重 kg</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-semibold">{profile.bodyFatPercent || '--'}</p>
            <p className="text-xs text-gray-500">体脂率 %</p>
          </div>
          <div className="stat-card">
            <p className="text-2xl font-semibold">{profile.bmi || '--'}</p>
            <p className="text-xs text-gray-500">BMI</p>
          </div>
        </div>

        {/* Today's Diet */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">今日饮食</h2>
            <Link href="/diet" className="text-sm text-gray-500 hover:text-black">
              {todayDiet ? '查看详情' : '记录'}
            </Link>
          </div>
          <div className="card">
            {todayDiet ? (
              <div className="flex items-center gap-6">
                <div className="flex-1">
                  <p className="text-3xl font-semibold">{todayDiet.totalNutrition.calories}</p>
                  <p className="text-sm text-gray-500">千卡</p>
                </div>
                <div className="flex gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">蛋白质</p>
                    <p className="font-medium">{todayDiet.totalNutrition.protein}g</p>
                  </div>
                  <div>
                    <p className="text-gray-500">脂肪</p>
                    <p className="font-medium">{todayDiet.totalNutrition.fat}g</p>
                  </div>
                  <div>
                    <p className="text-gray-500">碳水</p>
                    <p className="font-medium">{todayDiet.totalNutrition.carbs}g</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-400 mb-3">还没有记录今日饮食</p>
                <Link href="/diet" className="btn-secondary text-sm py-2 px-4">
                  拍照记录
                </Link>
              </div>
            )}
          </div>
        </section>

        {/* Today's Workout */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">今日训练</h2>
            <Link href="/plan" className="text-sm text-gray-500 hover:text-black">
              查看计划
            </Link>
          </div>
          {todayExercises.length > 0 ? (
            <div className="card">
              <p className="text-sm text-gray-500 mb-4">
                {todayExercises.length} 个动作 · 约 {todayExercises.reduce((s, e) => s + e.sets * e.reps * 3, 0)} 分钟
              </p>
              <div className="space-y-3">
                {todayExercises.slice(0, 3).map((ex, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                    <div>
                      <p className="font-medium">{ex.name}</p>
                      <p className="text-sm text-gray-500">{ex.targetMuscle}</p>
                    </div>
                    <p className="text-sm text-gray-400">
                      {ex.sets} × {ex.reps}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href="/workout"
                className="btn-primary w-full mt-4 text-center block"
              >
                {todayWorkout ? '继续训练' : '开始训练'}
              </Link>
            </div>
          ) : (
            <div className="card text-center py-6">
              <p className="text-gray-400 mb-3">今天休息日</p>
              <p className="text-sm text-gray-400">好好恢复，明天继续</p>
            </div>
          )}
        </section>

        {/* Active Plan */}
        {activePlan && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium">进行中的计划</h2>
              <Link href="/plan" className="text-sm text-gray-500 hover:text-black">
                查看全部
              </Link>
            </div>
            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <p className="font-medium">
                  {activePlan.goal === 'fat_loss' ? '减脂计划' :
                   activePlan.goal === 'muscle_gain' ? '增肌计划' :
                   activePlan.goal === 'shaping' ? '塑形计划' : '训练计划'}
                </p>
                <span className="text-xs bg-black text-white px-2 py-1 rounded">
                  第 {Math.ceil((new Date().getTime() - new Date(activePlan.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000))} 周
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {activePlan.startDate} - {activePlan.endDate}
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto flex justify-around py-3">
          <Link href="/" className="nav-item active">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>首页</span>
          </Link>
          <Link href="/plan" className="nav-item">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span>计划</span>
          </Link>
          <Link href="/chat" className="nav-item">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>AI</span>
          </Link>
          <Link href="/workout" className="nav-item">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>训练</span>
          </Link>
          <Link href="/diet" className="nav-item">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>饮食</span>
          </Link>
          <Link href="/profile" className="nav-item">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>我的</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
