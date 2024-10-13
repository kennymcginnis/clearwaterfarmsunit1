import { invariantResponse } from '@epic-web/invariant'
import { type Prisma } from '@prisma/client'
import {
	type ActionFunctionArgs,
	type UploadHandler,
	json,
	unstable_composeUploadHandlers as composeUploadHandlers,
	unstable_createMemoryUploadHandler as createMemoryUploadHandler,
	unstable_parseMultipartFormData as parseMultipartFormData,
} from '@remix-run/node'
import { z } from 'zod'
import { csvFileToArray, csvUploadHandler } from '#app/utils/csv-helper'
import { prisma } from '#app/utils/db.server'
import { requireUserWithRole } from '#app/utils/permissions'
import { generatePublicId } from '#app/utils/public-id.ts'
import { redirectWithToast } from '#app/utils/toast.server'
import { PhoneNumberSchema } from '#app/utils/user-validation'

const ContactsUploadSchema = z.array(
	z.object({
		id: z.string(),
		username: z.string().nullish(),
		display: z.string().nullish(),
		member: z.string().nullish(),
		quickbooks: z.string().nullish(),
		stripeId: z.string().nullish(),
		emailSubject: z.string().nullish(),
		primaryEmail: z.string().email().optional().or(z.literal('')),
		secondarySubject: z.string().nullish(),
		secondaryEmail: z.string().email().optional().or(z.literal('')),
		phoneNumber: PhoneNumberSchema.optional().or(z.literal('')),
		secondaryNumber: PhoneNumberSchema.optional().or(z.literal('')),
	}),
)
export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserWithRole(request, 'admin')

	try {
		const uploadHandler: UploadHandler = composeUploadHandlers(csvUploadHandler, createMemoryUploadHandler())
		const formData = await parseMultipartFormData(request, uploadHandler)

		const csv = formData.get('selected_csv')
		invariantResponse(typeof csv === 'string', 'selected_csv filename must be a string')

		const contacts = csvFileToArray(csv)
		const result = ContactsUploadSchema.safeParse(contacts)
		if (!result.success) {
			return json({ status: 'error', error: result.error.message } as const, { status: 400 })
		}

		let updatedUsers = 0
		for (let {
			id,
			username,
			display,
			member,
			quickbooks,
			stripeId,
			emailSubject,
			primaryEmail,
			secondarySubject,
			secondaryEmail,
			phoneNumber,
			secondaryNumber,
		} of result.data) {
			const updates: Prisma.UserUpdateInput = {}

			if (username) updates.username = username
			if (display) updates.display = display
			if (member) updates.member = member
			if (quickbooks) updates.quickbooks = quickbooks
			if (stripeId) updates.stripeId = stripeId
			if (emailSubject) updates.emailSubject = emailSubject
			if (primaryEmail) updates.primaryEmail = primaryEmail
			if (secondarySubject) updates.secondarySubject = secondarySubject
			if (secondaryEmail) updates.secondaryEmail = secondaryEmail

			if (phoneNumber) {
				if (secondaryNumber) {
					updates.phones = {
						create: [
							{ id: generatePublicId(), type: 'Primary', number: phoneNumber },
							{ id: generatePublicId(), type: 'Secondary', number: secondaryNumber },
						],
					}
				} else {
					updates.phones = { create: [{ id: generatePublicId(), type: 'Primary', number: phoneNumber }] }
				}
			}
			try {
				await prisma.user.update({
					data: { ...updates, updatedBy: currentUser },
					where: { id },
				})
				updatedUsers++
			} catch (error) {
				console.error(JSON.stringify({ error }, null, 2))
			}
		}
		return redirectWithToast('/members/contacts', {
			type: 'success',
			title: 'Success',
			description: `${updatedUsers} contacts uploaded.`,
		})
	} catch (error) {
		console.error({ error })
		return redirectWithToast('/members/contacts', {
			type: 'error',
			title: 'Error',
			description: JSON.stringify(error),
		})
	}
}
