/**
 * Reference adapter shape for a TypeScript web game.
 * Reconcile API calls against the current official Playables SDK reference.
 */

export type GameSave = {
  version: number;
  [key: string]: unknown;
};

export class YouTubePlatformAdapter {
  readonly inPlayables =
    typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV;

  firstFrameReady(): void {
    if (this.inPlayables) ytgame.game.firstFrameReady();
  }

  gameReady(): void {
    if (this.inPlayables) ytgame.game.gameReady();
  }

  bindSystemEvents(opts: {
    onPause: () => void;
    onResume: () => void;
    onAudioEnabled: (enabled: boolean) => void;
  }): () => void {
    if (!this.inPlayables) {
      opts.onAudioEnabled(true);
      return () => {};
    }

    opts.onAudioEnabled(ytgame.system.isAudioEnabled());
    const unsetAudio = ytgame.system.onAudioEnabledChange(opts.onAudioEnabled);
    const unsetPause = ytgame.system.onPause(opts.onPause);
    const unsetResume = ytgame.system.onResume(opts.onResume);

    return () => {
      unsetAudio();
      unsetPause();
      unsetResume();
    };
  }

  async loadSave<T extends GameSave>(fallback: T): Promise<T> {
    try {
      const raw = this.inPlayables
        ? await ytgame.game.loadData()
        : localStorage.getItem('SAVE_DATA') ?? '';
      if (!raw) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  async save(save: GameSave): Promise<void> {
    const raw = JSON.stringify(save);
    if (this.inPlayables) {
      await ytgame.game.saveData(raw);
    } else {
      localStorage.setItem('SAVE_DATA', raw);
    }
  }

  async sendScore(value: number): Promise<void> {
    if (!this.inPlayables) return;
    try {
      await ytgame.engagement.sendScore({ value: Math.trunc(value) });
    } catch {
      // Score submission failure must not block play.
    }
  }

  async interstitial(): Promise<void> {
    if (!this.inPlayables) return;
    try {
      await ytgame.ads.requestInterstitialAd();
    } catch {
      // Continue without ad.
    }
  }

  async rewarded(rewardId: string): Promise<boolean> {
    if (!this.inPlayables) return false;
    try {
      return await ytgame.ads.requestRewardedAd(rewardId);
    } catch {
      return false;
    }
  }
}
