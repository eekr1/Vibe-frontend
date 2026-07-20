import { useEffect, useState } from "react";
import { mergeClassNames } from "./utils";

export type AvatarSize = "presence" | "small" | "default" | "large" | "profile";
export type AvatarPresence = "online";

function getInitials(displayName: string) {
  return displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "V";
}

export type AvatarProps = {
  className?: string;
  decorative?: boolean;
  displayName: string;
  fallback?: string;
  presence?: AvatarPresence;
  size?: AvatarSize;
  src?: string | null;
};

export function Avatar({
  className,
  decorative = true,
  displayName,
  fallback,
  presence,
  size = "default",
  src
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [src]);
  const showImage = Boolean(src && !imageFailed);

  return (
    <span
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${displayName}'s avatar`}
      className={mergeClassNames("ui-avatar", `ui-avatar--${size}`, presence && "has-presence", className)}
      role={decorative ? undefined : "img"}
    >
      {showImage ? <img alt="" onError={() => setImageFailed(true)} src={src ?? undefined} /> : <span className="ui-avatar__fallback">{fallback || getInitials(displayName)}</span>}
      {presence ? <span className="ui-avatar__presence"><span className="visually-hidden">Online</span></span> : null}
    </span>
  );
}
