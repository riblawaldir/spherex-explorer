import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  History,
  LocateFixed,
  Pause,
  Play,
  Plus,
  SkipBack,
  SkipForward,
  Minus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimulatedBadge } from "@/components/layout/Header";
import type { Observation } from "@/types/observation";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";

const playbackSpeeds = [0.5, 1, 2, 4];
const blinkIntervalMs = 500;
const dateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

export interface TemporalViewerSlotProps {
  observations: Observation[];
  isSimulated?: boolean;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

function timestamp(value: string | null | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatDate(value: string | null | undefined): string {
  const parsed = timestamp(value);
  return parsed === undefined ? "Date not available" : `${dateFormatter.format(parsed)} UTC`;
}

function hasPreviewUrl(value: string | null | undefined): value is string {
  if (!value?.trim()) return false;
  try {
    const url = new URL(value.trim(), "https://spherex-explorer.local");
    return ["http:", "https:", "blob:", "data:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function sortObservations(observations: Observation[]): Observation[] {
  return observations
    .map((observation, originalIndex) => ({
      observation,
      originalIndex,
      observedAt: timestamp(observation.observed_at),
    }))
    .sort((left, right) => {
      if (left.observedAt === undefined && right.observedAt === undefined) {
        return left.originalIndex - right.originalIndex;
      }
      if (left.observedAt === undefined) return 1;
      if (right.observedAt === undefined) return -1;
      return left.observedAt - right.observedAt || left.originalIndex - right.originalIndex;
    })
    .map(({ observation }) => observation);
}

export function TemporalViewerSlot({
  observations,
  isSimulated = false,
  selectedId,
  onSelect,
}: TemporalViewerSlotProps) {
  const sortedObservations = useMemo(() => sortObservations(observations), [observations]);
  const blinkOptions = useMemo(
    () => sortedObservations.filter((observation) => hasPreviewUrl(observation.preview_url)),
    [sortedObservations],
  );
  const [activeId, setActiveId] = useState<string | undefined>(
    selectedId ?? sortedObservations[0]?.id,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isBlinking, setIsBlinking] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [blinkSecondId, setBlinkSecondId] = useState<string | undefined>(
    blinkOptions[1]?.id,
  );
  const [blinkFrame, setBlinkFrame] = useState(0);
  const [failedPreviewKey, setFailedPreviewKey] = useState<string | undefined>();
  const [loadedPreviewKeys, setLoadedPreviewKeys] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (sortedObservations.length === 0) {
      setActiveId(undefined);
      setIsPlaying(false);
      setIsBlinking(false);
      setBlinkSecondId(undefined);
      return;
    }

    setActiveId((currentId) => {
      if (selectedId && sortedObservations.some(({ id }) => id === selectedId)) {
        return selectedId;
      }
      return currentId && sortedObservations.some(({ id }) => id === currentId)
        ? currentId
        : sortedObservations[0].id;
    });

    setBlinkSecondId((currentId) => {
      if (currentId && blinkOptions.some(({ id }) => id === currentId)) return currentId;
      return blinkOptions[1]?.id;
    });

    if (sortedObservations.length < 2) setIsPlaying(false);
    if (blinkOptions.length < 2) setIsBlinking(false);
  }, [blinkOptions, selectedId, sortedObservations]);

  useEffect(() => {
    if (!isPlaying || sortedObservations.length < 2) return;

    const interval = window.setInterval(() => {
      const currentIndex = sortedObservations.findIndex(({ id }) => id === activeId);
      const nextIndex =
        currentIndex < 0 ? 0 : (currentIndex + 1) % sortedObservations.length;
      const nextId = sortedObservations[nextIndex]?.id;
      if (nextId) {
        setActiveId(nextId);
        onSelect?.(nextId);
      }
    }, 1000 / playbackSpeed);

    return () => window.clearInterval(interval);
  }, [activeId, isPlaying, onSelect, playbackSpeed, sortedObservations]);

  const activeIndex = sortedObservations.findIndex(({ id }) => id === activeId);
  const activeObservation = activeIndex >= 0 ? sortedObservations[activeIndex] : undefined;
  const otherBlinkOptions = blinkOptions.filter(({ id }) => id !== activeObservation?.id);
  const blinkSecondObservation =
    otherBlinkOptions.find(({ id }) => id === blinkSecondId) ?? otherBlinkOptions[0];
  const displayedObservation =
    isBlinking && blinkFrame === 1 && blinkSecondObservation
      ? blinkSecondObservation
      : activeObservation;
  const previewKey = displayedObservation
    ? `${displayedObservation.id}:${displayedObservation.preview_url ?? ""}`
    : undefined;
  const hasDisplayedPreview = hasPreviewUrl(displayedObservation?.preview_url);
  const imageFailed = previewKey !== undefined && failedPreviewKey === previewKey;
  const isPreviewLoading =
    previewKey !== undefined &&
    hasDisplayedPreview &&
    !imageFailed &&
    !loadedPreviewKeys.has(previewKey);

  useEffect(() => {
    if (isBlinking && (!hasPreviewUrl(activeObservation?.preview_url) || !blinkSecondObservation)) {
      setIsBlinking(false);
    }
  }, [activeObservation, blinkSecondObservation, isBlinking]);

  function selectObservation(index: number) {
    const observation = sortedObservations[index];
    if (!observation) return;
    setActiveId(observation.id);
    onSelect?.(observation.id);
    setBlinkFrame(0);
    if (isBlinking && !hasPreviewUrl(observation.preview_url)) setIsBlinking(false);
  }

  function step(direction: -1 | 1) {
    if (sortedObservations.length < 2) return;
    const currentIndex = activeIndex >= 0 ? activeIndex : 0;
    selectObservation(
      (currentIndex + direction + sortedObservations.length) % sortedObservations.length,
    );
  }

  function togglePlayback() {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    if (sortedObservations.length < 2) return;
    setIsBlinking(false);
    setIsPlaying(true);
  }

  function toggleBlink() {
    if (isBlinking) {
      setIsBlinking(false);
      return;
    }
    if (blinkOptions.length < 2) return;

    const first = blinkOptions.find(({ id }) => id === activeObservation?.id) ?? blinkOptions[0];
    const second = blinkOptions.find(({ id }) => id !== first.id);
    if (!first || !second) return;

    if (activeObservation?.id !== first.id) {
      setActiveId(first.id);
      onSelect?.(first.id);
    }
    setBlinkSecondId(second.id);
    setBlinkFrame(0);
    setIsPlaying(false);
    setIsBlinking(true);
  }

  useEffect(() => {
    if (!isBlinking || !activeObservation || !blinkSecondObservation) return;
    const interval = window.setInterval(() => setBlinkFrame((frame) => (frame === 0 ? 1 : 0)), blinkIntervalMs);
    return () => window.clearInterval(interval);
  }, [activeObservation, blinkSecondObservation, isBlinking]);

  const count = sortedObservations.length;

  return (
    <>
      <section className="glass-panel temporal-slot" aria-label="Temporal observation viewer">
        <div className="flex items-center justify-between gap-3">
          <h2 className="panel-heading">
            <History />
            Temporal viewer
          </h2>
          {isSimulated && <SimulatedBadge />}
        </div>

        <div className="temporal-image relative overflow-hidden">
          {displayedObservation && hasDisplayedPreview && !imageFailed ? (
            <>
              <TransformWrapper
                key={activeObservation?.id ?? "no-active-observation"}
                minScale={1}
                maxScale={8}
                initialScale={1}
                wheel={{ step: 0.1 }}
                panning={{ excluded: ["button"] }}
                onInit={(ref) => setZoomScale(ref.state.scale)}
                onTransform={(_, state) => setZoomScale(state.scale)}
              >
                {({ zoomIn, zoomOut, resetTransform }) => (
                  <>
                    <TransformComponent
                      wrapperStyle={{ width: "100%", height: "100%" }}
                      contentStyle={{
                        width: "100%",
                        height: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        key={previewKey}
                        src={displayedObservation.preview_url ?? undefined}
                        alt={`Preview of ${displayedObservation.id}, ${formatDate(displayedObservation.observed_at)}`}
                        className="max-h-full max-w-full object-contain"
                        onError={() => setFailedPreviewKey(previewKey)}
                        onLoad={() => {
                          setFailedPreviewKey((failed) => (failed === previewKey ? undefined : failed));
                          if (previewKey) {
                            setLoadedPreviewKeys((loaded) => new Set(loaded).add(previewKey));
                          }
                        }}
                      />
                    </TransformComponent>
                    {isPreviewLoading && (
                      <div
                        className="absolute inset-0 z-10 grid place-items-center bg-black/30 text-sm text-white"
                        role="status"
                        aria-live="polite"
                      >
                        Loading preview…
                      </div>
                    )}
                    <div className="absolute left-3 top-3 flex items-center gap-1 rounded bg-black/70 p-1 text-white">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
                        aria-label="Zoom in on image"
                        title="Zoom in on image"
                        disabled={zoomScale >= 8}
                        onClick={() => zoomIn()}
                      >
                        <Plus size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
                        aria-label="Zoom out of image"
                        title="Zoom out of image"
                        disabled={zoomScale <= 1}
                        onClick={() => zoomOut()}
                      >
                        <Minus size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-white hover:bg-white/20 hover:text-white"
                        aria-label="Center image"
                        title="Center image"
                        onClick={() => resetTransform()}
                      >
                        <LocateFixed size={14} />
                      </Button>
                      <span className="scientific min-w-9 pr-1 text-right text-xs" aria-live="polite">
                        {zoomScale.toFixed(1)}×
                      </span>
                    </div>
                  </>
                )}
              </TransformWrapper>
              <div className="scientific absolute bottom-3 left-3 rounded bg-black/70 px-3 py-2 text-left text-sm leading-5 text-white">
                <div>{formatDate(displayedObservation.observed_at)}</div>
                <div className="mt-1 opacity-80">
                  {displayedObservation.band} · {displayedObservation.collection}
                </div>
              </div>
              {isBlinking && (
                <span className="absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-xs text-white">
                  Blink · {blinkFrame === 0 ? "A" : "B"}
                </span>
              )}
            </>
          ) : (
            <div className="px-5 text-center" role="status">
              <History size={28} className="mx-auto mb-4 opacity-40" />
              {count === 0
                ? "No observations to show."
                : !hasDisplayedPreview
                  ? "This observation has no image URL available."
                  : "The preview for this observation could not be loaded."}
            </div>
          )}
        </div>

        <div className="h-px bg-border mb-5" />

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Previous"
              title="Previous"
              disabled={count < 2}
              onClick={() => step(-1)}
            >
              <SkipBack />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Play"
              title="Play"
              aria-pressed={isPlaying}
              disabled={count < 2 || isPlaying || isBlinking}
              onClick={togglePlayback}
            >
              <Play />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Pause"
              title="Pause"
              aria-pressed={isPlaying}
              disabled={!isPlaying}
              onClick={() => setIsPlaying(false)}
            >
              <Pause />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Next"
              title="Next"
              disabled={count < 2}
              onClick={() => step(1)}
            >
              <SkipForward />
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="temporal-playback-speed">
              Playback speed
            </label>
            <select
              id="temporal-playback-speed"
              aria-label="Playback speed"
              className="field w-20"
              value={playbackSpeed}
              disabled={count < 2}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
            >
              {playbackSpeeds.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}×
                </option>
              ))}
            </select>
            {isBlinking && otherBlinkOptions.length > 0 && (
              <>
                <label className="sr-only" htmlFor="temporal-blink-second">
                  Second Blink observation
                </label>
                <select
                  id="temporal-blink-second"
                  aria-label="Second Blink observation"
                  className="field max-w-48"
                  value={blinkSecondObservation?.id ?? ""}
                  onChange={(event) => {
                    setBlinkSecondId(event.target.value);
                    setBlinkFrame(0);
                  }}
                >
                  {otherBlinkOptions.map((observation) => (
                    <option key={observation.id} value={observation.id}>
                      {formatDate(observation.observed_at)} · {observation.band}
                    </option>
                  ))}
                </select>
              </>
            )}
            <Button
              variant={isBlinking ? "secondary" : "outline"}
              aria-pressed={isBlinking}
              disabled={blinkOptions.length < 2}
              onClick={toggleBlink}
            >
              {isBlinking ? "Stop Blink" : "Blink mode"}
            </Button>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className="min-w-32 text-xs text-muted-foreground" aria-live="polite">
            {activeObservation ? formatDate(activeObservation.observed_at) : "No observations"}
          </span>
          <input
            type="range"
            min={0}
            max={Math.max(count - 1, 0)}
            step={1}
            value={Math.max(activeIndex, 0)}
            disabled={count < 2}
            aria-label="Observation timeline"
            aria-valuetext={activeObservation ? formatDate(activeObservation.observed_at) : "No observations"}
            className="w-full accent-primary disabled:opacity-40"
            onChange={(event) => selectObservation(Number(event.target.value))}
          />
          <span className="min-w-12 text-right text-xs text-muted-foreground" aria-live="polite">
            {count === 0 ? "0 / 0" : `${Math.max(activeIndex, 0) + 1} / ${count}`}
          </span>
        </div>

        <p className="text-muted-foreground text-xs mt-4">
          {count}{isSimulated ? " simulated" : ""} observation{count === 1 ? "" : "s"}
          {activeObservation ? ` · ${activeObservation.id}` : ""}
        </p>
      </section>
      <div className="warning-banner">
        <AlertTriangle size={18} className="shrink-0" />
        A difference between images is not an astronomical finding without scientific validation.
      </div>
    </>
  );
}
