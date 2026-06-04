import { NextResponse } from "next/server";

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Unexpected server error";
}

export function errorResponse(error: unknown, status = 500) {
  return NextResponse.json({ error: messageOf(error) }, { status });
}
