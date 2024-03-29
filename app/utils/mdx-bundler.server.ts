import path from 'path'
import { bundleMDX } from 'mdx-bundler'

if (process.platform === 'win32') {
	process.env.ESBUILD_BINARY_PATH = path.join(process.cwd(), 'node_modules', 'esbuild', 'esbuild.exe')
} else {
	process.env.ESBUILD_BINARY_PATH = path.join(process.cwd(), 'node_modules', 'esbuild', 'bin', 'esbuild')
}

export async function parseMdx<FrontmatterType extends Record<string, unknown>>(mdx: string) {
	// prettier-ignore

	const { default: remarkAutolinkHeader } = await import("remark-autolink-headings");
	const { default: remarkGfm } = await import('remark-gfm')
	const { default: remarkSlug } = await import('remark-slug')
	const { default: remarkToc } = await import('remark-toc')
	const { default: rehypeHighlight } = await import('rehype-highlight')
	try {
		const { code, frontmatter } = await bundleMDX({
			source: mdx,
			xdmOptions: options => ({
				remarkPlugins: [
					...(options.remarkPlugins ?? []),
					remarkSlug,
					[remarkAutolinkHeader, { behavior: 'wrap' }],
					remarkGfm,
					remarkToc,
				],
				rehypePlugins: [...(options.rehypePlugins ?? []), rehypeHighlight],
			}),
		})

		return { code, frontmatter: frontmatter as FrontmatterType }
	} catch (e) {
		throw new Error(`MDX Compilation failed for ${mdx}`)
	}
}
