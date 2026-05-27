import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

const client = new S3Client({
  region: "us-east-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const corsConfig = {
  CORSRules: [
    {
      AllowedOrigins: [
        "https://jakoliveira.com.br",
        "http://localhost:3000",
      ],
      AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
      AllowedHeaders: ["*"],
      ExposeHeaders: ["ETag"],
      MaxAgeSeconds: 3600,
    },
  ],
};

const result = await client.send(
  new PutBucketCorsCommand({
    Bucket: "almare-fotos-upload",
    CORSConfiguration: corsConfig,
  })
);

console.log("CORS configured successfully:", result.$metadata.httpStatusCode);
