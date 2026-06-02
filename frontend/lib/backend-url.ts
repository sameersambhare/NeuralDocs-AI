const LOCAL_BACKEND_URL = 'http://127.0.0.1:8000';

export function getBackendUrl() {
  const configuredUrl =
    process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL;

  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, '');
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'BACKEND_URL is not configured. Set BACKEND_URL or NEXT_PUBLIC_BACKEND_URL in Vercel.',
    );
  }

  return LOCAL_BACKEND_URL;
}
