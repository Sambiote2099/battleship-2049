import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen bg-deep-navy flex items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-bold text-mist mb-2">404</h1>
        <p className="text-mist/60 mb-6">This page doesn't exist.</p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-coral text-deep-navy font-semibold px-6 py-2 hover:opacity-90"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}