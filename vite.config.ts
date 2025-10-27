import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    publicDir: 'public',
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                upload: resolve(__dirname, 'upload.html'),
            }
        }
    },
    resolve: {
        alias: {
            '@': resolve(__dirname, './src')
        },
        extensions: ['.ts', '.tsx', '.js', '.jsx', '.json']
    },
    esbuild: {
        target: 'esnext',
        loader: 'ts',
        include: /\.(ts|tsx)$/,
        exclude: []
    },
    optimizeDeps: {
        esbuildOptions: {
            target: 'esnext',
            loader: {
                '.ts': 'ts',
                '.tsx': 'tsx'
            }
        }
    }
})
