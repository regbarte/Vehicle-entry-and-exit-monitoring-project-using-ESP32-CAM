import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "./ui";

type Props = { photo: Blob | null; onChange: (photo: Blob | null) => void };

/** Takes the ID photo with the laptop webcam. getUserMedia needs a secure
 * context, so the dashboard runs at localhost on the guardhouse laptop. */
export function WebcamCapture({ photo, onChange }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const stop = useCallback(() => {
    for (const track of stream.current?.getTracks() ?? []) track.stop();
    stream.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
      });
      if (video.current) video.current.srcObject = stream.current;
    } catch {
      setError("The webcam is not available. Allow camera access, or save without an ID photo.");
    }
  }, []);

  useEffect(() => {
    if (!photo) start();
    return stop;
  }, [photo, start, stop]);

  useEffect(() => {
    if (!photo) return setPreview(null);
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const take = () => {
    const el = video.current;
    if (!el?.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = el.videoWidth;
    canvas.height = el.videoHeight;
    canvas.getContext("2d")?.drawImage(el, 0, 0);
    canvas.toBlob((blob) => blob && onChange(blob), "image/jpeg", 0.85);
  };

  return (
    <div className="flex max-w-sm flex-col gap-2">
      <div className="aspect-video overflow-hidden rounded-md bg-ink">
        {preview ? (
          <img
            src={preview}
            alt="The visitor's ID, as captured"
            className="size-full object-contain"
          />
        ) : error ? (
          <p className="flex size-full items-center justify-center px-6 text-center text-sm text-almond/80">
            {error}
          </p>
        ) : (
          <video ref={video} autoPlay playsInline muted className="size-full object-cover" />
        )}
      </div>
      {photo ? (
        <Button variant="quiet" onClick={() => onChange(null)}>
          Retake ID photo
        </Button>
      ) : (
        <Button onClick={take} disabled={!!error}>
          Take ID photo
        </Button>
      )}
    </div>
  );
}
