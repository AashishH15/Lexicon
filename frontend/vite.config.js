import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@tiptap/pm")) return "vendor-tiptap-pm";
          if (id.includes("node_modules/@tiptap")) return "vendor-tiptap";
          if (id.includes("node_modules/katex")) return "vendor-katex";
          if (id.includes("node_modules/lowlight") || id.includes("node_modules/highlight")) return "vendor-lowlight";
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom")) return "vendor-react";
          if (id.includes("node_modules/@phosphor-icons") || id.includes("node_modules/marked") || id.includes("node_modules/turndown")) return "vendor-misc";
        },
      },
    },
  },
});
