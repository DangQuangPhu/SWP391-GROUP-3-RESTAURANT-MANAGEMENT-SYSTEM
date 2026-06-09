import { useEffect, useState } from "react";
import { getAvatarInitial, getAvatarSrc, resolveAvatarUrl } from "@/utils/avatarUtils";

function UserAvatar({ user, className = "", imgClassName = "", size = "md" }) {
  const [broken, setBroken] = useState(false);
  const rawSrc = getAvatarSrc(user);
  const src = resolveAvatarUrl(rawSrc);
  const initial = getAvatarInitial(user);
  const showImage = Boolean(src) && !broken;

  useEffect(() => {
    setBroken(false);
  }, [src]);

  const sizeClass =
    size === "sm"
      ? "user-avatar--sm"
      : size === "lg"
      ? "user-avatar--lg"
      : "user-avatar--md";

  return (
    <span className={`user-avatar ${sizeClass} ${className}`.trim()} aria-hidden="true">
      {showImage ? (
        <img
          src={src}
          alt=""
          className={`user-avatar__img ${imgClassName}`.trim()}
          onError={() => setBroken(true)}
        />
      ) : (
        <span className={`user-avatar__initial ${imgClassName}`.trim()}>{initial}</span>
      )}
    </span>
  );
}

export default UserAvatar;
