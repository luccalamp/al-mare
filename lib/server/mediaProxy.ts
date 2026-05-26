function decodePathFragment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function normalizeStoragePathFromRoute(pathSegments: string[]) {
  const joinedPath = pathSegments.join("/").trim().replace(/^\/+|\/+$/g, "");
  if (!joinedPath) {
    return "";
  }

  let normalizedPath = joinedPath;
  for (let index = 0; index < 2; index += 1) {
    const decodedPath = decodePathFragment(normalizedPath);
    if (decodedPath === normalizedPath) {
      break;
    }
    normalizedPath = decodedPath;
  }

  normalizedPath = normalizedPath.replace(/\\/g, "/");
  return normalizedPath
    .split("/")
    .filter(Boolean)
    .join("/");
}

export function encodeStoragePathForRoute(storagePath: string) {
  return storagePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}