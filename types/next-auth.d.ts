import type { DefaultSession } from "next-auth";
import type { JWT as DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      nickname?: string | null;
      username?: string | null;
      role?: string;
      officeId?: string | null;
      officeName?: string;
      mustChangePassword?: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    nickname?: string | null;
    username?: string | null;
    role?: string;
    officeId?: string | null;
    officeName?: string;
    mustChangePassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id?: string;
    nickname?: string | null;
    username?: string | null;
    role?: string;
    officeId?: string | null;
    officeName?: string;
    mustChangePassword?: boolean;
    loginAt?: number;
  }
}
