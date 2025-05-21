import { type ActionFunctionArgs, json } from '@remix-run/cloudflare';
import { S3Client, PutObjectCommand, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import type { S3SiteInfo, S3DeployResult } from '~/types/s3';
import { requireUserId } from '~/services/session.server';

interface DeployRequestBody {
  files: Record<string, string>;
  chatId: string;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.html')) {
    return 'text/html';
  }

  if (filePath.endsWith('.css')) {
    return 'text/css';
  }

  if (filePath.endsWith('.js')) {
    return 'application/javascript';
  }

  if (filePath.endsWith('.json')) {
    return 'application/json';
  }

  if (filePath.endsWith('.png')) {
    return 'image/png';
  }

  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
    return 'image/jpeg';
  }

  if (filePath.endsWith('.svg')) {
    return 'image/svg+xml';
  }

  if (filePath.endsWith('.ico')) {
    return 'image/x-icon';
  }

  return 'application/octet-stream';
}

export async function action({ request, context }: ActionFunctionArgs) {
  // Authentication check using the existing pattern
  let userId: string;

  try {
    userId = await requireUserId(request);
  } catch (error) {
    console.error('Authentication failed:', error);
    return json({ error: 'Unauthorized access' }, { status: 401 });
  }

  try {
    const { files, chatId } = (await request.json()) as DeployRequestBody;

    if (!files || Object.keys(files).length === 0) {
      return json({ error: 'No files provided for deployment' }, { status: 400 });
    }

    if (!chatId) {
      return json({ error: 'Chat ID is required' }, { status: 400 });
    }

    // 2. Get S3 credentials from context or environment variables
    const cloudflareEnv = (context?.cloudflare?.env || {}) as unknown as Record<string, string>;

    console.log('Context structure:', {
      hasCloudflare: !!context?.cloudflare,
      hasEnv: !!context?.cloudflare?.env,
      envKeys: context?.cloudflare?.env ? Object.keys(context.cloudflare.env) : [],
      processEnvKeys: Object.keys(process.env).filter((key) => key.startsWith('S3_')),
    });

    const bucketName = cloudflareEnv.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
    const region = cloudflareEnv.S3_REGION || process.env.S3_REGION;
    const accessKeyId = cloudflareEnv.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = cloudflareEnv.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;

    if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
      console.error('S3 configuration missing in environment variables');
      console.error('Provided values:', {
        bucketName: !!bucketName,
        region: !!region,
        accessKeyId: !!accessKeyId,
        secretAccessKey: !!secretAccessKey,
      });

      return json({ error: 'Server configuration error: S3 credentials not available' }, { status: 500 });
    }

    // 3. Create S3 client
    const s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // 4. Create the path structure for the app: /[userId]/[appId]
    const folderPrefix = `${userId}/${chatId}/`;

    // 5. Delete existing files in the path before uploading
    try {
      // First, list all objects with the folder prefix
      const listCommand = new ListObjectsV2Command({
        Bucket: bucketName,
        Prefix: folderPrefix,
      });

      const listResponse = await s3Client.send(listCommand);

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        const objectsToDelete = listResponse.Contents.filter((item) => item.Key) // Filter out any undefined Keys
          .map((item) => ({ Key: item.Key! }));

        if (objectsToDelete.length > 0) {
          // Delete all objects in the folder
          const deleteCommand = new DeleteObjectsCommand({
            Bucket: bucketName,
            Delete: {
              Objects: objectsToDelete,
              Quiet: false,
            },
          });

          await s3Client.send(deleteCommand);
          console.log(`Deleted ${objectsToDelete.length} existing objects from ${folderPrefix}`);
        }
      }
    } catch (error) {
      console.error('Error deleting existing files:', error);

      // Continue with upload even if deletion fails
    }

    // 6. Prepare deployment information
    const deployId = `s3-deploy-${Date.now()}`;
    const deploymentResult: S3DeployResult = {
      id: deployId,
      state: 'uploading',
    };

    // Generate URL for the index.html in the app's folder
    const siteUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${folderPrefix}index.html`;

    const siteInfo: S3SiteInfo = {
      id: bucketName, // Use bucket name as ID
      name: `S3 Bucket: ${bucketName}/${folderPrefix}`,
      url: siteUrl,
      region,
      bucketName,
      path: folderPrefix,
      chatId,
    };

    // 7. Upload files to S3 with the folder prefix
    const uploadPromises = Object.entries(files).map(async ([filePath, content]) => {
      // Remove leading slash if present
      const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;

      // Add the folder prefix to the S3 key
      const s3Key = `${folderPrefix}${cleanPath}`;
      const contentType = getContentType(cleanPath);

      try {
        const command = new PutObjectCommand({
          Bucket: bucketName,
          Key: s3Key,
          Body: content,
          ContentType: contentType,

          // ACL: 'public-read', // Uncomment if bucket has appropriate policy
        });

        await s3Client.send(command);

        return {
          path: s3Key,
          success: true,
        };
      } catch (err) {
        return {
          path: s3Key,
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    const results = await Promise.all(uploadPromises);
    const failedUploads = results.filter((r) => !r.success);

    if (failedUploads.length > 0) {
      console.error('S3 Upload errors:', failedUploads);
      deploymentResult.state = 'error';
      deploymentResult.error = `Failed to upload ${failedUploads.length} files.`;

      return json(
        {
          success: false,
          deploy: deploymentResult,
          site: siteInfo,
          errors: failedUploads,
        },
        { status: 500 },
      );
    }

    // 8. All uploads successful
    deploymentResult.state = 'ready';
    deploymentResult.url = siteInfo.url;

    return json({
      success: true,
      deploy: deploymentResult,
      site: siteInfo,
    });
  } catch (error) {
    console.error('S3 Deployment failed:', error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown deployment error',
      },
      { status: 500 },
    );
  }
}
