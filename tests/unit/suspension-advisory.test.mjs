import { expect, test, vi } from "vitest";
import {
  listenSuspensionAdvisory,
  publishSuspensionAdvisory,
} from "../../apps/web/src/features/authentication/suspension-advisory.ts";

test("account-scoped advisory only requests revalidation and closes its channel", () => {
  const channels = [];
  const open = vi.fn((name) => {
    const channel = {
      name,
      onmessage: null,
      postMessage: vi.fn(),
      close: vi.fn(),
    };
    channels.push(channel);
    return channel;
  });
  const revalidate = vi.fn();
  const stop = listenSuspensionAdvisory("clinic-a", revalidate, open);
  publishSuspensionAdvisory("clinic-a", open);
  expect(channels[0].name).toBe(channels[1].name);
  expect(channels[1].postMessage).toHaveBeenCalledWith({
    accountId: "clinic-a",
  });
  expect(channels[1].close).toHaveBeenCalledOnce();
  channels[0].onmessage({ data: { accountId: "clinic-b" } });
  channels[0].onmessage({ data: "clinic-a" });
  expect(revalidate).not.toHaveBeenCalled();
  channels[0].onmessage({ data: { accountId: "clinic-a" } });
  expect(revalidate).toHaveBeenCalledOnce();
  stop();
  expect(channels[0].onmessage).toBeNull();
  expect(channels[0].close).toHaveBeenCalledOnce();
});

test("unavailable channel does not affect server suspension handling", () => {
  const unavailable = () => {
    throw new Error("unsupported");
  };
  expect(() =>
    publishSuspensionAdvisory("clinic-a", unavailable),
  ).not.toThrow();
  expect(() =>
    listenSuspensionAdvisory("clinic-a", () => {}, unavailable)(),
  ).not.toThrow();
});
