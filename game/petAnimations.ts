import * as Phaser from "phaser";
import { GRID_SIZE } from "@/lib/pet";

export const PET_TEXTURE_KEY = "player-pet";
export const PET_DISPLAY_SCALE = 3;

export function buildPetTexture(
  scene: Phaser.Scene,
  pixels: string[][]
): string {
  const canvas = document.createElement("canvas");
  canvas.width = GRID_SIZE;
  canvas.height = GRID_SIZE;
  const ctx = canvas.getContext("2d");

  if (ctx) {
    ctx.clearRect(0, 0, GRID_SIZE, GRID_SIZE);
    for (let y = 0; y < GRID_SIZE; y++) {
      const row = pixels[y];
      if (!row) continue;
      for (let x = 0; x < GRID_SIZE; x++) {
        const color = row[x];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
  }

  if (scene.textures.exists(PET_TEXTURE_KEY)) {
    scene.textures.remove(PET_TEXTURE_KEY);
  }

  const texture = scene.textures.addCanvas(PET_TEXTURE_KEY, canvas);
  if (texture) {
    texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  return PET_TEXTURE_KEY;
}

function resetSpritePose(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  shadow: Phaser.GameObjects.Ellipse,
  baseX: number,
  baseY: number
): void {
  scene.tweens.killTweensOf([sprite, shadow]);
  sprite.clearTint();
  sprite.setAlpha(1);
  sprite.setAngle(0);
  sprite.setScale(PET_DISPLAY_SCALE);
  sprite.setPosition(baseX, baseY);
  shadow.setPosition(baseX, baseY + 42);
  shadow.setScale(1, 1);
  shadow.setAlpha(0.35);
}

export function playIdleAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  shadow: Phaser.GameObjects.Ellipse,
  baseX: number,
  baseY: number
): void {
  resetSpritePose(scene, sprite, shadow, baseX, baseY);

  scene.tweens.add({
    targets: sprite,
    y: baseY - 5,
    scaleY: PET_DISPLAY_SCALE * 1.04,
    scaleX: PET_DISPLAY_SCALE * 0.97,
    duration: 550,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });

  scene.tweens.add({
    targets: shadow,
    scaleX: 0.9,
    alpha: 0.25,
    duration: 550,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

export function playListeningAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  shadow: Phaser.GameObjects.Ellipse,
  baseX: number,
  baseY: number
): void {
  resetSpritePose(scene, sprite, shadow, baseX, baseY);

  scene.tweens.add({
    targets: sprite,
    y: baseY - 7,
    angle: { from: -4, to: 4 },
    duration: 320,
    yoyo: true,
    repeat: -1,
    ease: "Sine.easeInOut",
  });
}

function spawnDustBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  count: number
): void {
  for (let i = 0; i < count; i++) {
    const size = Phaser.Math.Between(4, 8);
    const puff = scene.add.rectangle(
      x + Phaser.Math.Between(-12, 12),
      y + Phaser.Math.Between(-6, 6),
      size,
      size,
      color,
      0.85
    );
    scene.tweens.add({
      targets: puff,
      x: puff.x + Phaser.Math.Between(-36, -8),
      y: puff.y + Phaser.Math.Between(-24, -4),
      alpha: 0,
      scale: 0.3,
      duration: Phaser.Math.Between(280, 460),
      ease: "Quad.easeOut",
      onComplete: () => puff.destroy(),
    });
  }
}

export function playRunAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  shadow: Phaser.GameObjects.Ellipse,
  baseX: number,
  baseY: number,
  onScrollTick?: () => void,
  onComplete?: () => void
): void {
  resetSpritePose(scene, sprite, shadow, baseX, baseY);

  // Forward tilt & rapid stride bounces
  const runDistance = 68;
  const duration = 760;

  spawnDustBurst(scene, baseX - 24, baseY + 38, 0xfef08a, 7);

  scene.tweens.add({
    targets: sprite,
    x: baseX + runDistance,
    duration: duration * 0.55,
    yoyo: true,
    ease: "Quad.easeInOut",
    onUpdate: () => {
      shadow.x = sprite.x;
      onScrollTick?.();
    },
  });

  scene.tweens.add({
    targets: sprite,
    y: baseY - 22,
    duration: 140,
    yoyo: true,
    repeat: 4,
    ease: "Quad.easeOut",
  });

  scene.tweens.add({
    targets: sprite,
    angle: { from: -10, to: 8 },
    duration: 130,
    yoyo: true,
    repeat: 4,
    ease: "Sine.easeInOut",
  });

  scene.tweens.add({
    targets: shadow,
    scaleX: 0.72,
    alpha: 0.2,
    duration: 140,
    yoyo: true,
    repeat: 4,
  });

  scene.time.delayedCall(duration + 60, () => {
    resetSpritePose(scene, sprite, shadow, baseX, baseY);
    onComplete?.();
  });
}

export function playFallAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  shadow: Phaser.GameObjects.Ellipse,
  baseX: number,
  baseY: number,
  stayKnockedOut: boolean,
  onComplete?: () => void
): void {
  resetSpritePose(scene, sprite, shadow, baseX, baseY);
  sprite.setTint(0xff7b7b);

  scene.cameras.main.shake(190, 0.012);

  // Little hop then tumble onto the ground
  scene.tweens.chain({
    targets: sprite,
    tweens: [
      {
        y: baseY - 24,
        angle: -18,
        duration: 140,
        ease: "Quad.easeOut",
      },
      {
        y: baseY + 22,
        angle: 88,
        scaleY: PET_DISPLAY_SCALE * 0.82,
        scaleX: PET_DISPLAY_SCALE * 1.12,
        duration: 240,
        ease: "Bounce.easeOut",
        onComplete: () => {
          spawnDustBurst(scene, baseX + 10, baseY + 38, 0xfca5a5, 9);
          spawnDustBurst(scene, baseX - 10, baseY + 38, 0xe2e8f0, 6);
        },
      },
    ],
  });

  scene.tweens.add({
    targets: shadow,
    scaleX: 1.35,
    alpha: 0.45,
    duration: 360,
  });

  scene.time.delayedCall(780, () => {
    if (stayKnockedOut) {
      sprite.setAlpha(0.75);
      onComplete?.();
      return;
    }

    sprite.clearTint();
    scene.tweens.add({
      targets: sprite,
      y: baseY,
      angle: 0,
      scaleX: PET_DISPLAY_SCALE,
      scaleY: PET_DISPLAY_SCALE,
      duration: 240,
      ease: "Back.easeOut",
      onComplete: () => {
        resetSpritePose(scene, sprite, shadow, baseX, baseY);
        onComplete?.();
      },
    });
  });
}

export function playWinAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  shadow: Phaser.GameObjects.Ellipse,
  baseX: number,
  baseY: number
): void {
  resetSpritePose(scene, sprite, shadow, baseX, baseY);

  scene.tweens.add({
    targets: sprite,
    y: baseY - 28,
    angle: { from: -8, to: 8 },
    duration: 260,
    yoyo: true,
    repeat: -1,
    ease: "Quad.easeOut",
  });

  const confettiColors = [0xfacc15, 0x4ade80, 0x60a5fa, 0xf472b6, 0xfb923c];
  for (let i = 0; i < 24; i++) {
    const cx = Phaser.Math.Between(60, 580);
    const piece = scene.add.rectangle(
      cx,
      -12,
      8,
      8,
      confettiColors[i % confettiColors.length]
    );
    scene.tweens.add({
      targets: piece,
      y: 340,
      x: cx + Phaser.Math.Between(-45, 45),
      angle: Phaser.Math.Between(180, 540),
      duration: Phaser.Math.Between(1100, 1900),
      delay: Phaser.Math.Between(0, 500),
      repeat: -1,
    });
  }
}

export function playSadAnimation(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Image,
  shadow: Phaser.GameObjects.Ellipse,
  baseX: number,
  baseY: number
): void {
  resetSpritePose(scene, sprite, shadow, baseX, baseY);
  sprite.setTint(0x94a3b8);
  sprite.setAlpha(0.85);
  sprite.setPosition(baseX, baseY + 12);
  sprite.setScale(PET_DISPLAY_SCALE * 1.05, PET_DISPLAY_SCALE * 0.85);
}

