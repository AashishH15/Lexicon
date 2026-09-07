#!/usr/bin/env node

import { main } from "./gecFluencyBenchmark.mjs";

main().catch((error) => {
  console.error(`gecFluencyBenchmark: ${error.message}`);
  process.exitCode = 1;
});
