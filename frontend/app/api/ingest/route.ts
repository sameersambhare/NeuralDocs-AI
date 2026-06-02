import { NextRequest, NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export async function POST(request: NextRequest) {
  try {
    const BACKEND_URL = getBackendUrl();
    const formData = await request.formData();

    const response = await fetch(`${BACKEND_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || 'Failed to upload files' },
        { status: response.status },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Upload proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach backend upload endpoint' },
      { status: 500 },
    );
  }
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { error: text };
  }
}
