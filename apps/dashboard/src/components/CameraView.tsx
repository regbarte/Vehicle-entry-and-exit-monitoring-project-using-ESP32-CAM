import { useEffect, useState } from "react";
import { useCameraStatus } from "../api/queries";

const REFRESH_MS = 1000;

/** The live view: the server's camera preview, reloaded about once a second.
 * The next frame is requested only after the last one loaded, so a slow camera
 * never piles up requests. */
export function CameraView({ sid }: { sid: string }) {
  const camera = useCameraStatus(sid);
  const online = camera.data?.online ?? false;
  const [tick, setTick] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!online) return;
    setFailed(false);
  }, [online]);

  const scheduleNext = () => window.setTimeout(() => setTick((t) => t + 1), REFRESH_MS);

  return (
    <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-ink">
      {online && !failed ? (
        <img
          src={`/api/subdivisions/${sid}/camera/preview?frame=${tick}`}
          alt="Live view from the gate camera"
          className="size-full object-cover"
          onLoad={scheduleNext}
          onError={() => {
            setFailed(true);
            scheduleNext();
          }}
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 text-almond/80">
          <span className="font-medium">
            {camera.isPending ? "Connecting to the camera…" : "Camera offline"}
          </span>
          {!camera.isPending && (
            <span className="text-xs text-almond/60">
              Check that the ESP32-CAM is powered and on the laptop's hotspot.
            </span>
          )}
        </div>
      )}
    </div>
  );
}
