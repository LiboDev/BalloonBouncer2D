import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const files = ['index.html', 'style.css', 'src/platform.js', 'src/audio.js', 'src/game.js'];

for (const file of files) {
  const destination = join(root, 'dist', file);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(root, file), destination);
}

console.log(`Built Balloon Bouncer: ${files.length} runtime files in dist/`);
