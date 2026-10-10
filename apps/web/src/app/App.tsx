import { AppShell } from "../shared/AppShell.js";
import { Card } from "../shared/Card.js";
export function App() {
  return (
    <AppShell navigation={[]}>
      <div className="welcome">
        <p className="eyebrow">Laboratori · Klinikat</p>
        <h1>Një hapësirë për çdo punë dentare.</h1>
        <p className="lead">
          Porositë, dorëzimet dhe bisedat në një vend të vetëm.
        </p>
        <Card>
          <h2>Mirë se vini</h2>
          <p>Hapësirë private për laboratorin dhe klinikat partnere.</p>
          <p className="muted">
            Hyrja në llogari nuk është ende e disponueshme.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
