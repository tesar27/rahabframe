import { redirect } from "next/navigation";

// Fallback: middleware handles this for most clients, but this ensures
// a hard redirect to the default locale if the middleware doesn't fire.
export default function Page() {
  redirect("/ru");
}
