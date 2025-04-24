import { createCookieSessionStorage, redirect } from '@remix-run/cloudflare';

/*
 * Ensure you have SESSION_SECRET environment variable set
 * IN A REAL APP, THIS SHOULD BE A STRONG, RANDOM SECRET!
 * You can generate one using: openssl rand -base64 32
 * DO NOT HARDCODE a weak secret like this in production.
 */
const sessionSecret = process.env.SESSION_SECRET || 'DEFAULT_WEAK_SECRET_CHANGE_ME';

if (sessionSecret === 'DEFAULT_WEAK_SECRET_CHANGE_ME') {
  console.warn(
    '⚠️ WARNING: SESSION_SECRET is set to a default weak value. ' +
      'Please set a strong secret in your environment variables for production!',
  );
}

/*
 * TODO: Configure cookie options appropriately for production
 * secure: process.env.NODE_ENV === "production", // Send only over HTTPS
 * sameSite: "lax", // Protect against CSRF
 * path: "/",
 * httpOnly: true, // Prevent client-side JS access
 * secrets: [sessionSecret],
 * maxAge: 60 * 60 * 24 * 30, // 30 days
 */
export const { getSession, commitSession, destroySession } = createCookieSessionStorage({
  cookie: {
    name: '__session',
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 1 week expiry for example
    path: '/',
    sameSite: 'none',
    secrets: [sessionSecret],
    secure: true,
  },
});

const USER_SESSION_KEY = 'userId';

export async function getUserId(request: Request): Promise<string | undefined> {
  const session = await getSession(request.headers.get('Cookie'));
  const userId = session.get(USER_SESSION_KEY);

  return userId ? String(userId) : undefined; // Ensure it's a string or undefined
}

export async function requireUserId(request: Request): Promise<string> {
  const userId = await getUserId(request);

  if (!userId) {
    /*
     * Implement proper redirect or error handling if needed.
     * For API routes, throwing a 401 might be more appropriate than redirecting.
     * const searchParams = new URLSearchParams([["redirectTo", redirectTo]]);
     * throw redirect(`/login?${searchParams}`);
     */
    console.error('requireUserId: No user ID found in session.');
    throw new Response('Unauthorized', { status: 401 }); // Throw 401 for API routes
  }

  return userId;
}

// Helper to create session headers
export async function createUserSessionHeaders({
  request,
  userId,
  remember,
}: {
  request: Request;
  userId: string;
  remember?: boolean;
}) {
  const session = await getSession(request.headers.get('Cookie'));
  session.set(USER_SESSION_KEY, userId);

  // Return headers needed to set the cookie
  return {
    'Set-Cookie': await commitSession(session, {
      maxAge: remember
        ? 60 * 60 * 24 * 7 // 7 days
        : undefined,
    }),
  };
}

export async function logout(request: Request) {
  const session = await getSession(request.headers.get('Cookie'));
  return redirect('/', {
    // Redirect to homepage after logout
    headers: {
      'Set-Cookie': await destroySession(session),
    },
  });
}
