import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import envHelpers from "./env.js";

const { getEnv, requireEnv } = envHelpers;

function readFirstEnv(names) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) {
      return value;
    }
  }

  return null;
}

function collectAllowedOrigins() {
  const configuredOrigins = [
    getEnv("NEXT_PUBLIC_BASE_URL"),
    getEnv("BASE_URL"),
    getEnv("NEXT_PUBLIC_APP_URL"),
    getEnv("NEXT_PUBLIC_SITE_URL"),
    getEnv("SITE_URL"),
    getEnv("APP_URL"),
  ].filter(Boolean);

  const extraOrigins = (getEnv("S3_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  return Array.from(new Set([
    "https://jakoliveira.com.br",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://*.vercel.app",
    ...configuredOrigins,
    ...extraOrigins,
  ]));
}

const DEFAULT_S3_REGION = "us-east-2";
const DEFAULT_S3_BUCKET = "almare-fotos-upload";

const region = readFirstEnv(["AWS_S3_REGION", "AWS_REGION"]) || DEFAULT_S3_REGION;
const accessKeyId = getEnv("AWS_ACCESS_KEY_ID");
const secretAccessKey = getEnv("AWS_SECRET_ACCESS_KEY");
const bucket = readFirstEnv(["AWS_S3_BUCKET", "WS_BUCKET_NAME", "AWS_BUCKET_NAME"]) || DEFAULT_S3_BUCKET;

const client = new S3Client({
  region,
  ...(accessKeyId && secretAccessKey
    ? {
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      }
    : {}),
});

const allowedOrigins = collectAllowedOrigins();
const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: allowedOrigins,
      AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag", "x-amz-request-id", "x-amz-id-2"],
      MaxAgeSeconds: 3600,
    },
  ],
};

const result = await client.send(
  new PutBucketCorsCommand({
    Bucket: bucket,
    CORSConfiguration: corsConfig,
  })
);

console.log("S3 bucket CORS configured successfully", {
  bucket,
  region,
  allowedOrigins,
  statusCode: result.$metadata.httpStatusCode,
});
