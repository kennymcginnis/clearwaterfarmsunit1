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
	// mdx: async filename => {
	// 	const [remarkAutolinkHeader, remarkGfm, remarkSlug, remarkToc, rehypeHighlight] = await Promise.all([
	// 		import('remark-autolink-headings').then(mod => mod.default),
	// 		import('remark-gfm').then(mod => mod.default),
	// 		import('remark-slug').then(mod => mod.default),
	// 		import('remark-toc').then(mod => mod.default),
	// 		import('rehype-highlight').then(mod => mod.default),
	// 	])

	// 	return {
	// 		remarkPlugins: [remarkSlug, [remarkAutolinkHeader, { behavior: 'wrap' }], remarkGfm, remarkToc],
	// 		rehypePlugins: [rehypeHighlight],
	// 	}
	// },
}
