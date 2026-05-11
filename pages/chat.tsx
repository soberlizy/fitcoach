'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { storage, ChatSession, ChatMessage } from '@/lib/storage';
import type { UserProfile, TrainingPlan, WorkoutLog, DietLog } from '@/lib/types';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AgentAction {
  type: 'reminder' | 'plan_adjustment' | 'knowledge_card';
  data: unknown;
}

interface AgentResponse {
  content: string;
  suggestions?: string[];
  actions?: AgentAction[];
  steps?: unknown[];
  error?: string;
  generatedPlan?: TrainingPlan;
}

function createEmptySession(): ChatSession {
  return {
    id: `session_${Date.now()}`,
    title: '新对话',
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
}

export default function Chat() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [trainingPlan, setTrainingPlan] = useState<TrainingPlan | null>(null);
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutLog[]>([]);
  const [recentDiet, setRecentDiet] = useState<DietLog[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => `session_${Date.now()}`);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null);
  const [showSessionList, setShowSessionList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        await storage.init();
        const [p, plan, workouts, diet, allSessions] = await Promise.all([
          storage.getProfile(),
          storage.getActivePlan(),
          storage.getRecentWorkouts(7),
          storage.getRecentDietLogs(7),
          storage.getAllChatSessions()
        ]);
        setProfile(p || null);
        setTrainingPlan(plan || null);
        setRecentWorkouts(workouts || []);
        setRecentDiet(diet || []);
        setSessions(allSessions || []);

        if (allSessions && allSessions.length > 0) {
          setCurrentSession(allSessions[0]);
          setSessionId(allSessions[0].id);
          setMessages(allSessions[0].messages.map(m => ({
            ...m,
            timestamp: new Date(m.timestamp)
          })));
        }
      } catch (e) {
        console.error('Load error:', e);
      }
    }
    loadUserData();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const saveCurrentSession = async (msgs: Message[]) => {
    if (!currentSession) return;

    const title = msgs.length > 0
      ? (msgs[0].content.slice(0, 30) + (msgs[0].content.length > 30 ? '...' : ''))
      : '新对话';

    const updatedSession: ChatSession = {
      ...currentSession,
      title,
      messages: msgs.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.getTime()
      })),
      updatedAt: Date.now()
    };

    await storage.saveChatSession(updatedSession);

    setCurrentSession(updatedSession);
    setSessions(prev => {
      const exists = prev.find(s => s.id === updatedSession.id);
      if (exists) {
        return prev.map(s => s.id === updatedSession.id ? updatedSession : s);
      }
      return [updatedSession, ...prev];
    });
  };

  const handleAgentResponse = async (agentResponse: AgentResponse) => {
    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: agentResponse.content,
      timestamp: new Date()
    };

    const newMessages = [...messages, assistantMessage];
    setMessages(newMessages);
    await saveCurrentSession(newMessages);

    if (agentResponse.generatedPlan) {
      try {
        await storage.savePlan(agentResponse.generatedPlan);
        setTrainingPlan(agentResponse.generatedPlan);

        const planMessage: Message = {
          id: (Date.now() + 2).toString(),
          role: 'assistant',
          content: '✅ 已将新训练计划保存到您的计划中！',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, planMessage]);
      } catch (e) {
        console.error('Failed to save plan:', e);
      }
    }

    if (agentResponse.suggestions && agentResponse.suggestions.length > 0) {
      const suggestionText = `\n\n💡 ${agentResponse.suggestions.join('\n💡 ')}`;
      const suggestionMessage: Message = {
        id: (Date.now() + 3).toString(),
        role: 'assistant',
        content: suggestionText,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, suggestionMessage]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const trimmedInput = input.trim();

    if (trimmedInput === '/new') {
      handleNewSession();
      return;
    }

    if (!currentSession) {
      const newSession = createEmptySession();
      setCurrentSession(newSession);
      setSessionId(newSession.id);
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date()
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    await saveCurrentSession(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage.content,
          sessionId,
          userProfile: profile,
          trainingPlan,
          recentWorkouts,
          recentDiet
        })
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const agentResponse: AgentResponse = await response.json();

      if (agentResponse.error) {
        throw new Error(agentResponse.error);
      }

      await handleAgentResponse(agentResponse);
    } catch (e) {
      console.error('Chat error:', e);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，我遇到了一些问题，请稍后再试。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleNewSession = async () => {
    if (messages.length > 0 && currentSession) {
      await saveCurrentSession(messages);
    }

    const newSession = createEmptySession();
    setCurrentSession(newSession);
    setSessionId(newSession.id);
    setMessages([]);
    setInput('');
  };

  const handleSelectSession = async (session: ChatSession) => {
    if (messages.length > 0 && currentSession) {
      await saveCurrentSession(messages);
    }

    setCurrentSession(session);
    setSessionId(session.id);
    setMessages(session.messages.map(m => ({
      ...m,
      timestamp: new Date(m.timestamp)
    })));
    setShowSessionList(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    await storage.deleteChatSession(sessionId);
    setSessions(prev => prev.filter(s => s.id !== sessionId));

    if (currentSession?.id === sessionId) {
      const remaining = sessions.filter(s => s.id !== sessionId);
      if (remaining.length > 0) {
        handleSelectSession(remaining[0]);
      } else {
        const newSession = createEmptySession();
        setCurrentSession(newSession);
        setSessionId(newSession.id);
        setMessages([]);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    '如何快速减掉腹部脂肪？',
    '增肌应该吃什么？',
    '每天训练多久效果最好？',
    '俯卧撑怎么做才标准？'
  ];

  return (
    <div className="min-h-screen pb-20 flex flex-col">
      <header className="px-4 py-4 border-b border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <div>
              <h1 className="font-semibold">AI 教练</h1>
              <p className="text-xs text-gray-500">在线</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSessionList(!showSessionList)}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              title="历史对话"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button
              onClick={handleNewSession}
              className="px-3 py-1.5 rounded-full bg-black text-white text-sm flex items-center gap-1 hover:bg-gray-800 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              新对话
            </button>
          </div>
        </div>
      </header>

      {showSessionList && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30" onClick={() => setShowSessionList(false)} />
          <div className="relative w-80 h-full bg-white shadow-xl overflow-y-auto">
            <div className="sticky top-0 bg-white px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold">历史对话</h2>
              <button
                onClick={() => setShowSessionList(false)}
                className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="py-2">
              {sessions.length === 0 ? (
                <p className="px-4 py-8 text-center text-gray-500 text-sm">暂无历史对话</p>
              ) : (
                sessions.map(session => (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session)}
                    className={`px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 group ${
                      currentSession?.id === session.id ? 'bg-gray-50' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{session.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {new Date(session.updatedAt).toLocaleDateString('zh-CN', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        className="w-6 h-6 rounded hover:bg-gray-200 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">{session.messages.length} 条消息</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium mb-2">你好，我是 FitCoach</h2>
            <p className="text-gray-500 text-sm mb-6">可以问我任何关于健身、营养、训练计划的问题</p>

            <div className="w-full space-y-2">
              {suggestedQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(q);
                    inputRef.current?.focus();
                  }}
                  className="w-full text-left px-4 py-3 bg-gray-50 rounded-lg text-sm text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                    msg.role === 'user'
                      ? 'bg-black text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-md">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      <div className="border-t border-gray-100 bg-white">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex gap-3 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的问题..."
              rows={1}
              className="flex-1 px-4 py-3 bg-gray-100 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-black/10"
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${
                input.trim() && !loading
                  ? 'bg-black text-white'
                  : 'bg-gray-100 text-gray-400'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>计划</span>
          </Link>
          <Link href="/chat" className="nav-item active">
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
