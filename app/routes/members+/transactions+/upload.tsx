import { invariantResponse } from '@epic-web/invariant'
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
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server'
import { DateSchema } from '#app/utils/user-validation'

const TransactionsUploadSchema = z.array(
	z.object({
		id: z.string().optional(),
		userId: z.string().optional(),
		scheduleId: z.string().optional(),
		ditch: z.preprocess(x => (x ? x : null), z.coerce.number()).optional(),
		date: DateSchema,
		debit: z.preprocess(x => (x ? x : 0), z.coerce.number()).optional(),
		credit: z.preprocess(x => (x ? x : 0), z.coerce.number()).optional(),
		note: z.string().optional(),
	}),
)
export async function action({ request }: ActionFunctionArgs) {
	const currentUser = await requireUserWithRole(request, 'admin')

	try {
		const uploadHandler: UploadHandler = composeUploadHandlers(csvUploadHandler, createMemoryUploadHandler())
		const formData = await parseMultipartFormData(request, uploadHandler)

		const csv = formData.get('selected_csv')
		invariantResponse(typeof csv === 'string', 'selected_csv filename must be a string')

		const transactions = csvFileToArray(csv)
		const result = TransactionsUploadSchema.safeParse(transactions)
		if (!result.success) return json({ status: 'error', error: result.error.message } as const, { status: 400 })

		const missingUsers = []
		for (let { id, ...transaction } of result.data) {
			try {
				if (!id) id = '__new_transaction__'
				await prisma.transactions.upsert({
					where: { id },
					create: {
						id: generatePublicId(),
						...transaction,
						updatedBy: currentUser,
					},
					update: {
						...transaction,
						updatedBy: currentUser,
					},
				})
			} catch (error) {
				console.error(JSON.stringify({ error, transaction }, null, 2))
				missingUsers.push(transaction.userId)
			}
		}
		return redirectWithToast('', {
			type: 'success',
			title: 'Success',
			description: JSON.stringify(missingUsers),
		})
	} catch (error) {
		console.error({ error })
		return redirectWithToast('', {
			type: 'error',
			title: 'Error',
			description: JSON.stringify(error),
		})
	}
}
