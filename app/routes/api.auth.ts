import { json, type LoaderFunctionArgs } from '@remix-run/cloudflare';
import { cors } from 'remix-utils/cors';

// Import session utilities
import { createUserSessionHeaders } from '~/services/session.server';

// Define the UserProfile type (can be shared with client)
interface UserProfile {
  user: string;
}

/*
 * Placeholder for your actual token validation logic
 * Replace this with your implementation
 */
async function validateOneTimeToken(token: string): Promise<boolean> {
  console.log('validateOneTimeToken', token);

  const { NativeAuthServer: nativeAuthServer } = await import('~/routes/nativeAuth/native.auth.server');
  const server = new nativeAuthServer({
    acceptedOrigins: ['*'],
    apiUrl: 'https://api.vibechain.ai',
    maxExpirySeconds: 86400,
  });

  return Boolean(await server.validate(token));
}

/*
 * Placeholder for your actual token decoding logic
 * Replace this with your implementation
 * It should take the validated token and return user information
 */
async function decodeToken(token: string): Promise<UserProfile | null> {
  const { NativeAuthServer: nativeAuthServer } = await import('~/routes/nativeAuth/native.auth.server');
  const server = new nativeAuthServer({
    acceptedOrigins: ['*'],
    apiUrl: 'https://api.vibechain.ai',
    maxExpirySeconds: 86400,
  });

  const decoded = server.decode(token);

  // Simulate decoding and fetching/constructing user data
  if (token) {
    // Return the specified mock user data
    return { user: decoded.address };
  }

  return null; // Return null if decoding fails
}

// Use loader for GET requests with URL parameters
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  const token = url.searchParams.get('accessToken');

  if (!token) {
    // Use CORS for error responses too
    return cors(request, json({ success: false, error: 'accessToken query parameter is required' }, { status: 400 }));
  }

  let sessionHeaders = {}; // Initialize empty headers object

  try {
    const isValid = await validateOneTimeToken(token);

    if (isValid) {
      // If valid, attempt to decode the token to get user data
      const userData = await decodeToken(token);

      if (userData) {
        // Create session headers upon successful validation and decoding
        sessionHeaders = await createUserSessionHeaders({ request, userId: userData.user });

        // Respond with success and include the user data
        const responseData = {
          success: true,
          message: 'Token validated successfully',
          user: userData, // Include user data here
        };

        // Use cors utility correctly with response options including headers
        return await cors(request, json(responseData, { headers: sessionHeaders }));
      } else {
        // Token was valid but decoding failed
        console.error('Token was validated but decoding failed.');
        return cors(
          request,
          json({ success: false, error: 'Failed to decode token after validation' }, { status: 500 }),
        );
      }
    } else {
      // Respond with failure (invalid token)
      return cors(request, json({ success: false, error: 'Invalid or expired token' }, { status: 401 }));
    }
  } catch (error) {
    console.error('Token validation/decoding error:', error);

    // Respond with server error
    return cors(
      request,
      json({ success: false, error: 'Internal Server Error during validation/decoding' }, { status: 500 }),
    );
  }
};

// Handle OPTIONS request for CORS preflight (keep this if loader uses CORS)
export const options = async ({ request }: LoaderFunctionArgs) => {
  return cors(request, json(null, { status: 204 }));
};

/*
 * Handle GET requests if needed, otherwise return 405
 * export const loader = async ({ request }: LoaderFunctionArgs) => {
 *   if (request.method !== 'OPTIONS') { // OPTIONS is handled by cors
 *     return json({ error: 'Method Not Allowed' }, { status: 405 });
 *   }
 *   return json({}); // Required for OPTIONS
 * };
 */
