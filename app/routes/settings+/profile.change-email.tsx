import { conform, useForm } from '@conform-to/react'
import { getFieldsetConstraint, parse } from '@conform-to/zod'
import { invariant } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { json, redirect, type LoaderFunctionArgs } from '@remix-run/node'
import { Form, useActionData, useLoaderData } from '@remix-run/react'
import { AuthenticityTokenInput } from 'remix-utils/csrf/react'
import { z } from 'zod'
import { EmailChangeEmail } from '#app/components/email/EmailChangeEmail'
import { EmailChangeNoticeEmail } from '#app/components/email/EmailChangeNoticeEmail'
import { ErrorList, Field } from '#app/components/forms.tsx'
import { Icon } from '#app/components/ui/icon.tsx'
import { StatusButton } from '#app/components/ui/status-button.tsx'
import { prepareVerification, type VerifyFunctionArgs } from '#app/routes/_auth+/verify.tsx'
import { requireUserId } from '#app/utils/auth.server.ts'
import { validateCSRF } from '#app/utils/csrf.server.ts'
import { prisma } from '#app/utils/db.server.ts'
import { sendEmail } from '#app/utils/email.server.ts'
import { useIsPending } from '#app/utils/misc.tsx'
import { redirectWithToast } from '#app/utils/toast.server.ts'
import { saveUserAudit } from '#app/utils/user-audit.ts'
import { EmailSchema } from '#app/utils/user-validation.ts'
import { verifySessionStorage } from '#app/utils/verification.server.ts'
import { type BreadcrumbHandle } from './profile.tsx'

export const handle: BreadcrumbHandle & SEOHandle = {
	breadcrumb: <Icon name="envelope-closed">Change Email</Icon>,
	getSitemapEntries: () => null,
}

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

const ChangeEmailSchema = z.object({
	email: EmailSchema,
})

export async function loader({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { primaryEmail: true },
	})
	if (!user) {
		const params = new URLSearchParams({ redirectTo: request.url })
		throw redirect(`/login?${params}`)
	}
	return json({ user })
}

export async function action({ request }: LoaderFunctionArgs) {
	const userId = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const submission = await parse(formData, {
		schema: ChangeEmailSchema.superRefine(async (data, ctx) => {
			const existingUser = await prisma.user.findUnique({
				where: { primaryEmail: data.email },
			})
			if (existingUser) {
				ctx.addIssue({
					path: ['email'],
					code: z.ZodIssueCode.custom,
					message: 'This email is already in use.',
				})
			}
		}),
		async: true,
	})

	if (submission.intent !== 'submit') {
		return json({ status: 'idle', submission } as const)
	}
	if (!submission.value) {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
	const { otp, redirectTo, verifyUrl } = await prepareVerification({
		period: 10 * 60,
		request,
		target: userId,
		type: 'change-email',
	})

	const response = await sendEmail({
		to: submission.value.email,
		subject: `Clearwater Farms Unit 1 Email Change Verification`,
		react: <EmailChangeEmail verifyUrl={verifyUrl.toString()} otp={otp} />,
	})

	if (response.status === 'success') {
		const verifySession = await verifySessionStorage.getSession()
		verifySession.set(newEmailAddressSessionKey, submission.value.email)
		return redirect(redirectTo.toString(), {
			headers: {
				'set-cookie': await verifySessionStorage.commitSession(verifySession),
			},
		})
	} else {
		submission.error[''] = [response.error.message]
		return json({ status: 'error', submission } as const, { status: 500 })
	}
}

export default function ChangeEmailIndex() {
	const data = useLoaderData<typeof loader>()
	const actionData = useActionData<typeof action>()

	const [form, fields] = useForm({
		id: 'change-email-form',
		constraint: getFieldsetConstraint(ChangeEmailSchema),
		lastSubmission: actionData?.submission,
		onValidate({ formData }) {
			return parse(formData, { schema: ChangeEmailSchema })
		},
	})

	const isPending = useIsPending()
	return (
		<div>
			<h1 className="text-h1">Change Email</h1>
			<p>You will receive an email at the new email address to confirm.</p>
			<p>An email notice will also be sent to your old address {data.user.primaryEmail}.</p>
			<div className="mx-auto mt-5 max-w-sm">
				<Form method="POST" {...form.props}>
					<AuthenticityTokenInput />
					<Field
						labelProps={{ children: 'New Email' }}
						inputProps={{
							...conform.input(fields.email),
							autoComplete: 'email',
						}}
						errors={fields.email.errors}
					/>
					<ErrorList id={form.errorId} errors={form.errors} />
					<div className="mt-3">
						<StatusButton status={isPending ? 'pending' : (actionData?.status ?? 'idle')}>
							Send Confirmation
						</StatusButton>
					</div>
				</Form>
			</div>
		</div>
	)
}
