import { type LoaderFunctionArgs, json } from '@remix-run/cloudflare';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { requireUserId } from '~/services/session.server';

export async function loader({ request, context }: LoaderFunctionArgs) {
  let userId: string;

  try {
    userId = await requireUserId(request);
  } catch {
    // Not logged in or session expired, so no deployment to check for this user.
    return json({ deployed: false, error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const chatId = url.searchParams.get('chatId');

  if (!chatId) {
    return json({ deployed: false, error: 'Chat ID is required' }, { status: 400 });
  }

  const cloudflareEnv = (context?.cloudflare?.env || {}) as unknown as Record<string, string>;
  const bucketName = cloudflareEnv.S3_BUCKET_NAME || process.env.S3_BUCKET_NAME;
  const region = cloudflareEnv.S3_REGION || process.env.S3_REGION;
  const accessKeyId = cloudflareEnv.S3_ACCESS_KEY_ID || process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = cloudflareEnv.S3_SECRET_ACCESS_KEY || process.env.S3_SECRET_ACCESS_KEY;

  if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
    /*
     * S3 not configured on the server, so no deployments can exist.
     * Log this, but for the client, it just means no deployment found.
     */
    console.error('S3 configuration missing for deployment check.');
    return json({ deployed: false, error: 'S3 not configured' });
  }

  const s3Client = new S3Client({
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const shortUserId = userId.length > 40 ? `${userId.substring(0, 20)}${userId.substring(userId.length - 20)}` : userId;
  const folderPrefix = `${shortUserId}/${chatId}/`;
  const objectKey = `${folderPrefix}index.html`;
  const siteUrl = `https://${shortUserId}-${chatId}.vibeox.ai`;

  try {
    const command = new HeadObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
    });
    await s3Client.send(command);

    // If HeadObject succeeds, the object exists.
    return json({ deployed: true, url: siteUrl });
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      // Object does not exist
      return json({ deployed: false });
    }

    // Other S3 error
    console.error('Error checking S3 object:', error);

    return json({ deployed: false, error: 'Failed to check S3 status' }, { status: 500 });
  }
}
