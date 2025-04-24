import type { LoaderFunction, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { requireUserId } from '~/services/session.server';
import { LLMManager } from '~/lib/modules/llm/manager';
import { getApiKeysFromCookie } from '~/lib/api/cookies';

// Define context type locally if needed, or remove if unused
interface AppContext {
  env?: {
    [key: string]: string | undefined;
  };
}

export const loader: LoaderFunction = async ({ context, request }: LoaderFunctionArgs & { context?: AppContext }) => {
  await requireUserId(request);

  // Get API keys from cookie
  const cookieHeader = request.headers.get('Cookie');
  const apiKeysFromCookie = getApiKeysFromCookie(cookieHeader);

  // Initialize the LLM manager to access environment variables
  const llmManager = LLMManager.getInstance(context?.cloudflare?.env as any);

  // Get all provider instances to find their API token keys
  const providers = llmManager.getAllProviders();

  // Create a comprehensive API keys object
  const apiKeys: Record<string, string> = { ...apiKeysFromCookie };

  // For each provider, check all possible sources for API keys
  for (const provider of providers) {
    if (!provider.config.apiTokenKey) {
      continue;
    }

    const envVarName = provider.config.apiTokenKey;

    // Skip if we already have this provider's key from cookies
    if (apiKeys[provider.name]) {
      continue;
    }

    // Check environment variables in order of precedence
    const envValue =
      (context?.cloudflare?.env as Record<string, any>)?.[envVarName] ||
      process.env[envVarName] ||
      llmManager.env[envVarName];

    if (envValue) {
      apiKeys[provider.name] = envValue;
    }
  }

  return Response.json(apiKeys);
};
