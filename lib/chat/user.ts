/**
 * Anonymous per-browser identity.
 *
 * There are no accounts. A browser gets a random id in an httpOnly cookie, and
 * that id owns its conversations. Every query that touches a conversation is
 * scoped by it, so knowing another conversation's id isn't enough to read or
 * delete it.
 */
import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";

const USER_COOKIE = "aquaculture_user";

/** Reads the current browser's id, or null if it has never been here. */
export async function getUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(USER_COOKIE)?.value ?? null;
}

/** Reads the browser's id, minting and setting one if it doesn't have it yet. */
export async function getOrCreateUserId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(USER_COOKIE)?.value;
  if (existing) return existing;

  const id = randomUUID();
  store.set(USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });
  return id;
}
