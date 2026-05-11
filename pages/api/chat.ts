import type { NextApiRequest, NextApiResponse } from 'next';
import { createMessage, AI_MODEL } from '@/lib/anthropic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt, maxTokens = 4096, system } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  try {
    const result = await createMessage({
      model: AI_MODEL,
      maxTokens,
      system,
      messages: [{ role: 'user', content: prompt }]
    });

    return res.status(200).json({ result });
  } catch (error: any) {
    console.error('Generate text error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
