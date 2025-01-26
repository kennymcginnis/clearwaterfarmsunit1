import { invariant } from '@epic-web/invariant'
import { redirect } from '@remix-run/node'
import { safeRedirect } from 'remix-utils/safe-redirect'
import { sessionKey } from '#app/utils/auth.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { combineResponseInits } from '#app/utils/misc.tsx'
import { authSessionStorage } from '#app/utils/session.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { type VerifyFunctionArgs } from './verify.tsx'

const verifiedTimeKey = 'verified-time'
const unverifiedSessionIdKey = 'unverified-session-id'
const rememberKey = 'remember'

export async function handleNewSession(
	{
		request,
		session,
		redirectTo,
		remember,
	}: {
		request: Request
		session: { userId: string; id: string; expirationDate: Date }
		redirectTo?: string
		remember: boolean
	},
	responseInit?: ResponseInit,
) {
	const authSession = await authSessionStorage.getSession(request.headers.get('cookie'))
	authSession.set(sessionKey, session.id)

	return redirect(
		safeRedirect(redirectTo),
		combineResponseInits(
			{
				headers: {
					'set-cookie': await authSessionStorage.commitSession(authSession, {
						expires: remember ? session.expirationDate : undefined,
					}),
				},
			},
			responseInit,
		),
	)
}

export async function handleVerification({ request, submission }: VerifyFunctionArgs) {
	invariant(submission.value, 'Submission should have a value by this point')
	const authSession = await authSessionStorage.getSession(request.headers.get('cookie'))
	const verifySession = await verifySessionStorage.getSession(request.headers.get('cookie'))

	const remember = verifySession.get(rememberKey)
	const { redirectTo } = submission.value
	const headers = new Headers()
	authSession.set(verifiedTimeKey, Date.now())

	const unverifiedSessionId = verifySession.get(unverifiedSessionIdKey)
	if (unverifiedSessionId) {
		const session = await prisma.session.findUnique({
			select: { expirationDate: true },
			where: { id: unverifiedSessionId },
		})
		if (!session) {
			throw await redirectWithToast('/login', {
				type: 'error',
				title: 'Invalid session',
				description: 'Could not find session to verify. Please try again.',
			})
		}
		authSession.set(sessionKey, unverifiedSessionId)

		headers.append(
			'set-cookie',
			await authSessionStorage.commitSession(authSession, {
				expires: remember ? session.expirationDate : undefined,
			}),
		)
	} else {
		headers.append('set-cookie', await authSessionStorage.commitSession(authSession))
	}

	headers.append('set-cookie', await verifySessionStorage.destroySession(verifySession))

	return redirect(safeRedirect(redirectTo), { headers })
}
