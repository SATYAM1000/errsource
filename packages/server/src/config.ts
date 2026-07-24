const config = {
  port: Number(process.env.PORT ?? 4517),
  /** Bearer token the Vite plugin must send. Unset = dev mode (accept all). */
  apiKey: process.env.ERRSOURCE_API_KEY,
  /**
   * S3 bucket for source maps. When set, maps go to S3 (credentials come
   * from the standard AWS_* env vars); when unset, maps go to local disk.
   */
  s3Bucket: process.env.S3_BUCKET,
  /**
   * Key prefix inside the bucket. MUST stay outside any public-read
   * prefix — source maps are your entire source code.
   */
  s3Prefix: process.env.ERRSOURCE_S3_PREFIX ?? 'errsource/sourcemaps',
  awsRegion: process.env.AWS_REGION ?? 'ap-south-1',
  /** Local fallback directory, used only when S3_BUCKET is unset. */
  storageDir: process.env.ERRSOURCE_STORAGE ?? 'storage',
  /** SQLite database file for issues and events. */
  dbPath: process.env.ERRSOURCE_DB ?? 'errsource.db',
  /** Slack incoming-webhook url. Unset = Slack alerts disabled. */
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL,
};

export { config };
