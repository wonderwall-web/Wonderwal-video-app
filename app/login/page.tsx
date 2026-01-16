import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieName, verifySession } from "../lib/auth";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  const secret = process.env.SESSION_SECRET;

  if (secret) {
    const token = cookies().get(getSessionCookieName())?.value;
    if (token) {
      const payload = verifySession(token, secret);
      if (payload) redirect("/builder");
    }
  }

  return <LoginClient />;
}
