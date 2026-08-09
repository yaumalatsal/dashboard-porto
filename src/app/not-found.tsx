import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found">
      <p>Path 404 / Unmapped territory</p>
      <h1>This road ends<br />beyond the atlas.</h1>
      <Link href="/"><ArrowLeft size={18} />Return to Aether</Link>
    </main>
  );
}
