import { useState } from "react";

function SystemAvatarOption({ path, isActive, disabled, onSelect }) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return null;
  }

  return (
    <button
      type="button"
      className={`profile-edit__avatar-choice${isActive ? " profile-edit__avatar-choice--active" : ""}`}
      onClick={() => onSelect(path)}
      disabled={disabled}
      aria-label={`Select avatar ${path}`}
    >
      <img src={path} alt="" onError={() => setBroken(true)} />
    </button>
  );
}

export default SystemAvatarOption;
