import { COOKIE_NAME, SESSION_DURATION_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import { ForbiddenError } from "@shared/_core/errors";

export type SessionPayload = {
  userId: number;
  username: string;
  role: string;
};

class SDKServer {
  private getSecretKey() {
    return new TextEncoder().encode(ENV.jwtSecret);
  }

  async signSession(payload: SessionPayload, expiresInMs = SESSION_DURATION_MS): Promise<string> {
    const expirationSeconds = Math.floor((Date.now() + expiresInMs) / 1000);
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(this.getSecretKey());
  }

  async verifySession(cookieValue: string | undefined | null): Promise<SessionPayload | null> {
    if (!cookieValue) return null;
    try {
      const { payload } = await jwtVerify(cookieValue, this.getSecretKey(), {
        algorithms: ["HS256"],
      });
      const { userId, username, role } = payload as Record<string, unknown>;
      if (typeof userId !== "number" || typeof username !== "string" || typeof role !== "string") {
        return null;
      }
      return { userId, username, role };
    } catch {
      return null;
    }
  }

  private parseCookies(cookieHeader: string | undefined): Map<string, string> {
    if (!cookieHeader) return new Map();
    return new Map(Object.entries(parseCookieHeader(cookieHeader)));
  }

  async authenticateRequest(req: Request): Promise<User> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionToken = cookies.get(COOKIE_NAME);

    const session = await this.verifySession(sessionToken);
    if (!session) throw ForbiddenError("Invalid or missing session");

    const user = await db.getUserById(session.userId);
    if (!user) throw ForbiddenError("User not found");

    return user;
  }
}

export const sdk = new SDKServer();
