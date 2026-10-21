import { AuditLogPanel } from "../features/audit/AuditLogPanel.js";
import { GeneralMessagingPanel } from "../features/messaging/GeneralMessagingPanel.js";
import { ActionInboxPanel } from "../features/orders/index.js";
import { OrderTrackingPanel } from "../features/orders/index.js";
import { ClinicOrderForm, OrderReviewPanel } from "../features/orders/index.js";
import { LaboratorySettingsPanel } from "../features/settings/index.js";
import {
  CatalogPanel,
  CatalogManagementPanel,
} from "../features/catalog/index.js";
import {
  AdminPanel,
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
              {identity.profile !== "clinic" && (
                <ActionInboxPanel key={identity.account_id + "-action-inbox"} />
              )}
              {identity.profile !== "clinic" && (
                <PermissionBoundary
                  identity={identity}
                  permission="orders.read_details"
                  allowClinic={false}
                >
                  {(snapshot) => (
                    <OrderReviewPanel
                      key={identity.account_id + "-order-review"}
                      permissions={snapshot.permissions}
                    />
                  )}
                </PermissionBoundary>
              )}
              <PermissionBoundary
                identity={identity}
                permission="orders.read_logistics"
                allowClinic
              >
                {(snapshot) => (
                  <OrderTrackingPanel
                    key={identity.account_id + "-tracking"}
                    clinic={identity.profile === "clinic"}
                    permissions={snapshot.permissions}
                  />
                )}
              </PermissionBoundary>
              {identity.profile === "clinic" && (
                <ClinicOrderForm key={identity.account_id + "-order-form"} />
              )}
              {import.meta.env.VITE_DENTAL_LAB_GENERAL_MESSAGING_ENABLED ===
                "true" && (
                <PermissionBoundary
                  identity={identity}
                  permission="messaging.general.read"
                  allowClinic
                >
                  {(snapshot) => (
                    <GeneralMessagingPanel
                      key={identity.account_id + "-general"}
                      clinic={identity.profile === "clinic"}
                      canReply={
                        identity.profile === "clinic" ||
                        snapshot.permissions.includes("messaging.general.reply")
                      }
                    />
                  )}
                </PermissionBoundary>
              )}
              <LaboratorySettingsPanel
                key={identity.account_id + "-lab-info"}
              />
              <PermissionBoundary
                identity={identity}
                permission="settings.manage"
                allowClinic={false}
              >
                <LaboratorySettingsPanel
                  manage
                  key={identity.account_id + "-lab-settings"}
                />
              </PermissionBoundary>
              <PermissionBoundary
                identity={identity}
                permission="catalog.manage"
                allowClinic={false}
              >
                <CatalogManagementPanel
                  owner={identity.profile === "owner"}
                  key={identity.account_id + "-catalog-management"}
                />
              </PermissionBoundary>
              <PermissionBoundary
                identity={identity}
                permission="catalog.manage"
                allowCatalogReader
                allowClinic
              >
                <CatalogPanel key={identity.account_id + "-catalog"} />
              </PermissionBoundary>
              {identity.profile === "owner" &&
                import.meta.env.VITE_DENTAL_LAB_AUDIT_READ_ENABLED ===
                  "true" && (
                  <PermissionBoundary identity={identity} allowClinic={false}>
                    <AuditLogPanel key={identity.account_id + "-audit"} />
                  </PermissionBoundary>
                )}
              {identity.profile === "owner" && (
                <PermissionBoundary identity={identity} allowClinic={false}>
                  <AdminPanel key={identity.account_id + "-admins"} />
                </PermissionBoundary>
              )}
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
