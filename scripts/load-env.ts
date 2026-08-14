/**
 * Side-effect module: loads .env.local into process.env.
 *
 * Import this FIRST in any standalone script, before importing anything that
 * reads process.env at module load time — lib/supabase.ts and lib/openrouter.ts
 * both construct their clients the moment they're imported.
 *
 * Why a whole module for two lines: import statements are hoisted above
 * ordinary statements, so calling dotenv's config() inline at the top of a
 * script runs *after* every import has already executed, and the clients are
 * built with undefined values. Making the call an import instead means normal
 * import ordering controls when it happens.
 */
import { config } from "dotenv";

config({ path: ".env.local" });
