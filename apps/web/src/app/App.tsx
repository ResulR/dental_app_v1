import {
  DelegationPanel,
  AccountStatePanel,
} from "../features/permissions/index.js";
import {
  ClinicRegistrationPanel,
  ClinicProfilePanel,
  ClinicReviewPanel,
  ClinicDirectoryPanel,
} from "../features/clinics/index.js";
import { AppShell } from "../shared/AppShell.js";
import {
  AuthenticationPanel,
  PermissionBoundary,
} from "../features/authentication/index.js";
export function App() {
  return (
    <AppShell navigation={[]}>
      <div className="welcome">
        <p className="eyebrow">Laboratori · Klinikat</p>
        <h1>Një hapësirë për çdo punë dentare.</h1>
        <p className="lead">
          Porositë, dorëzimet dhe bisedat në një vend të vetëm.
        </p>
        <AuthenticationPanel
          renderAuthenticated={(identity) => (
            <>
              <PermissionBoundary identity={identity}>
                {identity.profile === "clinic" ? (
                  <ClinicProfilePanel key={identity.account_id} />
                ) : (
                  <>
                    <ClinicReviewPanel key={identity.account_id} />
                    <ClinicDirectoryPanel
                      key={identity.account_id + "-directory"}
                    />
                  </>
                )}
                {identity.profile !== "clinic" && (
                  <AccountStatePanel
                    type="clinic"
                    key={identity.account_id + "-clinic-state"}
                  />
                )}
              </PermissionBoundary>
              {(identity.profile === "owner" ||
                identity.profile === "admin") && (
                <PermissionBoundary
                  identity={identity}
                  permission="employees.manage_permissions"
                  allowClinic={false}
                >
                  <DelegationPanel
                    key={identity.account_id}
                    owner={identity.profile === "owner"}
                  />
                </PermissionBoundary>
              )}
              {(identity.profile === "owner" ||
                identity.profile === "admin") && (
                <PermissionBoundary
                  identity={identity}
                  permission="employees.suspend"
                  allowClinic={false}
                >
                  <AccountStatePanel
                    type="employee"
                    key={identity.account_id + "-employee-state"}
                  />
                </PermissionBoundary>
              )}
            </>
          )}
        />
        <ClinicRegistrationPanel />
      </div>
    </AppShell>
  );
}
