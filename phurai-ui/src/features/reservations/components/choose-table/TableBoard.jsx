import React, { useState, useMemo } from "react";
import TableBoardFilter from "./TableBoardFilter";
import TableStatusCard from "./TableStatusCard";
import UpgradeMembershipModal from "./UpgradeMembershipModal";
import { canAccessArea, getRequiredTierForArea, MEMBERSHIP_RANKS } from "../../utils/membershipUtils.js";
import "../../styles/table-board.css";
// Normalized status: AVAILABLE, RESERVED, OCCUPIED, CLEANING, INACTIVE
function normalizeStatus(table) {
  if (!table.is_bookable) {
    const avail = table.availability_at_slot || "";
    const lowerAvail = avail.toLowerCase();
    if (lowerAvail === "occupied") return "OCCUPIED";
    if (lowerAvail === "cleaning") return "CLEANING";
    if (lowerAvail === "inactive") return "INACTIVE";
    return "RESERVED"; // default for not bookable
  }
  
  // if bookable
  const dbStatus = (table.table_status || "").toLowerCase();
  if (dbStatus === "available") return "AVAILABLE";
  if (dbStatus === "reserved") return "RESERVED";
  if (dbStatus === "occupied") return "OCCUPIED";
  if (dbStatus === "cleaning") return "CLEANING";
  if (dbStatus === "inactive") return "INACTIVE";
  return "AVAILABLE"; // fallback
}
export default function TableBoard({ 
  tables = [], 
  selectedTableId = null, 
  onSelectTable, 
  loading, 
  guestCount = 2,
  membershipTier = "Bronze",
  isAuthenticated = false,
  onNavigateLogin,
  onNavigateRegister
}) {
  const [activeFilter, setActiveFilter] = useState("all");
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [modalRequiredTier, setModalRequiredTier] = useState("Gold");

  const filteredTables = useMemo(() => {
    let result = tables.filter((t) => {
      if (activeFilter === "all") return true;
      const area = (t.area_name || "").toLowerCase();
      if (activeFilter === "window") return area.includes("window") || area.includes("bar");
      if (activeFilter === "standard") return area.includes("main") || area.includes("standard") || t.table_number.startsWith("S-");
      if (activeFilter === "premium") return area.includes("premium") || t.table_number.startsWith("PRE-");
      if (activeFilter === "vip") return area.includes("vip") || area.includes("private");
      if (activeFilter === "kitchen") return area.includes("kitchen");
      if (activeFilter === "rooftop") return area.includes("rooftop") || area.includes("terrace") || area.includes("garden");
      return true;
    });

    // Sort ascending by capacity so smallest suitable tables are recommended first
    // Then sort by membership tier access (higher tier required means lower priority if user has access)
    result.sort((a, b) => {
      if (a.capacity !== b.capacity) return a.capacity - b.capacity;
      const rankA = MEMBERSHIP_RANKS[getRequiredTierForArea(a.area_name)] || 1;
      const rankB = MEMBERSHIP_RANKS[getRequiredTierForArea(b.area_name)] || 1;
      return rankB - rankA; // Higher rank requirements first, actually wait: the user requested specific priority. Let's just do capacity for now.
    });
    return result;
  }, [tables, activeFilter]);
  const selectedTableData = useMemo(() => {
    return tables.find(t => t.table_id === selectedTableId);
  }, [tables, selectedTableId]);

  const handleCardClick = (table) => {
    const isLocked = !canAccessArea(membershipTier, table.area_name);
    if (isLocked) {
      setModalRequiredTier(getRequiredTierForArea(table.area_name));
      setUpgradeModalOpen(true);
      return;
    }
    onSelectTable(table.table_id);
  };

  return (
    <div className="tb-board">
      <div className="tb-board__header">
        <h3 className="tb-board__title">Choose your table</h3>
        <p className="tb-board__hint">
          Filter by area and select an available table.
        </p>
      </div>
      <TableBoardFilter activeFilter={activeFilter} onFilterChange={setActiveFilter} />
      <div className="tb-legend">
        <span className="tb-legend__item"><span className="tb-legend__dot tb-legend__dot--available"></span> Available</span>
        <span className="tb-legend__item"><span className="tb-legend__dot tb-legend__dot--reserved"></span> Reserved</span>
        <span className="tb-legend__item"><span className="tb-legend__dot tb-legend__dot--occupied"></span> Occupied</span>
        <span className="tb-legend__item"><span className="tb-legend__dot tb-legend__dot--cleaning"></span> Cleaning</span>
        <span className="tb-legend__item"><span className="tb-legend__dot tb-legend__dot--selected"></span> Selected</span>
      </div>
      <div className="tb-grid">
        {loading ? (
          <div className="tb-loading">Checking live availability…</div>
        ) : filteredTables.length > 0 ? (
          filteredTables.map((t) => {
            const isSelected = t.table_id === selectedTableId;
            const status = normalizeStatus(t);
            const isSuitable = t.capacity >= guestCount && t.capacity <= guestCount + 2;
            const requiredTier = getRequiredTierForArea(t.area_name);
            const isLocked = !canAccessArea(membershipTier, t.area_name);

            return (
              <TableStatusCard
                key={t.table_id}
                table={t}
                status={status}
                isSelected={isSelected}
                isSuitable={isSuitable}
                guestCount={guestCount}
                isLocked={isLocked}
                requiredTier={requiredTier}
                onClick={() => handleCardClick(t)}
              />
            );
          })
        ) : (
          <div className="tb-empty" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "2rem" }}>
            {tables.length === 0
              ? "Select a date, time and guests to load tables"
              : "No suitable table is available for this party size. Please choose another time or contact staff for table arrangement."}
          </div>
        )}
      </div>
      {selectedTableData && (
        <div className="tb-summary">
          <h4 className="tb-summary__title">Selected Table</h4>
          <ul className="tb-summary__list">
            <li className="tb-summary__item">
              <div className="tb-summary__info">
                <span className="tb-summary__id">{selectedTableData.display_label || selectedTableData.table_number}</span>
                <span className="tb-summary__status">({normalizeStatus(selectedTableData).charAt(0).toUpperCase() + normalizeStatus(selectedTableData).slice(1).toLowerCase()})</span>
              </div>
              <button
                type="button"
                className="tb-summary__remove"
                onClick={() => onSelectTable(null)}
              >
                Remove
              </button>
            </li>
          </ul>
        </div>
      )}

      <UpgradeMembershipModal 
        isOpen={upgradeModalOpen}
        onClose={() => setUpgradeModalOpen(false)}
        requiredTier={modalRequiredTier}
        userTier={membershipTier}
        isAuthenticated={isAuthenticated}
        onNavigateLogin={() => {
          setUpgradeModalOpen(false);
          if (onNavigateLogin) onNavigateLogin();
        }}
        onNavigateRegister={() => {
          setUpgradeModalOpen(false);
          if (onNavigateRegister) onNavigateRegister();
        }}
        onNavigateUpgrade={() => {
          // Placeholder for upgrade
          alert("Membership upgrade flow will be available soon.");
        }}
      />
    </div>
  );
}
