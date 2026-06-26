"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PusherClient from "pusher-js";
import { toast } from "react-toastify";
import PlacementBoard from "./PlacementBoard";
import BattleBoards from "./BattleBoards";
import { confirmToast } from "@/lib/confirmToast";
import { ATTACK_LABELS } from "@/lib/game-engine/types";

function labelFor(fleet: any[] | undefined, type: string | null) {
  if (!type) return "ship";
  return fleet?.find((f: any) => f.type === type)?.label ?? "ship";
}

function liveRemaining(bankMs: number, isCurrentMover: boolean, turnStartedAt: string | null, now: number) {
  if (!isCurrentMover || !turnStartedAt) return bankMs;
  const elapsed = now - new Date(turnStartedAt).getTime();
  return Math.max(0, bankMs - elapsed);
}

function formatTime(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function GameClient({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [state, setState] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cancelledMessage, setCancelledMessage] = useState<string | null>(null);
  const [connection, setConnection] = useState<"connecting" | "connected" | "disconnected">("connecting");
  const [actionLoading, setActionLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadRef = useRef<() => void>(() => {});
  const stateRef = useRef<any>(null);
  const hasConnectedOnce = useRef(false);
  const timeoutClaimedRef = useRef(false);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    timeoutClaimedRef.current = false;
  }, [state?.game?.currentTurn, state?.game?.status]);

  useEffect(() => {
    const game = state?.game;
    if (!game || game.status !== "ACTIVE" || game.vsAI) return;
    if (game.hostTimeMs == null || game.guestTimeMs == null || !game.turnStartedAt) return;

    const elapsed = now - new Date(game.turnStartedAt).getTime();
    const movingBank = game.currentTurn === game.host.id ? game.hostTimeMs : game.guestTimeMs;
    const remaining = movingBank - elapsed;

    if (remaining <= 0 && !timeoutClaimedRef.current) {
      timeoutClaimedRef.current = true;
      fetch(`/api/games/${gameId}/claim-timeout`, { method: "POST" }).then(() => loadRef.current());
    }
  }, [now, state, gameId]);

  useEffect(() => {
    let active = true;

    async function load() {
      const res = await fetch(`/api/games/${gameId}`);
      const data = await res.json();
      if (!active) return;
      if (!res.ok) return setError(data.error ?? "Could not load game.");
      setState(data);
    }
    loadRef.current = load;
    load();

    const pusher = new PusherClient(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
    });

    function handleConnectionStateChange({ current }: { current: string }) {
      if (current === "connected") {
        setConnection("connected");
        if (hasConnectedOnce.current) {
          toast.success("Back online", { toastId: "connection-status" });
        }
        hasConnectedOnce.current = true;
      } else if (current === "connecting" || current === "unavailable") {
        setConnection("connecting");
      } else {
        setConnection("disconnected");
        if (hasConnectedOnce.current) {
          toast.warning("Connection lost — reconnecting...", { toastId: "connection-status" });
        }
      }
    }
    pusher.connection.bind("state_change", handleConnectionStateChange);

    const channel = pusher.subscribe(`private-game-${gameId}`);

    channel.bind("player-joined", (data: any) => {
      load();
      toast.info(`${data.guestName} joined the game!`);
    });

    channel.bind("ships-placed", (data: any) => {
      load();
      if (data.bothReady) {
        toast.success("Both fleets ready — battle begins!");
      }
    });

    channel.bind("shot-fired", (data: any) => {
      load();
      const you = stateRef.current?.you;
      const fleet = stateRef.current?.game?.fleet;

      if (you && data.playerId !== you.id && data.attackType !== "single") {
        const hits = data.cells.filter((c: any) => c.result !== "miss");
        const sunk = data.cells.filter((c: any) => c.result === "sunk");
        const attackLabel = ` (${ATTACK_LABELS[data.attackType] ?? data.attackType})`;

        if (sunk.length > 0) {
          const names = sunk.map((s: any) => labelFor(fleet, s.sunkShipType)).join(", ");
          toast.warning(`Opponent sank your ${names}!${attackLabel}`);
        } else if (hits.length > 0) {
          toast.warning(`Opponent hit ${hits.length} of your cells!${attackLabel}`);
        } else {
          toast.info(`Opponent missed!${attackLabel}`);
        }
      }

      if (data.gameFinished && you) {
        if (data.winnerId === you.id) toast.success("Victory! You sank the enemy fleet.");
        else toast.error("Defeat. Your fleet has been sunk.");
      }
    });

    channel.bind("game-resigned", (data: any) => {
      load();
      const you = stateRef.current?.you;
      if (you && data.byPlayerId !== you.id) {
        toast.success("Your opponent resigned — you win!");
      }
    });

    channel.bind("game-timeout", (data: any) => {
      load();
      const you = stateRef.current?.you;
      if (you) {
        if (data.winnerId === you.id) toast.success("Your opponent ran out of time — you win!");
        else toast.error("You ran out of time.");
      }
    });

    channel.bind("game-cancelled", (data: any) => {
      if (!active) return;
      const you = stateRef.current?.you;
      if (you && data.byPlayerId === you.id) return;
      toast.warning("Your opponent cancelled this game.");
      setCancelledMessage("Your opponent cancelled this game.");
    });

    const fallback = setInterval(load, 15000);

    return () => {
      active = false;
      clearInterval(fallback);
      pusher.connection.unbind("state_change", handleConnectionStateChange);
      channel.unbind_all();
      pusher.unsubscribe(`private-game-${gameId}`);
      pusher.disconnect();
    };
  }, [gameId]);

  function cancelGame() {
    confirmToast(
      "Cancel this room? This can't be undone.",
      async () => {
        setActionLoading(true);
        const res = await fetch(`/api/games/${gameId}/cancel`, { method: "POST" });
        setActionLoading(false);
        if (res.ok) {
          toast.info("Room terminated.");
          router.push("/lobby");
        } else {
          const data = await res.json().catch(() => ({}));
          const message = data.error ?? "Could not cancel game.";
          setError(message);
          toast.error(message);
        }
      },
      "Cancel room"
    );
  }

  function resignGame() {
    confirmToast(
      "Resign this game? This counts as a loss.",
      async () => {
        setActionLoading(true);
        const res = await fetch(`/api/games/${gameId}/resign`, { method: "POST" });
        setActionLoading(false);
        if (res.ok) {
          loadRef.current();
        } else {
          const data = await res.json().catch(() => ({}));
          const message = data.error ?? "Could not resign.";
          setError(message);
          toast.error(message);
        }
      },
      "Resign"
    );
  }

  if (cancelledMessage) {
    return (
      <div className="text-center">
        <p className="text-mist mb-4">{cancelledMessage}</p>
        <Link
          href="/lobby"
          className="rounded-lg bg-coral text-deep-navy font-semibold px-4 py-2 text-sm hover:opacity-90 inline-block"
        >
          Back to lobby
        </Link>
      </div>
    );
  }

  if (error) return <p className="text-coral text-center">{error}</p>;
  if (!state) return <p className="text-mist/60 text-center">Loading...</p>;

   const { game, you, opponent, moves } = state;
  const canCancel = game.status === "WAITING" || game.status === "PLACING";
  const canResign = game.status === "ACTIVE";

  const isHost = you.id === game.host.id;
  const youName = isHost ? game.host.displayName : (game.guest?.displayName ?? "You");
  const opponentName = isHost ? (game.guest?.displayName ?? "waiting for opponent...") : game.host.displayName;
  const youTimeMs = isHost ? game.hostTimeMs : game.guestTimeMs;
  const opponentTimeMs = isHost ? game.guestTimeMs : game.hostTimeMs;

  return (
    <div className="flex flex-col gap-4 z-10">
      <div className="text-center">
        <p className="text-sea-foam text-sm uppercase tracking-wide">{game.status}</p>
        <h1 className="text-xl text-mist font-semibold">
          {youName} vs {opponentName}
        </h1>
      </div>

      {game.status === "ACTIVE" && !game.vsAI && youTimeMs != null && opponentTimeMs != null && (
        <div className="flex justify-center gap-6 text-sm">
          <span className={game.currentTurn === you.id ? "text-coral font-semibold" : "text-mist/50"}>
            {youName}: {formatTime(liveRemaining(youTimeMs, game.currentTurn === you.id, game.turnStartedAt, now))}
          </span>
          <span className={game.currentTurn === opponent.id ? "text-coral font-semibold" : "text-mist/50"}>
            {opponentName}: {formatTime(liveRemaining(opponentTimeMs, game.currentTurn === opponent.id, game.turnStartedAt, now))}
          </span>
        </div>
      )}

      <div className="flex justify-center items-center gap-3 flex-wrap">
        <span
          className={`text-xs px-2 py-1 rounded-full border ${
            connection === "connected"
              ? "border-sea-foam text-sea-foam"
              : connection === "connecting"
              ? "border-sandy text-sandy"
              : "border-coral text-coral"
          }`}
        >
          {connection === "connected" ? "● Live" : connection === "connecting" ? "○ Connecting..." : "○ Reconnecting..."}
        </span>

        {canCancel && (
          <button
            onClick={cancelGame}
            disabled={actionLoading}
            className="text-xs rounded-full border border-coral text-coral px-3 py-1 hover:bg-coral/10 disabled:opacity-50"
          >
            Cancel game
          </button>
        )}

        {canResign && (
          <button
            onClick={resignGame}
            disabled={actionLoading}
            className="text-xs rounded-full border border-coral text-coral px-3 py-1 hover:bg-coral/10 disabled:opacity-50"
          >
            Resign
          </button>
        )}
      </div>

      {game.status === "PLACING" && (
        you.ready ? (
          <p className="text-mist/60 text-center">Fleet placed. Waiting for your opponent...</p>
        ) : (
          <PlacementBoard
            gameId={gameId}
            gridSize={game.gridSize}
            fleet={game.fleet}
            onPlaced={() => loadRef.current()}
          />
        )
      )}

      {game.status === "ACTIVE" && (
        <BattleBoards
          gameId={gameId}
          gridSize={game.gridSize}
          myId={you.id}
          opponentId={opponent.id}
          myShips={you.ships}
          fleet={game.fleet}
          isMyTurn={game.currentTurn === you.id}
          moves={moves}
          gameStatus={game.status}
          attackConfig={game.attackConfig}
          myCharges={game.attackCharges?.[you.id] ?? {}}
          onFired={() => loadRef.current()}
        />
      )}

      {game.status === "FINISHED" && (
        <div className="text-center">
          <h2 className={`text-3xl font-bold mb-2 ${game.winnerId === you.id ? "text-sea-foam" : "text-coral"}`}>
            {game.winnerId === you.id ? "Victory!" : "Defeat"}
          </h2>
          <p className="text-mist/60 mb-6">
            {game.winnerId === you.id ? "You sank the enemy fleet." : "Your fleet has been sunk."}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/lobby"
              className="rounded-lg bg-coral text-deep-navy font-semibold px-4 py-2 text-sm hover:opacity-90"
            >
              Back to lobby
            </Link>
            <Link
              href="/stats"
              className="rounded-lg border border-sea-foam/40 text-sea-foam px-4 py-2 text-sm hover:bg-ocean-blue/40"
            >
              View stats
            </Link>
          </div>
        </div>
      )}

      {game.status === "WAITING" && (
        <p className="text-mist/60 text-center">Waiting for an opponent to join...</p>
      )}
    </div>
  );
}