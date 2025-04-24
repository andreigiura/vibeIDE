import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData, useNavigate } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island';
import { useEffect } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';
import { toast } from 'react-toastify';
import { authStore, setAuthState } from './lib/stores/auth';
import { AuthRequired } from './components/auth/AuthRequired';
import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { getUserId } from './services/session.server';
import { useChatHistory, db } from './lib/persistence';
import { importChatFromRemixId } from './lib/persistence/chats';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

interface UserProfile {
  user: string;
}

interface AuthResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: UserProfile;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const userId = await getUserId(request);
  return json({ userId });
};

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);
  const { isAuthenticated, isLoading, error, initialCheckComplete } = useStore(authStore);
  const { userId: loaderUserId } = useLoaderData<typeof loader>();
  const { ready: chatHistoryReady } = useChatHistory();
  const navigate = useNavigate();

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (loaderUserId && !new URLSearchParams(window.location.search).get('accessToken')) {
      console.log('User session found via loader, skipping URL token check.');
      setAuthState({
        isAuthenticated: true,
        user: { user: loaderUserId },
        isLoading: false,
        initialCheckComplete: true,
        error: null,
      });

      return;
    }

    if (typeof window === 'undefined' || initialCheckComplete || isLoading) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const tokenFromUrl = urlParams.get('accessToken');

    setAuthState({ isLoading: true, error: null });

    if (tokenFromUrl) {
      console.log('accessToken found, attempting validation...');

      const validateToken = async () => {
        try {
          const response = await fetch(`/api/auth?accessToken=${encodeURIComponent(tokenFromUrl)}`, {
            method: 'GET',
            headers: { Accept: 'application/json' },
          });
          const data = (await response.json()) as AuthResponse;

          if (response.ok && data.success && data.user) {
            setAuthState({
              isAuthenticated: true,
              isLoading: false,
              initialCheckComplete: true,
              user: data.user,
            });
            toast.success(data.message || 'Authentication successful!');

            const currentUrlParams = new URLSearchParams(window.location.search);
            const remixId = currentUrlParams.get('remixId');

            if (remixId && chatHistoryReady && db) {
              console.log(`remixId (${remixId}) found, attempting to import chat...`);

              try {
                const urlId = await importChatFromRemixId(db, remixId);

                if (urlId) {
                  toast.success(`Chat imported successfully`);
                  navigate(`/chat/${urlId}`, { replace: true });
                  currentUrlParams.delete('remixId');

                  const newUrl = `${window.location.pathname}?${currentUrlParams.toString()}`;
                  window.history.replaceState({}, document.title, newUrl);
                } else {
                  toast.error('Failed to import chat from remixId.');
                }
              } catch (importError) {
                console.error('Error importing chat from remixId:', importError);
                toast.error(
                  `Error importing chat: ${importError instanceof Error ? importError.message : 'Unknown error'}`,
                );
              }
            } else {
              if (window.history && typeof window.history.replaceState === 'function') {
                window.history.replaceState({}, document.title, window.location.pathname);
              }
            }
          } else {
            const errorMessage =
              data.error ||
              (!data.user && data.success ? 'User data missing in response' : response.statusText) ||
              'Authentication failed.';
            setAuthState({
              isAuthenticated: false,
              isLoading: false,
              error: errorMessage,
              initialCheckComplete: true,
              user: null,
            });
            toast.error(errorMessage);
          }
        } catch (fetchError) {
          const errorMessage = fetchError instanceof Error ? fetchError.message : 'An unexpected error occurred.';
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            error: errorMessage,
            initialCheckComplete: true,
            user: null,
          });
          toast.error(`Authentication error: ${errorMessage}`);
          console.error('Authentication error:', fetchError);
        } finally {
          if (authStore.get().isLoading) {
            setAuthState({ isLoading: false });
          }
        }
      };
      validateToken();
    } else {
      console.log('No session or URL token found.');
      setAuthState({
        isAuthenticated: false,
        isLoading: false,
        error: null,
        initialCheckComplete: true,
        user: null,
      });
    }
  }, [initialCheckComplete, isLoading, loaderUserId, chatHistoryReady, navigate]);

  let content: React.ReactNode;

  if (!initialCheckComplete && isLoading) {
    content = (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <p className="text-lg text-gray-600 dark:text-gray-400">Checking authentication...</p>
        <div className="ml-3 i-ph:spinner-gap w-6 h-6 text-gray-500 animate-spin" />
      </div>
    );
  } else if (!isAuthenticated && initialCheckComplete) {
    content = <AuthRequired error={error} />;
  } else if (isAuthenticated) {
    content = children;
  } else {
    content = null;
  }

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{content}</DndProvider>}</ClientOnly>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const theme = useStore(themeStore);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });
  }, []);

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
