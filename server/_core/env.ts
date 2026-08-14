import "dotenv/config";

function requireEnv(key: string): string {
  const val = process.env[key];
  if (!val) {
    throw new Error(
      `[env] Missing required environment variable: ${key}\n` +
      `  Copy .env.example to .env and fill in the values.`
    );
  }
  return val;
}

export const ENV = {
  // Required
  jwtSecret: process.env.NODE_ENV === "production"
    ? requireEnv("JWT_SECRET")
    : (process.env.JWT_SECRET ?? "dev-only-insecure-secret-change-in-production"),
  databaseUrl: process.env.DATABASE_URL ?? "",

  // Context
  isProduction: process.env.NODE_ENV === "production",
  isDevelopment: process.env.NODE_ENV !== "production",

  // Optional: AWS S3 for photo storage (falls back to local /uploads)
  awsS3Bucket: process.env.AWS_S3_BUCKET ?? "",
  awsRegion: process.env.AWS_REGION ?? "us-east-1",

  // Optional: AI features (LLM, image generation, voice)
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
};
