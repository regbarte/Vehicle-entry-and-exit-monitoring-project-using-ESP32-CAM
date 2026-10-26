// The subdivision as a 3D grid: one bar per house, Dark Teal for registered entries with
// Sandy Clay visitors stacked on top. Once a house is picked, the others turn
// translucent. This file pulls in three.js, so screens load it lazily.

import { Instance, Instances, OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { type RefObject, useEffect, useMemo, useRef, useState } from "react";
import { Vector3 } from "three";
import { barHeights, type GridHouse, type GridLayout } from "../lib/grid";

const REGISTERED = "#1e555c";
const VISITORS = "#edb183";
const PLOT = "#d8cfbc";
const NO_VEHICLE = "#f4d8cd";
const BLOCK_PAD = "#e4dccb";
const SITE = "#eee8db";
const SITE_EDGE = "#cfc6b3";
const FADED_OPACITY = 0.22;
const FOOTPRINT = 0.72;

type Props = {
  layout: GridLayout;
  houses: GridHouse[];
  /** The label shown on hover and on the picked house, by house id. */
  labels: Map<string, string>;
  /** The house the viewer picked. While one is picked, the others turn translucent. */
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

type Label = {
  key: string;
  at: readonly [number, number, number];
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
      point.set(...label.at).project(camera);
      const x = (point.x * 0.5 + 0.5) * size.width;
      const y = (-point.y * 0.5 + 0.5) * size.height;
      node.style.visibility = point.z > 1 ? "hidden" : "visible";
      node.style.transform = `translate(${x}px, ${y}px) translate(-50%, ${label.anchor === "above" ? "-100%" : "-50%"})`;
    }
  });
  return null;
}

export default function SubdivisionGrid3D({ layout, houses, labels, selectedId, onSelect }: Props) {
  const { cols, rows } = layout;
  const size = Math.max(cols, rows, 4);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const height = useMemo(() => barHeights(houses), [houses]);

  const bars = houses.map((house) => {
    const h = height(house);
    return { house, ...h, top: h.registered + h.visitors };
  });
  const faded = (id: string) => selectedId !== null && id !== selectedId;
  const anchor = (id: string) => {
    const bar = bars.find((b) => b.house.id === id);
    return bar && ([bar.house.col + 0.5, bar.top + 0.35, bar.house.row + 0.5] as const);
  };
  const hover = (id: string | null) => {
    setHoverId(id);
    document.body.style.cursor = id ? "pointer" : "";
  };

  const group = (kind: "registered" | "visitors", fade: boolean) => {
    const items = bars.filter((b) => b[kind] > 0 && faded(b.house.id) === fade);
    return (
      <Instances
        key={`${kind}-${fade}-${houses.length}`}
        limit={Math.max(houses.length, 1)}
        frustumCulled={false}
      >
        <boxGeometry />
        <meshStandardMaterial
          color={kind === "registered" ? REGISTERED : VISITORS}
          transparent={fade}
          opacity={fade ? FADED_OPACITY : 1}
          depthWrite={!fade}
        />
        {items.map((b) => {
          const base = kind === "registered" ? 0 : b.registered;
          return (
            <Instance
              key={b.house.id}
              position={[b.house.col + 0.5, base + b[kind] / 2, b.house.row + 0.5]}
              scale={[FOOTPRINT, b[kind], FOOTPRINT]}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(b.house.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                hover(b.house.id);
              }}
              onPointerOut={() => hover(null)}
            />
          );
        })}
      </Instances>
    );
  };

  const shown = [hoverId, selectedId].filter(
    (id, i, all): id is string => id !== null && all.indexOf(id) === i,
  );
  const nodes = useRef(new Map<string, HTMLElement>());
  const overlay: Label[] = [
    ...layout.blocks.map((b) => ({
      key: `block-${b.block}`,
      at: [b.col + b.cols / 2, 0.02, b.row + b.rows + 0.5] as const,
      text: `Block ${b.block}`,
      className: "rounded-full border border-line bg-white px-2.5 py-0.5 font-medium text-ink",
      anchor: "center" as const,
    })),
    ...shown.flatMap((id) => {
      const at = anchor(id);
      return at
        ? [
            {
              key: `house-${id}`,
              at,
              text: labels.get(id) ?? "",
              className: "rounded-md bg-ink px-2.5 py-1 font-medium text-paper",
              anchor: "above" as const,
            },
          ]
        : [];
    }),
  ];

  return (
    <div className="relative size-full">
      <Canvas
        key={`${cols}x${rows}`}
        frameloop="demand"
        dpr={[1, 2]}
        camera={{
          fov: 35,
          near: 0.1,
          far: size * 12,
          position: [cols / 2 + size * 0.9, size * 0.85, rows / 2 + size * 1.1],
        }}
        style={{ background: "transparent" }}
      >
        <ambientLight intensity={1.1} />
        <directionalLight position={[cols, size * 1.2, rows * 1.5]} intensity={1.6} />
        <OrbitControls
          makeDefault
          target={[cols / 2, 1, rows / 2]}
          enableDamping={!reducedMotion()}
          maxPolarAngle={Math.PI / 2.15}
          minDistance={size * 0.6}
          maxDistance={size * 3.5}
        />

        <mesh position={[cols / 2, -0.1, rows / 2]}>
          <boxGeometry args={[cols + 1.2, 0.2, rows + 1.2]} />
          <meshStandardMaterial color={SITE} />
        </mesh>
        <mesh position={[cols / 2, -0.22, rows / 2]}>
          <boxGeometry args={[cols + 1.2, 0.05, rows + 1.2]} />
          <meshStandardMaterial color={SITE_EDGE} />
        </mesh>
        {layout.blocks.map((b) => (
          <group key={b.block}>
            <mesh position={[b.col + b.cols / 2, 0.005, b.row + b.rows / 2]}>
              <boxGeometry args={[b.cols + 0.44, 0.01, b.rows + 0.44]} />
              <meshStandardMaterial color={BLOCK_PAD} />
            </mesh>
          </group>
        ))}

        <Instances limit={Math.max(houses.length, 1)} frustumCulled={false}>
          <boxGeometry />
          <meshStandardMaterial />
          {houses.map((house) => (
            <Instance
              key={house.id}
              position={[house.col + 0.5, 0.025, house.row + 0.5]}
              scale={[0.9, 0.05, 0.9]}
              color={house.hasVehicle ? PLOT : NO_VEHICLE}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(house.id);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                hover(house.id);
              }}
              onPointerOut={() => hover(null)}
            />
          ))}
        </Instances>

        {group("registered", false)}
        {group("visitors", false)}
        {group("registered", true)}
        {group("visitors", true)}

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
