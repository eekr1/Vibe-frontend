import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ActionFeedback, InlineError } from "../components/feedback";
import { Button } from "../components/ui";
import { safeErrorText } from "../lib/errorMapping";
import { removeManagedAvatar, uploadManagedAvatar, type ProfileAvatar } from "./profileApi";
import { ProfileAvatarView } from "./ProfileIdentityCard";

type LoadedImage = { file: File; height: number; image: HTMLImageElement; url: string; width: number };

export function AvatarCropper({ avatar, disabled, displayName, onChanged }: { avatar: ProfileAvatar; disabled: boolean; displayName: string; onChanged: (avatar: ProfileAvatar) => Promise<void> | void }) {
  const [loaded, setLoaded] = useState<LoadedImage | null>(null);
  const [cropSize, setCropSize] = useState(1);
  const [cropX, setCropX] = useState(0);
  const [cropY, setCropY] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<"idle" | "uploading" | "success" | "removing">("idle");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => () => { if (loaded) URL.revokeObjectURL(loaded.url); }, [loaded]);

  useEffect(() => {
    if (!loaded || !canvasRef.current) return;
    const context = canvasRef.current.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, 240, 240);
    context.drawImage(loaded.image, cropX, cropY, cropSize, cropSize, 0, 0, 240, 240);
  }, [cropSize, cropX, cropY, loaded]);

  useEffect(() => {
    if (status === "success") statusRef.current?.focus();
  }, [status]);

  function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setError(null);
    setStatus("idle");
    if (!file) return;
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type)) || file.size > 5 * 1024 * 1024) {
      setError("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      event.target.value = "";
      return;
    }
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (loaded) URL.revokeObjectURL(loaded.url);
      const size = Math.min(image.naturalWidth, image.naturalHeight);
      setLoaded({ file, height: image.naturalHeight, image, url, width: image.naturalWidth });
      setCropSize(size);
      setCropX(Math.floor((image.naturalWidth - size) / 2));
      setCropY(Math.floor((image.naturalHeight - size) / 2));
    };
    image.onerror = () => { URL.revokeObjectURL(url); setError("This image could not be decoded."); };
    image.src = url;
  }

  function updateSize(value: number) {
    if (!loaded) return;
    const size = Math.max(1, Math.min(value, Math.min(loaded.width, loaded.height)));
    setCropSize(size);
    setCropX((current) => Math.min(current, loaded.width - size));
    setCropY((current) => Math.min(current, loaded.height - size));
  }

  async function upload() {
    if (!loaded) return;
    setError(null);
    setProgress(0);
    setStatus("uploading");
    try {
      const data = await uploadManagedAvatar({ cropSize, cropX, cropY, file: loaded.file }, setProgress);
      await onChanged(data.avatar);
      setStatus("success");
      setLoaded(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (caught) {
      setStatus("idle");
      setError(safeErrorText(caught, "Avatar upload failed. Try again."));
    }
  }

  async function remove() {
    setError(null);
    setStatus("removing");
    try {
      const data = await removeManagedAvatar();
      await onChanged(data.avatar);
      setStatus("success");
    } catch (caught) {
      setStatus("idle");
      setError(safeErrorText(caught, "Avatar removal failed. Try again."));
    }
  }

  const minimumSize = loaded ? Math.max(1, Math.floor(Math.min(loaded.width, loaded.height) / 4)) : 1;
  const busy = status === "uploading" || status === "removing";

  return (
    <section className="avatar-manager" aria-labelledby="avatar-manager-title">
      <div className="settings-section-heading">
        <div><p className="eyebrow">Managed avatar</p><h3 id="avatar-manager-title">Choose and crop an image</h3></div>
        <ProfileAvatarView avatar={avatar} displayName={displayName} size="small" />
      </div>
      <p className="field-hint">JPEG, PNG, or WebP up to 5 MB. Vibehall strips metadata and publishes only processed square variants.</p>
      <label className="file-picker">
        Image from this device
        <input ref={inputRef} accept="image/jpeg,image/png,image/webp" disabled={disabled || busy} onChange={selectFile} type="file" />
      </label>
      {loaded ? (
        <div className="avatar-crop-layout">
          <canvas aria-label="Square avatar crop preview" className="avatar-crop-preview" height="240" ref={canvasRef} role="img" width="240" />
          <div className="avatar-crop-controls">
            <label>Crop size <input aria-describedby="crop-keyboard-hint" max={Math.min(loaded.width, loaded.height)} min={minimumSize} onChange={(event) => updateSize(Number(event.target.value))} type="range" value={cropSize} /></label>
            <label>Horizontal position <input max={Math.max(0, loaded.width - cropSize)} min="0" onChange={(event) => setCropX(Number(event.target.value))} type="range" value={cropX} /></label>
            <label>Vertical position <input max={Math.max(0, loaded.height - cropSize)} min="0" onChange={(event) => setCropY(Number(event.target.value))} type="range" value={cropY} /></label>
            <p className="field-hint" id="crop-keyboard-hint">Use arrow keys on each slider for precise crop control.</p>
            <div className="action-row"><button className="primary-action" disabled={busy} onClick={() => void upload()} type="button">{status === "uploading" ? (progress >= 100 ? "Processing…" : `Uploading ${progress}%`) : "Upload avatar"}</button><button className="text-action" disabled={busy} onClick={() => { setLoaded(null); if (inputRef.current) inputRef.current.value = ""; }} type="button">Cancel</button></div>
          </div>
        </div>
      ) : null}
      {status === "uploading" ? <progress aria-label="Avatar upload progress" max="100" value={progress}>{progress}%</progress> : null}
      {avatar.kind === "managed" && !loaded ? <button className="text-action" disabled={disabled || busy} onClick={() => inputRef.current?.focus()} type="button">Replace avatar</button> : null}
      {avatar.kind === "managed" && !loaded ? <button className="text-action avatar-remove-action" disabled={disabled || busy} onClick={() => void remove()} type="button">{status === "removing" ? "Removing…" : "Remove avatar"}</button> : null}
      {error ? <InlineError action={<Button disabled={!loaded || busy} onClick={() => void upload()} size="small" variant="text">Retry</Button>} description={error} /> : null}
      {status === "success" ? <div ref={statusRef} tabIndex={-1}><ActionFeedback tone="success">Avatar updated. Room and profile identity will use the new version.</ActionFeedback></div> : null}
    </section>
  );
}
