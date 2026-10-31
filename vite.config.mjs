import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({base:'./',plugins:[react()],build:{target:'es2022',chunkSizeWarningLimit:600,rollupOptions:{output:{manualChunks:{three:['three','three/addons/controls/OrbitControls.js'],react:['react','react-dom/client']}}}}});
