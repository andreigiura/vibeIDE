import React from 'react';

interface AuthRequiredProps {
  error: string | null; // Error message from authStore
}

export function AuthRequired({ error }: AuthRequiredProps) {
  let title = 'Authentication Required';
  let message = 'You need to be authenticated to access this application.';
  let details =
    'Please ensure you have accessed the application using a valid accessToken in the URL (e.g., ?accessToken=YOUR_TOKEN).';

  if (error) {
    if (error.toLowerCase().includes('missing')) {
      title = 'Access Token Missing';
      message = 'The required accessToken parameter was not found in the URL.';
      details = 'Please check the URL you used to access the application.';
    } else if (error.toLowerCase().includes('invalid or expired')) {
      title = 'Invalid or Expired Token';
      message = 'The provided access token is invalid or has expired.';
      details = 'Please obtain a new, valid access token and try again.';
    } else {
      // General error
      title = 'Authentication Failed';
      message = 'An error occurred during the authentication process.';
      details = `Error details: ${error}`;
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 text-center">
        <div className="mx-auto mb-6 w-16 h-16 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <div className="i-ph:warning-octagon-fill w-8 h-8 text-red-500 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
        <p className="text-gray-600 dark:text-gray-300 mb-4">{message}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 p-3 rounded-md border border-gray-200 dark:border-gray-700">
          {details}
        </p>
        {/* Optional: Add a button to retry or contact support */}
        {/*
        <button
          onClick={() => window.location.reload()} // Simple reload to retry
          className="mt-6 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
        >
          Retry
        </button>
        */}
      </div>
    </div>
  );
}
