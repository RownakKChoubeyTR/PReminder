/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind v4 PostCSS plugin (includes autoprefixer)
    '@tailwindcss/postcss': {},
  },
};

module.exports = config;
