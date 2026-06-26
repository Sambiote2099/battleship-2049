import { redirect } from "next/navigation";
import { getCurrentPlayer } from "@/lib/identity";
import NameEntryForm from "@/components/NameEntryForm";
import Image from "next/image";

export default async function HomePage() {
  const player = await getCurrentPlayer();
  if (player) redirect("/lobby");

  return (
    <main id="main" className="min-h-screen bg-deep-navy flex items-center justify-center px-4">
        <Image
          src="/ezgif-45f3184e849bf5ca.jpg"
          alt="Background"
          fill
          className="object-cover"
          priority
        />
      <div className="w-full h-full max-w-md px-4 opacity-96 py-4 max-h-md z-10 bg-slate-800 rounded-2xl">
        <Image
        src="/logo-light-transparent.png"
        alt="BATTLESHIP | 2049"
        height={356}
        width={356}>
        </Image>
        <p className="text-sea-foam text-center mb-2 mt-0.5 border-t border-white">
          
        </p>
         <p className="text-sea-foam text-center mb-6">
          Conquer The SEA | Make Every Missile Count
        </p>
        <NameEntryForm />
      </div>
    </main>
  );
}