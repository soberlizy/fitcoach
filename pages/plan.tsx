import { useState, useEffect } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { fitnessAgent } from '@/agents/fitness-agent';
import type { TrainingPlan, UserProfile } from '@/lib/types';

export default function Plan() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedWeek, setSelectedWeek] = useState(1);

  useEffect(() => {
    async function loadData() {
      try {
        await storage.init();
        const p = await storage.getProfile();
        const plan = await storage.getActivePlan();
        setProfile(p || null);
        setActivePlan(plan || null);
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleGeneratePlan = async () => {
    if (!profile) return;
    setGenerating(true);
    try {
      const plan = await fitnessAgent.generateTrainingPlan(profile);
      setActivePlan(plan);
    } catch (e) {
      console.error('Generate error:', e);
      alert('生成计划失败');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  const dayNames = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 py-6 border-b border-gray-100">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold">训练计划</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {!activePlan ? (
          <div className="text-center py-12">
            <svg className="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <h2 className="text-lg font-medium mb-2">还没有训练计划</h2>
            <p className="text-gray-500 mb-6">根据你的目标和体能，生成专属训练计划</p>
            {!profile ? (
              <Link href="/profile" className="btn-primary inline-block">
                完善档案后生成
              </Link>
            ) : (
              <button
                onClick={handleGeneratePlan}
                disabled={generating}
                className="btn-primary"
              >
                {generating ? '生成中...' : '生成训练计划'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Plan Header */}
            <div className="card mb-6">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-lg">
                    {activePlan.goal === 'fat_loss' ? '减脂计划' :
                     activePlan.goal === 'muscle_gain' ? '增肌计划' :
                     activePlan.goal === 'shaping' ? '塑形计划' : '训练计划'}
                  </p>
                  <p className="text-sm text-gray-500">
                    {activePlan.startDate} - {activePlan.endDate}
                  </p>
                </div>
                <button
                  onClick={handleGeneratePlan}
                  disabled={generating}
                  className="btn-secondary text-sm py-2"
                >
                  重新生成
                </button>
              </div>

              {/* Week Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2">
                {activePlan.weeks.map((week) => (
                  <button
                    key={week.weekNumber}
                    onClick={() => setSelectedWeek(week.weekNumber)}
                    className={`px-4 py-2 rounded-lg text-sm whitespace-nowrap transition-all ${
                      selectedWeek === week.weekNumber
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    第 {week.weekNumber} 周
                  </button>
                ))}
              </div>
            </div>

            {/* Week Schedule */}
            {activePlan.weeks
              .filter((w) => w.weekNumber === selectedWeek)
              .map((week) => (
                <div key={week.weekNumber} className="space-y-3">
                  {week.days.map((day) => (
                    <div key={day.dayOfWeek} className="card">
                      <div className="flex items-center justify-between mb-3">
                        <p className="font-medium">{dayNames[day.dayOfWeek - 1]}</p>
                        {day.isRestDay && (
                          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-1 rounded">
                            休息日
                          </span>
                        )}
                      </div>

                      {day.isRestDay ? (
                        <p className="text-sm text-gray-400 py-2">好好休息，让身体恢复</p>
                      ) : day.exercises.length === 0 ? (
                        <p className="text-sm text-gray-400 py-2">无训练安排</p>
                      ) : (
                        <div className="space-y-3">
                          {day.exercises.map((ex, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex-1">
                                <p className="font-medium">{ex.name}</p>
                                <p className="text-sm text-gray-500">{ex.targetMuscle}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-medium">
                                  {ex.sets} × {ex.reps}
                                </p>
                                <p className="text-xs text-gray-400">组 × 次数</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
          </>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto flex justify-around py-3">
          <Link href="/" className="nav-item">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span>首页</span>
          </Link>
          <Link href="/plan" className="nav-item active">
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
