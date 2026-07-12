import { buildTrustedAppUrl } from "@/lib/server/trustedOrigin";

export function buildAuthConfirmationUrl(
  request: Request,
  input: {
    tokenHash: string;
    type: "magiclink" | "recovery";
    nextPath: string;
  }
) {
  const confirmationUrl = new URL(buildTrustedAppUrl("/auth/confirm", request));
  confirmationUrl.searchParams.set("token_hash", input.tokenHash);
  confirmationUrl.searchParams.set("type", input.type);
  confirmationUrl.searchParams.set("next", input.nextPath);
  return confirmationUrl.toString();
}
