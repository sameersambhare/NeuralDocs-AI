import { NextResponse } from 'next/server';
import { getBackendUrl } from '@/lib/backend-url';

export async function GET(
  _req: Request,
  { params }: { params: { workspaceId: string } },
) {
  try {
    const BACKEND_URL = getBackendUrl();
    const { workspaceId } = params;
    const response = await fetch(
      `${BACKEND_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/files`,
    );

    if (!response.ok) {
      const data = await readJsonResponse(response);
      return NextResponse.json(
        { error: data.detail || data.error || 'Failed to load workspace files' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Workspace files proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach backend workspace files endpoint' },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { workspaceId: string } },
) {
  try {
    const BACKEND_URL = getBackendUrl();
    const { workspaceId } = params;
    const url = new URL(req.url);
    const filename = url.searchParams.get('filename');

    if (!filename) {
      return NextResponse.json(
        { error: 'filename is required' },
        { status: 400 },
      );
    }

    const response = await fetch(
      `${BACKEND_URL}/api/workspaces/${encodeURIComponent(workspaceId)}/files?filename=${encodeURIComponent(filename)}`,
      {
        method: 'DELETE',
      },
    );

    if (!response.ok) {
      const data = await readJsonResponse(response);
      return NextResponse.json(
        { error: data.detail || data.error || 'Failed to delete workspace file' },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Workspace delete proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to reach backend workspace delete endpoint' },
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
