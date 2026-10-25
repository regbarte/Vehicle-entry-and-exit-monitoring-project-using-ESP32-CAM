import type { paths } from "@guardhouse/api-types";
import createClient from "openapi-fetch";

export const api = createClient<paths>({ baseUrl: "" });

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type Result<T> = { data?: T; error?: unknown; response: Response };

/** Return the data, or throw an ApiError carrying the server's `detail` message. */
export async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  const { data, error, response } = await request;
  if (response.ok) return data as T;
  throw new ApiError(response.status, detailOf(error) ?? `Request failed (${response.status})`);
}

function detailOf(error: unknown): string | undefined {
  if (!error || typeof error !== "object" || !("detail" in error)) return undefined;
  const { detail } = error as { detail: unknown };
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
  return undefined;
}
