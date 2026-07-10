import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { rutaPorRol } from "@/lib/rutas";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect(rutaPorRol(session.user.rol));
}
