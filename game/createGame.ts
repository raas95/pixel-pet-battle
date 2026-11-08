import * as Phaser from "phaser";
import { MiniGameScene } from "./scenes/MiniGameScene";

export type MiniGameController = {
  startGame: () => void;
  submitAnswer: (letter: string) => void;
  replayAudio: () => void;
  updatePetPixels: (pixels: string[][]) => void;
  destroy: () => void;
};

export function createGame(container: HTMLElement): MiniGameController {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: container,
    width: 640,
    height: 320,
    backgroundColor: "#dbeafe",
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    scene: [MiniGameScene],
  };

  const game = new Phaser.Game(config);

  return {
    startGame: () => {
      game.events.emit("game:start");
    },
    submitAnswer: (letter: string) => {
      game.events.emit("game:answer", letter);
    },
    replayAudio: () => {
      game.events.emit("game:replay-audio");
    },
    updatePetPixels: (pixels: string[][]) => {
      game.events.emit("game:update-pet-pixels", pixels);
    },
    destroy: () => {
      game.destroy(true);
    },
  };
}

