import { mergeConfig, type UserConfig } from 'vite';

export default (config: UserConfig) => {
  return mergeConfig(config, {
    css: {
      postcss: {
        plugins: [
          require('autoprefixer'),
        ],
      },
    },
    build: {
      target: 'esnext',
      minify: 'esbuild',
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'esnext',
      },
    },
  });
};