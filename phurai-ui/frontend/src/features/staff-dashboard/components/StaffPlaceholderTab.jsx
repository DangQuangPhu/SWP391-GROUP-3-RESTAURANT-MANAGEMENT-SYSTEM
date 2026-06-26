import { SectionHead, EmptyState } from "./StaffUI.jsx";

function StaffPlaceholderTab({ title, subtitle, phaseLabel = "Phase 3+" }) {
  return (
    <div className="sfx-stack">
      <SectionHead title={title} subtitle={subtitle} />
      <EmptyState
        icon="spark"
        title="Coming soon"
        hint={`${phaseLabel} — this module will be wired to live operations data.`}
      />
    </div>
  );
}

export default StaffPlaceholderTab;
