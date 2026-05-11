import type { NextApiRequest, NextApiResponse } from 'next';
import { FitCoachAgent, getOrCreateAgent } from '@/agents/core/agent';
import type { AgentResponse, UserProfile, TrainingPlan, WorkoutLog, DietLog } from '@/agents/core/types';

interface AgentChatRequest {
  message: string;
  sessionId?: string;
  userProfile?: UserProfile;
  trainingPlan?: TrainingPlan;
  recentWorkouts?: WorkoutLog[];
  recentDiet?: DietLog[];
}

interface AgentChatResponse {
  content: string;
  suggestions?: string[];
  actions?: {
    type: 'reminder' | 'plan_adjustment' | 'knowledge_card';
    data: unknown;
  }[];
  steps?: unknown[];
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AgentChatResponse>
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ content: '', error: 'Method not allowed' });
  }

  const {
    message,
    sessionId = 'default',
    userProfile,
    trainingPlan,
    recentWorkouts = [],
    recentDiet = []
  } = req.body as AgentChatRequest;

  if (!message) {
    return res.status(400).json({ content: '', error: 'message is required' });
  }

  try {
    const agent = getOrCreateAgent(sessionId);

    const contextOverrides = {
      userProfile,
      currentPlan: trainingPlan,
      recentWorkouts,
      recentDiet
    };

    const response = await agent.processWithContext(message, contextOverrides);

    const agentResponse: AgentChatResponse = {
      content: response.content,
      steps: response.steps
    };

    if (response.suggestions && response.suggestions.length > 0) {
      agentResponse.suggestions = response.suggestions;
    }

    if (response.shouldRemind && response.reminder) {
      agentResponse.actions = agentResponse.actions || [];
      agentResponse.actions.push({
        type: 'reminder',
        data: response.reminder
      });
    }

    if (response.planAdjustment) {
      agentResponse.actions = agentResponse.actions || [];
      agentResponse.actions.push({
        type: 'plan_adjustment',
        data: response.planAdjustment
      });
    }

    return res.status(200).json(agentResponse);
  } catch (error) {
    console.error('Agent chat error:', error);
    return res.status(500).json({
      content: '抱歉，我遇到了一些问题，请稍后再试。',
      error: error instanceof Error ? error.message : 'Internal server error'
    });
  }
}
