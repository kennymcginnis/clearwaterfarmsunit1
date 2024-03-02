import { type Password, type User } from '@prisma/client'
import { type LoaderFunctionArgs, redirect } from '@remix-run/node'
import bcrypt from 'bcryptjs'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { prisma } from './db.server.ts'
import { combineHeaders } from './misc.tsx'
import { authSessionStorage } from './session.server.ts'

export const SESSION_EXPIRATION_TIME = 1000 * 60 * 60 * 24 * 30
export const getSessionExpirationDate = () => new Date(Date.now() + SESSION_EXPIRATION_TIME)

export const sessionKey = 'sessionId'

export async function getUserId(request: Request) {
	const authSession = await authSessionStorage.getSession(request.headers.get('cookie'))
	const sessionId = authSession.get(sessionKey)
	if (!sessionId) return null
	const session = await prisma.session.findUnique({
		select: { user: { select: { id: true } } },
		where: { id: sessionId, expirationDate: { gt: new Date() } },
	})
	if (!session?.user) {
		throw redirect('/', {
			headers: {
				'set-cookie': await authSessionStorage.destroySession(authSession),
			},
		})
	}
	return session.user.id
}

export async function requireUserId(request: Request, { redirectTo }: { redirectTo?: string | null } = {}) {
	const userId = await getUserId(request)
	if (!userId) {
		const requestUrl = new URL(request.url)
		redirectTo = redirectTo === null ? null : redirectTo ?? `${requestUrl.pathname}${requestUrl.search}`
		const loginParams = redirectTo ? new URLSearchParams({ redirectTo }) : null
		const loginRedirect = ['/login', loginParams?.toString()].filter(Boolean).join('?')
		throw redirect(loginRedirect)
	}
	return userId
}

export async function requireSelfOrAdmin(
	{ request, params }: { request: Request; params: LoaderFunctionArgs['params'] },
	{ redirectTo }: { redirectTo?: string | null } = {},
) {
	const selfId = await requireUserId(request, { redirectTo })
	const viewing = await prisma.user.findFirst({ select: { id: true }, where: { username: params.username } })
	// self
	if (viewing?.id !== selfId) {
		const isAdmin = await prisma.user.findUnique({ where: { id: selfId, roles: { some: { name: 'admin' } } } })
		if (!isAdmin) throw redirect('/members')
	}
	return selfId
}

export async function requireAnonymous(request: Request) {
	const userId = await getUserId(request)
	if (userId) {
		throw redirect('/')
	}
}

export async function login({ username, password }: { username: User['username']; password: string }) {
	const user = await verifyUserPassword({ username }, password)
	if (!user) return null
	const session = await prisma.session.create({
		select: { id: true, expirationDate: true, userId: true },
		data: {
			expirationDate: getSessionExpirationDate(),
			userId: user.id,
		},
	})
	return session
}

export async function resetUserPassword({ username, password }: { username: User['username']; password: string }) {
	const hashedPassword = await getPasswordHash(password)
	return prisma.user.update({
		where: { username },
		data: {
			password: {
				update: {
					hash: hashedPassword,
				},
			},
		},
	})
}

export async function logout(
	{
		request,
		redirectTo = '/',
	}: {
		request: Request
		redirectTo?: string
	},
	responseInit?: ResponseInit,
) {
	const authSession = await authSessionStorage.getSession(request.headers.get('cookie'))
	const sessionId = authSession.get(sessionKey)
	// if this fails, we still need to delete the session from the user's browser
	// and it doesn't do any harm staying in the db anyway.
	if (sessionId) {
		// the .catch is important because that's what triggers the query.
		// learn more about PrismaPromise: https://www.prisma.io/docs/orm/reference/prisma-client-reference#prismapromise-behavior
		void prisma.session.deleteMany({ where: { id: sessionId } }).catch(() => {})
	}
	throw redirect(safeRedirect(redirectTo), {
		...responseInit,
		headers: combineHeaders(
			{ 'set-cookie': await authSessionStorage.destroySession(authSession) },
			responseInit?.headers,
		),
	})
}

export async function getPasswordHash(password: string) {
	return await bcrypt.hash(password, 10)
}

export async function verifyUserPassword(where: Pick<User, 'username'> | Pick<User, 'id'>, password: Password['hash']) {
	const userWithPassword = await prisma.user.findUnique({
		select: { id: true, password: { select: { hash: true } } },
		where,
	})

	if (!userWithPassword || !userWithPassword.password) {
		return null
	}

	const isValid = await bcrypt.compare(password, userWithPassword.password.hash)

	if (!isValid) {
		return null
	}

	return { id: userWithPassword.id }
}

export async function shouldCreatePassword(userId: string) {
	const userWithPassword = await prisma.user.findUnique({
		select: { id: true, username: true, password: { select: { hash: true } } },
		where: { id: userId },
	})
	if (!userWithPassword || !userWithPassword.password) return true
	let { username } = userWithPassword
	if (username.length < 6) username = `${username}123456`.substring(0, 6)
	return await bcrypt.compare(username, userWithPassword.password.hash)
}
