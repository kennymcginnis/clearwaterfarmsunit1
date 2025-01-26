import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { json, type ActionFunctionArgs } from '@remix-run/node'
import { z } from 'zod'
import { requireUserId, sessionKey } from '#app/utils/auth.server'
import { validateCSRF } from '#app/utils/csrf.server'
import { prisma } from '#app/utils/db.server.ts'
import { generatePublicId } from '#app/utils/public-id'
import { authSessionStorage } from '#app/utils/session.server'
import { redirectWithToast } from '#app/utils/toast.server'
import { saveUserAudit } from '#app/utils/user-audit.ts'
import {
	ProfileFormSchema,
	CreatePhoneSchema,
	UpdatePhoneSchema,
	DeletePhoneSchema,
} from '#app/utils/user-validation.ts'

type ProfileActionArgs = {
	request: Request
	currentUser: string
	formData: FormData
}

const createPhoneActionIntent = 'create-phone'
const updatePhoneActionIntent = 'update-phone'
const deletePhoneActionIntent = 'delete-phone'
const profileUpdateActionIntent = 'update-profile'
const signOutOfSessionsActionIntent = 'sign-out-of-sessions'
const deleteDataActionIntent = 'delete-data'

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
async function profileUpdateAction({ currentUser, formData }: ProfileActionArgs) {
	const submission = await parse(formData, {
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
	if (submission.intent !== 'submit') return json({ status: 'idle', submission } as const)
	if (!submission.value) return json({ status: 'error', submission } as const, { status: 400 })
	const data = submission.value
	const {
		id: userId,
		username,
		member,
		secondaryEmail,
	} = (await prisma.user.findFirst({
		select: { id: true, username: true, member: true, secondaryEmail: true },
		where: { id: currentUser },
	})) ?? { userId: null, username: null, member: null, secondaryEmail: null }
	if (userId) {
		await prisma.user.update({
			select: { username: true },
			data,
			where: { id: currentUser },
		})
		if (data.username && username !== data.username) {
			await saveUserAudit({
				userId,
				field: 'username',
				from: username,
				to: data.username,
				updatedBy: currentUser,
			})
		}
		if (data.member && member !== data.member) {
			await saveUserAudit({
				userId,
				field: 'member',
				from: member,
				to: data.member,
				updatedBy: currentUser,
			})
		}
		if (data.secondaryEmail && secondaryEmail !== data.secondaryEmail) {
			await saveUserAudit({
				userId,
				field: 'secondary-email',
				from: secondaryEmail,
				to: data.secondaryEmail,
				updatedBy: currentUser,
			})
		}
	}

	return json({ status: 'success', submission } as const)
}

async function signOutOfSessionsAction({ request, currentUser }: ProfileActionArgs) {
	const authSession = await authSessionStorage.getSession(request?.headers.get('cookie'))
	const sessionId = authSession.get(sessionKey)
	invariantResponse(sessionId, 'You must be authenticated to sign out of other sessions')
	await prisma.session.deleteMany({
		where: {
			userId: currentUser,
			id: { not: sessionId },
		},
	})
	return json({ status: 'success' } as const)
}

async function createPhoneAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: CreatePhoneSchema, async: true })
	if (submission.intent !== 'submit') return json({ status: 'idle', submission } as const)
	if (submission.value) {
		const { type, number, userId } = submission.value
		await prisma.userPhone.create({
			data: {
				id: generatePublicId(),
				userId,
				type,
				number,
				updatedBy: currentUser,
			},
		})

		await saveUserAudit({
			userId,
			field: 'phone',
			from: 'new',
			to: `${type}: ${number}`,
			updatedBy: currentUser,
		})

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `New phone number added.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}
async function updatePhoneAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: UpdatePhoneSchema, async: true })
	if (submission.intent !== 'submit') json({ status: 'idle', submission } as const)
	if (submission.value) {
		const { id, userId, ...data } = submission.value
		const { type, number } = (await prisma.userPhone.findFirst({
			select: { type: true, number: true },
			where: { id },
		})) ?? { type: null, number: null }

		if (data.type !== type || data.number !== number) {
			await prisma.userPhone.update({ data: { ...data, updatedBy: currentUser }, where: { id } })
			await saveUserAudit({
				userId,
				field: 'phone',
				from: `${type ?? 'new'}: ${number ?? 'new'}`,
				to: `${data.type}: ${number}`,
				updatedBy: currentUser,
			})
		}

		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: `Contact updated.`,
		})
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function deletePhoneAction({ formData, currentUser }: ProfileActionArgs) {
	const submission = await parse(formData, { schema: DeletePhoneSchema, async: true })
	if (submission.intent !== 'submit') return json({ status: 'idle', submission } as const)
	if (submission.value) {
		const { id } = submission.value
		const deleted = (await prisma.userPhone.delete({
			select: { userId: true, type: true, number: true },
			where: { id },
		})) ?? { userId: null, type: null, number: null }
		if (deleted && deleted.userId) {
			const { userId, type, number } = deleted
			await saveUserAudit({
				userId,
				field: 'phone',
				from: `${type}: ${number}`,
				to: 'deleted',
				updatedBy: currentUser,
			})
		}
		return json({ status: 'success' })
	} else {
		return json({ status: 'error', submission } as const, { status: 400 })
	}
}

async function deleteDataAction({ currentUser }: ProfileActionArgs) {
	await prisma.user.delete({ where: { id: currentUser } })
	return redirectWithToast('/', {
		type: 'success',
		title: 'Data Deleted',
		description: 'All of your data has been deleted',
	})
}
