"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  GRID_SIZE,
  PetReaction,
  clonePixels,
  countPaintedPixels,
  createDefaultPixels,
  createEmptyPixels,
  hasPaintedPixels,
} from "@/lib/pet";
import { usePetStore } from "@/store/usePetStore";
import { PetSprite } from "./PetSprite";

type Tool = "pencil" | "eraser" | "fill" | "eyedropper";

const PRESET_COLORS = [
  "#1e1b2e",
  "#ffffff",
  "#ef4444",
  "#f97316",
  "#facc15",
  "#4ade80",
  "#10b981",
  "#06b6d4",
  "#3b82f6",
  "#5b6ee1",
  "#8b5cf6",
  "#ec4899",
  "#f472b6",
  "#a16207",
  "#94a3b8",
  "#475569",
];

const MAX_HISTORY = 40;

function floodFill(
  grid: string[][],
  startX: number,
  startY: number,
  replacement: string
): string[][] {
  const targetColor = grid[startY]?.[startX] ?? "";
  if (targetColor === replacement) return grid;

  const next = clonePixels(grid);
  const queue: [number, number][] = [[startX, startY]];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const [x, y] = queue.shift()!;
    const key = `${x},${y}`;
    if (visited.has(key)) continue;
    visited.add(key);

    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) continue;
    if (next[y][x] !== targetColor) continue;

    next[y][x] = replacement;
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  return next;
}

function drawLineOnGrid(
  grid: string[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  value: string
): boolean {
  let changed = false;
  let cx = x0;
  let cy = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (cx >= 0 && cx < GRID_SIZE && cy >= 0 && cy < GRID_SIZE) {
      if (grid[cy][cx] !== value) {
        grid[cy][cx] = value;
        changed = true;
      }
    }
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }

  return changed;
}

export function PixelEditor() {
  const pet = usePetStore((state) => state.pet);
  const hydrated = usePetStore((state) => state.hydrated);
  const updatePixels = usePetStore((state) => state.updatePixels);

  const [draftPixels, setDraftPixels] = useState<string[][]>(() =>
    clonePixels(pet.pixels)
  );
  const [tool, setTool] = useState<Tool>("pencil");
  const [activeColor, setActiveColor] = useState<string>("#5b6ee1");
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [undoStack, setUndoStack] = useState<string[][][]>([]);
  const [redoStack, setRedoStack] = useState<string[][][]>([]);
  const [previewPose, setPreviewPose] = useState<PetReaction>("idle");
  const [statusAlert, setStatusAlert] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const initializedFromStoreRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const lastCellRef = useRef<{ x: number; y: number } | null>(null);
  const strokeButtonRef = useRef<number>(0);
  const strokeSnapshotRef = useRef<string[][] | null>(null);
  const strokeChangedRef = useRef<boolean>(false);

  // Sync draft canvas once store hydrates from localStorage
  useEffect(() => {
    if (hydrated && !initializedFromStoreRef.current) {
      initializedFromStoreRef.current = true;
      setDraftPixels(clonePixels(pet.pixels));
    }
  }, [hydrated, pet.pixels]);

  // Draw draftPixels onto the 32x32 editor canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = draftPixels[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const color = row[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }, [draftPixels]);

  const pushUndo = useCallback((snapshot: string[][]) => {
    setUndoStack((prev) => [...prev.slice(-(MAX_HISTORY - 1)), clonePixels(snapshot)]);
    setRedoStack([]);
  }, []);

  const getCellFromPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    const x = Math.max(
      0,
      Math.min(GRID_SIZE - 1, Math.floor(((clientX - rect.left) / rect.width) * GRID_SIZE))
    );
    const y = Math.max(
      0,
      Math.min(GRID_SIZE - 1, Math.floor(((clientY - rect.top) / rect.height) * GRID_SIZE))
    );
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const cell = getCellFromPointer(e.clientX, e.clientY);
    if (!cell) return;

    setStatusAlert(null);

    if (tool === "eyedropper") {
      const picked = draftPixels[cell.y]?.[cell.x];
      if (picked) {
        setActiveColor(picked);
        setTool("pencil");
      }
      return;
    }

    if (tool === "fill") {
      const replacement = e.button === 2 ? "" : activeColor;
      const before = draftPixels;
      const filled = floodFill(before, cell.x, cell.y, replacement);
      if (filled !== before) {
        pushUndo(before);
        setDraftPixels(filled);
      }
      return;
    }

    e.currentTarget.setPointerCapture(e.pointerId);
    isDrawingRef.current = true;
    lastCellRef.current = cell;
    strokeButtonRef.current = e.button;
    strokeSnapshotRef.current = clonePixels(draftPixels);
    strokeChangedRef.current = false;

    const value = tool === "eraser" || e.button === 2 ? "" : activeColor;
    setDraftPixels((prev) => {
      if (prev[cell.y][cell.x] === value) return prev;
      strokeChangedRef.current = true;
      const next = clonePixels(prev);
      next[cell.y][cell.x] = value;
      return next;
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) return;
    const cell = getCellFromPointer(e.clientX, e.clientY);
    if (!cell) return;

    const last = lastCellRef.current ?? cell;
    if (last.x === cell.x && last.y === cell.y) return;
    lastCellRef.current = cell;

    const value =
      tool === "eraser" || strokeButtonRef.current === 2 ? "" : activeColor;

    setDraftPixels((prev) => {
      const next = clonePixels(prev);
      const didChange = drawLineOnGrid(
        next,
        last.x,
        last.y,
        cell.x,
        cell.y,
        value
      );
      if (!didChange) return prev;
      strokeChangedRef.current = true;
      return next;
    });
  };

  const finishStroke = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastCellRef.current = null;
    if (strokeChangedRef.current && strokeSnapshotRef.current) {
      pushUndo(strokeSnapshotRef.current);
    }
    strokeSnapshotRef.current = null;
    strokeChangedRef.current = false;
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev, clonePixels(draftPixels)]);
    setUndoStack((prev) => prev.slice(0, -1));
    setDraftPixels(clonePixels(previous));
    setStatusAlert(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextState = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev, clonePixels(draftPixels)]);
    setRedoStack((prev) => prev.slice(0, -1));
    setDraftPixels(clonePixels(nextState));
    setStatusAlert(null);
  };

  const handleClearCanvas = () => {
    if (!hasPaintedPixels(draftPixels)) return;
    pushUndo(draftPixels);
    setDraftPixels(createEmptyPixels());
    setStatusAlert(null);
  };

  const handleLoadStarter = () => {
    pushUndo(draftPixels);
    setDraftPixels(createDefaultPixels());
    setStatusAlert(null);
  };

  const handleSave = () => {
    if (!hasPaintedPixels(draftPixels)) {
      setStatusAlert({
        type: "error",
        text: "Kanvas masih kosong! Gambar minimal 1 pixel sebelum menyimpan.",
      });
      return;
    }

    const saved = updatePixels(draftPixels);
    if (saved) {
      setStatusAlert({
        type: "success",
        text: `Gambar monster "${pet.name}" berhasil disimpan!`,
      });
    } else {
      setStatusAlert({
        type: "error",
        text: "Gagal menyimpan gambar. Pastikan gambar tidak kosong.",
      });
    }
  };

  const pixelCount = countPaintedPixels(draftPixels);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
      {/* Canvas & Toolbar */}
      <div className="pixel-card space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="font-pixel text-lg font-bold text-[#1e1b2e] sm:text-xl">
              Editor Pixel Monster (32 × 32)
            </h1>
            <p className="text-xs text-slate-600">
              Sentuh atau seret untuk menggambar. Klik kanan untuk menghapus cepat.
            </p>
          </div>
          <span className="font-pixel rounded-md border-2 border-[#1e1b2e] bg-[#eef2ff] px-2.5 py-1 text-xs font-bold">
            {pixelCount} pixel terisi
          </span>
        </div>

        {/* Tools row */}
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { id: "pencil", label: "✏️ Pensil" },
              { id: "eraser", label: "🧽 Penghapus" },
              { id: "fill", label: "🪣 Isi Area" },
              { id: "eyedropper", label: "💧 Ambil Warna" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTool(item.id)}
              className={`pixel-btn font-pixel px-3 py-1.5 text-xs font-bold ${
                tool === item.id
                  ? "bg-[#fde047] text-[#1e1b2e]"
                  : "bg-white text-[#1e1b2e]"
              }`}
            >
              {item.label}
            </button>
          ))}

          <button
            type="button"
            onClick={() => setShowGrid((v) => !v)}
            className={`pixel-btn font-pixel px-3 py-1.5 text-xs font-bold ${
              showGrid ? "bg-[#e0e7ff]" : "bg-white"
            }`}
          >
            {showGrid ? "# Grid: Nyala" : "# Grid: Mati"}
          </button>
        </div>

        {/* Canvas surface */}
        <div className="flex justify-center">
          <div
            className="relative aspect-square w-full max-w-[448px] overflow-hidden rounded-lg border-[3px] border-[#1e1b2e] shadow-[4px_4px_0_#1e1b2e]"
            style={{
              backgroundImage:
                "repeating-conic-gradient(#e2e8f0 0% 25%, #ffffff 0% 50%)",
              backgroundSize: "calc(100% / 16) calc(100% / 16)",
            }}
          >
            <canvas
              ref={canvasRef}
              width={GRID_SIZE}
              height={GRID_SIZE}
              aria-label="Kanvas editor pixel 32 kali 32"
              onContextMenu={(e) => e.preventDefault()}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishStroke}
              onPointerCancel={finishStroke}
              className="pixelated block h-full w-full cursor-crosshair touch-none"
            />
            {showGrid && (
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0"
                style={{
                  backgroundImage:
                    "linear-gradient(to right, rgba(30,27,46,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(30,27,46,0.12) 1px, transparent 1px)",
                  backgroundSize: "calc(100% / 32) calc(100% / 32)",
                }}
              />
            )}
          </div>
        </div>

        {/* History & Reset row */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUndo}
              disabled={undoStack.length === 0}
              className="pixel-btn font-pixel bg-white px-3 py-1.5 text-xs font-bold"
            >
              ↩ Undo ({undoStack.length})
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="pixel-btn font-pixel bg-white px-3 py-1.5 text-xs font-bold"
            >
              ↪ Redo
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleLoadStarter}
              className="pixel-btn font-pixel bg-[#e0e7ff] px-3 py-1.5 text-xs font-bold"
            >
              👾 Template Bawaan
            </button>
            <button
              type="button"
              onClick={handleClearCanvas}
              className="pixel-btn font-pixel bg-[#fee2e2] px-3 py-1.5 text-xs font-bold text-[#991b1b]"
            >
              🗑️ Bersihkan
            </button>
          </div>
        </div>
      </div>

      {/* Color Palette + Preview + Save */}
      <div className="space-y-4">
        <div className="pixel-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-pixel text-sm font-bold text-[#1e1b2e]">
              Palet Warna
            </h2>
            <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold">
              <span>Pilih Bebas</span>
              <input
                type="color"
                aria-label="Pemilih warna kustom"
                value={activeColor}
                onChange={(e) => {
                  setActiveColor(e.target.value);
                  if (tool === "eraser") setTool("pencil");
                }}
                className="h-8 w-10 cursor-pointer rounded border-2 border-[#1e1b2e] bg-transparent p-0"
              />
            </label>
          </div>

          <div className="grid grid-cols-8 gap-2">
            {PRESET_COLORS.map((color) => {
              const selected =
                activeColor.toLowerCase() === color.toLowerCase() &&
                tool !== "eraser";
              return (
                <button
                  key={color}
                  type="button"
                  aria-label={`Warna ${color}`}
                  onClick={() => {
                    setActiveColor(color);
                    if (tool === "eraser") setTool("pencil");
                  }}
                  className={`h-8 w-full rounded border-2 transition-transform ${
                    selected
                      ? "scale-110 border-[#1e1b2e] ring-2 ring-[#fde047] ring-offset-1"
                      : "border-[#1e1b2e]/60 hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              );
            })}
          </div>
        </div>

        {/* Live Preview */}
        <div className="pixel-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-pixel text-sm font-bold text-[#1e1b2e]">
              Pratinjau Monster
            </h2>
            <span className="text-[11px] font-medium text-slate-500">
              Nearest-neighbor
            </span>
          </div>

          <div className="flex items-center justify-around rounded-lg border-2 border-[#1e1b2e] bg-gradient-to-b from-[#dbeafe] to-[#dcfce7] p-4">
            <div className="flex flex-col items-center gap-1">
              <PetSprite
                pixels={draftPixels}
                size={112}
                reaction={previewPose}
                animated
              />
              <span className="font-pixel text-[11px] font-bold text-slate-700">
                3.5× Besar
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <PetSprite pixels={draftPixels} size={48} animated={false} />
              <span className="font-pixel text-[11px] font-bold text-slate-700">
                1.5× Kecil
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: "idle", label: "Diam" },
                { id: "happy", label: "Senang" },
                { id: "playing", label: "Berlari/Main" },
                { id: "sad", label: "Sedih" },
              ] as const
            ).map((pose) => (
              <button
                key={pose.id}
                type="button"
                onClick={() => setPreviewPose(pose.id)}
                className={`rounded border-2 border-[#1e1b2e] px-2 py-1 text-[11px] font-bold ${
                  previewPose === pose.id ? "bg-[#fde047]" : "bg-white"
                }`}
              >
                {pose.label}
              </button>
            ))}
          </div>
        </div>

        {/* Save Actions */}
        <div className="pixel-card space-y-3 p-4">
          <button
            type="button"
            onClick={handleSave}
            className="pixel-btn font-pixel w-full bg-[#4ade80] px-4 py-3 text-sm font-bold text-[#1e1b2e]"
          >
            💾 Simpan Monster
          </button>

          {statusAlert && (
            <div
              role="alert"
              className={`rounded-lg border-2 border-[#1e1b2e] px-3 py-2.5 text-xs font-bold ${
                statusAlert.type === "error"
                  ? "bg-[#fee2e2] text-[#991b1b]"
                  : "bg-[#dcfce7] text-[#166534]"
              }`}
            >
              {statusAlert.text}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/pet"
              className="pixel-btn font-pixel block bg-white px-3 py-2 text-center text-xs font-bold text-[#1e1b2e] no-underline"
            >
              ← Rawat
            </Link>
            <Link
              href="/play"
              className="pixel-btn font-pixel block bg-[#e0e7ff] px-3 py-2 text-center text-xs font-bold text-[#1e1b2e] no-underline"
            >
              Main Game →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

