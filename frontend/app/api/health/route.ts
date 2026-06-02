import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export async function GET() {
  try {
    const backendUrl = getBackendUrl();
    const response = await fetch(`${backendUrl}/health`, {
      cache: 'no-store',
    });

    const data = await response.json().catch(() => ({}));
    return NextResponse.json(
      {
        backendUrl,
        backendReachable: response.ok,
        backendStatus: response.status,
        backendResponse: data,
      },
      { status: response.ok ? 200 : response.status },
    );
  } catch (error) {
    return NextResponse.json(
      {
        backendReachable: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
