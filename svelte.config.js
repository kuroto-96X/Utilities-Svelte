import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter({
      pages: 'dist',
      assets: 'dist'
    }),
    prerender: {
      handleHttpError: ({ status, path }) => {
        // Suppress 404 errors for routes that are still in development
        if (status === 404 && path.startsWith('/admin/shidasu-debug')) {
          return;
        }
        throw new Error(`Prerender error: ${status} ${path}`);
      }
    }
  }
};

export default config;