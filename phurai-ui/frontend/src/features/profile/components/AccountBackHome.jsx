import "@/styles/profile.css";

function AccountBackHome({ onNavigateHome, className = "" }) {
  return (
    <button
      type="button"
      className={className}
      onClick={onNavigateHome}
      aria-label="Go to Home"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
        <polyline points="9 22 9 12 15 12 15 22"></polyline>
      </svg>
    </button>
  );
}

export default AccountBackHome;
