import { invariant } from '@epic-web/invariant'
import { json, redirect } from '@remix-run/node'
import { prisma } from '#app/utils/db.server.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { type VerifyFunctionArgs } from './verify.server.ts'
const resetPasswordUsernameSessionKey = 'resetPasswordUsername'

export async function handleVerification({ submission }: VerifyFunctionArgs) {
	invariant(submission.value, 'submission.value should be defined by now')
	const target = submission.value.target
	const user = await prisma.user.findFirst({
		where: { OR: [{ primaryEmail: target }, { secondaryEmail: target }, { username: target }] },
		select: { primaryEmail: true, username: true },
	})
	// we don't want to say the user is not found if the email is not found
	// because that would allow an attacker to check if an email is registered
	if (!user) {
		submission.error.code = ['Invalid code']
		return json({ status: 'error', submission } as const, { status: 400 })
	}

	const verifySession = await verifySessionStorage.getSession()
	verifySession.set(resetPasswordUsernameSessionKey, user.username)
	return redirect('/reset-password', {
		headers: {
			'set-cookie': await verifySessionStorage.commitSession(verifySession),
		},
	})
}
