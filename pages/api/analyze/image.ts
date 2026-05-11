import type { NextApiRequest, NextApiResponse } from 'next';
import { createVisionMessage, AI_MODEL } from '@/lib/anthropic';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { image, prompt } = req.body;

  if (!image) {
    return res.status(400).json({ error: 'image is required' });
  }

  try {
    console.log('Image analysis request - image data length:', image.length, 'prompt length:', prompt.length);

    const result = await createVisionMessage({
      model: AI_MODEL,
      maxTokens: 4096,
      imageBase64: image,
      prompt
    });

    console.log('Image analysis response - result length:', result.length, 'first 200 chars:', result.substring(0, 200));

    if (!result) {
      console.error('Empty response from API');
    }

    return res.status(200).json({ result });
  } catch (error: any) {
    console.error('Image analysis error:', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
}
