import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  const token = cookies().get("ww_session")?.value;
  if (token) redirect("/builder");
  return <LoginClient />;
}
