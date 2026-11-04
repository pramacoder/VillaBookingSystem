import { NextResponse } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const timestamp = new Date().toISOString();
  try {
    // Quick DB ping to confirm pool & connectivity
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      {
        status: "ok",
        database: "ok",
        timestamp,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        status: "degraded",
        database: "error",
        error: err instanceof Error ? err.message : "Database ping failed",
        timestamp,
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      },
    );
  }
}
