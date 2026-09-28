export const SAVE_VERSION = 2 as const;

export type SaveV2 = {
  version: typeof SAVE_VERSION;
  highScore: number;
  unlockedLevel: number;
  settings: {
    music: number;
    sfx: number;
    haptics: boolean;
  };
};

export function defaultSave(): SaveV2 {
  return {
    version: SAVE_VERSION,
    highScore: 0,
    unlockedLevel: 1,
    settings: { music: 1, sfx: 1, haptics: true },
  };
}

export function migrateSave(value: unknown): SaveV2 {
  if (!value || typeof value !== 'object') return defaultSave();
  const raw = value as Record<string, unknown>;

  if (raw.version === 2) return raw as SaveV2;

  if (raw.version === 1) {
    return {
      version: 2,
      highScore: Number(raw.highScore ?? 0),
      unlockedLevel: Number(raw.unlockedLevel ?? 1),
      settings: { music: 1, sfx: 1, haptics: true },
    };
  }

  return defaultSave();
}
