import "../../pages/customer/accountShared.css";

function AccountBackHome({ onNavigateHome, className = "" }) {
  return (
    <button
      type="button"
      className={`account-page__back-home ${className}`.trim()}
      onClick={onNavigateHome}
    >
      ← Back to Home
    </button>
  );
}

export default AccountBackHome;
