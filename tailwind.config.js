module.exports = {
  content: [
    './src/**/*.{js,jsx,ts,tsx}',
    './src/api/**/*.{js,jsx,ts,tsx}',
    './src/admin/**/*.{js,jsx,ts,tsx}',
    './src/components/**/*.{js,jsx,ts,tsx}'
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  }
};