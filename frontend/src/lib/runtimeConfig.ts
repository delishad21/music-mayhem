type RuntimeConfig = {
  NEXT_PUBLIC_API_URL?: string;
  NEXTAUTH_URL?: string;
  NEXT_BACKEND_URL?: string;
};

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: RuntimeConfig;
  }
}

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window !== 'undefined' && window.__RUNTIME_CONFIG__) {
    return window.__RUNTIME_CONFIG__;
  }

  return {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXT_BACKEND_URL: process.env.NEXT_BACKEND_URL,
  };
}
