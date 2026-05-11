import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { storage } from '@/lib/storage';
import { formatDate, generateId } from '@/lib/utils';
import type { TrainingPlan, WorkoutLog, Exercise } from '@/lib/types';

export default function Workout() {
  const [activePlan, setActivePlan] = useState<TrainingPlan | null>(null);
  const [todayExercises, setTodayExercises] = useState<Exercise[]>([]);
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [currentSet, setCurrentSet] = useState(1);
  const [isResting, setIsResting] = useState(false);
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workoutActive, setWorkoutActive] = useState(false);
  const [workoutCompleted, setWorkoutCompleted] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        await storage.init();
        const plan = await storage.getActivePlan();
        if (plan) {
          setActivePlan(plan);

          const today = new Date();
          const todayDayOfWeek = today.getDay() as 1 | 2 | 3 | 4 | 5 | 6 | 7;
          // Convert Sunday (0) to 7
          const adjustedDay = todayDayOfWeek === 0 ? 7 : todayDayOfWeek;

          for (const week of plan.weeks) {
            const day = week.days.find(d => d.dayOfWeek === adjustedDay);
            if (day && !day.isRestDay && day.exercises.length > 0) {
              setTodayExercises(day.exercises);
              break;
            }
          }
        }
      } catch (e) {
        console.error('Load error:', e);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (isResting && restTimeLeft > 0) {
      timerRef.current = setTimeout(() => {
        setRestTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (restTimeLeft === 0 && isResting) {
      setIsResting(false);
      if (currentSet < todayExercises[currentExerciseIndex]?.sets) {
        setCurrentSet(prev => prev + 1);
      }
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isResting, restTimeLeft, currentSet, currentExerciseIndex, todayExercises]);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (e) {
      console.error('Camera error:', e);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  }, [stream]);

  const startRest = useCallback(() => {
    const exercise = todayExercises[currentExerciseIndex];
    setIsResting(true);
    setRestTimeLeft(exercise?.restSeconds || 60);
  }, [currentExerciseIndex, todayExercises]);

  const handleSetComplete = useCallback(() => {
    const exercise = todayExercises[currentExerciseIndex];
    if (!exercise) return;

    if (currentSet >= exercise.sets) {
      // Move to next exercise
      if (currentExerciseIndex < todayExercises.length - 1) {
        setCurrentExerciseIndex(prev => prev + 1);
        setCurrentSet(1);
        startRest();
      } else {
        // Workout complete
        setWorkoutCompleted(true);
        stopCamera();
        saveWorkoutLog();
      }
    } else {
      startRest();
    }
  }, [currentSet, currentExerciseIndex, todayExercises, startRest, stopCamera]);

  const saveWorkoutLog = async () => {
    const log: WorkoutLog = {
      id: generateId(),
      userId: 'current',
      planId: activePlan?.id || '',
      date: formatDate(new Date()),
      exercises: todayExercises.map(ex => ({
        exerciseId: ex.id,
        exerciseName: ex.name,
        setsCompleted: ex.sets,
        repsCompleted: ex.reps
      })),
      duration: 30, // TODO: calculate actual duration
      status: 'completed'
    };
    await storage.saveWorkout(log);
  };

  const handleSkip = () => {
    if (currentExerciseIndex < todayExercises.length - 1) {
      setCurrentExerciseIndex(prev => prev + 1);
      setCurrentSet(1);
      setIsResting(false);
    } else {
      setWorkoutCompleted(true);
      stopCamera();
    }
  };

  const currentExercise = todayExercises[currentExerciseIndex];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">加载中...</div>
      </div>
    );
  }

  if (todayExercises.length === 0) {
    return (
      <div className="min-h-screen pb-20">
        <header className="px-4 py-6 border-b border-gray-100">
          <div className="max-w-2xl mx-auto">
            <h1 className="text-xl font-semibold">今日训练</h1>
          </div>
        </header>
        <main className="max-w-2xl mx-auto px-4 py-12 text-center">
          <svg className="w-16 h-16 mx-auto text-gray-200 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <h2 className="text-lg font-medium mb-2">今天休息日</h2>
          <p className="text-gray-500">好好恢复，明天继续</p>
        </main>
      </div>
    );
  }

  if (workoutCompleted) {
    return (
      <div className="min-h-screen pb-20 flex flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">训练完成！</h2>
          <p className="text-gray-500 mb-8">
            太棒了！你已完成今日 {todayExercises.length} 个动作的训练
          </p>
          <Link href="/" className="btn-primary inline-block">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <header className="px-4 py-6 border-b border-gray-100">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">今日训练</h1>
            <p className="text-sm text-gray-500">
              动作 {currentExerciseIndex + 1} / {todayExercises.length}
            </p>
          </div>
          {workoutActive && (
            <button onClick={handleSkip} className="btn-ghost text-sm">
              跳过
            </button>
          )}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {!workoutActive ? (
          <div className="text-center py-12">
            <h2 className="text-lg font-medium mb-2">{currentExercise?.name}</h2>
            <p className="text-gray-500 mb-8">{currentExercise?.targetMuscle}</p>
            <div className="text-6xl font-bold mb-8">
              {currentExercise?.sets} × {currentExercise?.reps}
            </div>
            <button
              onClick={() => {
                setWorkoutActive(true);
                startCamera();
              }}
              className="btn-primary w-full max-w-xs"
            >
              开始训练
            </button>
          </div>
        ) : isResting ? (
          <div className="text-center py-12">
            <p className="text-gray-500 mb-4">休息一下</p>
            <div className="text-8xl font-bold mb-8">{restTimeLeft}</div>
            <button
              onClick={() => {
                setIsResting(false);
                setRestTimeLeft(0);
              }}
              className="btn-secondary"
            >
              跳过休息
            </button>
          </div>
        ) : (
          <>
            {/* Video Preview */}
            <div className="relative rounded-xl overflow-hidden bg-gray-100 mb-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full aspect-[4/3] object-cover"
              />
              <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  {currentExercise?.name}
                </div>
                <div className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  第 {currentSet} / {currentExercise?.sets} 组
                </div>
              </div>
            </div>

            {/* Exercise Info */}
            <div className="card mb-6">
              <h3 className="font-medium mb-2">{currentExercise?.name}</h3>
              <p className="text-sm text-gray-500 mb-4">
                {currentExercise?.targetMuscle} · 难度 {currentExercise?.difficulty}
              </p>
              <div className="text-center py-4">
                <p className="text-4xl font-bold">
                  {currentExercise?.sets - currentSet + 1 > 0 ? currentExercise?.sets - currentSet + 1 : 1}
                </p>
                <p className="text-gray-500">组剩余</p>
              </div>
            </div>

            {/* Tips */}
            {currentExercise?.tips && currentExercise.tips.length > 0 && (
              <div className="card mb-6 bg-blue-50 border-blue-100">
                <p className="text-sm font-medium text-blue-800 mb-2">动作要点</p>
                <ul className="text-sm text-blue-700 space-y-1">
                  {currentExercise.tips.map((tip, i) => (
                    <li key={i}>• {tip}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-4">
              <button
                onClick={handleSetComplete}
                className="btn-primary flex-1"
              >
                完成一组
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
