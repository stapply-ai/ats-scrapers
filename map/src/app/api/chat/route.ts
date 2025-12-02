import { NextRequest, NextResponse } from 'next/server';

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';
const MODEL = 'mistral-large-latest';

export async function POST(request: NextRequest) {
  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!mistralApiKey) {
    return NextResponse.json(
      { error: 'Mistral API key not configured on server' },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { messages, tools, tool_choice } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid request: messages array is required' },
        { status: 400 }
      );
    }

    const payload: any = {
      model: MODEL,
      messages: messages,
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
      payload.tool_choice = tool_choice || 'auto';
    }

    const mistralResponse = await fetch(MISTRAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${mistralApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!mistralResponse.ok) {
      const errorText = await mistralResponse.text();
      console.error('Mistral API error:', mistralResponse.status, errorText);
      return NextResponse.json(
        {
          error: `Mistral API error: ${mistralResponse.status}`,
          details: errorText
        },
        { status: mistralResponse.status }
      );
    }

    const data = await mistralResponse.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error proxying Mistral API:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
