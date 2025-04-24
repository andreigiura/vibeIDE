import type { LoaderFunction, LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

/*
 * import type { AppContext } from '~/types/appContext'; // Commented out problematic import
 * import { getDiagnostics } from '~/lib/system/diagnostics';
 */
import { requireUserId } from '~/services/session.server';

/**
 * Diagnostic API for troubleshooting connection issues
 */

export const loader: LoaderFunction = async ({ request }: LoaderFunctionArgs) => {
  await requireUserId(request);

  /*
   * Ensure context is not used here or adjust logic
   * Example implementation without context:
   */
  const envVars = {
    NODE_ENV: process.env.NODE_ENV || 'unknown',

    // Check other env vars directly if needed
    hasGithubToken: Boolean(process.env.GITHUB_ACCESS_TOKEN),
    hasNetlifyToken: Boolean(process.env.NETLIFY_TOKEN),
  };

  const systemInfo = {
    platform: typeof process !== 'undefined' ? process.platform : 'unknown',
    arch: typeof process !== 'undefined' ? process.arch : 'unknown',
    nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
  };

  const diagnostics = {
    environment: envVars,
    system: systemInfo,

    // Add other diagnostic sections
  };

  return json(diagnostics); // Return the diagnostics object
};
