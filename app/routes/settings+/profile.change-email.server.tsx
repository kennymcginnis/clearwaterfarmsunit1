import { invariant } from '@epic-web/invariant'
import { json } from '@remix-run/node'
import { EmailChangeNoticeEmail } from '#app/components/email/EmailChangeNoticeEmail'
import { type VerifyFunctionArgs } from '#app/routes/_auth+/verify.tsx'
import { prisma } from '#app/utils/db.server.ts'
import { sendEmail } from '#app/utils/email.server.ts'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { saveUserAudit } from '#app/utils/user-audit.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'

const newEmailAddressSessionKey = 'new-email-address'

export async function handleVerification({ request, submission }: VerifyFunctionArgs) {
	invariant(submission.value, 'submission.value should be defined by now')

	const verifySession = await verifySessionStorage.getSession(request.headers.get('cookie'))
	const newEmail = verifySession.get(newEmailAddressSessionKey)
	if (!newEmail) {
		submission.error[''] = ['You must submit the code on the same device that requested the email change.']
		return json({ status: 'error', submission } as const, { status: 400 })
	}
	const preUpdateUser = await prisma.user.findFirstOrThrow({
		select: { primaryEmail: true },
		where: { id: submission.value.target },
	})
	const user = await prisma.user.update({
		where: { id: submission.value.target },
		select: { id: true, primaryEmail: true, username: true },
		data: { primaryEmail: newEmail },
	})

	await saveUserAudit({
		userId: user.id,
		field: 'primary-email',
		from: preUpdateUser.primaryEmail,
		to: user.primaryEmail,
		updatedBy: user.id,
	})

	if (preUpdateUser.primaryEmail) {
		void sendEmail({
			to: preUpdateUser.primaryEmail,
			subject: 'Clearwater Farms Unit 1 email changed',
			react: <EmailChangeNoticeEmail userId={user.id} />,
		})
	}

	return redirectWithToast(
		'/settings/profile',
		{
			title: 'Primary Email Changed',
			type: 'success',
			description: `Your primary email has been changed to ${user.primaryEmail}`,
		},
		{
			headers: {
				'set-cookie': await verifySessionStorage.destroySession(verifySession),
			},
		},
	)
}
