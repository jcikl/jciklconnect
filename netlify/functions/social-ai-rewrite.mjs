export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, body: JSON.stringify({ error: 'OpenAI API key not configured' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { content, platform = 'Facebook', tone = 'professional and engaging' } = body;
  if (!content) {
    return { statusCode: 400, body: JSON.stringify({ error: 'content is required' }) };
  }

  const systemPrompt = `You are a social media copywriter for JCI Kuala Lumpur, a leadership development organization for young active citizens aged 18–40. Your writing style is ${tone}. You write posts optimized for ${platform}. Always include 3–5 relevant hashtags at the end. Keep posts concise, impactful, and action-oriented. Write in English unless the original content is in another language.`;

  const userPrompt = `Rewrite the following content as an engaging ${platform} post for JCI Kuala Lumpur:\n\n${content}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.75,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { statusCode: 502, body: JSON.stringify({ error: err.error?.message ?? 'OpenAI request failed' }) };
    }

    const data = await res.json();
    const rewritten = data.choices?.[0]?.message?.content?.trim() ?? '';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rewritten }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};
