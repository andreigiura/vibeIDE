export interface S3SiteInfo {
  id: string;
  name: string;
  url: string;
  region: string;
  bucketName: string;
  path?: string;
  chatId: string;
}

export interface S3DeployResult {
  id: string;
  state: 'ready' | 'error' | 'uploading';
  url?: string;
  error?: string;
}
