import { bundleMDX } from 'mdx-bundler'

export async function parseMdx<FrontmatterType extends Record<string, unknown>>(
	mdx: string,
) {
	// prettier-ignore
	const { default: remarkAutolinkHeader } = await import("remark-autolink-headings");
	const { default: remarkGfm } = await import('remark-gfm')
	const { default: remarkSlug } = await import('remark-slug')
	const { default: rehypeHighlight } = await import('rehype-highlight')

	try {
		const { code, frontmatter } = await bundleMDX({
			source: mdx,
			mdxOptions: options => ({
				remarkPlugins: [
					...(options.remarkPlugins ?? []),
					remarkSlug,
					[remarkAutolinkHeader, { behavior: 'wrap' }],
					remarkGfm,
				],
				rehypePlugins: [...(options.rehypePlugins ?? []), rehypeHighlight],
			}),
		})

		return { code, frontmatter: frontmatter as FrontmatterType }
	} catch (e) {
		throw new Error(`MDX Compilation failed for ${mdx}`)
	}
}
