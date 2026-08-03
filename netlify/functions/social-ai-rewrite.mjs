export default async (req, context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'Groq API key not configured' }, { status: 500 });
  }

  let body;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { content, platform = 'Facebook', tone = 'professional and engaging', customSystemPrompt } = body;
  if (!content) {
    return Response.json({ error: 'content is required' }, { status: 400 });
  }

  const systemPrompt = customSystemPrompt
    ? `${customSystemPrompt}\n\nTone: ${tone}.`
    : `You are a social media copywriter for JCI Kuala Lumpur, a leadership development organization for young active citizens aged 18–40. Your writing style is ${tone}. You write posts optimized for ${platform}. Always include 3–5 relevant hashtags at the end. Keep posts concise, impactful, and action-oriented. Write in English unless the original content is in another language.`;

  const userPrompt = `Rewrite the following content as an engaging ${platform} post for JCI Kuala Lumpur:\n\n${content}`;

  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
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
      return Response.json({ error: err.error?.message ?? 'Groq request failed' }, { status: 502 });
    }

    const data = await res.json();
    const rewritten = data.choices?.[0]?.message?.content?.trim() ?? '';

    return Response.json({ rewritten });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
