const { S3Client, GetObjectCommand, PutObjectCommand } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");
const { v2: cloudinary } = require("cloudinary");
const { Readable } = require("stream");
const { getEnv, requireEnv } = require("./env");

const TARGET_STORAGE_BUCKET = "s3";
const LEGACY_STORAGE_BUCKETS = ["cloudinary", "r2"];
const PAGE_SIZE = 200;

function createSecretKeySafeFetch(apiKey) {
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    const authorizationHeader = headers.get("Authorization");

    if (authorizationHeader === `Bearer ${apiKey}` || authorizationHeader === "") {
      headers.delete("Authorization");
    }

    if (!headers.has("apikey")) {
      headers.set("apikey", apiKey);
    }

    return fetch(input, { ...init, headers });
  };
}

function createSupabaseAdminClient() {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const isSecretKey = serviceKey.startsWith("sb_secret_");

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    ...(isSecretKey
      ? {
          global: {
            fetch: createSecretKeySafeFetch(serviceKey),
            headers: {
              Authorization: "",
            },
          },
        }
      : {}),
  });
}

function getFirstEnv(names) {
  for (const name of names) {
    const value = getEnv(name);
    if (value) {
      return value;
    }
  }

  return null;
}

function requireFirstEnv(names) {
  const value = getFirstEnv(names);
  if (value) {
    return value;
  }

  throw new Error(`Missing required environment variable. Expected one of: ${names.join(", ")}`);
}

function getS3Config() {
  return {
    region: requireFirstEnv(["AWS_S3_REGION", "AWS_REGION"]),
    accessKeyId: requireEnv("AWS_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("AWS_SECRET_ACCESS_KEY"),
    bucket: requireFirstEnv(["AWS_S3_BUCKET", "WS_BUCKET_NAME", "AWS_BUCKET_NAME"]),
  };
}

function getR2Config() {
  return {
    accountId: requireEnv("R2_ACCOUNT_ID"),
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    bucket: requireEnv("R2_BUCKET"),
  };
}

function configureCloudinary() {
  cloudinary.config({
    cloud_name: requireEnv("CLOUDINARY_CLOUD_NAME"),
    api_key: requireEnv("CLOUDINARY_API_KEY"),
    api_secret: requireEnv("CLOUDINARY_API_SECRET"),
  });
}

function createAwsS3Client() {
  const config = getS3Config();

  return new S3Client({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

function createR2Client() {
  const config = getR2Config();

  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true,
  });
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

async function getObjectBuffer(client, bucket, key) {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );

  if (!response.Body) {
    throw new Error(`Objeto sem payload para ${bucket}:${key}`);
  }

  let buffer;
  if (typeof response.Body.transformToByteArray === "function") {
    buffer = Buffer.from(await response.Body.transformToByteArray());
  } else if (response.Body instanceof Readable) {
    buffer = await streamToBuffer(response.Body);
  } else {
    throw new Error(`Formato de stream nao suportado para ${bucket}:${key}`);
  }

  return {
    buffer,
    contentType: response.ContentType || "application/octet-stream",
  };
}

async function downloadLegacyAsset(sourceBucket, storagePath) {
  if (sourceBucket === "r2") {
    const r2Config = getR2Config();
    return getObjectBuffer(createR2Client(), r2Config.bucket, storagePath);
  }

  if (sourceBucket === "cloudinary") {
    configureCloudinary();
    const signedUrl = cloudinary.url(storagePath, {
      resource_type: "image",
      type: "authenticated",
      sign_url: true,
      expires_at: Math.floor(Date.now() / 1000) + 120,
      secure: true,
    });

    const response = await fetch(signedUrl, {
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      throw new Error(`Falha ao baixar asset Cloudinary ${storagePath}: ${response.status}`);
    }

    return {
      buffer: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type") || "application/octet-stream",
    };
  }

  throw new Error(`Storage bucket legado nao suportado: ${sourceBucket}`);
}

async function uploadAssetToS3(storagePath, buffer, contentType) {
  const s3Config = getS3Config();
  await createAwsS3Client().send(
    new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: storagePath,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

function encodeStoragePathForRoute(storagePath) {
  return storagePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildProxyUrl(storagePath) {
  return `/api/media/${encodeStoragePathForRoute(storagePath)}`;
}

function normalizeBucket(bucket) {
  return typeof bucket === "string" ? bucket.trim().toLowerCase() : "";
}

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const verbose = argv.includes("--verbose");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Number.parseInt(limitArg.split("=")[1], 10) : null;

  return {
    dryRun,
    verbose,
    limit: Number.isFinite(limit) && limit > 0 ? limit : null,
  };
}

async function loadAllRows(fetchPage) {
  const rows = [];
  let from = 0;

  while (true) {
    const page = await fetchPage(from, from + PAGE_SIZE - 1);
    rows.push(...page);

    if (page.length < PAGE_SIZE) {
      break;
    }

    from += PAGE_SIZE;
  }

  return rows;
}

async function loadLegacyPhotoRows(supabase, limit) {
  const rows = await loadAllRows(async (from, to) => {
    const { data, error } = await supabase
      .from("client_photos")
      .select("id, cliente_id, storage_bucket, storage_path, url")
      .in("storage_bucket", LEGACY_STORAGE_BUCKETS)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  });

  return limit ? rows.slice(0, limit) : rows;
}

async function loadLegacyClientRows(supabase, limit) {
  const rows = await loadAllRows(async (from, to) => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, photo_url, profile_photo_storage_bucket, profile_photo_storage_path")
      .in("profile_photo_storage_bucket", LEGACY_STORAGE_BUCKETS)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .range(from, to);

    if (error) {
      throw error;
    }

    return Array.isArray(data) ? data : [];
  });

  return limit ? rows.slice(0, limit) : rows;
}

async function migrateAsset(sourceBucket, storagePath, options, assetCache, stats) {
  const cacheKey = `${sourceBucket}:${storagePath}`;
  if (assetCache.has(cacheKey)) {
    return assetCache.get(cacheKey);
  }

  const migrated = {
    storageBucket: TARGET_STORAGE_BUCKET,
    storagePath,
    url: buildProxyUrl(storagePath),
  };

  if (!options.dryRun) {
    const downloaded = await downloadLegacyAsset(sourceBucket, storagePath);
    await uploadAssetToS3(storagePath, downloaded.buffer, downloaded.contentType);
    stats.assetsUploaded += 1;
  }

  assetCache.set(cacheKey, migrated);
  return migrated;
}

async function migratePhotoRows(supabase, rows, options, assetCache, stats) {
  for (const row of rows) {
    const sourceBucket = normalizeBucket(row.storage_bucket);
    const storagePath = typeof row.storage_path === "string" ? row.storage_path.trim() : "";

    if (!LEGACY_STORAGE_BUCKETS.includes(sourceBucket) || !storagePath) {
      stats.photoRowsSkipped += 1;
      continue;
    }

    if (options.verbose || options.dryRun) {
      console.log(`[photo] ${row.id}: ${sourceBucket}:${storagePath} -> ${TARGET_STORAGE_BUCKET}:${storagePath}`);
    }

    const migratedAsset = await migrateAsset(sourceBucket, storagePath, options, assetCache, stats);

    if (!options.dryRun) {
      const now = new Date().toISOString();
      const { error: updatePhotoError } = await supabase
        .from("client_photos")
        .update({
          storage_bucket: migratedAsset.storageBucket,
          storage_path: migratedAsset.storagePath,
          url: migratedAsset.url,
          updated_at: now,
        })
        .eq("id", row.id)
        .eq("storage_bucket", row.storage_bucket)
        .eq("storage_path", row.storage_path);

      if (updatePhotoError) {
        throw new Error(`Falha ao atualizar client_photos ${row.id}: ${updatePhotoError.message}`);
      }

      const { error: syncProfilePhotoError } = await supabase
        .from("clientes")
        .update({
          photo_url: migratedAsset.url,
          profile_photo_storage_bucket: migratedAsset.storageBucket,
          profile_photo_storage_path: migratedAsset.storagePath,
          updated_at: now,
        })
        .eq("profile_photo_storage_bucket", row.storage_bucket)
        .eq("profile_photo_storage_path", row.storage_path);

      if (syncProfilePhotoError) {
        throw new Error(
          `Falha ao sincronizar foto de perfil vinculada ao asset ${row.storage_bucket}:${row.storage_path}: ${syncProfilePhotoError.message}`
        );
      }
    }

    stats.photoRowsMigrated += 1;
  }
}

async function migrateClientRows(supabase, rows, options, assetCache, stats) {
  for (const row of rows) {
    const sourceBucket = normalizeBucket(row.profile_photo_storage_bucket);
    const storagePath = typeof row.profile_photo_storage_path === "string"
      ? row.profile_photo_storage_path.trim()
      : "";

    if (!LEGACY_STORAGE_BUCKETS.includes(sourceBucket) || !storagePath) {
      stats.clientRowsSkipped += 1;
      continue;
    }

    if (options.verbose || options.dryRun) {
      console.log(`[client] ${row.id}: ${sourceBucket}:${storagePath} -> ${TARGET_STORAGE_BUCKET}:${storagePath}`);
    }

    const migratedAsset = await migrateAsset(sourceBucket, storagePath, options, assetCache, stats);

    if (!options.dryRun) {
      const { error: updateClientError } = await supabase
        .from("clientes")
        .update({
          photo_url: migratedAsset.url,
          profile_photo_storage_bucket: migratedAsset.storageBucket,
          profile_photo_storage_path: migratedAsset.storagePath,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("profile_photo_storage_bucket", row.profile_photo_storage_bucket)
        .eq("profile_photo_storage_path", row.profile_photo_storage_path);

      if (updateClientError) {
        throw new Error(`Falha ao atualizar cliente ${row.id}: ${updateClientError.message}`);
      }
    }

    stats.clientRowsMigrated += 1;
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const supabase = createSupabaseAdminClient();
  const assetCache = new Map();
  const stats = {
    assetsUploaded: 0,
    photoRowsMigrated: 0,
    photoRowsSkipped: 0,
    clientRowsMigrated: 0,
    clientRowsSkipped: 0,
  };

  console.log(`Modo: ${options.dryRun ? "dry-run" : "execucao real"}`);
  console.log(
    `Destino: ${TARGET_STORAGE_BUCKET} (${getFirstEnv(["AWS_S3_BUCKET", "WS_BUCKET_NAME", "AWS_BUCKET_NAME"]) || "bucket nao informado"})`
  );

  const legacyPhotoRows = await loadLegacyPhotoRows(supabase, options.limit);
  console.log(`Fotos legadas encontradas: ${legacyPhotoRows.length}`);
  await migratePhotoRows(supabase, legacyPhotoRows, options, assetCache, stats);

  const legacyClientRows = await loadLegacyClientRows(supabase, options.limit);
  console.log(`Perfis legados restantes: ${legacyClientRows.length}`);
  await migrateClientRows(supabase, legacyClientRows, options, assetCache, stats);

  console.log("Resumo:");
  console.log(JSON.stringify(stats, null, 2));
}

main().catch((error) => {
  console.error("Falha na migracao de fotos para S3:", error);
  process.exitCode = 1;
});