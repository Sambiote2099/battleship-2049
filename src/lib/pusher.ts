import Pusher from "pusher";

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.PUSHER_CLUSTER!,
  useTLS: true,
});

export async function safeTrigger(channel: string, event: string, data: unknown) {
  try {
    await pusherServer.trigger(channel, event, data);
  } catch (err) {
    // Don't let a Pusher hiccup break the underlying game action —
    // the client's fallback poll (see GameClient) will still catch up.
    console.error("Pusher trigger failed:", err);
  }
}