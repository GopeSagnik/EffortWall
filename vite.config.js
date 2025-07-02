import { defineConfig } from "vite";
// Assuming you still have this plugin if you were using React
// import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  // Use process.env.VITE_REPO_NAME to get the repository name from the .env file
  // Ensure the environment variable is loaded correctly by Vite.
  // The 'base' path needs to start and end with a slash.
  base: `/${process.env.VITE_REPO_NAME || 'default-repo-name'}/`,

  plugins: [
    tailwindcss(),
    // If you were using React, uncomment the line below:
    // react(),
  ],

  // Ensure the build output directory is 'dist' (Vite's default)
  build: {
    outDir: 'dist',
  }
});
