import type { NextApiRequest, NextApiResponse } from 'next';
import { createMultiVisionMessage, AI_MODEL } from '@/lib/anthropic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { images, prompt } = req.body;

  if (!images || !Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images array is required' });
  }

  try {
    console.log('Body fat analysis request - images count:', images.length, 'prompt length:', prompt.length);

    const result = await createMultiVisionMessage({
      model: AI_MODEL,
      maxTokens: 4096,
      imagesBase64: images,
      prompt
    });

    console.log('Body fat analysis response - result length:', result.length, 'first 200 chars:', result.substring(0, 200));

    if (!result) {
      console.error('Empty response from API');
    }

    return res.status(200).json({ result });
  } catch (error: any) {
    console.error('Body fat analysis error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
