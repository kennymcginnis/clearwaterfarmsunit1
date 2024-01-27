/// <reference types="@remix-run/node" />
/// <reference types="vite/client" />

import { type Call, type Session, type User } from '@prisma/client'
import type calculateReadingTime from 'reading-time'

type NonNullProperties<Type> = {
	[Key in keyof Type]-?: Exclude<Type[Key], null | undefined>
}
type Await<Type> = Type extends Promise<infer Value> ? Await<Value> : Type

type MdxPage = {
	code: string
	slug: string
	editLink: string
	readTime?: ReturnType<typeof calculateReadingTime>
	dateDisplay?: string

	/**
	 * It's annoying that all these are set to optional I know, but there's
	 * no great way to ensure that the MDX files have these properties,
	 * especially when a common use case will be to edit them without running
	 * the app or build. So we're going to force you to handle situations when
	 * these values are missing to avoid runtime errors.
	 */
	frontmatter: {
		archived?: boolean
		draft?: boolean
		unlisted?: boolean
		title?: string
		description?: string
		meta?: {
			keywords?: Array<string>
			[key as string]: string
		}

		// Post meta
		categories?: Array<string>
		date?: string
		bannerBlurDataUrl?: string
		bannerCloudinaryId?: string
		bannerCredit?: string
		bannerAlt?: string
		bannerTitle?: string
		socialImageTitle?: string
		socialImagePreTitle?: string
		translations?: Array<{
			language: string
			link: string
			author?: {
				name: string
				link?: string
			}
		}>
	}
}

/**
 * This is a separate type from MdxPage because the code string is often
 * pretty big and the pages that simply list the pages shouldn't include the code.
 */
type MdxListItem = Omit<MdxPage, 'code'>

type Link = {
	name: string
	url: string
}
type GitHubFile = { path: string; content: string }

export { NonNullProperties, Await, User, Call, Session, MdxPage, MdxListItem, GitHubFile }
