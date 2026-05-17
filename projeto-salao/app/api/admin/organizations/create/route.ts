import { NextResponse } from "next/server";

export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: "O fluxo de organizações foi desativado neste ambiente." },
    { status: 410 }
  );
}
