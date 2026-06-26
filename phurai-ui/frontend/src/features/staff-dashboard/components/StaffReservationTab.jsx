import ReservationManagement from "./ReservationManagement.jsx";
import "../styles/staff-table-tab.css";

function StaffReservationTab({ user, toast, refreshKey }) {
  return (
    <div className="staff-reservation-tab">
      <ReservationManagement user={user} toast={toast} refreshKey={refreshKey} />
    </div>
  );
}

export default StaffReservationTab;
