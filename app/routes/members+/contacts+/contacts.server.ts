import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type Prisma } from '@prisma/client'
import { type ActionFunctionArgs, json } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server.ts'
import {
	contactsPaginationSchema,
	type ContactData,
	type Contacts,
	getItemTableParams,
} from '#app/utils/pagination/contacts'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server'
import { EmailSchema, PhoneNumberSchema } from '#app/utils/user-validation'

export const getPaginatedContacts = async (request: Request) => {
	const tableParams = getItemTableParams(request, contactsPaginationSchema)

	let result: ContactData = {
		contacts: [],
		filters: [],
		tableParams,
		total: 0,
	}

	const select: Prisma.UserSelect = {
		id: true,
		username: true,
		display: true,
		member: true,
		quickbooks: true,
		phones: { select: { id: true, type: true, number: true } },
		emailSubject: true,
		primaryEmail: true,
		secondarySubject: true,
		secondaryEmail: true,
	}
	const filter: Prisma.UserFindManyArgs = {
		select,
		where: {},
		skip: tableParams.items * (tableParams.page - 1),
		take: tableParams.items,
	}

	if (tableParams.search) {
		filter.where = {
			...filter.where,
			OR: [{ display: { contains: tableParams.search } }, { quickbooks: { contains: tableParams.search } }],
		}
	}

	if (tableParams.sort) {
		filter.orderBy = {
			[tableParams.sort]: tableParams.direction,
		}
	}

	const getCount = async () => {
		const res = await prisma.user.count({
			where: filter.where,
		})
		return res || 0
	}

	const getContacts = async () => {
		// @ts-ignore
		const res: Contacts = await prisma.user.findMany(filter)
		return res || []
	}

	const res = await Promise.all([getCount(), getContacts()])

	result.total = res[0]
	result.contacts = res[1]
	// @ts-ignore
	result.filters = res[2]

	return result
}

const ContactsFormSchema = z.object({
	intent: z.string(),
	userId: z.string().optional(),
	display: z.string().optional(),
	quickbooks: z.string().optional(),
	emailSubject: z.string().optional(),
	primaryEmail: EmailSchema.optional(),
	secondaryEmail: EmailSchema.optional(),
	phoneId: z.string().optional(),
	phoneType: z.string().optional(),
	phoneNumber: PhoneNumberSchema.optional(),
})
export async function action({ request }: ActionFunctionArgs) {
	const formData = await request.formData()
	const submission = parse(formData, { schema: ContactsFormSchema })
	invariantResponse(submission?.value, 'Invalid submission', { status: 404 })
	const { userId: id, intent, phoneId } = submission.value
	try {
		switch (intent) {
			case 'phone-type':
				if (submission.value.phoneType) {
					await prisma.userPhone.update({ data: { type: submission.value.phoneType }, where: { id: phoneId } })
				}
				return null
			case 'phone-number':
				if (submission.value.phoneNumber) {
					await prisma.userPhone.update({ data: { number: submission.value.phoneNumber }, where: { id: phoneId } })
				}
				return null
			case 'create-phone':
				if (submission.value.phoneType && submission.value.phoneNumber) {
					await prisma.userPhone.create({
						data: {
							id: generatePublicId(),
							userId: submission.value.userId,
							type: submission.value.phoneType,
							number: submission.value.phoneNumber,
						},
					})
					return redirectWithToast('.', {
						type: 'success',
						title: 'Success',
						description: `New phone number added.`,
					})
				}
				return null
			case 'delete-phone':
				try {
					await prisma.userPhone.delete({ where: { id: phoneId } })
					return redirectWithToast('.', {
						type: 'success',
						title: 'Success',
						description: `Phone number deleted.`,
					})
				} catch (error) {
					return null
				}
			default:
				// @ts-ignore
				if (submission.value[intent]) {
					// @ts-ignore
					await prisma.user.update({ data: { [intent]: submission.value[intent] }, where: { id } })
				}
				return null
		}
	} catch (error) {
		return json({ status: 'error', error } as const, { status: 400 })
	}
}
