import { useFetcher } from '@remix-run/react';
import { useEffect, useState } from 'react';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface S3DeploymentLinkProps {
  chatId: string | null;
}

interface S3CheckResponse {
  deployed: boolean;
  url?: string;
  error?: string;
}

export function S3DeploymentLink({ chatId }: S3DeploymentLinkProps) {
  const fetcher = useFetcher<S3CheckResponse>();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (chatId) {
      /*
       * Reset visibility when chatId changes, to re-trigger potential loading states if desired
       * or simply to ensure we fetch for the new chat ID.
       */
      setIsVisible(false);
      fetcher.load(`/api/s3-check-deployment?chatId=${chatId}`);
    }
  }, [chatId, fetcher.load]);

  useEffect(() => {
    if (fetcher.data?.deployed && fetcher.data.url) {
      setIsVisible(true);
    } else {
      setIsVisible(false); // Ensure it's hidden if not deployed or no URL
    }

    // Do not add fetcher.data to dependencies to avoid loop if data object reference changes but content is same
  }, [fetcher.state, fetcher.data?.deployed, fetcher.data?.url]);

  if (!chatId || fetcher.state === 'loading' || !isVisible || !fetcher.data?.url) {
    /*
     * Render nothing if no chatId, loading, not deployed, or no URL
     * A subtle loading indicator could be added here if desired.
     */
    return null;
  }

  return (
    <a
      href={fetcher.data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 rounded-md hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 whitespace-nowrap"
      title="View S3 Deployment"
    >
      <ArrowTopRightOnSquareIcon className="w-4 h-4 mr-2" />
    </a>
  );
}
