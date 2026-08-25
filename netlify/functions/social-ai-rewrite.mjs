import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const PLATFORM_BRIEFS = {
  Facebook: 'Facebook role: Community + Distribution. Optimize for comments, shares, community pride, and clear participation. Use short paragraphs, warm professional language, and a natural CTA.',
  Instagram: 'Instagram role: Visual + Emotion. Let the visual carry the basic facts; the caption should add a sharp first-line hook, human emotion, and a lightweight CTA. Use mobile-friendly line breaks and 5-8 precise hashtags.',
  LinkedIn: 'LinkedIn role: Professional + Credibility. Turn the source into a leadership, professional development, stakeholder value, or impact story. Include a thoughtful takeaway and avoid hype.',
  'Little Red Book': 'Xiaohongshu role: Discovery + Search + Relatability. Write like an authentic experience note, not an official announcement. Include searchable title/caption thinking, practical keywords, and a relatable angle. Chinese or bilingual output is welcome when appropriate.',
};

const CONTENT_TYPE_BRIEFS = {
  recognition: 'Content type: Recognition / achievement. Structure: achievement hook -> who -> what happened -> why it matters -> community or leadership meaning -> congratulations CTA. Do not turn it into a press release or overuse proud/honoured/delighted.',
  member_story: 'Content type: People / Member Story. Structure: story hook -> before/challenge -> turning point -> transformation -> today -> reflective CTA. Focus on the person, not a resume. Never invent quotes.',
  event_highlight: 'Content type: Event Highlight / recap. Structure: moment or outcome hook -> experience -> people -> best moments -> outcome -> community feeling -> CTA. Do not begin with "On [date], JCI Kuala Lumpur organised...".',
  announcement_teaser: 'Content type: Announcement / teaser. Structure: pattern interrupt -> hint -> why the audience should care -> open loop -> reveal timing. Build curiosity without fake clickbait or revealing everything at once.',
  educational_value: 'Content type: Educational / value. Structure: problem hook -> common mistake -> insight -> 3-5 practical points -> takeaway. Make each point useful enough to save or share.',
  impact_community: 'Content type: Impact / community / CSR / SDG. Structure: human problem -> action -> human change -> numbers/results -> bigger purpose. Start with people or the problem, not the organisation. Use only provided data.',
  promotion_recruitment: 'Content type: Promotion / recruitment / registration. Structure: audience pain point -> benefit -> proof -> details -> urgency -> one CTA. Make it clear who should join and what to do next.',
  corporate_organisational: 'Content type: Corporate / organisational / partnership / visit / MOU. Structure: opportunity -> partnership/context -> what happened -> concrete meaning/outcome -> stakeholder value -> next step. Avoid empty words like fruitful, meaningful, honoured, and privileged.',
};

const MASTER_INSTRUCTIONS = `Important principles:
1. Do not write copy just to make JCI Kuala Lumpur look impressive; make the target audience feel the content is relevant to them.
2. Do not invent people, numbers, quotes, awards, partnership outcomes, event outcomes, or any missing facts.
3. If the source material is insufficient, state the missing key information before drafting.
4. Do not simply copy one platform's caption into another platform.
5. Reorganize the hook, length, CTA, and content order according to the selected platform.
6. Use only one primary objective for the post.
7. Prioritize concrete facts, people, numbers, and results over generic adjectives.
8. The hook must give a real reason to continue reading, not just clickbait.`;

const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';
const FALLBACK_GROQ_MODEL = 'qwen/qwen3.6-27b';
const ALLOWED_ROLES = ['BOARD', 'ADMIN', 'SUPER_ADMIN'];

async function requireBoardCaller(req) {
  const authHeader = req.headers.get('authorization') ?? '';
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  try {
    const decoded = await getAuth().verifyIdToken(authHeader.split('Bearer ')[1]);
    const callerDoc = await getFirestore().collection('members').doc(decoded.uid).get();
    const role = callerDoc.data()?.role;
    if (!ALLOWED_ROLES.includes(role)) {
      return { error: Response.json({ error: 'Forbidden' }, { status: 403 }) };
    }
    return { uid: decoded.uid, role };
  } catch {
    return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
}

async function requestGroqCompletion({ apiKey, model, systemPrompt, userPrompt }) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 900,
      temperature: 0.75,
    }),
  });

  const data = await res.json().catch(() => ({}));
  return { res, data };
}

export default async (req, context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const caller = await requireBoardCaller(req);
  if (caller.error) return caller.error;

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

  const { content, platform = 'Facebook', tone = 'professional and engaging', contentType = 'event_highlight' } = body;
  if (!content) {
    return Response.json({ error: 'content is required' }, { status: 400 });
  }
  if (typeof content !== 'string' || content.length > 8000) {
    return Response.json({ error: 'content must be a string up to 8000 characters' }, { status: 400 });
  }

  const platformBrief = PLATFORM_BRIEFS[platform] ?? PLATFORM_BRIEFS.Facebook;
  const contentTypeBrief = CONTENT_TYPE_BRIEFS[contentType] ?? CONTENT_TYPE_BRIEFS.event_highlight;
  const basePrompt = 'You are a social media copywriter for JCI Kuala Lumpur, a leadership development organization for young active citizens aged 18-40.';

  const systemPrompt = `${basePrompt}

Tone: ${tone}.
Platform: ${platform}.
${platformBrief}
${contentTypeBrief}

${MASTER_INSTRUCTIONS}

Output requirements:
- Produce a ready-to-publish caption for the selected platform and content type.
- Include 3 alternative hooks.
- Include the most natural CTA.
- Include relevant hashtags or searchable keywords appropriate to the platform.
- Keep the language consistent with the source material unless a language is specified in the source.`;

  const userPrompt = `Rewrite the following content as an engaging ${platform} post for JCI Kuala Lumpur.

Selected content type: ${contentType}

Source material:
${content}`;

  try {
    const primaryModel = process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL;
    let { res, data } = await requestGroqCompletion({ apiKey, model: primaryModel, systemPrompt, userPrompt });

    if (!res.ok && primaryModel !== FALLBACK_GROQ_MODEL) {
      const primaryError = data.error?.message ?? 'Groq request failed';
      console.warn(`Groq request failed for ${primaryModel}; retrying ${FALLBACK_GROQ_MODEL}: ${primaryError}`);
      ({ res, data } = await requestGroqCompletion({ apiKey, model: FALLBACK_GROQ_MODEL, systemPrompt, userPrompt }));
      if (!res.ok) {
        return Response.json({
          error: data.error?.message ?? 'Groq request failed',
          provider: 'groq',
          model: FALLBACK_GROQ_MODEL,
          fallbackFrom: primaryModel,
        }, { status: 502 });
      }
    } else if (!res.ok) {
      return Response.json({
        error: data.error?.message ?? 'Groq request failed',
        provider: 'groq',
        model: primaryModel,
      }, { status: 502 });
    }

    const rewritten = data.choices?.[0]?.message?.content?.trim() ?? '';

    return Response.json({ rewritten });
  } catch (err) {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
};
