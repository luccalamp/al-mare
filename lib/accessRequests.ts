import type { User } from "@supabase/supabase-js";

export type AccessRequestStatus = "pending" | "approved" | "denied";
export type AccessApprovalStatus = AccessRequestStatus | "none";

export type AccessRequestFormValues = {
  fullName: string;
  phone: string;
  instagramHandle: string;
  justification: string;
};

export type AccessRequestRecord = {
  id: string;
  email: string;
  requester_user_id: string | null;
  full_name: string | null;
  phone: string | null;
  instagram_handle: string | null;
  justification: string | null;
  auth_provider: string | null;
  email_verified: boolean;
  avatar_url: string | null;
  reviewed_by: string | null;
  status: AccessRequestStatus;
  created_at: string;
  updated_at: string;
  approved_at: string | null;
  password_setup_email_sent_at: string | null;
};

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) {
        return normalized;
      }
    }
  }

  return null;
}

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeFullName(value: string) {
  return collapseWhitespace(value);
}

export function normalizePhone(value: string) {
  return collapseWhitespace(value);
}

export function normalizeInstagramHandle(value: string) {
  const normalized = value.trim().replace(/^@+/, "").replace(/\s+/g, "");
  return normalized ? normalized.toLowerCase() : "";
}

export function normalizeJustification(value: string) {
  return value.trim();
}

export function normalizeAccessRequestForm(values: AccessRequestFormValues): AccessRequestFormValues {
  return {
    fullName: normalizeFullName(values.fullName),
    phone: normalizePhone(values.phone),
    instagramHandle: normalizeInstagramHandle(values.instagramHandle),
    justification: normalizeJustification(values.justification),
  };
}

export function getUserAuthProvider(user: Pick<User, "app_metadata" | "identities"> | null | undefined) {
  const appProvider = firstNonEmptyString(user?.app_metadata?.provider);
  if (appProvider) {
    return appProvider;
  }

  const providers = Array.isArray(user?.app_metadata?.providers)
    ? user?.app_metadata?.providers.filter((provider): provider is string => typeof provider === "string" && provider.trim().length > 0)
    : [];

  if (providers.length > 0) {
    return providers[0];
  }

  const identityProvider = Array.isArray(user?.identities)
    ? user.identities.find((identity) => typeof identity?.provider === "string" && identity.provider.trim().length > 0)?.provider ?? null
    : null;

  return identityProvider;
}

export function getAuthProviderLabel(provider: string | null | undefined) {
  switch ((provider || "").toLowerCase()) {
    case "google":
      return "Google";
    case "email":
      return "Link por e-mail";
    case "apple":
      return "Apple";
    case "github":
      return "GitHub";
    default:
      return provider || "Não identificado";
  }
}

export function isUserEmailVerified(user: Pick<User, "email_confirmed_at" | "user_metadata"> | null | undefined) {
  const metadata = user?.user_metadata;

  return Boolean(
    user?.email_confirmed_at ||
      metadata?.email_verified === true ||
      metadata?.email_verified === "true"
  );
}

export function getUserAvatarUrl(user: Pick<User, "user_metadata"> | null | undefined) {
  const metadata = user?.user_metadata;

  return firstNonEmptyString(metadata?.avatar_url, metadata?.picture, metadata?.photo_url);
}

export function getDefaultAccessRequestFormValues(user: User | null | undefined): AccessRequestFormValues {
  const metadata = user?.user_metadata ?? {};
  const suggestedFullName =
    firstNonEmptyString(
      metadata.full_name,
      metadata.name,
      [metadata.given_name, metadata.family_name].filter((value): value is string => typeof value === "string" && value.trim().length > 0).join(" ")
    ) || "";
  const suggestedInstagramHandle = firstNonEmptyString(
    metadata.user_name,
    metadata.preferred_username,
    metadata.nickname
  );

  return normalizeAccessRequestForm({
    fullName: suggestedFullName,
    phone: "",
    instagramHandle: suggestedInstagramHandle || "",
    justification: "",
  });
}

export function buildAccessRequestIdentitySnapshot(user: User, values: AccessRequestFormValues) {
  const normalized = normalizeAccessRequestForm(values);

  return {
    requester_user_id: user.id,
    full_name: normalized.fullName || null,
    phone: normalized.phone || null,
    instagram_handle: normalized.instagramHandle || null,
    justification: normalized.justification || null,
    auth_provider: getUserAuthProvider(user),
    email_verified: isUserEmailVerified(user),
    avatar_url: getUserAvatarUrl(user),
  };
}