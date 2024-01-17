import { flatRoutes } from 'remix-flat-routes'

/**
 * @type {import('@remix-run/dev').AppConfig}
 */
export default {
	cacheDirectory: './node_modules/.cache/remix',
	ignoredRouteFiles: ['**/*'],
	serverModuleFormat: 'esm',
	serverPlatform: 'node',
	tailwind: true,
	postcss: true,
	watchPaths: ['./tailwind.config.ts'],
	browserNodeBuiltinsPolyfill: { modules: { buffer: true } },
	routes: async defineRoutes => {
		return flatRoutes('routes', defineRoutes, {
			ignoredRouteFiles: ['.*', '**/*.css', '**/*.test.{js,jsx,ts,tsx}', '**/__*.*'],
		})
	},
	mdx: async filename => {
		const [rehypeHighlight, remarkToc] = await Promise.all([
			import('rehype-highlight').then(mod => mod.default),
			import('remark-toc').then(mod => mod.default),
		])

		return {
			remarkPlugins: [remarkToc],
			rehypePlugins: [rehypeHighlight],
		}
	},
}
