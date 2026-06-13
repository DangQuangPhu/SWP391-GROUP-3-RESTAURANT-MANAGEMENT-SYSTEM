import { SectionHead, Card, Button, NotConnectedNote } from "../ManagerUI.jsx";

const ROLE_LABEL = { manager: "Manager", manager: "Manager", admin: "Admin" };

function SettingsSection({ user, role, onSignOut, toast }) {
  return (
    <div className="sfx-stack">
      <SectionHead title="Settings" subtitle="Portal and restaurant configuration" />

      <div className="sfx-grid sfx-grid--2">
        <Card title="Your account">
          <div className="sfx-detail">
            <div className="sfx-detail__row">
              <span>Name</span>
              <strong>{user?.fullName || user?.username || "Phūrai Manager"}</strong>
            </div>
            <div className="sfx-detail__row">
              <span>Email</span>
              <strong>{user?.email || "—"}</strong>
            </div>
            <div className="sfx-detail__row">
              <span>Role</span>
              <strong>{user?.roleName || ROLE_LABEL[role]}</strong>
            </div>
          </div>
          <div className="sfx-settings-acts">
            <Button variant="danger" icon="logout" onClick={onSignOut}>
              Logout
            </Button>
          </div>
        </Card>

        <Card title="Restaurant settings">
          <div className="sfx-detail">
            <div className="sfx-detail__row">
              <span>Service hours</span>
              <strong>11:00 — 23:00</strong>
            </div>
            <div className="sfx-detail__row">
              <span>Default slot length</span>
              <strong>120 minutes</strong>
            </div>
            <div className="sfx-detail__row">
              <span>Floors</span>
              <strong>2</strong>
            </div>
            <div className="sfx-detail__row">
              <span>Areas</span>
              <strong>8</strong>
            </div>
          </div>
          <div className="sfx-settings-acts">
            <Button variant="soft" icon="settings" onClick={() => toast("Settings API not connected yet", "info")}>
              Edit settings
            </Button>
          </div>
          <NotConnectedNote>Restaurant settings are read-only here until the settings API is wired.</NotConnectedNote>
        </Card>
      </div>
    </div>
  );
}

export default SettingsSection;
