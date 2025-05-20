import { mergeConfig, type UserConfig } from 'vite';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default (config: UserConfig) => {
  return mergeConfig(config, {
    css: {
      postcss: {
        plugins: [
          tailwindcss(),
          autoprefixer(),
        ],
      },
    },
    resolve: {
      alias: {
        '@': '/src',
      },
    },
  });
};