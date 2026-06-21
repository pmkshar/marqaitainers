import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ChatRequestBody {
  messages: { role: 'user' | 'assistant' | 'system'; content: string }[];
  courseContext?: string;
}

const SYSTEM_PROMPT = `You are TutorAI, an expert software engineering instructor on a personalized learning platform.
You help students learn software development topics including: AI & Machine Learning, Full Stack Java, .NET, Mobile App Development (React Native), and Flutter.

Your teaching style:
- Be concise but thorough. Lead with the direct answer, then explain the "why".
- Use short code snippets (5-20 lines) with language tags when helpful.
- Prefer plain language; define jargon on first use.
- When a learner is confused, ask one clarifying question instead of dumping more information.
- Encourage best practices: testing, security, accessibility, and clean code.
- If a learner asks for the answer to a quiz, gently redirect them to reason through it themselves.
- Stay on the topic of software engineering and learning. Politely decline off-topic requests.

Keep responses focused. Use Markdown formatting (headings, lists, code blocks, bold) for readability.`;

interface ZAIConfig {
  baseUrl: string;
  apiKey: string;
  chatId?: string;
  userId?: string;
  token?: string;
}

/**
 * Resolve ZAI credentials from (in priority order):
 *   1. Explicit env vars: ZAI_BASE_URL + ZAI_API_KEY (recommended for Vercel)
 *   2. ZAI_API_KEY only (uses default public base URL)
 *   3. JSON file at one of the SDK search paths (local dev with .z-ai-config)
 *
 * Returns null if no configuration is found.
 */
async function resolveZAIConfig(): Promise<ZAIConfig | null> {
  // 1) Env vars (Vercel / production)
  const envKey = process.env.ZAI_API_KEY;
  const envBase = process.env.ZAI_BASE_URL;
  if (envKey && envBase) {
    return { baseUrl: envBase, apiKey: envKey };
  }
  if (envKey) {
    // Default public ZAI OpenAI-compatible endpoint
    return { baseUrl: 'https://api.z.ai/api/paas/v4', apiKey: envKey };
  }

  // 2) Fall back to .z-ai-config JSON file (local dev / sandbox)
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const os = await import('os');
    const candidates = [
      path.join(process.cwd(), '.z-ai-config'),
      path.join(os.default.homedir(), '.z-ai-config'),
      '/etc/.z-ai-config',
    ];
    for (const p of candidates) {
      try {
        const raw = await fs.default.readFile(p, 'utf-8');
        const cfg = JSON.parse(raw);
        if (cfg.baseUrl && cfg.apiKey) return cfg as ZAIConfig;
      } catch {
        // skip missing / invalid file
      }
    }
  } catch {
    // fs unavailable — fall through
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ChatRequestBody;
    const messages = body.messages ?? [];

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'No messages provided.' }, { status: 400 });
    }

    const config = await resolveZAIConfig();
    if (!config) {
      return NextResponse.json(
        {
          error: 'AI tutor is not configured.',
          detail:
            'Set ZAI_API_KEY (and optionally ZAI_BASE_URL) environment variables in Vercel, ' +
            'or create a .z-ai-config file. After setting env vars, redeploy the project.',
        },
        { status: 500 }
      );
    }

    const contextualSystem = body.courseContext
      ? `${SYSTEM_PROMPT}\n\nThe learner is currently studying: ${body.courseContext}. Tailor examples to this course when relevant.`
      : SYSTEM_PROMPT;

    const fullMessages = [
      { role: 'system' as const, content: contextualSystem },
      ...messages.map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content })),
    ];

    // Call the ZAI OpenAI-compatible chat completions endpoint directly.
    const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
      'X-Z-AI-From': 'Z',
    };
    if (config.chatId) headers['X-Chat-Id'] = config.chatId;
    if (config.userId) headers['X-User-Id'] = config.userId;
    if (config.token) headers['X-Token'] = config.token;

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        messages: fullMessages,
        temperature: 0.5,
        max_tokens: 1200,
        thinking: { type: 'disabled' },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('ZAI API error:', response.status, errorText);
      return NextResponse.json(
        {
          error: 'The AI tutor returned an error. Please try again in a moment.',
          detail: `Upstream status ${response.status}: ${errorText.slice(0, 500)}`,
        },
        { status: 502 }
      );
    }

    const data = await response.json();
    const content =
      data?.choices?.[0]?.message?.content ?? 'Sorry, I could not generate a response.';

    return NextResponse.json({
      role: 'assistant',
      content,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Tutor API error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'The AI tutor is unavailable right now. Please try again in a moment.',
        detail: message,
      },
      { status: 500 }
    );
  }
}
