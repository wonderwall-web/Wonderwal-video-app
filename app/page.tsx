import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default function Home() {
  const token = cookies().get("ww_session")?.value;
  if (token) redirect("/builder");
  redirect("/login");
}
