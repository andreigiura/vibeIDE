// Contains utilities and types related to process information, safe for client/server import.

// Interface definition
export interface ProcessInfo {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  command?: string;
  timestamp: string;
  error?: string;
}

const isDevelopment = process.env.NODE_ENV === 'development';

// Generate mock process information with realistic values
export const getMockProcessInfo = (): ProcessInfo[] => {
  const timestamp = new Date().toISOString();
  const randomCPU = () => Math.floor(Math.random() * 15);
  const randomHighCPU = () => 15 + Math.floor(Math.random() * 25);
  const randomMem = () => Math.floor(Math.random() * 5);
  const randomHighMem = () => 5 + Math.floor(Math.random() * 15);

  return [
    { pid: 1, name: 'Browser', cpu: randomHighCPU(), memory: 25 + randomMem(), command: 'Browser Process', timestamp },
    { pid: 2, name: 'System', cpu: 5 + randomCPU(), memory: 10 + randomMem(), command: 'System Process', timestamp },
    { pid: 3, name: 'bolt', cpu: randomHighCPU(), memory: 15 + randomMem(), command: 'Bolt AI Process', timestamp },
    { pid: 4, name: 'node', cpu: randomCPU(), memory: randomHighMem(), command: 'Node.js Process', timestamp },
    { pid: 5, name: 'wrangler', cpu: randomCPU(), memory: randomMem(), command: 'Wrangler Process', timestamp },
    { pid: 6, name: 'vscode', cpu: randomCPU(), memory: 12 + randomMem(), command: 'VS Code Process', timestamp },
    { pid: 7, name: 'chrome', cpu: randomHighCPU(), memory: 20 + randomMem(), command: 'Chrome Browser', timestamp },
    { pid: 8, name: 'finder', cpu: 1 + randomCPU(), memory: 3 + randomMem(), command: 'Finder Process', timestamp },
    { pid: 9, name: 'terminal', cpu: 2 + randomCPU(), memory: 5 + randomMem(), command: 'Terminal Process', timestamp },
    { pid: 10, name: 'cloudflared', cpu: randomCPU(), memory: randomMem(), command: 'Cloudflare Tunnel', timestamp },
  ];
};

// Get process info - Util version ONLY returns mock or error, no execSync
export const getProcessInfoUtil = (): ProcessInfo[] => {
  /*
   * This util version cannot run execSync safely.
   * It either returns mock data in dev or an error.
   */
  if (isDevelopment) {
    console.log('Returning mock process info from util in development.');
    return getMockProcessInfo();
  }

  // Production non-Node environment
  return [
    {
      pid: 0,
      name: 'N/A',
      cpu: 0,
      memory: 0,
      timestamp: new Date().toISOString(),
      error: 'Process info requires server-side execution.',
    },
  ];

  /*
   * NOTE: The original execSync logic is now expected to be *only* within
   * the loader/action of app/routes/api.system.process-info.ts
   */
};

// --- Placeholder catch blocks from original function (can be removed if not porting logic) ---
/*
 *catch (error) { console.error('Failed darwin exec:', error); /* ... darwin fallback ... * / }
 *catch (error) { console.error('Failed linux exec:', error); /* ... linux fallback ... * / }
 *catch (error) { console.error('Failed windows exec:', error); /* ... windows fallback ... * / }
 */
