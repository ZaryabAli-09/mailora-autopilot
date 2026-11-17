// Compatibility entry for existing `nodemon index` development sessions.
// Production uses the compiled Nest entry point through `npm start`.
import { tsImport } from 'tsx/esm/api';

await tsImport('./src/main.ts', import.meta.url);
