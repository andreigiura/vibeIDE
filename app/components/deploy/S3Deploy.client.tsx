import { toast } from 'react-toastify';
import { useStore } from '@nanostores/react';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { path } from '~/utils/path';
import { useState } from 'react';
import type { ActionCallbackData } from '~/lib/runtime/message-parser';
import { chatId } from '~/lib/persistence/useChatHistory';
import { Button } from '~/components/ui/Button';
import type { S3DeployResult, S3SiteInfo } from '~/types/s3';
import type { ActionState } from '~/lib/runtime/action-runner';

interface S3ApiResponse {
  success: boolean;
  deploy: S3DeployResult;
  site: S3SiteInfo;
  error?: string;
  errors?: { path: string; error: string }[];
}

export function useS3Deploy() {
  const [isDeploying, setIsDeploying] = useState(false);
  const currentChatId = useStore(chatId);

  const handleS3Deploy = async () => {
    if (!currentChatId) {
      toast.error('No active chat found');
      return false;
    }

    let deploymentArtifactId = ``;

    try {
      setIsDeploying(true);

      const artifact = workbenchStore.firstArtifact;

      if (!artifact) {
        toast.error('No active project found');
        throw new Error('No active project found');
      }

      // Create deployment artifact for visual feedback
      deploymentArtifactId = `s3-deploy-artifact-${Date.now()}`;
      workbenchStore.addArtifact({
        id: deploymentArtifactId,
        messageId: deploymentArtifactId,
        title: 'S3 Deployment',
        type: 'standalone',
      });

      const deployArtifact = workbenchStore.artifacts.get()[deploymentArtifactId];

      if (!deployArtifact || !deployArtifact.runner) {
        toast.error('Failed to create deployment artifact.');
        throw new Error('Failed to create deployment artifact.');
      }

      // Notify that build is starting - use 'netlify' as the source as it's a valid value
      deployArtifact.runner.handleDeployAction('building', 'running', { source: 'netlify' });

      // Set up build action
      const buildActionId = `build-s3-${Date.now()}`;
      const actionData: ActionCallbackData = {
        messageId: 's3-build',
        artifactId: artifact.id,
        actionId: buildActionId,
        action: {
          type: 'build' as const,
          content: 'npm run build',
        },
      };

      // Add the action first
      artifact.runner.addAction(actionData);

      // Then run it
      await artifact.runner.runAction(actionData);

      if (!artifact.runner.buildOutput) {
        deployArtifact.runner.handleDeployAction('building', 'failed', {
          error: 'Build failed. Check the terminal for details.',
          source: 'netlify',
        });
        toast.error('Build failed. Check the terminal for details.');
        throw new Error('Build failed');
      }

      // Notify that build succeeded and deployment is starting
      deployArtifact.runner.handleDeployAction('deploying', 'running', { source: 'netlify' });

      // Get the build files
      const container = await webcontainer;

      // Remove /home/project from buildPath if it exists
      const buildPath = artifact.runner.buildOutput.path.replace('/home/project', '');

      console.log('Original buildPath', buildPath);

      // Check if the build path exists
      let finalBuildPath = buildPath;

      // List of common output directories to check if the specified build path doesn't exist
      const commonOutputDirs = [buildPath, '/dist', '/build', '/out', '/output', '/.next', '/public'];

      // Verify the build path exists, or try to find an alternative
      let buildPathExists = false;

      for (const dir of commonOutputDirs) {
        try {
          await container.fs.readdir(dir);
          finalBuildPath = dir;
          buildPathExists = true;
          console.log(`Using build directory: ${finalBuildPath}`);
          break;
        } catch (error) {
          // Directory doesn't exist, try the next one
          console.log(`Directory ${dir} doesn't exist, trying next option. ${error}`);
          continue;
        }
      }

      if (!buildPathExists) {
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: 'Could not find build output directory.',
          source: 'netlify',
        });
        toast.error('Could not find build output directory. Please check your build configuration.');
        throw new Error('Could not find build output directory.');
      }

      // Recursively get all files from the build directory
      async function getAllFiles(dirPath: string): Promise<Record<string, string>> {
        const files: Record<string, string> = {};
        const entries = await container.fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);

          if (entry.isFile()) {
            const content = await container.fs.readFile(fullPath, 'utf-8');

            // Remove build path prefix from the path
            const deployPath = fullPath.replace(finalBuildPath, '');
            files[deployPath] = content;
          } else if (entry.isDirectory()) {
            const subFiles = await getAllFiles(fullPath);
            Object.assign(files, subFiles);
          }
        }

        return files;
      }

      const fileContents = await getAllFiles(finalBuildPath);

      // Send the files to the server for S3 upload
      const response = await fetch('/api/s3-deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: fileContents,
          chatId: currentChatId,
        }),
      });

      const data = (await response.json()) as S3ApiResponse;

      if (!response.ok || !data.success || !data.deploy || !data.site) {
        console.error('Invalid deploy response:', data);

        // Notify that deployment failed
        deployArtifact.runner.handleDeployAction('deploying', 'failed', {
          error: data.error || 'Invalid deployment response',
          source: 'netlify',
        });
        throw new Error(data.error || 'Invalid deployment response');
      }

      // Store the site ID if it's a new site
      if (data.site) {
        localStorage.setItem(`s3-site-${currentChatId}`, JSON.stringify(data.site));
      }

      // Notify that deployment completed successfully
      deployArtifact.runner.handleDeployAction('complete', 'complete', {
        url: data.deploy.url,
        source: 'netlify',
      });

      toast.success('Successfully deployed to S3!');

      return true;
    } catch (error) {
      console.error('S3 Deploy error:', error);

      const errorMsg = error instanceof Error ? error.message : 'S3 Deployment failed';
      toast.error(errorMsg);

      if (deploymentArtifactId) {
        const deployArtifact = workbenchStore.artifacts.get()[deploymentArtifactId];

        if (deployArtifact && deployArtifact.runner) {
          // Fixing the action status check
          const actions = deployArtifact.runner.actions?.get();
          const buildActionId = `build-s3-${deploymentArtifactId.split('-').pop()}`;
          const buildAction = actions ? (actions[buildActionId] as ActionState | undefined) : undefined;

          if (!buildAction || buildAction.status !== 'complete') {
            deployArtifact.runner.handleDeployAction('building', 'failed', {
              error: errorMsg,
              source: 'netlify',
            });
          } else {
            deployArtifact.runner.handleDeployAction('deploying', 'failed', {
              error: errorMsg,
              source: 'netlify',
            });
          }
        }
      }

      return false;
    } finally {
      setIsDeploying(false);
    }
  };

  return {
    isDeploying,
    handleS3Deploy,
  };
}

// Simple button component that matches Netlify's approach
export function S3DeployButton() {
  const { handleS3Deploy, isDeploying } = useS3Deploy();

  return (
    <Button onClick={handleS3Deploy} disabled={isDeploying} variant="outline" size="sm" className="ml-2">
      {isDeploying ? 'Deploying to S3...' : 'Deploy to S3'}
    </Button>
  );
}
