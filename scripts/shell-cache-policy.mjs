export function isPublicShellRequest(url, method, origin, assets) {
  const parsed = new URL(url);
  return (
    method === "GET" &&
    parsed.origin === origin &&
    !parsed.search &&
    (assets.includes(parsed.pathname) || parsed.pathname === "/")
  );
}
