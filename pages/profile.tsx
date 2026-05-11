import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { fitnessAgent } from '@/agents/fitness-agent';
import { generateId, calculateBMI, calculateBMR } from '@/lib/utils';
import type { UserProfile, BodyFatResult } from '@/lib/types';

export default function Profile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showBodyFatResult, setShowBodyFatResult] = useState(false);
  const [bodyFatResult, setBodyFatResult] = useState<BodyFatResult | null>(null);
  const [analyzingBodyFat, setAnalyzingBodyFat] = useState(false);
  const [sidePhoto, setSidePhoto] = useState<string | null>(null);
  const [frontPhoto, setFrontPhoto] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const frontFileInputRef = useRef<HTMLInputElement>(null);
  const [photoType, setPhotoType] = useState<'side' | 'front'>('side');
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [goal, setGoal] = useState<UserProfile['goal']>('fat_loss');
  const [experience, setExperience] = useState<UserProfile['experience']>('beginner');
  const [trainingDays, setTrainingDays] = useState(3);
  const [trainingDuration, setTrainingDuration] = useState<30 | 45 | 60>(45);

  useEffect(() => {
    async function loadProfile() {
      try {
        await storage.init();
        const p = await storage.getProfile();
        if (p) {
          setProfile(p);
          setNickname(p.nickname);
          setGender(p.gender);
          setAge(p.age.toString());
          setHeight(p.height.toString());
          setWeight(p.weight.toString());
          setGoal(p.goal);
          setExperience(p.experience);
          setTrainingDays(p.trainingDaysPerWeek);
          setTrainingDuration(p.trainingDuration);
        }
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'side' | 'front') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const imageData = event.target?.result as string;

      if (type === 'side') {
        setSidePhoto(imageData);
      } else {
        setFrontPhoto(imageData);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!sidePhoto) return;

    setAnalyzingBodyFat(true);

    try {
      const result = await fitnessAgent.analyzeBodyFat(sidePhoto, frontPhoto || undefined);
      setBodyFatResult(result);
      setShowBodyFatResult(true);
    } catch (error) {
      console.error('Body fat analysis error:', error);
    } finally {
      setAnalyzingBodyFat(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const bmi = calculateBMI(parseFloat(weight), parseFloat(height));
      const bmr = calculateBMR(parseFloat(weight), parseFloat(height), parseInt(age), gender);

      const newProfile: UserProfile = {
        id: profile?.id || generateId(),
        nickname,
        gender,
        age: parseInt(age),
        height: parseFloat(height),
        weight: parseFloat(weight),
        goal,
        experience,
        trainingDaysPerWeek: trainingDays as 1 | 2 | 3 | 4 | 5 | 6 | 7,
        trainingDuration: trainingDuration as 15 | 30 | 45 | 60,
        bodyFatPercent: bodyFatResult?.bodyFatPercent || profile?.bodyFatPercent,
        bodyType: bodyFatResult?.bodyType || profile?.bodyType,
        bmi,
        bmr,
        createdAt: profile?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await storage.saveProfile(newProfile);
      setProfile(newProfile);
      setIsEditing(false);
      alert('档案已保存');
    } catch (e) {
      console.error('Save error:', e);
      alert('保存失败');
    } finally {
      setSaving(false);
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
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <Link href="/" className="text-gray-500">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-xl font-semibold">我的档案</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Profile Preview (when exists and not editing) */}
        {profile && !isEditing ? (
          <section className="mb-8">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center text-2xl font-bold">
                    {nickname.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold">{profile.nickname}</h2>
                    <p className="text-sm text-gray-500">
                      {profile.gender === 'male' ? '男' : profile.gender === 'female' ? '女' : '其他'} · {profile.age}岁 · {profile.height}cm
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
                >
                  编辑
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-semibold">{profile.weight}</p>
                  <p className="text-xs text-gray-500">体重 kg</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-semibold">{profile.bodyFatPercent || '--'}</p>
                  <p className="text-xs text-gray-500">体脂率 %</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-semibold">{profile.bmi || '--'}</p>
                  <p className="text-xs text-gray-500">BMI</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500">健身目标</span>
                  <span className="font-medium">
                    {profile.goal === 'fat_loss' ? '减脂' :
                     profile.goal === 'muscle_gain' ? '增肌' :
                     profile.goal === 'shaping' ? '塑形' :
                     profile.goal === 'maintain' ? '维持' : '体态矫正'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">经验等级</span>
                  <span className="font-medium">
                    {profile.experience === 'beginner' ? '新手' :
                     profile.experience === 'intermediate' ? '中级' : '高级'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">训练频率</span>
                  <span className="font-medium">每周{profile.trainingDaysPerWeek}天</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">训练时长</span>
                  <span className="font-medium">每次{profile.trainingDuration}分钟</span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="section-title">体脂检测</h2>
          <div className="card">
            {showBodyFatResult && bodyFatResult ? (
              <div className="text-center py-4">
                <p className="text-5xl font-bold mb-2">{bodyFatResult.bodyFatPercent}%</p>
                <p className="text-lg text-gray-600 mb-4">{bodyFatResult.bodyType}</p>
                <p className="text-sm text-gray-500 mb-4">{bodyFatResult.comment}</p>
                <div className="text-left bg-gray-50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">建议：</p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {bodyFatResult.suggestions.map((s, i) => (
                      <li key={i}>• {s}</li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={async () => {
                      if (!profile) {
                        alert('请先创建档案');
                        return;
                      }
                      try {
                        const updatedProfile: UserProfile = {
                          ...profile,
                          bodyFatPercent: bodyFatResult.bodyFatPercent,
                          bodyType: bodyFatResult.bodyType as any,
                          updatedAt: new Date().toISOString()
                        };
                        await storage.saveProfile(updatedProfile);
                        setProfile(updatedProfile);
                        alert('体脂数据已保存到档案');
                      } catch (e) {
                        console.error('Save body fat error:', e);
                        alert('保存失败');
                      }
                    }}
                    className="flex-1 bg-green-500 text-white py-2 px-4 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    保存到档案
                  </button>
                  <button
                    onClick={() => {
                      setShowBodyFatResult(false);
                      setSidePhoto(null);
                      setFrontPhoto(null);
                    }}
                    className="btn-ghost"
                  >
                    重新上传
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Side Photo */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    侧面照 <span className="text-red-500">*</span>
                  </p>
                  {sidePhoto ? (
                    <div className="relative rounded-lg overflow-hidden">
                      <img src={sidePhoto} alt="侧面照" className="w-full h-48 object-cover" />
                      <button
                        onClick={() => setSidePhoto(null)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleImageUpload(e, 'side')}
                        className="hidden"
                      />
                      <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">上传侧面照</p>
                      <p className="text-xs text-gray-400 mt-1">穿贴身衣物，自然站立</p>
                    </div>
                  )}
                </div>

                {/* Front Photo */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    正面照 <span className="text-gray-400">(可选)</span>
                  </p>
                  {frontPhoto ? (
                    <div className="relative rounded-lg overflow-hidden">
                      <img src={frontPhoto} alt="正面照" className="w-full h-48 object-cover" />
                      <button
                        onClick={() => setFrontPhoto(null)}
                        className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-gray-300 transition-colors"
                      onClick={() => frontFileInputRef.current?.click()}
                    >
                      <input
                        ref={frontFileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => handleImageUpload(e, 'front')}
                        className="hidden"
                      />
                      <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-sm text-gray-500">上传正面照</p>
                      <p className="text-xs text-gray-400 mt-1">双臂自然下垂，目视前方</p>
                    </div>
                  )}
                </div>

                {/* Analyze Button */}
                {sidePhoto && !analyzingBodyFat && (
                  <button
                    onClick={handleAnalyze}
                    className="btn-primary w-full"
                  >
                    开始分析
                  </button>
                )}

                {analyzingBodyFat && (
                  <div className="text-center py-4">
                    <div className="animate-pulse">
                      <p className="text-gray-500">AI 分析中...</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Basic Info */}
        <section className="mb-8">
          <h2 className="section-title">基本信息</h2>
          <div className="card space-y-4">
            <div>
              <label className="input-label">昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="给自己起个名字"
              />
            </div>

            <div>
              <label className="input-label">性别</label>
              <div className="flex gap-3">
                {(['male', 'female', 'other'] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGender(g)}
                    className={`flex-1 py-3 rounded-lg border transition-all ${
                      gender === g
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">年龄</label>
                <input
                  type="number"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="25"
                />
              </div>
              <div>
                <label className="input-label">身高 (cm)</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  placeholder="170"
                />
              </div>
            </div>

            <div>
              <label className="input-label">体重 (kg)</label>
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
              />
            </div>
          </div>
        </section>

        {/* Fitness Goal */}
        <section className="mb-8">
          <h2 className="section-title">健身目标</h2>
          <div className="card space-y-3">
            {([
              { value: 'fat_loss', label: '减脂', desc: '降低体脂率，塑造线条' },
              { value: 'muscle_gain', label: '增肌', desc: '增加肌肉量，提升力量' },
              { value: 'shaping', label: '塑形', desc: '紧致身材，提升比例' },
              { value: 'posture', label: '体态矫正', desc: '改善圆肩、驼背等问题' },
              { value: 'maintain', label: '维持', desc: '保持当前体型' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGoal(opt.value)}
                className={`w-full p-4 rounded-lg border text-left transition-all ${
                  goal === opt.value
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="font-medium">{opt.label}</p>
                <p className="text-sm text-gray-500">{opt.desc}</p>
              </button>
            ))}
          </div>
        </section>

        {/* Experience */}
        <section className="mb-8">
          <h2 className="section-title">健身经验</h2>
          <div className="card">
            <div className="flex gap-3">
              {([
                { value: 'beginner', label: '新手' },
                { value: 'intermediate', label: '中级' },
                { value: 'advanced', label: '高级' },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExperience(opt.value)}
                  className={`flex-1 py-3 rounded-lg border transition-all ${
                    experience === opt.value
                      ? 'border-black bg-black text-white'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Training Preference */}
        <section className="mb-8">
          <h2 className="section-title">训练偏好</h2>
          <div className="card space-y-4">
            <div>
              <label className="input-label">每周训练天数</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5, 6, 7].map((d) => (
                  <button
                    key={d}
                    onClick={() => setTrainingDays(d)}
                    className={`flex-1 py-2 rounded-lg border text-sm transition-all ${
                      trainingDays === d
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="input-label">每次训练时长</label>
              <div className="flex gap-3">
                {([30, 45, 60] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setTrainingDuration(d)}
                    className={`flex-1 py-3 rounded-lg border transition-all ${
                      trainingDuration === d
                        ? 'border-black bg-black text-white'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    {d}分钟
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Save Button */}
        <div className="flex gap-3">
          {profile && isEditing && (
            <button
              onClick={() => {
                setIsEditing(false);
                // Reset form to saved profile values
                if (profile) {
                  setNickname(profile.nickname);
                  setGender(profile.gender);
                  setAge(profile.age.toString());
                  setHeight(profile.height.toString());
                  setWeight(profile.weight.toString());
                  setGoal(profile.goal);
                  setExperience(profile.experience);
                  setTrainingDays(profile.trainingDaysPerWeek);
                  setTrainingDuration(profile.trainingDuration);
                }
              }}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          )}
          <button
            onClick={handleSaveProfile}
            disabled={saving || !nickname || !age || !height || !weight}
            className="btn-primary flex-1"
          >
            {saving ? '保存中...' : '保存档案'}
          </button>
        </div>
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
          <Link href="/profile" className="nav-item active">
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
