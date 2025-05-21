import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { requireUserId } from '~/services/session.server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  try {
    // Authenticate the request
    await requireUserId(request);

    // Get environment variables from various sources
    const cloudflareEnv = (context?.cloudflare?.env || {}) as unknown as Record<string, string>;

    // Extract S3-related environment variables
    const s3Vars = {
      // From Cloudflare context
      context: {
        S3_BUCKET_NAME: cloudflareEnv.S3_BUCKET_NAME || null,
        S3_REGION: cloudflareEnv.S3_REGION || null,
        S3_ACCESS_KEY_ID: cloudflareEnv.S3_ACCESS_KEY_ID ? 'PRESENT' : null,
        S3_SECRET_ACCESS_KEY: cloudflareEnv.S3_SECRET_ACCESS_KEY ? 'PRESENT' : null,
      },

      // From process.env
      processEnv: {
        S3_BUCKET_NAME: process.env.S3_BUCKET_NAME || null,
        S3_REGION: process.env.S3_REGION || null,
        S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID ? 'PRESENT' : null,
        S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY ? 'PRESENT' : null,
      },
    };

    // Get a list of all available environment variables (keys only)
    const availableProcessEnvKeys = Object.keys(process.env);
    const availableContextEnvKeys = context?.cloudflare?.env ? Object.keys(context.cloudflare.env) : [];

    return json({
      success: true,
      s3Vars,
      environment: {
        processEnvKeys: availableProcessEnvKeys,
        contextEnvKeys: availableContextEnvKeys,
      },
    });
  } catch (error) {
    console.error('Error in environment test endpoint:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    );
  }
}
