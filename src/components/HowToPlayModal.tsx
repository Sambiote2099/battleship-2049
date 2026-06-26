"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

export default function HowToPlayModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-deep-navy border border-sea-foam/30 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-mist/60 hover:text-mist"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-mist mb-1">How to play</h2>
        <p className="text-sea-foam text-sm mb-6">A quick tour of the fleet and the battlefield.</p>

        <div className="flex flex-col gap-6">
          
          <Section
            title="I. Create or join a room"
            body="Create a room and configure the grid size, your fleet (ship count and lengths), and which special attacks are allowed. Or join someone else's open room from the lobby list."
            image="/Capture.png"
          />
          <Section
            title="II. Place your fleet"
            body="Drag ships from the tray onto your board. Use the rotate (⟳) button before or after placing. Each ship gets its own color so you can track them at a glance."
            image="/Capture2.png"
          />
          <Section
            title="III. Take turns firing"
            body="Click a cell on the enemy grid to fire. Hits, misses, and sunk ships are revealed instantly to both players."
            image="/Capture3.png"
          />
          <Section
            title="IV. Special attacks"
            body="If enabled for this room, you'll have a limited number of charges for: Nuclear (3×3 blast), Mortar (5-cell cross), and Cluster (your target + 4 random cells elsewhere). Pick one from the attack bar before firing — only available on your turn."
            image="/Capture4.png"
          />
          <Section
            title="V. Win the match"
            body="Sink every ship in your opponent's fleet to win. Each player also has a time bank — run out of time and you lose automatically. You can resign at any time, or cancel a room before the match starts."
            image="/Capture5.png"
          />
        </div>

        <button
          onClick={onClose}
          className="mt-8 w-full rounded-lg bg-coral text-deep-navy font-semibold py-2.5 hover:opacity-90"
        >
          Got it, let's play
        </button>
      </div>
    </div>
  );
}

function Section({ title, body, image }: { title: string; body: string; image?: string }) {
  return (
    <div>
      <h3 className="text-mist font-semibold mb-1">{title}</h3>
      <p className="text-mist/70 text-sm mb-2">{body}</p>
      {image && (
        <div className="rounded-lg border border-sea-foam/20 overflow-hidden bg-ocean-blue/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={title} className="w-full object-cover" />
        </div>
      )}
    </div>
  );
}