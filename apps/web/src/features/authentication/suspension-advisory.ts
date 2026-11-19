// This message is advisory only. Every receiving tab must query the server;
// it must never purge local records based on a browser message.
const CHANNEL = "dental-lab-account-state-v1";

type Channel = Pick<BroadcastChannel, "postMessage" | "close" | "onmessage">;
type Open = (name: string) => Channel;
const openDefault: Open = (name) => new BroadcastChannel(name);

export function publishSuspensionAdvisory(
  accountId: string,
  open: Open = openDefault,
) {
  try {
    const channel = open(CHANNEL);
    channel.postMessage({ accountId });
    channel.close();
  } catch {
    // Focus and visibility checks still revalidate when this API is unavailable.
  }
}

export function listenSuspensionAdvisory(
  accountId: string,
  revalidate: () => void,
  open: Open = openDefault,
): () => void {
  let channel: Channel;
  try {
    channel = open(CHANNEL);
  } catch {
    return () => {};
  }
  channel.onmessage = (event: MessageEvent<unknown>) => {
    const data = event.data;
    if (
      data &&
      typeof data === "object" &&
      "accountId" in data &&
      data.accountId === accountId
    )
      revalidate();
  };
  return () => {
    channel.onmessage = null;
    channel.close();
  };
}
