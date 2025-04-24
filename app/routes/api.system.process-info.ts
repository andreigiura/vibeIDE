import type { ActionFunctionArgs, LoaderFunction } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';
import { requireUserId } from '~/services/session.server';
import {
  type ProcessInfo,
  getProcessInfoUtil,
  getMockProcessInfo, // Import mock generator
} from '~/lib/system/process-info.utils';

// Use standard import for server-only route file
import * as child_process from 'child_process';

let execSync: typeof child_process.execSync | undefined;

try {
  if (typeof process !== 'undefined' && process.versions?.node) {
    execSync = child_process.execSync;
  } else {
    console.log('Not in a standard Node.js environment, execSync unavailable.');
  }
} catch (e) {
  console.warn('Failed to import child_process:', e);
}

/*
 * Remove unused isDevelopment const
 * const isDevelopment = process.env.NODE_ENV === 'development';
 */

// Server-side function to get REAL process info using execSync
const getRealProcessInfo = (): ProcessInfo[] => {
  if (!execSync) {
    console.warn('[SERVER] execSync not available, returning util fallback info.');
    return getProcessInfoUtil();
  }

  try {
    const platform = process.platform;
    let processes: ProcessInfo[] = [];
    let cpuCount = 1;

    // Get CPU Count (with error handling)
    try {
      if (platform === 'darwin') {
        cpuCount = parseInt(execSync('sysctl -n hw.ncpu').toString().trim(), 10) || 1;
      } else if (platform === 'linux') {
        cpuCount = parseInt(execSync('nproc').toString().trim(), 10) || 1;
      } else if (platform === 'win32') {
        const match = execSync('wmic cpu get NumberOfCores').toString().trim().match(/\d+/);
        cpuCount = match ? parseInt(match[0], 10) : 1;
      }
    } catch (cpuError) {
      console.error('[SERVER] Failed to get CPU count:', cpuError);
      cpuCount = 1; // Default to 1 if error
    }

    // Platform-specific process fetching (ensure this uses the correct structure)
    if (platform === 'darwin') {
      try {
        const output = execSync('ps -eo pid,pcpu,pmem,comm -r | head -n 11').toString().trim();
        const lines = output.split('\n').slice(1);
        processes = lines.map((line: string) => {
          const parts = line.trim().split(/\s+/);
          const command = parts.slice(3).join(' ');

          return {
            pid: parseInt(parts[0], 10),
            cpu: parseFloat(parts[1]) / cpuCount,
            memory: parseFloat(parts[2]),
            name: command.split('/').pop() || command,
            command,
            timestamp: new Date().toISOString(),
          };
        });
      } catch (error) {
        console.error('[SERVER] Failed macOS primary process fetch:', error);
        throw new Error('Failed to fetch macOS process info');
      }
    } else if (platform === 'linux') {
      try {
        const output = execSync('ps -eo pid,pcpu,pmem,comm --sort=-pmem | head -n 11').toString().trim();
        const lines = output.split('\n').slice(1);
        processes = lines.map((line: string) => {
          const parts = line.trim().split(/\s+/);
          const command = parts.slice(3).join(' ');

          return {
            pid: parseInt(parts[0], 10),
            cpu: parseFloat(parts[1]) / cpuCount,
            memory: parseFloat(parts[2]),
            name: command.split('/').pop() || command,
            command,
            timestamp: new Date().toISOString(),
          };
        });
      } catch (error) {
        console.error('[SERVER] Failed linux primary process fetch:', error);
        throw new Error('Failed to fetch linux process info');
      }
    } else if (platform === 'win32') {
      try {
        const output = execSync(
          'powershell "Get-Process | Sort-Object -Property WorkingSet64 -Descending | Select-Object -First 10 Id, CPU, @{Name=\'Memory\';Expression={$_.WorkingSet64/1MB}}, ProcessName | ConvertTo-Json"',
        )
          .toString()
          .trim();
        const processData = JSON.parse(output);
        const processArray = Array.isArray(processData) ? processData : [processData];
        processes = processArray.map((proc: any) => ({
          pid: proc.Id,
          name: proc.ProcessName,
          cpu: (proc.CPU || 0) / cpuCount,
          memory: proc.Memory,
          timestamp: new Date().toISOString(),
        }));
      } catch (error) {
        console.error('[SERVER] Failed windows primary process fetch:', error);
        throw new Error('Failed to fetch windows process info');
      }
    } else {
      console.warn(`[SERVER] Unsupported platform: ${platform}`);
      throw new Error(`Unsupported platform: ${platform}`);
    }

    return processes;
  } catch (error) {
    console.error('[SERVER] Error in getRealProcessInfo:', error);
    return [
      {
        pid: 0,
        name: 'Error',
        cpu: 0,
        memory: 0,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Failed to fetch process info on server',
      },
    ];
  }
};

// ... (loader and action remain the same, calling getRealProcessInfo) ...

export const loader: LoaderFunction = async ({ request }) => {
  await requireUserId(request);

  try {
    const processInfo = getRealProcessInfo();
    return json(processInfo);
  } catch (error) {
    console.error('Failed to get process info in loader:', error);

    const fallbackData =
      process.env.NODE_ENV === 'development'
        ? getMockProcessInfo() // Use imported mock function
        : [
            {
              pid: 0,
              name: 'Error',
              cpu: 0,
              memory: 0,
              timestamp: new Date().toISOString(),
              error: 'Loader error fetching process info',
            },
          ];

    return json(fallbackData, { status: 500 });
  }
};

export const action = async ({ request }: ActionFunctionArgs) => {
  await requireUserId(request);

  try {
    const processInfo = getRealProcessInfo();
    return json(processInfo);
  } catch (error) {
    console.error('Failed to get process info in action:', error);

    const fallbackData =
      process.env.NODE_ENV === 'development'
        ? getMockProcessInfo() // Use imported mock function
        : [
            {
              pid: 0,
              name: 'Error',
              cpu: 0,
              memory: 0,
              timestamp: new Date().toISOString(),
              error: 'Action error fetching process info',
            },
          ];

    return json(fallbackData, { status: 500 });
  }
};
