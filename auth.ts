import NextAuth from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: { office: true },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          officeId: user.officeId,
          officeName: user.office?.name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.officeId = (user as any).officeId;
        token.officeName = (user as any).officeName;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = (token.id || token.sub) as string;
        (session.user as any).role = token.role;
        (session.user as any).officeId = token.officeId;
        (session.user as any).officeName = token.officeName;

        // Auto-heal session if database was migrated or re-seeded (stale JWT cookie from previous DB)
        if (session.user.email) {
          try {
            const currentDbUser = await prisma.user.findUnique({
              where: { id: session.user.id },
              select: { id: true, officeId: true, role: true, office: { select: { name: true } } },
            });

            if (!currentDbUser) {
              const matchedUser = await prisma.user.findUnique({
                where: { email: session.user.email },
                select: { id: true, officeId: true, role: true, office: { select: { name: true } } },
              });
              if (matchedUser) {
                session.user.id = matchedUser.id;
                (session.user as any).officeId = matchedUser.officeId;
                (session.user as any).officeName = matchedUser.office?.name;
                (session.user as any).role = matchedUser.role;
              }
            }
          } catch {
            // Fail open to standard session data if DB query errors
          }
        }
      }
      return session;
    },
  },
});
