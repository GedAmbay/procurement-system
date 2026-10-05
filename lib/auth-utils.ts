import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { Role } from "./utils";

type AllowedRole = Role | "ANY";

type AuthResult = 
  | { authorized: false; response: NextResponse; user: any }
  | { authorized: true; response: null; user: any };

export async function requireRole(allowedRoles: AllowedRole[]): Promise<AuthResult> {
  const session = await auth();
  
  if (!session || !session.user) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      user: null 
    };
  }

  const userRole = (session.user as any).role as Role;

  if (!allowedRoles.includes("ANY") && !allowedRoles.includes(userRole)) {
    return { 
      authorized: false, 
      response: NextResponse.json({ error: "Forbidden: insufficient permissions" }, { status: 403 }),
      user: session.user 
    };
  }

  return { authorized: true, response: null, user: session.user };
}
