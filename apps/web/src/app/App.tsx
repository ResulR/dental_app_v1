import { AppShell } from "../shared/AppShell.js";
import { AuthenticationPanel } from "../features/authentication/index.js";
export function App() {
  return (
    <AppShell navigation={[]}>
      <div className="welcome">
        <p className="eyebrow">Laboratori · Klinikat</p>
        <h1>Një hapësirë për çdo punë dentare.</h1>
        <p className="lead">
          Porositë, dorëzimet dhe bisedat në një vend të vetëm.
        </p>
        <AuthenticationPanel />
      </div>
    </AppShell>
  );
}
