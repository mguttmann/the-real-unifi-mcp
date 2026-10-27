// Loads a `.env` from the working directory into unset variables (BACKLOG
// N-58: behaviour kept). Imported first by src/index.ts so it runs before any
// other module. stdout carries the stdio JSON-RPC stream, so dotenv must never
// print: `quiet` and `debug` are fixed here and win over DOTENV_QUIET,
// DOTENV_DEBUG (and the DOTENV_CONFIG_* names) and over `.env` entries.
// DOTENV_CONFIG_PATH, DOTENV_CONFIG_ENCODING and DOTENV_CONFIG_OVERRIDE (and
// their DOTENV_* aliases) still apply.
import { config } from "dotenv";

config({ quiet: true, debug: false });
