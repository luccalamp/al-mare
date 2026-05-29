import { NextResponse } from "next/server";
import { requireAdminRequest } from "@/lib/server/requestGuards";

const ADMIN_TOKEN_COOKIE = "admin_operations_token";

export async function POST(request: Request) {
  // Validate the admin token via the standard guard
  const authError = requireAdminRequest(request);
  if (authError) {
    return authError;
  }

  // Read the token from the request header
  const token = request.headers.get("x-admin-token")?.trim();
  if (!token) {
    return NextResponse.json({ error: "Token administrativo ausente." }, { status: 400 });
  }

  // Set the token as an httpOnly cookie
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(ADMIN_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 0,
    path: "/",
  });

  return response;
}
