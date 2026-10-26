// The subdivision as a 3D grid: one bar per house, Dark Teal for registered entries with
// Sandy Clay visitors stacked on top. Bars ease to their new heights when the window
// changes. Once a house is picked, the others turn translucent. This file pulls in
// three.js, so screens load it lazily.

import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  type ComponentRef,
  type RefObject,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Color, type InstancedMesh, MathUtils, MOUSE, Object3D, TOUCH, Vector3 } from "three";
import { blend, easeOutCubic, type GridHouse, type GridLayout, heightArrays } from "../lib/grid";
import { prefersReducedMotion } from "../lib/motion";

const REGISTERED = "#1e555c";
const VISITORS = "#edb183";
const PLOT = "#d8cfbc";
const NO_VEHICLE = "#f4d8cd";
const BLOCK_PAD = "#e4dccb";
const SITE = "#eee8db";
const SITE_EDGE = "#cfc6b3";
const FADED_OPACITY = 0.22;
const FOOTPRINT = 0.72;
/** How long the bars take to reach new heights, and the camera to fly to a house. */
const BAR_MS = 600;
const FLY_MS = 500;
const Y_AXIS = new Vector3(0, 1, 0);

type Controls = NonNullable<ComponentRef<typeof OrbitControls>>;
type Heights = { registered: Float32Array; visitors: Float32Array };
type View = { target: Vector3; position: Vector3 };

/** What the buttons beside the scene can do to the camera. */
export type GridCamera = {
  /** Multiplies the distance to the target: below 1 zooms in, above 1 zooms out. */
  zoom: (factor: number) => void;
  /** Turns the view around the target. */
  turn: (radians: number) => void;
  /** Flies back to the starting view. */
  reset: () => void;
  /** Flies to centre a house, keeping the viewing angle and distance. */
  flyTo: (col: number, row: number) => void;
};

type Props = {
  layout: GridLayout;
  houses: GridHouse[];
  /** The label shown on hover and on the picked house, by house id. */
  labels: Map<string, string>;
  /** The house the viewer picked. While one is picked, the others turn translucent. */
  selectedId: string | null;
  onSelect: (id: string) => void;
  cameraRef?: React.Ref<GridCamera>;
};

type Label = {
  key: string;
  at: () => readonly [number, number, number];
  text: string;
  className: string;
  anchor: "center" | "above";
};

/**
 * Keeps each DOM label over its 3D position. drei's Html does the same, but it unmounts
 * a React root while rendering, which React 19 logs as an error on every label.
 */
function LabelProjector({
  labels,
  nodes,
}: {
  labels: Label[];
  nodes: RefObject<Map<string, HTMLElement>>;
}) {
  const point = useMemo(() => new Vector3(), []);
  const invalidate = useThree((state) => state.invalidate);
  // The scene only redraws on demand, so ask for a frame when the labels change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `labels` is the trigger
  useEffect(() => invalidate(), [labels, invalidate]);
  useFrame(({ camera, size }) => {
    for (const label of labels) {
      const node = nodes.current.get(label.key);
      if (!node) continue;
      point.set(...label.at()).project(camera);
      const x = (point.x * 0.5 + 0.5) * size.width;
      const y = (-point.y * 0.5 + 0.5) * size.height;
      node.style.visibility = point.z > 1 ? "hidden" : "visible";
      node.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${label.anchor === "above" ? "-100%" : "-50%"})`;
    }
  });
  return null;
}

const dummy = new Object3D();
const tint = new Color();

/** Writes one bar's matrix. A bar that does not belong in this mesh gets scale 0. */
function place(
  mesh: InstancedMesh | null,
  i: number,
  house: GridHouse,
  base: number,
  height: number,
  shown: boolean,
) {
  if (!mesh) return;
  const y = shown && height > 0.001 ? height : 0;
  const footprint = y > 0 ? FOOTPRINT : 0;
  dummy.position.set(house.col + 0.5, base + y / 2, house.row + 0.5);
  dummy.scale.set(footprint, y, footprint);
  dummy.updateMatrix();
  mesh.setMatrixAt(i, dummy.matrix);
}

type BarsProps = {
  houses: GridHouse[];
  /** Where the bars are heading. */
  target: Heights;
  /** Where the bars are now. The labels read it too, so they follow the bars up. */
  now: Heights;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
};

/**
 * The plots and bars, drawn as instanced meshes. When `target` changes, each bar eases
 * from its current height to the new one. The scene only redraws on demand, so the
 * animation asks for another frame until it finishes.
 */
function Bars({ houses, target, now, selectedId, onSelect, onHover }: BarsProps) {
  const invalidate = useThree((state) => state.invalidate);
  const plots = useRef<InstancedMesh>(null);
  const registeredSolid = useRef<InstancedMesh>(null);
  const visitorsSolid = useRef<InstancedMesh>(null);
  const registeredFaded = useRef<InstancedMesh>(null);
  const visitorsFaded = useRef<InstancedMesh>(null);
  const tween = useRef<(Heights & { start: number }) | null>(null);

  // New heights (a different window, or the first load): ease from wherever the bars are.
  useEffect(() => {
    if (prefersReducedMotion()) {
      now.registered.set(target.registered);
      now.visitors.set(target.visitors);
      tween.current = null;
    } else {
      tween.current = {
        registered: now.registered.slice(),
        visitors: now.visitors.slice(),
        start: performance.now(),
      };
    }
    invalidate();
  }, [target, now, invalidate]);

  // Picking or clearing a house changes which bars are translucent.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `selectedId` is the trigger
  useEffect(() => invalidate(), [selectedId, invalidate]);

  useLayoutEffect(() => {
    const mesh = plots.current;
    if (!mesh) return;
    houses.forEach((house, i) => {
      dummy.position.set(house.col + 0.5, 0.025, house.row + 0.5);
      dummy.scale.set(0.9, 0.05, 0.9);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, tint.set(house.hasVehicle ? PLOT : NO_VEHICLE));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    invalidate();
  }, [houses, invalidate]);

  useFrame(() => {
    const run = tween.current;
    if (run) {
      const t = Math.min(1, (performance.now() - run.start) / BAR_MS);
      const k = easeOutCubic(t);
      blend(run.registered, target.registered, k, now.registered);
      blend(run.visitors, target.visitors, k, now.visitors);
      if (t < 1) invalidate();
      else tween.current = null;
    }
    for (let i = 0; i < houses.length; i++) {
      const house = houses[i];
      const faded = selectedId !== null && house.id !== selectedId;
      place(registeredSolid.current, i, house, 0, now.registered[i], !faded);
      place(visitorsSolid.current, i, house, now.registered[i], now.visitors[i], !faded);
      place(registeredFaded.current, i, house, 0, now.registered[i], faded);
      place(visitorsFaded.current, i, house, now.registered[i], now.visitors[i], faded);
    }
    for (const mesh of [registeredSolid, visitorsSolid, registeredFaded, visitorsFaded]) {
      if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
    }
  });

  const idOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => houses[e.instanceId ?? -1]?.id;
  const handlers = {
    onClick: (e: ThreeEvent<MouseEvent>) => {
      const id = idOf(e);
      if (!id) return;
      e.stopPropagation();
      onSelect(id);
    },
    onPointerOver: (e: ThreeEvent<PointerEvent>) => {
      const id = idOf(e);
      if (!id) return;
      e.stopPropagation();
      onHover(id);
    },
    onPointerOut: () => onHover(null),
  };
  const bars = (ref: RefObject<InstancedMesh | null>, color: string, faded: boolean) => (
    <instancedMesh
      ref={ref}
      args={[undefined, undefined, houses.length]}
      frustumCulled={false}
      {...handlers}
    >
      <boxGeometry />
      <meshStandardMaterial
        color={color}
        transparent={faded}
        opacity={faded ? FADED_OPACITY : 1}
        depthWrite={!faded}
      />
    </instancedMesh>
  );

  return (
    <>
      <instancedMesh
        ref={plots}
        args={[undefined, undefined, houses.length]}
        frustumCulled={false}
        {...handlers}
      >
        <boxGeometry />
        <meshStandardMaterial />
      </instancedMesh>
      {bars(registeredSolid, REGISTERED, false)}
      {bars(visitorsSolid, VISITORS, false)}
      {bars(registeredFaded, REGISTERED, true)}
      {bars(visitorsFaded, VISITORS, true)}
    </>
  );
}

/**
 * Moves the camera for the buttons, the keyboard and "fly to this house". Orbit controls
 * handle the mouse and touch. All of this moves the camera and its target together, so
 * the viewing angle only changes when asked.
 */
function CameraRig({
  controls,
  home,
  api,
}: {
  controls: RefObject<Controls | null>;
  home: View;
  api?: React.Ref<GridCamera>;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const gl = useThree((state) => state.gl);
  const flight = useRef<{ from: View; to: View; start: number } | null>(null);

  const camera = useMemo<GridCamera>(() => {
    const fly = (to: View) => {
      const c = controls.current;
      if (!c) return;
      if (prefersReducedMotion()) {
        c.target.copy(to.target);
        c.object.position.copy(to.position);
        c.update();
      } else {
        flight.current = {
          from: { target: c.target.clone(), position: c.object.position.clone() },
          to,
          start: performance.now(),
        };
      }
      invalidate();
    };
    const orbit = (change: (offset: Vector3) => void) => {
      const c = controls.current;
      if (!c) return;
      const offset = c.object.position.clone().sub(c.target);
      change(offset);
      c.object.position.copy(c.target).add(offset);
      c.update();
      invalidate();
    };
    return {
      zoom: (factor) => orbit((offset) => offset.multiplyScalar(factor)),
      turn: (radians) => orbit((offset) => offset.applyAxisAngle(Y_AXIS, radians)),
      reset: () => fly(home),
      flyTo: (col, row) => {
        const c = controls.current;
        if (!c) return;
        const target = new Vector3(col + 0.5, home.target.y, row + 0.5);
        fly({ target, position: target.clone().add(c.object.position).sub(c.target) });
      },
    };
  }, [controls, home, invalidate]);
  useImperativeHandle(api, () => camera, [camera]);

  useFrame(() => {
    const run = flight.current;
    const c = controls.current;
    if (!run || !c) return;
    const t = Math.min(1, (performance.now() - run.start) / FLY_MS);
    const k = easeOutCubic(t);
    c.target.lerpVectors(run.from.target, run.to.target, k);
    c.object.position.lerpVectors(run.from.position, run.to.position, k);
    c.update();
    if (t < 1) invalidate();
    else flight.current = null;
  });

  // Arrow keys pan (orbit controls), plus and minus zoom, brackets turn, Home resets.
  useEffect(() => {
    const el = gl.domElement;
    const c = controls.current;
    el.tabIndex = 0;
    el.setAttribute(
      "aria-label",
      "3D grid. Arrow keys move the view, plus and minus zoom, brackets turn, Home resets.",
    );
    c?.listenToKeyEvents(el);
    // A drag takes over from any flight in progress.
    const stopFlight = () => {
      flight.current = null;
    };
    c?.addEventListener("start", stopFlight);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "+" || e.key === "=") camera.zoom(0.8);
      else if (e.key === "-" || e.key === "_") camera.zoom(1.25);
      else if (e.key === "[") camera.turn(-Math.PI / 8);
      else if (e.key === "]") camera.turn(Math.PI / 8);
      else if (e.key === "Home") camera.reset();
      else return;
      e.preventDefault();
    };
    el.addEventListener("keydown", onKey);
    return () => {
      el.removeEventListener("keydown", onKey);
      c?.removeEventListener("start", stopFlight);
      c?.stopListenToKeyEvents();
    };
  }, [gl, controls, camera]);
  return null;
}

export default function SubdivisionGrid3D({
  layout,
  houses,
  labels,
  selectedId,
  onSelect,
  cameraRef,
}: Props) {
  const { cols, rows } = layout;
  const size = Math.max(cols, rows, 4);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const controls = useRef<Controls>(null);
  const nodes = useRef(new Map<string, HTMLElement>());

  const target = useMemo(() => heightArrays(houses), [houses]);
  // The heights on screen. A new array per house count makes a changed registry rise from zero.
  const now = useMemo<Heights>(
    () => ({
      registered: new Float32Array(houses.length),
      visitors: new Float32Array(houses.length),
    }),
    [houses.length],
  );
  const indexById = useMemo(() => new Map(houses.map((h, i) => [h.id, i])), [houses]);
  const home = useMemo<View>(
    () => ({
      target: new Vector3(cols / 2, 1, rows / 2),
      position: new Vector3(cols / 2 + size * 0.9, size * 0.85, rows / 2 + size * 1.1),
    }),
    [cols, rows, size],
  );

  const hover = (id: string | null) => {
    setHoverId(id);
    document.body.style.cursor = id ? "pointer" : "";
  };
  // Panning moves the camera and its target together, so keep the target over the site.
  const keepOnMap = () => {
    const c = controls.current;
    if (!c) return;
    const before = c.target.clone();
    c.target.x = MathUtils.clamp(c.target.x, -2, cols + 2);
    c.target.z = MathUtils.clamp(c.target.z, -2, rows + 2);
    c.object.position.add(c.target.clone().sub(before));
  };

  const shown = [hoverId, selectedId].filter(
    (id, i, all): id is string => id !== null && all.indexOf(id) === i,
  );
  const topOf = (id: string) => {
    const i = indexById.get(id);
    const house = i === undefined ? undefined : houses[i];
    if (i === undefined || !house) return [0, 0, 0] as const;
    return [house.col + 0.5, now.registered[i] + now.visitors[i] + 0.35, house.row + 0.5] as const;
  };
  const overlay: Label[] = [
    ...layout.blocks.map((b) => ({
      key: `block-${b.block}`,
      at: () => [b.col + b.cols / 2, 0.02, b.row + b.rows + 0.5] as const,
      text: `Block ${b.block}`,
      className: "rounded-full border border-line bg-white px-2.5 py-0.5 font-medium text-ink",
      anchor: "center" as const,
    })),
    ...shown.map((id) => ({
      key: `house-${id}`,
      at: () => topOf(id),
      text: labels.get(id) ?? "",
      className: "rounded-md bg-ink px-2.5 py-1 font-medium text-paper",
      anchor: "above" as const,
    })),
  ];

  return (
    <div className="relative size-full">
      <Canvas
        key={`${cols}x${rows}`}
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ fov: 35, near: 0.1, far: size * 12, position: home.position.toArray() }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[cols, size * 1.2, rows * 1.5]} intensity={1.6} />
        <OrbitControls
          ref={controls}
          makeDefault
          target={home.target.toArray()}
          enableDamping={!prefersReducedMotion()}
          screenSpacePanning={false}
          mouseButtons={{ LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN }}
          touches={{ ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }}
          keyPanSpeed={20}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={size * 0.6}
          maxDistance={size * 3.5}
          onChange={keepOnMap}
        />
        <CameraRig controls={controls} home={home} api={cameraRef} />

        <mesh position={[cols / 2, -0.1, rows / 2]}>
          <boxGeometry args={[cols + 1.2, 0.2, rows + 1.2]} />
          <meshStandardMaterial color={SITE} />
        </mesh>
        <mesh position={[cols / 2, -0.22, rows / 2]}>
          <boxGeometry args={[cols + 1.2, 0.05, rows + 1.2]} />
          <meshStandardMaterial color={SITE_EDGE} />
        </mesh>
        {layout.blocks.map((b) => (
          <mesh key={b.block} position={[b.col + b.cols / 2, 0.005, b.row + b.rows / 2]}>
            <boxGeometry args={[b.cols + 0.44, 0.01, b.rows + 0.44]} />
            <meshStandardMaterial color={BLOCK_PAD} />
          </mesh>
        ))}

        <Bars
          houses={houses}
          target={target}
          now={now}
          selectedId={selectedId}
          onSelect={onSelect}
          onHover={hover}
        />
        <LabelProjector labels={overlay} nodes={nodes} />
      </Canvas>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden text-xs"
      >
        {overlay.map((label) => (
          <span
            key={label.key}
            ref={(node) => {
              if (node) nodes.current.set(label.key, node);
              else nodes.current.delete(label.key);
            }}
            className={`absolute top-0 left-0 whitespace-nowrap ${label.className}`}
            style={{ visibility: "hidden" }}
          >
            {label.text}
          </span>
        ))}
      </div>
    </div>
  );
}
