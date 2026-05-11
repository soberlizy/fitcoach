import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { fitnessAgent, saveDietMeal } from '@/agents/fitness-agent';
import { formatDate, generateId } from '@/lib/utils';
import type { DietLog, UserProfile } from '@/lib/types';

export default function Diet() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [todayDiet, setTodayDiet] = useState<DietLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selectedMeal, setSelectedMeal] = useState<'breakfast' | 'lunch' | 'dinner' | 'snack'>('breakfast');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [recognizedFoods, setRecognizedFoods] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        await storage.init();
        const p = await storage.getProfile();
        const diet = await storage.getDietLog(formatDate(new Date()));
        setProfile(p || null);
        setTodayDiet(diet || null);
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setShowCamera(true);
    } catch (e) {
      console.error('Camera error:', e);
      alert('无法访问摄像头');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL('image/jpeg', 0.8);

    // Stop camera first, then analyze
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);

    await analyzeImage(imageData);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;
      await analyzeImage(imageData);
    };
    reader.readAsDataURL(file);

    // Reset input so same file can be selected again
    e.target.value = '';
  };

  const analyzeImage = async (imageData: string) => {
    setAnalyzing(true);

    try {
      const result = await fitnessAgent.analyzeFood(imageData);
      setRecognizedFoods(result.foods);
      setShowResults(true);
    } catch (e) {
      console.error('Analyze error:', e);
      alert('识别失败，请重试');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleConfirmMeal = async () => {
    const meal = {
      id: generateId(),
      type: selectedMeal,
      foods: recognizedFoods.map(f => ({
        id: generateId(),
        name: f.name,
        amount: f.amount,
        nutrition: {
          calories: f.calories,
          protein: f.protein,
          fat: f.fat,
          carbs: f.carbs
        }
      })),
      time: new Date().toISOString()
    };

    await saveDietMeal(formatDate(new Date()), meal);

    // Refresh today's diet
    const updated = await storage.getDietLog(formatDate(new Date()));
    setTodayDiet(updated || null);
    setShowResults(false);
    setRecognizedFoods([]);
  };

  const getMealIcon = (type: string) => {
    switch (type) {
      case 'breakfast':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707" />
          </svg>
        );
      case 'lunch':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        );
      case 'dinner':
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14v6m-3-3h6M6 10h2a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v2a2 2 0 002 2zm10 0h2a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2 2v2a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  const getMealName = (type: string) => {
    switch (type) {
      case 'breakfast': return '早餐';
      case 'lunch': return '午餐';
      case 'dinner': return '晚餐';
      case 'snack': return '加餐';
      default: return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 py-6 border-b border-gray-100">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-xl font-semibold">饮食记录</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Today's Summary */}
        <section className="mb-8">
          <h2 className="section-title">今日摄入</h2>
          {todayDiet && todayDiet.totalNutrition.calories > 0 ? (
            <div className="card">
              <div className="flex items-center gap-6 mb-6">
                <div className="flex-1">
                  <p className="text-4xl font-bold">{todayDiet.totalNutrition.calories.toFixed(2)}</p>
                  <p className="text-sm text-gray-500">千卡</p>
                </div>
                <div className="flex gap-6 text-sm">
                  <div>
                    <p className="text-gray-500">蛋白质</p>
                    <p className="font-semibold">{todayDiet.totalNutrition.protein.toFixed(2)}g</p>
                  </div>
                  <div>
                    <p className="text-gray-500">脂肪</p>
                    <p className="font-semibold">{todayDiet.totalNutrition.fat.toFixed(2)}g</p>
                  </div>
                  <div>
                    <p className="text-gray-500">碳水</p>
                    <p className="font-semibold">{todayDiet.totalNutrition.carbs.toFixed(2)}g</p>
                  </div>
                </div>
              </div>

              {/* Meals */}
              <div className="space-y-3">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((mealType) => {
                  const meal = todayDiet.meals.find(m => m.type === mealType);
                  return (
                    <div
                      key={mealType}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {getMealIcon(mealType)}
                        <span>{getMealName(mealType)}</span>
                      </div>
                      {meal ? (
                        <span className="text-gray-500">
                          {meal.foods.reduce((s, f) => s + f.nutrition.calories, 0).toFixed(2)} kcal
                        </span>
                      ) : (
                        <span className="text-gray-300">未记录</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card text-center py-8">
              <svg className="w-12 h-12 mx-auto text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <p className="text-gray-500 mb-4">还没有记录今日饮食</p>
            </div>
          )}
        </section>

        {/* Camera / Upload */}
        {!showResults && (
          <section className="mb-8">
            <h2 className="section-title">添加记录</h2>
            <div className="card">
              {/* Meal Type Selector */}
              <div className="flex gap-2 mb-6">
                {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedMeal(type)}
                    className={`flex-1 py-2 rounded-lg text-sm transition-all ${
                      selectedMeal === type
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {getMealName(type)}
                  </button>
                ))}
              </div>

              {showCamera ? (
                <div className="space-y-4">
                  <div className="relative rounded-lg overflow-hidden bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className="w-full aspect-[4/3] object-cover"
                    />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={stopCamera} className="btn-secondary flex-1">
                      取消
                    </button>
                    <button onClick={captureAndAnalyze} className="btn-primary flex-1">
                      拍照识别
                    </button>
                  </div>
                </div>
              ) : analyzing ? (
                <div className="text-center py-12">
                  <div className="animate-pulse">
                    <p className="text-gray-500">AI 识别中...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div
                    onClick={startCamera}
                    className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <p className="text-gray-500 mb-1">拍照记录</p>
                    <p className="text-xs text-gray-400">使用摄像头拍摄</p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex-1 h-px bg-gray-200"></div>
                    <span className="px-3 text-xs text-gray-400">或</span>
                    <div className="flex-1 h-px bg-gray-200"></div>
                  </div>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    <svg className="w-10 h-10 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500 mb-1">上传图片</p>
                    <p className="text-xs text-gray-400">从相册选择食物照片</p>
                  </button>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Recognition Results */}
        {showResults && recognizedFoods.length > 0 && (
          <section className="mb-8">
            <h2 className="section-title">识别结果</h2>
            <div className="card">
              <div className="space-y-3 mb-6">
                {recognizedFoods.map((food, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium">{food.name}</p>
                      <p className="text-sm text-gray-500">{food.amount.toFixed(2)}g</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{food.calories.toFixed(2)} kcal</p>
                      <p className="text-xs text-gray-400">
                        P: {food.protein.toFixed(2)}g / F: {food.fat.toFixed(2)}g / C: {food.carbs.toFixed(2)}g
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 pt-4 mb-4">
                <div className="flex items-center justify-between">
                  <span className="font-medium">总计</span>
                  <span className="text-xl font-bold">
                    {recognizedFoods.reduce((s, f) => s + f.calories, 0).toFixed(2)} kcal
                  </span>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowResults(false);
                    setRecognizedFoods([]);
                  }}
                  className="btn-secondary flex-1"
                >
                  重新拍摄
                </button>
                <button onClick={handleConfirmMeal} className="btn-primary flex-1">
                  确认添加
                </button>
              </div>
            </div>
          </section>
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
          <Link href="/diet" className="nav-item active">
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
