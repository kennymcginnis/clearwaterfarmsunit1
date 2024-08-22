import { parseWithZod } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { ProfileFormSchema } from '#app/routes/settings+/profile.index'
import { requireUserId, sessionKey } from '#app/utils/auth.server'
import { validateCSRF } from '#app/utils/csrf.server'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'
import { authSessionStorage } from '#app/utils/session.server'
import { redirectWithToast } from '#app/utils/toast.server'
import {
	EmailSchema,
	NameSchema,
	UsernameSchema,
} from '#app/utils/user-validation.ts'
import {
	createPhoneActionIntent,
	updatePhoneActionIntent,
	updatePhonePrimaryActionIntent,
	deletePhoneActionIntent,
	profileUpdateActionIntent,
	signOutOfSessionsActionIntent,
	deleteDataActionIntent,
	CreatePhoneSchema,
	UpdatePhoneSchema,
} from './_edit'

export const UserContactSchema = z.object({
	id: z.string(),
	member: NameSchema.optional(),
	username: UsernameSchema,
	primaryEmail: EmailSchema,
	secondaryEmail: EmailSchema.optional(),
})

export type ProfileActionArgs = {
	request: Request
	currentUser: string
	formData: FormData
}

export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserId(request)
	const formData = await request.formData()
	await validateCSRF(formData, request.headers)
	const intent = formData.get('intent')
	const event = { request, currentUser, formData }
	switch (intent) {
		case createPhoneActionIntent:
			return createPhoneAction(event)

		case updatePhoneActionIntent:
			return updatePhoneAction(event)

		case updatePhonePrimaryActionIntent:
			return updatePhonePrimaryAction(event)

		case deletePhoneActionIntent:
			return deletePhoneAction(event)

		case profileUpdateActionIntent:
			return profileUpdateAction(event)

		case signOutOfSessionsActionIntent:
			return signOutOfSessionsAction(event)

		case deleteDataActionIntent:
			return deleteDataAction(event)
		default: {
			throw new Response(`Invalid intent "${intent}"`, { status: 400 })
		}
	}
}

export async function profileUpdateAction({
	currentUser,
	formData,
}: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		async: true,
		schema: ProfileFormSchema.superRefine(async ({ username }, ctx) => {
			const existingUsername = await prisma.user.findUnique({
				where: { username },
				select: { id: true },
			})
			if (existingUsername && existingUsername.id !== currentUser) {
				ctx.addIssue({
					path: ['username'],
					code: z.ZodIssueCode.custom,
					message: 'A user already exists with this username',
				})
			}
		}),
	})
	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}

	const data = submission.value
	await prisma.user.update({
		select: { username: true },
		where: { id: currentUser },
		data,
	})

	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: `Profile updated.`,
	})
}

export async function signOutOfSessionsAction({
	request,
	currentUser,
}: ProfileActionArgs) {
	const authSession = await authSessionStorage.getSession(
		request?.headers.get('cookie'),
	)
	const sessionId = authSession.get(sessionKey)
	invariantResponse(
		sessionId,
		'You must be authenticated to sign out of other sessions',
	)
	await prisma.session.deleteMany({
		where: {
			userId: currentUser,
			id: { not: sessionId },
		},
	})
	return json({ status: 'success' } as const)
}

export async function createPhoneAction({ formData }: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		schema: CreatePhoneSchema,
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const { type, number, userId } = submission.value
	await prisma.userPhone.create({
		select: { id: true },
		data: {
			id: generatePublicId(),
			userId,
			type,
			number,
		},
	})

	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: `New phone number added.`,
	})
}

export async function updatePhoneAction({
	formData,
	currentUser,
}: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		schema: UpdatePhoneSchema,
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const { id, userId, ...data } = submission.value
	await prisma.userPhone.update({
		data: {
			...data,
			updatedBy: currentUser,
		},
		where: { id },
	})
	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: `Contact updated.`,
	})
}

export const UpdatePhonePrimarySchema = z.object({
	userId: z.string(),
	id: z.string(),
	primary: z.boolean().optional().default(false),
})
export async function updatePhonePrimaryAction({
	formData,
	currentUser,
}: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		schema: UpdatePhonePrimarySchema,
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const { id, userId, primary } = submission.value
	await prisma.userPhone.update({
		data: {
			primary,
			updatedBy: currentUser,
		},
		where: { id },
	})

	if (primary) {
		await prisma.userPhone.updateMany({
			data: {
				primary: false,
				updatedBy: currentUser,
			},
			where: { userId, NOT: { id } },
		})
	}

	return redirectWithToast('', {
		type: 'success',
		title: 'Success',
		description: `Phone updated to primary.`,
	})
}

export const DeletePhoneSchema = z.object({
	id: z.string().optional(),
})

export async function deletePhoneAction({ formData }: ProfileActionArgs) {
	const submission = await parseWithZod(formData, {
		schema: DeletePhoneSchema,
		async: true,
	})

	if (submission.status !== 'success') {
		return json(
			{ result: submission.reply() },
			{ status: submission.status === 'error' ? 400 : 200 },
		)
	}
	const { id } = submission.value
	await prisma.userPhone.delete({ where: { id } })
	return json({ status: 'success' })
}

async function deleteDataAction({ currentUser }: ProfileActionArgs) {
	await prisma.user.delete({ where: { id: currentUser } })
	return redirectWithToast('/', {
		type: 'success',
		title: 'Data Deleted',
		description: 'All of your data has been deleted',
	})
}
