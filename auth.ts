import NextAuth, { CredentialsSignin } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

class AccountLockedError extends CredentialsSignin {
  code = "account_locked";
}

class AccountInactiveError extends CredentialsSignin {
  code = "account_inactive";
}

async function logAuthEvent(userId: string, action: string, notes: string) {
  try {
    await prisma.documentAuditLog.create({
      data: {
        documentType: "AUTH",
        documentId: userId,
        action,
        userId,
        notes,
      },
    });
  } catch {
    // Non-blocking audit log write
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
    updateAge: 15 * 60,
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Employee ID / Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const rawUsername = (credentials?.username as string | undefined)?.trim();
        const rawPassword = credentials?.password as string | undefined;
        if (!rawUsername || !rawPassword) return null;

        const user = await prisma.user.findFirst({
          where: {
            username: { equals: rawUsername, mode: "insensitive" },
          },
          include: { office: true },
        });

        if (!user) return null;

        if (!user.isActive) {
          await logAuthEvent(user.id, "LOGIN_FAILED", "Login blocked: account is inactive.");
          throw new AccountInactiveError();
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          await logAuthEvent(user.id, "LOGIN_FAILED", "Login blocked: account is temporarily locked.");
          throw new AccountLockedError();
        }

        const isValid = await bcrypt.compare(rawPassword, user.password);

        if (!isValid) {
          const nextAttempts = (user.failedLoginAttempts ?? 0) + 1;
          const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;

          await prisma.user.update({
            where: { id: user.id },
            data: {
              failedLoginAttempts: shouldLock ? 0 : nextAttempts,
              lockedUntil: shouldLock ? new Date(Date.now() + LOCKOUT_DURATION_MS) : null,
            },
          });

          await logAuthEvent(
            user.id,
            shouldLock ? "ACCOUNT_LOCKED" : "LOGIN_FAILED",
            shouldLock
              ? "Account locked for 15 minutes after 5 failed login attempts."
              : `Failed login attempt (${nextAttempts}/${MAX_FAILED_ATTEMPTS}).`
          );

          if (shouldLock) {
            throw new AccountLockedError();
          }
          return null;
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        await logAuthEvent(user.id, "LOGIN_SUCCESS", `Signed in as ${user.username}.`);

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          officeId: user.officeId,
          officeName: user.office?.name,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.email = user.email;
        token.role = user.role;
        token.officeId = user.officeId;
        token.officeName = user.officeName;
        token.mustChangePassword = Boolean(user.mustChangePassword);
        token.loginAt = Date.now();
        return token;
      }

      if (token?.id) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { id: token.id as string },
            select: {
              id: true,
              name: true,
              username: true,
              email: true,
              role: true,
              officeId: true,
              isActive: true,
              mustChangePassword: true,
              passwordChangedAt: true,
              office: { select: { name: true } },
            },
          });

          if (!dbUser || !dbUser.isActive) {
            return null;
          }

          if (trigger === "update") {
            token.loginAt = Date.now();
          } else if (
            dbUser.passwordChangedAt &&
            token.loginAt &&
            dbUser.passwordChangedAt.getTime() > (token.loginAt as number)
          ) {
            return null;
          }

          token.name = dbUser.name;
          token.username = dbUser.username;
          token.email = dbUser.email;
          token.role = dbUser.role;
          token.officeId = dbUser.officeId;
          token.officeName = dbUser.office?.name;
          token.mustChangePassword = dbUser.mustChangePassword;
        } catch {
          // Keep existing token if transient DB error occurs
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (!token) return session;
      session.user.id = (token.id || token.sub) as string;
      session.user.name = (token.name as string) ?? session.user.name;
      session.user.email = (token.email as string | null) ?? "";
      session.user.username = token.username;
      session.user.role = token.role;
      session.user.officeId = token.officeId;
      session.user.officeName = token.officeName ?? undefined;
      session.user.mustChangePassword = Boolean(token.mustChangePassword);
      return session;
    },
  },
});
