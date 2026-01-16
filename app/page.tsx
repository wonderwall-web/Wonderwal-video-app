import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSessionCookieName, verifySession } from "./lib/auth";

export default function Home() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) redirect("/login");

  const token = cookies().get(getSessionCookieName())?.value;
  if (!token) redirect("/login");

  const payload = verifySession(token, secret);
  if (!payload) redirect("/login");

  redirect("/builder");
}
