"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function NameEntryForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });

    const data = await res.json();

    if (!res.ok) {
      const message = data.error ?? "Something went wrong.";
      setError(message);
      toast.error(message);
      setLoading(false);
      return;
    }

    router.push("/lobby");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Enter your name"
        maxLength={20}
        autoFocus
        className="w-full rounded-lg bg-ocean-blue/40 border border-sea-foam/30 px-4 py-3 text-mist placeholder:text-sea-foam/60 focus:outline-none focus:ring-2 focus:ring-coral text-base"
      />
      {error && <p className="text-coral text-sm">{error}</p>}
      <button
        type="submit"
        disabled={loading || !name.trim()}
        className="w-full rounded-lg bg-coral text-deep-navy font-semibold py-3 transition hover:opacity-90 disabled:opacity-50 text-base"
      >
        {loading ? "Joining..." : "Enter the fleet"}
      </button>
    </form>
  );
}