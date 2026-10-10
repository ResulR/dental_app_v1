import type { ReactNode } from "react";
type NavigationItem = { href: string; label: string; current?: boolean };
export function AppShell({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation: readonly NavigationItem[];
}) {
  return (
    <>
      <a className="skip" href="#main">
        Kalo te përmbajtja
      </a>
      <header className="header">
        <div className="container header-row">
          <div className="brand">
            <img src="/icon.svg" alt="" width="44" height="44" />
            <span>Laboratori dentar</span>
          </div>
          <span className="muted">Laboratori dhe klinikat</span>
        </div>
      </header>
      <main id="main" className="container" tabIndex={-1}>
        {navigation.length > 0 && (
          <nav aria-label="Navigimi kryesor">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                aria-current={item.current ? "page" : undefined}
              >
                {item.label}
              </a>
            ))}
          </nav>
        )}
        {children}
      </main>
      <footer className="container muted">Laboratori dentar</footer>
    </>
  );
}
