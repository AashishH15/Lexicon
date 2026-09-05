#!/usr/bin/env node

import { main } from "./deepProofreadBenchmark.mjs";

main().catch((error) => {
  console.error(`deepProofreadBenchmark: ${error.message}`);
  process.exitCode = 1;
});
