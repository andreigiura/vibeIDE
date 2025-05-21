import { useStore } from '@nanostores/react';
import useViewport from '~/lib/hooks';
import { chatStore } from '~/lib/stores/chat';
import { netlifyConnection } from '~/lib/stores/netlify';
import { workbenchStore } from '~/lib/stores/workbench';
import { classNames } from '~/utils/classNames';
import { useEffect, useRef, useState } from 'react';
import { streamingState } from '~/lib/stores/streaming';
import { NetlifyDeploymentLink } from '~/components/chat/NetlifyDeploymentLink.client';
import { useNetlifyDeploy } from '~/components/deploy/NetlifyDeploy.client';
import { useS3Deploy } from '~/components/deploy/S3Deploy.client';
import { chatId, useChatHistory, chatMetadata, description } from '~/lib/persistence/useChatHistory';
import { toast } from 'react-toastify';

interface HeaderActionButtonsProps {}

export function HeaderActionButtons({}: HeaderActionButtonsProps) {
  const showWorkbench = useStore(workbenchStore.showWorkbench);
  const { showChat } = useStore(chatStore);
  const netlifyConn = useStore(netlifyConnection);
  const [activePreviewIndex] = useState(0);
  const previews = useStore(workbenchStore.previews);
  const activePreview = previews[activePreviewIndex];
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployingTo, setDeployingTo] = useState<'netlify' | 'vercel' | 's3' | null>(null);
  const isSmallViewport = useViewport(1024);
  const canHideChat = showWorkbench || !showChat;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isStreaming = useStore(streamingState);
  const { handleNetlifyDeploy } = useNetlifyDeploy();
  const { handleS3Deploy } = useS3Deploy();
  const currentChatId = useStore(chatId);
  const metadata = useStore(chatMetadata);
  const chatDescription = useStore(description);
  const { prepareExportChat, getNetlifyUrl } = useChatHistory();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const onNetlifyDeploy = async () => {
    setIsDeploying(true);
    setDeployingTo('netlify');

    try {
      await handleNetlifyDeploy();
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const onS3Deploy = async () => {
    setIsDeploying(true);
    setDeployingTo('s3');

    try {
      await handleS3Deploy();
    } finally {
      setIsDeploying(false);
      setDeployingTo(null);
    }
  };

  const onVibechainPublish = async () => {
    const netlifyUrl = getNetlifyUrl();
    console.log('Current chat metadata:', metadata);

    const appName = metadata?.appName;
    const model = metadata?.model;
    const appDescription = chatDescription || 'No description available';

    console.log('Publishing info:', { netlifyUrl, appName, model, appDescription });

    if (!netlifyUrl) {
      toast.error('No Netlify deployment found');
      return;
    }

    if (!appName) {
      toast.error('Application name not found in metadata');
      return;
    }

    const chat = await prepareExportChat();

    if (!chat) {
      toast.error('No chat found');
      return;
    }

    try {
      window.parent.postMessage(
        {
          type: 'publish-vibechain',
          payload: {
            url: netlifyUrl,
            appName: appName || 'Unknown App',
            model: model || 'Unknown Model',
            description: appDescription,
            chat,
          },
        },
        '*',
      );
      toast.success('Publishing request sent');
    } catch (error) {
      console.error('Failed to send publish message:', error);
      toast.error('Failed to initiate publishing');
    }
  };

  const isNetlifyDeployed = netlifyConn.stats?.sites?.some((site) =>
    site.name.includes(`vibe-${currentChatId?.toLocaleLowerCase()}`),
  );
  console.log('deployed site is 2: ', isNetlifyDeployed, `vibe-${currentChatId}`);

  return (
    <div className="flex">
      <div className="relative" ref={dropdownRef}>
        <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden mr-2 text-sm">
          <Button
            active
            disabled={isDeploying || !activePreview || isStreaming}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="px-4 hover:bg-bolt-elements-item-backgroundActive flex items-center gap-2"
          >
            {isDeploying ? `Deploying to ${deployingTo}...` : 'Deploy'}
            <div
              className={classNames('i-ph:caret-down w-4 h-4 transition-transform', isDropdownOpen ? 'rotate-180' : '')}
            />
          </Button>
        </div>

        {isDropdownOpen && (
          <div className="absolute right-2 flex flex-col gap-1 z-50 p-1 mt-1 min-w-[13.5rem] bg-bolt-elements-background-depth-2 rounded-md shadow-lg bg-bolt-elements-backgroundDefault border border-bolt-elements-borderColor">
            <Button
              active
              onClick={() => {
                onNetlifyDeploy();
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying || !activePreview || !netlifyConn.user}
              className="flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative"
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/netlify"
              />
              <span className="mx-auto">
                {!netlifyConn.user ? 'No Netlify Account Connected' : 'Deploy to Netlify'}
              </span>
              {netlifyConn.user && <NetlifyDeploymentLink />}
            </Button>
            {/* S3 Deploy Button */}
            <Button
              active
              onClick={() => {
                onS3Deploy();
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying || !activePreview}
              className="flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative"
            >
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/amazons3"
              />
              <span className="mx-auto">Deploy to S3</span>
            </Button>
            {/* Vibechain Publish Button */}
            <Button
              active
              onClick={() => {
                onVibechainPublish();
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying || !activePreview || !netlifyConn.user || !isNetlifyDeployed}
              className="flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative"
            >
              {/* TODO: Add Vibechain icon if available */}
              <span className="mx-auto">Publish on Vibechain</span>
              {/* TODO: Potentially add a link/status indicator for Vibechain publish */}
            </Button>
            {/* <Button
              active
              onClick={() => {
                onVercelDeploy();
                setIsDropdownOpen(false);
              }}
              disabled={isDeploying || !activePreview || !vercelConn.user}
              className="flex items-center w-full px-4 py-2 text-sm text-bolt-elements-textPrimary hover:bg-bolt-elements-item-backgroundActive gap-2 rounded-md group relative"
            >
              <img
                className="w-5 h-5 bg-black p-1 rounded"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/vercel/white"
                alt="vercel"
              />
              <span className="mx-auto">{!vercelConn.user ? 'No Vercel Account Connected' : 'Deploy to Vercel'}</span>
              {vercelConn.user && <VercelDeploymentLink />}
            </Button>
            <Button
              active={false}
              disabled
              className="flex items-center w-full rounded-md px-4 py-2 text-sm text-bolt-elements-textTertiary gap-2"
            >
              <span className="sr-only">Coming Soon</span>
              <img
                className="w-5 h-5"
                height="24"
                width="24"
                crossOrigin="anonymous"
                src="https://cdn.simpleicons.org/cloudflare"
                alt="cloudflare"
              />
              <span className="mx-auto">Deploy to Cloudflare (Coming Soon)</span>
            </Button> */}
          </div>
        )}
      </div>
      <div className="flex border border-bolt-elements-borderColor rounded-md overflow-hidden">
        <Button
          active={showChat}
          disabled={!canHideChat || isSmallViewport} // expand button is disabled on mobile as it's not needed
          onClick={() => {
            if (canHideChat) {
              chatStore.setKey('showChat', !showChat);
            }
          }}
        >
          <div className="i-bolt:chat text-sm" />
        </Button>
        <div className="w-[1px] bg-bolt-elements-borderColor" />
        <Button
          active={showWorkbench}
          onClick={() => {
            if (showWorkbench && !showChat) {
              chatStore.setKey('showChat', true);
            }

            workbenchStore.showWorkbench.set(!showWorkbench);
          }}
        >
          <div className="i-ph:code-bold" />
        </Button>
      </div>
    </div>
  );
}

interface ButtonProps {
  active?: boolean;
  disabled?: boolean;
  children?: any;
  onClick?: VoidFunction;
  className?: string;
}

function Button({ active = false, disabled = false, children, onClick, className }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center p-1.5',
        {
          'bg-bolt-elements-item-backgroundDefault hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-textTertiary hover:text-bolt-elements-textPrimary':
            !active,
          'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': active && !disabled,
          'bg-bolt-elements-item-backgroundDefault text-alpha-gray-20 dark:text-alpha-white-20 cursor-not-allowed':
            disabled,
        },
        className,
      )}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
