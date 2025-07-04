import { defineConfig } from "vite";
// If you are using React, you might have this import:
// import react from '@vitejs/plugin-react';
import tailwindcss from "@tailwindcss/vite";

// https://vitejs.dev/config/
export default defineConfig({
  // IMPORTANT: This 'base' property tells Vite where your assets will be located.
  // For https://gopesagnik.github.io/effortwall/, the base path is '/effortwall/'.
  // Ensure your .env file has VITE_REPO_NAME="effortwall"
  base: `/${process.env.VITE_REPO_NAME || 'effortwall'}/`,

  plugins: [
    tailwindcss(),
    // If you are using React, uncomment the line below:
    // react(),
  ],

  // Ensure the build output directory is 'dist' (Vite's default)
  build: {
    outDir: 'dist',
  }
});
