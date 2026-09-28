// Thin platform adapter. Uses the YouTube Playables SDK when present,
// otherwise falls back to localStorage so the game runs anywhere.
window.Platform = (() => {
  const yt = typeof ytgame !== 'undefined' && ytgame.IN_PLAYABLES_ENV ? ytgame : null;
  const KEY = 'balloon-bouncer-save';

  return {
    inPlayables: !!yt,

    firstFrameReady() {
      if (yt) ytgame.game.firstFrameReady();
    },

    gameReady() {
      if (yt) ytgame.game.gameReady();
    },

    bindSystemEvents({ onPause, onResume, onAudioEnabled }) {
      if (!yt) {
        onAudioEnabled(true);
        return;
      }
      onAudioEnabled(ytgame.system.isAudioEnabled());
      ytgame.system.onAudioEnabledChange(onAudioEnabled);
      ytgame.system.onPause(onPause);
      ytgame.system.onResume(onResume);
    },

    async load() {
      try {
        const raw = yt ? await ytgame.game.loadData() : localStorage.getItem(KEY);
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    async save(data) {
      const raw = JSON.stringify(data);
      try {
        if (yt) await ytgame.game.saveData(raw);
        else localStorage.setItem(KEY, raw);
      } catch {
        // Saving must never break gameplay.
      }
    },

    async sendScore(value) {
      if (!yt) return;
      try {
        await ytgame.engagement.sendScore({ value: Math.trunc(value) });
      } catch {
        // Ignore score failures.
      }
    },
  };
})();
