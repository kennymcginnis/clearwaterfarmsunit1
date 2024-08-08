import { useForm } from '@conform-to/react'
import { parse } from '@conform-to/zod'
import { cssBundleHref } from '@remix-run/css-bundle'
import {
	json,
	type LoaderFunctionArgs,
	type HeadersFunction,
	type LinksFunction,
	type MetaFunction,
	type ActionFunctionArgs,
} from '@remix-run/node'
import {
	Form,
	Link,
	Links,
	LiveReload,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useFetchers,
	useLoaderData,
	useSubmit,
	useFetcher,
} from '@remix-run/react'
import { withSentry } from '@sentry/remix'
import { useRef } from 'react'
import { AuthenticityTokenProvider } from 'remix-utils/csrf/react'
import { HoneypotProvider } from 'remix-utils/honeypot/react'
import { z } from 'zod'
import { Icon, href as iconsHref } from '#app/components/ui/icon.tsx'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { Footer } from './components/main-footer.tsx'
import { MainNavigationMenu } from './components/main-nav.tsx'
import { EpicProgress } from './components/progress-bar.tsx'
import { useToast } from './components/toaster.tsx'
import { Button } from './components/ui/button.tsx'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuPortal,
	DropdownMenuTrigger,
} from './components/ui/dropdown-menu.tsx'

import { EpicToaster } from './components/ui/sonner.tsx'
import tailwindStyleSheetUrl from './styles/tailwind.css'
import { getUserId, logout } from './utils/auth.server.ts'
import { ClientHintCheck, getHints, useHints } from './utils/client-hints.tsx'
import { csrf } from './utils/csrf.server.ts'
import { prisma } from './utils/db.server.ts'
import { getEnv } from './utils/env.server.ts'
import { honeypot } from './utils/honeypot.server.ts'
import { combineHeaders, getDomainUrl, getUserImgSrc } from './utils/misc.tsx'
import { useNonce } from './utils/nonce-provider.ts'
import { useRequestInfo } from './utils/request-info.ts'
import { type Theme, getTheme, setTheme } from './utils/theme.server.ts'
import { makeTimings, time } from './utils/timing.server.ts'
import { getToast } from './utils/toast.server.ts'
import { useOptionalUser } from './utils/user.ts'

export const links: LinksFunction = () => {
	return [
		// Preload svg sprite as a resource to avoid render blocking
		{ rel: 'preload', href: iconsHref, as: 'image' },
		// Preload CSS as a resource to avoid render blocking
		{ rel: 'preload', href: tailwindStyleSheetUrl, as: 'style' },
		cssBundleHref ? { rel: 'preload', href: cssBundleHref, as: 'style' } : null,
		{ rel: 'mask-icon', href: '/favicons/mask-icon.svg' },
		{
			rel: 'alternate icon',
			type: 'image/png',
			href: '/favicons/favicon-32x32.png',
		},
		{ rel: 'apple-touch-icon', href: '/favicons/apple-touch-icon.png' },
		{
			rel: 'manifest',
			href: '/site.webmanifest',
			crossOrigin: 'use-credentials',
		} as const, // necessary to make typescript happy
		//These should match the css preloads above to avoid css as render blocking resource
		{ rel: 'icon', type: 'image/svg+xml', href: '/favicons/favicon.svg' },
		{ rel: 'stylesheet', href: tailwindStyleSheetUrl },
		cssBundleHref ? { rel: 'stylesheet', href: cssBundleHref } : null,
	].filter(Boolean)
}

export const meta: MetaFunction<typeof loader> = ({ data }) => {
	return [
		{ title: data ? 'Clearwater Farms 1' : 'Error | Clearwater Farms 1' },
		{ name: 'description', content: `Your own captain's log` },
	]
}

export async function loader({ request }: LoaderFunctionArgs) {
	const timings = makeTimings('root loader')
	const userId = await time(() => getUserId(request), {
		timings,
		type: 'getUserId',
		desc: 'getUserId in root',
	})

	const user = userId
		? await time(
				() =>
					prisma.user.findUniqueOrThrow({
						select: {
							id: true,
							member: true,
							username: true,
							display: true,
							image: { select: { id: true } },
							roles: {
								select: {
									name: true,
									permissions: {
										select: { entity: true, action: true, access: true },
									},
								},
							},
						},
						where: { id: userId },
					}),
				{ timings, type: 'find user', desc: 'find user in root' },
			)
		: null
	if (userId && !user) {
		console.info('something weird happened')
		// something weird happened... The user is authenticated but we can't find
		// them in the database. Maybe they were deleted? Let's log them out.
		await logout({ request, redirectTo: '/' })
	}
	const { toast, headers: toastHeaders } = await getToast(request)
	const honeyProps = honeypot.getInputProps()
	const [csrfToken, csrfCookieHeader] = await csrf.commitToken()

	const open = await time(
		() =>
			prisma.schedule.findFirst({
				select: { date: true },
				where: { state: 'open' },
				orderBy: { date: 'desc' },
			}),
		{
			timings,
			type: 'find open schedule',
			desc: 'find open schedule in root',
		},
	)
	const closed = await time(
		() =>
			prisma.schedule.findMany({
				select: { date: true },
				where: { state: 'closed' },
				orderBy: { date: 'desc' },
				take: 2
			}),
		{
			timings,
			type: 'find latest closed schedule',
			desc: 'find latest closed schedule in root',
		},
	)

	return json(
		{
			user,
			open,
			closed,
			requestInfo: {
				hints: getHints(request),
				origin: getDomainUrl(request),
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
			},
			ENV: getEnv(),
			toast,
			honeyProps,
			csrfToken,
		},
		{
			headers: combineHeaders(
				{ 'Server-Timing': timings.toString() },
				toastHeaders,
				csrfCookieHeader ? { 'set-cookie': csrfCookieHeader } : null,
			),
		},
	)
}

export const ThemeFormSchema = z.object({ theme: z.enum(['system', 'light', 'dark']) })
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, {
		schema: ThemeFormSchema,
	})
	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
	const { theme } = submission.value

	const responseInit = {
		headers: { 'set-cookie': setTheme(theme) },
	}
	return json({ success: true, submission }, responseInit)
}

export const headers: HeadersFunction = ({ loaderHeaders }) => {
	const headers = {
		'Server-Timing': loaderHeaders.get('Server-Timing') ?? '',
	}
	return headers
}

export type RootLoaderType = typeof loader

function Document({
	children,
	nonce,
	theme = 'light',
	env = {},
}: {
	children: React.ReactNode
	nonce: string
	theme?: Theme
	env?: Record<string, string>
}) {
	return (
		<html lang="en" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				<ClientHintCheck nonce={nonce} />
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				<Links />
			</head>
			<body className="bg-background text-foreground">
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
				<LiveReload nonce={nonce} />
			</body>
		</html>
	)
}

function App() {
	const data = useLoaderData<typeof loader>()
	const nonce = useNonce()
	const theme = useTheme()
	useToast(data.toast)

	return (
		<Document nonce={nonce} theme={theme} env={data.ENV}>
			<div className="flex h-screen flex-col">
				<header className="sticky top-0 flex flex-col bg-background px-6 py-6 text-foreground hover:z-10">
					<div className="flex items-center justify-between gap-4 md:gap-8">
						<img src="/img/cwf.svg" className="dark:light-filter h-12" alt="CWF" />
						<Link to="/" className="group flex flex-wrap items-center leading-snug md:max-2xl:hidden">
							<span className="text-lg font-bold transition group-hover:translate-y-1">Clearwater Farms&nbsp;</span>
							<span className="text-md text-nowrap font-light transition group-hover:-translate-y-1">Unit 1</span>
						</Link>
						<div id="row1-nav" className="flex max-md:hidden">
							<MainNavigationMenu open={data.open} closed={data.closed} />
						</div>
						<div id="row1-profile" className="flex gap-1 md:max-lg:hidden">
							<ThemeSwitch userPreference={data.requestInfo.userPrefs.theme} />
							<UserProfile />
						</div>
					</div>
					<div id="row2-icons" className="flex md:hidden">
						<MainNavigationMenu open={data.open} closed={data.closed} />
					</div>
					<div id="row2-logo" className="hidden w-full justify-between p-1 lg:max-2xl:flex">
						<Link to="/" className="group flex flex-wrap items-center leading-snug">
							<span className="text-lg font-bold transition group-hover:translate-y-1">Clearwater Farms&nbsp;</span>
							<span className="text-md font-light transition group-hover:-translate-y-1">Unit 1</span>
						</Link>
					</div>
					<div id="row2-profile" className="hidden w-full justify-between md:max-lg:flex">
						<Link to="/" className="group flex flex-wrap items-center leading-snug">
							<span className="text-lg font-bold transition group-hover:translate-y-1">Clearwater Farms&nbsp;</span>
							<span className="text-md font-light transition group-hover:-translate-y-1">Unit 1</span>
						</Link>
						<div className="flex flex-row gap-1">
							<ThemeSwitch userPreference={data.requestInfo.userPrefs.theme} />
							<UserProfile />
						</div>
					</div>
				</header>
				<Outlet />
				<Footer userPreference={data.requestInfo.userPrefs.theme} />
			</div>
			<EpicToaster closeButton position="top-center" theme={theme} />
			<EpicProgress />
		</Document>
	)
}

function UserProfile() {
	const user = useOptionalUser()
	const submit = useSubmit()
	const formRef = useRef<HTMLFormElement>(null)
	return (
		<div className="flex items-center gap-5">
			{user ? (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button asChild variant="secondary">
							<Link
								to={`/member/${user.username}`}
								// this is for progressive enhancement
								onClick={e => e.preventDefault()}
								className="flex items-center gap-2"
							>
								<img
									className="h-8 w-8 rounded-full object-cover"
									alt={user.member ?? user.username}
									src={getUserImgSrc(user.image?.id, user.id)}
								/>
								<span className="flex overflow-hidden text-ellipsis text-nowrap text-body-sm font-bold">
									{user.member ?? user.username}
								</span>
							</Link>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuPortal>
						<DropdownMenuContent sideOffset={8} align="start">
							<DropdownMenuItem asChild>
								<Link prefetch="intent" to={`/member/${user.username}/contact`}>
									<Icon className="m-2 text-body-md" name="avatar">
										Profile
									</Icon>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link prefetch="intent" to={`/member/${user.username}/irrigation`}>
									<Icon className="m-2 text-body-md" name="droplets">
										Irrigation
									</Icon>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem asChild>
								<Link prefetch="intent" to={`/member/${user.username}/transactions`}>
									<Icon className="m-2 text-body-md" name="reader">
										Transactions
									</Icon>
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								asChild
								// this prevents the menu from closing before the form submission is completed
								onSelect={event => {
									event.preventDefault()
									submit(formRef.current)
								}}
							>
								<Form action="/logout" method="POST" ref={formRef}>
									<Icon className="m-2 text-body-md" name="exit">
										<button type="submit">Logout</button>
									</Icon>
								</Form>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenuPortal>
				</DropdownMenu>
			) : (
				<Button asChild variant="default" size="lg">
					<Link to="/login" className="text-nowrap">
						Log In
					</Link>
				</Button>
			)}
		</div>
	)
}

function AppWithProviders() {
	const data = useLoaderData<typeof loader>()
	return (
		<AuthenticityTokenProvider token={data.csrfToken}>
			<HoneypotProvider {...data.honeyProps}>
				<App />
			</HoneypotProvider>
		</AuthenticityTokenProvider>
	)
}

export default withSentry(AppWithProviders)

/**
 * @returns the user's theme preference, or the client hint theme if the user
 * has not set a preference.
 */
export function useTheme() {
	const hints = useHints()
	const requestInfo = useRequestInfo()
	const optimisticMode = useOptimisticThemeMode()
	if (optimisticMode) {
		return optimisticMode === 'system' ? hints.theme : optimisticMode
	}
	return requestInfo.userPrefs.theme ?? hints.theme
}

/**
 * If the user's changing their theme mode preference, this will return the
 * value it's being changed to.
 */

export function useOptimisticThemeMode() {
	const fetchers = useFetchers()
	const themeFetcher = fetchers.find(f => f.formAction === '/')

	if (themeFetcher && themeFetcher.formData) {
		const submission = parse(themeFetcher.formData, {
			schema: ThemeFormSchema,
		})
		return submission.value?.theme
	}
}

function ThemeSwitch({ userPreference }: { userPreference?: Theme | null }) {
	const fetcher = useFetcher<typeof action>()

	const [form] = useForm({
		id: 'theme-switch',
		lastSubmission: fetcher.data?.submission,
	})

	const optimisticMode = useOptimisticThemeMode()
	const mode = optimisticMode ?? userPreference ?? 'system'
	const nextMode = mode === 'system' ? 'light' : mode === 'light' ? 'dark' : 'system'
	const modeLabel = {
		light: (
			<Icon name="sun">
				<span className="sr-only">Light</span>
			</Icon>
		),
		dark: (
			<Icon name="moon">
				<span className="sr-only">Dark</span>
			</Icon>
		),
		system: (
			<Icon name="laptop">
				<span className="sr-only">System</span>
			</Icon>
		),
	}

	return (
		<fetcher.Form method="POST" {...form.props}>
			<input type="hidden" name="theme" value={nextMode} />
			<div className="flex gap-2">
				<button
					type="submit"
					className="inline-flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border-2 border-secondary p-1 transition hover:border-primary focus:border-primary focus:outline-none"
				>
					{modeLabel[mode]}
				</button>
			</div>
		</fetcher.Form>
	)
}

export function ErrorBoundary() {
	// the nonce doesn't rely on the loader so we can access that
	const nonce = useNonce()

	// NOTE: you cannot use useLoaderData in an ErrorBoundary because the loader
	// likely failed to run so we have to do the best we can.
	// We could probably do better than this (it's possible the loader did run).
	// This would require a change in Remix.

	// Just make sure your root route never errors out and you'll always be able
	// to give the user a better UX.

	return (
		<Document nonce={nonce}>
			<GeneralErrorBoundary />
		</Document>
	)
}
