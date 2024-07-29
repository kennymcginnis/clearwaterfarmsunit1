import { useFormAction, useNavigation, Link, type LinkProps } from '@remix-run/react'
import { clsx, type ClassValue } from 'clsx'
import { format, parse } from 'date-fns'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as React from 'react'
import { useSpinDelay } from 'spin-delay'
import { extendTailwindMerge } from 'tailwind-merge'
import { extendedTheme } from './extended-theme.ts'

export function getUserImgSrc(imageId?: string | null, userId?: string | null) {
	if (imageId) return `/resources/user-images/${imageId}`
	if (userId) {
		const stripped = userId.replace(/\D/g, '')
		if (stripped) return `/img/${+stripped % 10}.jpg`
	}
	return `/img/${Math.floor(Math.random() * 10) % 10}.jpg`
}

export function getNoteImgSrc(imageId: string) {
	return `/resources/note-images/${imageId}`
}

export function getDocumentImgSrc(imageId: string) {
	return `/resources/document-images/${imageId}`
}

export function removeTrailingSlash(s: string) {
	return s.endsWith('/') ? s.slice(0, -1) : s
}

export function getOrigin(requestInfo?: { origin?: string; path: string }) {
	return requestInfo?.origin ?? 'https://kentcdodds.com'
}

export function getDisplayUrl(requestInfo?: { origin: string; path: string }) {
	return getUrl(requestInfo).replace(/^https?:\/\//, '')
}

export function getUrl(requestInfo?: { origin: string; path: string }) {
	return removeTrailingSlash(`${getOrigin(requestInfo)}${requestInfo?.path ?? ''}`)
}

export function typedBoolean<T>(value: T): value is Exclude<T, '' | 0 | false | null | undefined> {
	return Boolean(value)
}

export function getErrorMessage(error: unknown) {
	if (typeof error === 'string') return error
	if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
		return error.message
	}
	console.error('Unable to get error message for error', error)
	return 'Unknown Error'
}

function formatColors() {
	const colors = []
	for (const [key, color] of Object.entries(extendedTheme.colors)) {
		if (typeof color === 'string') {
			colors.push(key)
		} else {
			const colorGroup = Object.keys(color).map(subKey => (subKey === 'DEFAULT' ? '' : subKey))
			colors.push({ [key]: colorGroup })
		}
	}
	return colors
}

const customTwMerge = extendTailwindMerge<string, string>({
	extend: {
		theme: {
			colors: formatColors(),
			borderRadius: Object.keys(extendedTheme.borderRadius),
		},
		classGroups: {
			'font-size': [
				{
					text: Object.keys(extendedTheme.fontSize),
				},
			],
		},
	},
})

export function cn(...inputs: ClassValue[]) {
	return customTwMerge(clsx(inputs))
}

export function getDomainUrl(request: Request) {
	const host = request.headers.get('X-Forwarded-Host') ?? request.headers.get('host') ?? new URL(request.url).host
	const protocol = host.includes('localhost') ? 'http' : 'https'
	return `${protocol}://${host}`
}

export function getReferrerRoute(request: Request) {
	// spelling errors and whatever makes this annoyingly inconsistent
	// in my own testing, `referer` returned the right value, but 🤷‍♂️
	const referrer = request.headers.get('referer') ?? request.headers.get('referrer') ?? request.referrer
	const domain = getDomainUrl(request)
	if (referrer?.startsWith(domain)) {
		return referrer.slice(domain.length)
	} else {
		return '/'
	}
}

/**
 * Merge multiple headers objects into one (uses set so headers are overridden)
 */
export function mergeHeaders(...headers: Array<ResponseInit['headers'] | null | undefined>) {
	const merged = new Headers()
	for (const header of headers) {
		if (!header) continue
		for (const [key, value] of new Headers(header).entries()) {
			merged.set(key, value)
		}
	}
	return merged
}

/**
 * Combine multiple header objects into one (uses append so headers are not overridden)
 */
export function combineHeaders(...headers: Array<ResponseInit['headers'] | null | undefined>) {
	const combined = new Headers()
	for (const header of headers) {
		if (!header) continue
		for (const [key, value] of new Headers(header).entries()) {
			combined.append(key, value)
		}
	}
	return combined
}

/**
 * Combine multiple response init objects into one (uses combineHeaders)
 */
export function combineResponseInits(...responseInits: Array<ResponseInit | null | undefined>) {
	let combined: ResponseInit = {}
	for (const responseInit of responseInits) {
		combined = {
			...responseInit,
			headers: combineHeaders(combined.headers, responseInit?.headers),
		}
	}
	return combined
}

/**
 * Returns true if the current navigation is submitting the current route's
 * form. Defaults to the current route's form action and method POST.
 *
 * Defaults state to 'non-idle'
 *
 * NOTE: the default formAction will include query params, but the
 * navigation.formAction will not, so don't use the default formAction if you
 * want to know if a form is submitting without specific query params.
 */
export function useIsPending({
	formAction,
	formMethod = 'POST',
	state = 'non-idle',
}: {
	formAction?: string
	formMethod?: 'POST' | 'GET' | 'PUT' | 'PATCH' | 'DELETE'
	state?: 'submitting' | 'loading' | 'non-idle'
} = {}) {
	const contextualFormAction = useFormAction()
	const navigation = useNavigation()
	const isPendingState = state === 'non-idle' ? navigation.state !== 'idle' : navigation.state === state
	return (
		isPendingState &&
		navigation.formAction === (formAction ?? contextualFormAction) &&
		navigation.formMethod === formMethod
	)
}

/**
 * This combines useSpinDelay (from https://npm.im/spin-delay) and useIsPending
 * from our own utilities to give you a nice way to show a loading spinner for
 * a minimum amount of time, even if the request finishes right after the delay.
 *
 * This avoids a flash of loading state regardless of how fast or slow the
 * request is.
 */
export function useDelayedIsPending({
	formAction,
	formMethod,
	delay = 400,
	minDuration = 300,
}: Parameters<typeof useIsPending>[0] & Parameters<typeof useSpinDelay>[1] = {}) {
	const isPending = useIsPending({ formAction, formMethod })
	const delayedIsPending = useSpinDelay(isPending, {
		delay,
		minDuration,
	})
	return delayedIsPending
}

function callAll<Args extends Array<unknown>>(...fns: Array<((...args: Args) => unknown) | undefined>) {
	return (...args: Args) => fns.forEach(fn => fn?.(...args))
}

/**
 * Use this hook with a button and it will make it so the first click sets a
 * `doubleCheck` state to true, and the second click will actually trigger the
 * `onClick` handler. This allows you to have a button that can be like a
 * "are you sure?" experience for the user before doing destructive operations.
 */
export function useDoubleCheck() {
	const [doubleCheck, setDoubleCheck] = useState(false)

	function getButtonProps(props?: React.ButtonHTMLAttributes<HTMLButtonElement>) {
		const onBlur: React.ButtonHTMLAttributes<HTMLButtonElement>['onBlur'] = () => setDoubleCheck(false)

		const onClick: React.ButtonHTMLAttributes<HTMLButtonElement>['onClick'] = doubleCheck
			? undefined
			: e => {
					e.preventDefault()
					setDoubleCheck(true)
				}

		const onKeyUp: React.ButtonHTMLAttributes<HTMLButtonElement>['onKeyUp'] = e => {
			if (e.key === 'Escape') {
				setDoubleCheck(false)
			}
		}

		return {
			...props,
			onBlur: callAll(onBlur, props?.onBlur),
			onClick: callAll(onClick, props?.onClick),
			onKeyUp: callAll(onKeyUp, props?.onKeyUp),
		}
	}

	return { doubleCheck, getButtonProps }
}

/**
 * Simple debounce implementation
 */
function debounce<Callback extends (...args: Parameters<Callback>) => void>(fn: Callback, delay: number) {
	let timer: ReturnType<typeof setTimeout> | null = null
	return (...args: Parameters<Callback>) => {
		if (timer) clearTimeout(timer)
		timer = setTimeout(() => {
			fn(...args)
		}, delay)
	}
}

type AnchorProps = React.DetailedHTMLProps<React.AnchorHTMLAttributes<HTMLAnchorElement>, HTMLAnchorElement>

export const AnchorOrLink = React.forwardRef<
	HTMLAnchorElement,
	AnchorProps & {
		reload?: boolean
		to?: LinkProps['to']
		prefetch?: LinkProps['prefetch']
	}
>(function AnchorOrLink(props, ref) {
	const { to, href, download, reload = false, prefetch, children, ...rest } = props
	let toUrl = ''
	let shouldUserRegularAnchor = reload || download

	if (!shouldUserRegularAnchor && typeof href === 'string') {
		shouldUserRegularAnchor = href.includes(':') || href.startsWith('#')
	}

	if (!shouldUserRegularAnchor && typeof to === 'string') {
		toUrl = to
		shouldUserRegularAnchor = to.includes(':')
	}

	if (!shouldUserRegularAnchor && typeof to === 'object') {
		toUrl = `${to.pathname ?? ''}${to.hash ? `#${to.hash}` : ''}${to.search ? `?${to.search}` : ''}`
		shouldUserRegularAnchor = to.pathname?.includes(':')
	}

	if (shouldUserRegularAnchor) {
		return (
			<a {...rest} download={download} href={href ?? toUrl} ref={ref}>
				{children}
			</a>
		)
	} else {
		return (
			<Link prefetch={prefetch} to={to ?? href ?? ''} {...rest} ref={ref}>
				{children}
			</Link>
		)
	}
})

/**
 * Debounce a callback function
 */
export function useDebounce<Callback extends (...args: Parameters<Callback>) => ReturnType<Callback>>(
	callback: Callback,
	delay: number,
) {
	const callbackRef = useRef(callback)
	useEffect(() => {
		callbackRef.current = callback
	})
	return useMemo(() => debounce((...args: Parameters<Callback>) => callbackRef.current(...args), delay), [delay])
}

export async function downloadFile(url: string, retries: number = 0) {
	const MAX_RETRIES = 3
	try {
		const response = await fetch(url)
		if (!response.ok) {
			throw new Error(`Failed to fetch image with status ${response.status}`)
		}
		const contentType = response.headers.get('content-type') ?? 'image/jpg'
		const blob = Buffer.from(await response.arrayBuffer())
		return { contentType, blob }
	} catch (e) {
		if (retries > MAX_RETRIES) throw e
		return downloadFile(url, retries + 1)
	}
}
export function getRequiredEnvVar(key: string, env = process.env): string {
	if (key in env && typeof env[key] === 'string') {
		return env[key] ?? ''
	}

	throw new Error(`Environment variable ${key} is not defined`)
}

export type UserSchedule = {
	ditch: number
	hours: number | null
	start: Date | null
	stop: Date | null
	previous: number | null
	schedule: string[]
}
export type UserSchedules = UserSchedule[]

export function formatUserSchedule(
	user: {
		ports: { ditch: number }[]
	},
	userSchedules:
		| {
				ditch: number
				start: Date | null
				stop: Date | null
				hours: number
		  }[]
		| undefined,
	previousUserSchedules?:
		| {
				ditch: number
				start: Date | null
				stop: Date | null
				hours: number
		  }[]
		| undefined,
): UserSchedules {
	return user.ports.map(port => {
		const empty = {
			ditch: port.ditch,
			hours: null,
			start: null,
			stop: null,
		}
		const found = userSchedules?.find(us => us.ditch === port.ditch) ?? empty
		const { hours } = previousUserSchedules?.find(us => us.ditch === port.ditch) ?? empty
		return {
			...found,
			previous: hours,
			schedule: formatDates({ start: found?.start, stop: found?.stop }),
		}
	})
}

export function formatDay(deadline: string): string {
	const deadlineDate = parse(deadline, 'yyyy-MM-dd', new Date())
	return format(deadlineDate, 'eeee')
}

export function formatDates({
	start,
	stop,
}: {
	start: Date | null | undefined
	stop: Date | null | undefined
}): string[] {
	if (!start || !stop) return ['', '']
	if (start.getDay() === stop.getDay()) {
		return [format(start, 'eee, MMM do'), `${format(start, 'h:mmaaa')}-${format(stop, 'h:mmaaa')}`]
	} else {
		return [format(start, 'eee, MMM dd, h:mmaaa'), format(stop, 'eee, MMM dd, h:mmaaa')]
	}
}

export function formatPrintableDates({ start, stop }: { start: Date | null; stop: Date | null }): string {
	if (!start || !stop) return ''
	if (start.getDay() === stop.getDay()) {
		return `"${format(start, 'eee, MMM do')}
${format(start, 'h:mmaaa')} - ${format(stop, 'h:mmaaa')}"`
	} else {
		return `"${format(start, 'eee, MMM dd, h:mmaaa')} -
${format(stop, 'eee, MMM dd, h:mmaaa')}"`
	}
}

export const formatCurrency = (n: number | null): string =>
	n ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'

export function formatDisplayName({ display, member }: { display: string; member: string | null }): string {
	let output = display
	if (output.includes('-')) output = output.replaceAll('-', ', ')
	if (member && member.toLowerCase().startsWith(output)) return member.substring(0, output.length)
	return capitalizeFirstLetter(output)
}

export function capitalizeFirstLetter([first = '', ...rest]: string): string {
	return [first.toUpperCase(), ...rest].join('')
}

export function getVariantForState(
	state: string,
): 'open' | 'default' | 'destructive' | 'outline' | 'secondary' | null | undefined {
	switch (state) {
		case 'pending':
			return 'outline'
		case 'open':
			return 'default'
		case 'locked':
			return 'secondary'
		case 'closed':
			return 'destructive'
	}
}

export const formatHours = (hours: number | null) =>
	!hours ? '' : hours === 1 ? '1-hour' : hours % 1 === 0 ? `${hours}-hours` : `${hours}-hrs`

export const formatHrs = (hours: number | null) => (!hours ? '' : hours === 1 ? '1-hr' : `${hours}-hrs`)

export const formatBalance = (balance: number): string => (!balance ? '' : balance % 1 === 0 ? `$${balance}` : `$${balance}0`)
