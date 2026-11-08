import * as Phaser from "phaser";
import {
  LETTERS,
  LetterRound,
  MAX_LIVES,
  POINTS_PER_CORRECT,
  TOTAL_ROUNDS,
  generateRound,
  getLetterAudioPath,
  isValidLetterOption,
} from "@/lib/letters";
import { MiniGameState, usePetStore } from "@/store/usePetStore";
import {
  PET_DISPLAY_SCALE,
  buildPetTexture,
  playFallAnimation,
  playIdleAnimation,
  playListeningAnimation,
  playRunAnimation,
  playSadAnimation,
  playWinAnimation,
} from "../petAnimations";
import {
  playClickSfx,
  playCorrectSfx,
  playLoseSfx,
  playWinSfx,
  playWrongSfx,
} from "../soundFx";

export const SCENE_KEY = "MiniGameScene";
const STAGE_WIDTH = 640;
const STAGE_HEIGHT = 320;
const PET_BASE_X = 210;
const PET_BASE_Y = 205;

function getAudioKey(letter: string): string {
  return `letter_${letter.toLowerCase()}`;
}

export class MiniGameScene extends Phaser.Scene {
  private gameState: MiniGameState = "MENUNGGU_MULAI";
  private roundNumber = 1;
  private score = 0;
  private lives = MAX_LIVES;
  private currentRound: LetterRound | null = null;
  private previousTarget: string | undefined = undefined;

  private petSprite!: Phaser.GameObjects.Image;
  private petShadow!: Phaser.GameObjects.Ellipse;
  private speakerBadge!: Phaser.GameObjects.Container;
  private statusBanner!: Phaser.GameObjects.Text;
  private clouds: Phaser.GameObjects.Rectangle[] = [];
  private trackMarkers: Phaser.GameObjects.Rectangle[] = [];

  private failedAudioKeys = new Set<string>();
  private activeVoiceSound: Phaser.Sound.BaseSound | null = null;
  private trackedTimers: Phaser.Time.TimerEvent[] = [];
  private trackedWindowTimeouts: number[] = [];
  private isDestroyed = false;
  private keydownHandler: ((event: KeyboardEvent) => void) | null = null;

  constructor() {
    super(SCENE_KEY);
  }

  preload(): void {
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      if (file?.key) {
        this.failedAudioKeys.add(file.key);
      }
    });

    for (const letter of LETTERS) {
      const key = getAudioKey(letter);
      if (!this.cache.audio.exists(key)) {
        this.load.audio(key, getLetterAudioPath(letter));
      }
    }
  }

  create(): void {
    this.isDestroyed = false;
    this.createBackdrop();

    const petPixels = usePetStore.getState().pet.pixels;
    const textureKey = buildPetTexture(this, petPixels);

    this.petShadow = this.add.ellipse(
      PET_BASE_X,
      PET_BASE_Y + 42,
      78,
      18,
      0x1e1b2e,
      0.35
    );
    this.petSprite = this.add
      .image(PET_BASE_X, PET_BASE_Y, textureKey)
      .setScale(PET_DISPLAY_SCALE)
      .setOrigin(0.5, 0.5);

    this.createSpeakerBadge();

    this.statusBanner = this.add
      .text(STAGE_WIDTH / 2, 34, "Tekan tombol Mulai untuk bermain!", {
        fontFamily: "monospace",
        fontSize: "18px",
        fontStyle: "bold",
        color: "#1e1b2e",
        backgroundColor: "#fef9c3",
        padding: { x: 14, y: 7 },
      })
      .setOrigin(0.5, 0.5);

    playIdleAnimation(this, this.petSprite, this.petShadow, PET_BASE_X, PET_BASE_Y);
    usePetStore.getState().resetMiniGameSession();

    this.registerListeners();
  }

  update(_time: number, delta: number): void {
    if (this.isDestroyed) return;
    const step = (delta / 1000) * 14;
    for (const cloud of this.clouds) {
      cloud.x -= step;
      if (cloud.x < -80) {
        cloud.x = STAGE_WIDTH + 80;
      }
    }
  }

  private createBackdrop(): void {
    // Crisp sky bands
    this.add.rectangle(STAGE_WIDTH / 2, 110, STAGE_WIDTH, 220, 0xdbeafe);
    this.add.rectangle(STAGE_WIDTH / 2, 178, STAGE_WIDTH, 88, 0xbfdbfe);

    // Pixel sun
    this.add.rectangle(552, 54, 42, 42, 0xfde047);
    this.add.rectangle(552, 54, 30, 30, 0xfef08a);

    // Drifting pixel clouds
    const cloudCoords = [
      { x: 110, y: 66, w: 68 },
      { x: 320, y: 48, w: 84 },
      { x: 470, y: 88, w: 58 },
    ];
    for (const c of cloudCoords) {
      const cloud = this.add.rectangle(c.x, c.y, c.w, 20, 0xffffff, 0.92);
      this.clouds.push(cloud);
    }

    // Distant pixel hills
    this.add.rectangle(110, 208, 240, 56, 0x86efac);
    this.add.rectangle(390, 204, 280, 64, 0x6ee7b7);
    this.add.rectangle(580, 212, 180, 48, 0x86efac);

    // Grass & running track
    this.add.rectangle(STAGE_WIDTH / 2, 242, STAGE_WIDTH, 32, 0x22c55e);
    this.add.rectangle(STAGE_WIDTH / 2, 288, STAGE_WIDTH, 66, 0xd97706);
    this.add.rectangle(STAGE_WIDTH / 2, 258, STAGE_WIDTH, 8, 0x15803d);

    // Scrolling ground markers (move when monster runs)
    this.trackMarkers = [];
    for (let x = 24; x < STAGE_WIDTH + 64; x += 64) {
      const pebble = this.add.rectangle(x, 282, 18, 6, 0xb45309);
      this.trackMarkers.push(pebble);
    }
  }

  private scrollTrack(amount: number): void {
    for (const marker of this.trackMarkers) {
      marker.x -= amount;
      if (marker.x < -24) {
        marker.x += STAGE_WIDTH + 64;
      }
    }
  }

  private createSpeakerBadge(): void {
    const bg = this.add.rectangle(0, 0, 128, 32, 0x312e81, 0.95);
    bg.setStrokeStyle(2, 0xffffff);
    const label = this.add
      .text(0, 0, "♪ DENGARKAN", {
        fontFamily: "monospace",
        fontSize: "13px",
        fontStyle: "bold",
        color: "#fde047",
      })
      .setOrigin(0.5, 0.5);

    this.speakerBadge = this.add.container(PET_BASE_X, PET_BASE_Y - 76, [bg, label]);
    this.speakerBadge.setVisible(false);
  }

  private registerListeners(): void {
    const startHandler = () => this.startGame();
    const answerHandler = (letter: string) => this.handleAnswer(letter);
    const replayHandler = () => this.replayCurrentAudio();
    const updatePixelsHandler = (pixels: string[][]) => {
      if (this.isDestroyed || !this.petSprite) return;
      const key = buildPetTexture(this, pixels);
      this.petSprite.setTexture(key);
    };

    this.game.events.on("game:start", startHandler);
    this.game.events.on("game:answer", answerHandler);
    this.game.events.on("game:replay-audio", replayHandler);
    this.game.events.on("game:update-pet-pixels", updatePixelsHandler);

    this.keydownHandler = (event: KeyboardEvent) => {
      if (this.isDestroyed) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (/^[a-zA-Z]$/.test(event.key)) {
        this.handleAnswer(event.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", this.keydownHandler);

    const cleanup = () => {
      this.isDestroyed = true;
      this.game.events.off("game:start", startHandler);
      this.game.events.off("game:answer", answerHandler);
      this.game.events.off("game:replay-audio", replayHandler);
      this.game.events.off("game:update-pet-pixels", updatePixelsHandler);

      if (this.keydownHandler) {
        window.removeEventListener("keydown", this.keydownHandler);
        this.keydownHandler = null;
      }
      this.cleanupAudioAndTimers();
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
    this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
  }

  private cleanupAudioAndTimers(): void {
    this.stopActiveAudio();
    for (const timer of this.trackedTimers) {
      timer.remove(false);
    }
    this.trackedTimers = [];

    for (const timeoutId of this.trackedWindowTimeouts) {
      window.clearTimeout(timeoutId);
    }
    this.trackedWindowTimeouts = [];

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore
      }
    }
  }

  private stopActiveAudio(): void {
    if (this.activeVoiceSound) {
      try {
        this.activeVoiceSound.off("complete");
        this.activeVoiceSound.stop();
        this.activeVoiceSound.destroy();
      } catch {
        // Ignore
      }
      this.activeVoiceSound = null;
    }
  }

  private scheduleDelay(ms: number, callback: () => void): void {
    if (this.isDestroyed) return;
    const timer = this.time.delayedCall(ms, () => {
      if (!this.isDestroyed) callback();
    });
    this.trackedTimers.push(timer);
  }

  private startGame(): void {
    if (this.isDestroyed) return;
    if (
      this.gameState !== "MENUNGGU_MULAI" &&
      this.gameState !== "PERMAINAN_SELESAI"
    ) {
      return;
    }

    playClickSfx();
    this.cleanupAudioAndTimers();

    // Ensure WebAudio context unlocks cleanly after explicit user interaction
    if (
      this.sound &&
      "context" in this.sound &&
      (this.sound as Phaser.Sound.WebAudioSoundManager).context?.state === "suspended"
    ) {
      void (this.sound as Phaser.Sound.WebAudioSoundManager).context.resume();
    }

    this.roundNumber = 1;
    this.score = 0;
    this.lives = MAX_LIVES;
    this.previousTarget = undefined;
    this.currentRound = null;

    usePetStore.getState().resetMiniGameSession();
    this.beginRound();
  }

  private beginRound(): void {
    if (this.isDestroyed) return;

    const roundData = generateRound(this.previousTarget);
    this.currentRound = roundData;
    this.previousTarget = roundData.target;
    this.gameState = "MEMUTAR_SUARA";

    this.statusBanner.setText(`Ronde ${this.roundNumber}/${TOTAL_ROUNDS} • Dengarkan!`);
    this.speakerBadge.setVisible(true);
    playListeningAnimation(
      this,
      this.petSprite,
      this.petShadow,
      PET_BASE_X,
      PET_BASE_Y
    );

    usePetStore.getState().setMiniGameSnapshot({
      gameState: "MEMUTAR_SUARA",
      round: this.roundNumber,
      score: this.score,
      lives: this.lives,
      currentOptions: roundData.options,
      currentTarget: roundData.target,
      lastAnswerFeedback: null,
      gameOutcome: null,
      audioFallbackUsed: false,
      gameHint: "Dengarkan instruksi huruf...",
    });

    this.playLetterInstruction(roundData.target, () => {
      if (this.isDestroyed || this.gameState !== "MEMUTAR_SUARA") return;
      this.enterWaitingForAnswer();
    });
  }

  private playLetterInstruction(target: string, onDone?: () => void): void {
    this.stopActiveAudio();
    const key = getAudioKey(target);
    const canPlayPhaserAudio =
      !this.failedAudioKeys.has(key) && this.cache.audio.exists(key);

    if (canPlayPhaserAudio) {
      let finished = false;
      const finishOnce = () => {
        if (finished || this.isDestroyed) return;
        finished = true;
        this.speakerBadge.setVisible(false);
        onDone?.();
      };

      try {
        const sound = this.sound.add(key);
        this.activeVoiceSound = sound;
        sound.once("complete", finishOnce);

        const started = sound.play();
        if (!started) {
          this.triggerSpeechFallback(target, finishOnce);
          return;
        }

        // Safety fallback timeout in case browser audio playback stalls
        const timeoutId = window.setTimeout(finishOnce, 1700);
        this.trackedWindowTimeouts.push(timeoutId);
        return;
      } catch {
        this.triggerSpeechFallback(target, finishOnce);
        return;
      }
    }

    this.triggerSpeechFallback(target, () => {
      this.speakerBadge.setVisible(false);
      onDone?.();
    });
  }

  private triggerSpeechFallback(target: string, onDone?: () => void): void {
    usePetStore.getState().setMiniGameSnapshot({
      audioFallbackUsed: true,
    });

    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(`Tekan ${target}`);
        utterance.lang = "id-ID";
        utterance.rate = 0.95;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Ignore speechSynthesis errors
      }
    }

    const timeoutId = window.setTimeout(() => {
      if (!this.isDestroyed) {
        onDone?.();
      }
    }, 550);
    this.trackedWindowTimeouts.push(timeoutId);
  }

  private enterWaitingForAnswer(): void {
    if (this.isDestroyed) return;
    this.gameState = "MENUNGGU_JAWABAN";
    this.speakerBadge.setVisible(false);
    this.statusBanner.setText(
      `Ronde ${this.roundNumber}/${TOTAL_ROUNDS} • Pilih hurufnya!`
    );

    usePetStore.getState().setMiniGameSnapshot({
      gameState: "MENUNGGU_JAWABAN",
      gameHint: "Tekan tombol di layar atau keyboard sesuai suara!",
    });
  }

  private replayCurrentAudio(): void {
    if (this.isDestroyed || !this.currentRound) return;
    if (this.gameState !== "MENUNGGU_JAWABAN") return;

    this.speakerBadge.setVisible(true);
    this.playLetterInstruction(this.currentRound.target, () => {
      this.speakerBadge.setVisible(false);
    });
  }

  private handleAnswer(rawLetter: string): void {
    // Ignore all inputs when not strictly waiting for an answer
    if (
      this.isDestroyed ||
      this.gameState !== "MENUNGGU_JAWABAN" ||
      !this.currentRound
    ) {
      return;
    }

    const selected = rawLetter.toUpperCase();
    if (!isValidLetterOption(selected, this.currentRound.options)) {
      usePetStore.getState().setMiniGameSnapshot({
        gameHint: `Huruf "${selected}" tidak ada di 4 pilihan (${this.currentRound.options.join(", ")}).`,
      });
      return;
    }

    // Transition synchronously to prevent double processing in the same round
    this.gameState = "MEMPROSES_JAWABAN";
    this.stopActiveAudio();
    this.speakerBadge.setVisible(false);

    const target = this.currentRound.target;
    const isCorrect = selected === target;

    if (isCorrect) {
      this.score += POINTS_PER_CORRECT;
      playCorrectSfx();
      this.statusBanner.setText(`Benar! Monster berlari (+${POINTS_PER_CORRECT})`);
      this.spawnFloatingText(`+${POINTS_PER_CORRECT}`, "#15803d", "#dcfce7");
    } else {
      this.lives = Math.max(0, this.lives - 1);
      playWrongSfx();
      this.statusBanner.setText(`Ups! Seharusnya huruf ${target} (-1 nyawa)`);
      this.spawnFloatingText("-1 ♥", "#b91c1c", "#fee2e2");
    }

    usePetStore.getState().setMiniGameSnapshot({
      gameState: "MEMPROSES_JAWABAN",
      score: this.score,
      lives: this.lives,
      lastAnswerFeedback: {
        selected,
        target,
        correct: isCorrect,
      },
      gameHint: isCorrect
        ? `Hebat! Jawaban "${selected}" benar!`
        : `Salah! Kamu pilih "${selected}", instruksinya "${target}".`,
    });

    if (isCorrect) {
      playRunAnimation(
        this,
        this.petSprite,
        this.petShadow,
        PET_BASE_X,
        PET_BASE_Y,
        () => this.scrollTrack(3.4),
        () => this.advanceOrFinishRound()
      );
    } else {
      playFallAnimation(
        this,
        this.petSprite,
        this.petShadow,
        PET_BASE_X,
        PET_BASE_Y,
        this.lives <= 0,
        () => this.advanceOrFinishRound()
      );
    }
  }

  private spawnFloatingText(
    label: string,
    color: string,
    bgColor: string
  ): void {
    const txt = this.add
      .text(PET_BASE_X + 20, PET_BASE_Y - 56, label, {
        fontFamily: "monospace",
        fontSize: "20px",
        fontStyle: "bold",
        color,
        backgroundColor: bgColor,
        padding: { x: 8, y: 4 },
      })
      .setOrigin(0.5, 0.5);

    this.tweens.add({
      targets: txt,
      y: txt.y - 44,
      alpha: 0,
      duration: 750,
      ease: "Quad.easeOut",
      onComplete: () => txt.destroy(),
    });
  }

  private advanceOrFinishRound(): void {
    if (this.isDestroyed) return;

    if (this.lives <= 0) {
      this.gameState = "PERMAINAN_SELESAI";
      this.statusBanner.setText("Permainan Selesai • Nyawa Habis!");
      playLoseSfx();
      playSadAnimation(
        this,
        this.petSprite,
        this.petShadow,
        PET_BASE_X,
        PET_BASE_Y
      );
      usePetStore.getState().completeMiniGame({
        won: false,
        score: this.score,
        roundsCompleted: this.roundNumber,
        livesRemaining: 0,
      });
      return;
    }

    if (this.roundNumber >= TOTAL_ROUNDS) {
      this.gameState = "PERMAINAN_SELESAI";
      this.statusBanner.setText("Menang! 10 Ronde Selesai!");
      playWinSfx();
      playWinAnimation(
        this,
        this.petSprite,
        this.petShadow,
        PET_BASE_X,
        PET_BASE_Y
      );
      usePetStore.getState().completeMiniGame({
        won: true,
        score: this.score,
        roundsCompleted: TOTAL_ROUNDS,
        livesRemaining: this.lives,
      });
      return;
    }

    this.gameState = "RONDE_BERIKUTNYA";
    usePetStore.getState().setMiniGameSnapshot({
      gameState: "RONDE_BERIKUTNYA",
      gameHint: "Bersiap ke ronde berikutnya...",
    });

    this.roundNumber += 1;
    this.scheduleDelay(320, () => {
      this.beginRound();
    });
  }
}
