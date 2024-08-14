import { parse } from '@conform-to/zod'
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

import {
	getItemTableParams,
	transactionsPaginationSchema,
	type TransactionData,
	type Transactions,
} from '#app/utils/pagination/transactions'

import { requireUserWithRole } from '#app/utils/permissions'
import { generatePublicId } from '#app/utils/public-id'
import { redirectWithToast } from '#app/utils/toast.server'
import { DateSchema } from '#app/utils/user-validation'

const TransactionsFormSchema = z.object({
	id: z.string(),
	intent: z.string(),
	scheduleId: z.string().optional(),
	ditch: z.preprocess(x => (x ? x : null), z.coerce.number()).optional(),
	date: DateSchema.optional(),
	debit: z.preprocess(x => (x ? x : 0), z.coerce.number()).optional(),
	credit: z.preprocess(x => (x ? x : 0), z.coerce.number()).optional(),
	note: z.string().optional(),
})

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
	const formData = await request.formData()
	const intent = formData.get('intent')
	try {
		switch (intent) {
			case 'upload-transactions': {
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
				return redirectWithToast('.', {
					type: 'success',
					title: 'Success',
					description: JSON.stringify(missingUsers),
				})
			}
			case 'delete-transaction':
				const submission = parse(formData, { schema: z.object({ id: z.string() }) })
				invariantResponse(submission?.value, 'Invalid submission', { status: 404 })
				const { id } = submission.value
				await prisma.transactions.delete({ where: { id } })
				return null
			default: {
				const submission = parse(formData, { schema: TransactionsFormSchema })
				invariantResponse(submission?.value, 'Invalid submission', { status: 404 })
				const { id } = submission.value

				console.log({ id, intent })

				// @ts-ignore
				if (submission.value[intent]) {
					// @ts-ignore
					await prisma.transactions.update({ data: { [intent]: submission.value[intent] }, where: { id } })
					return null
				}
			}
		}
	} catch (error) {
		return json({ status: 'error', error } as const, { status: 400 })
	}
	return json({ status: 'error' } as const, { status: 400 })
}

export const getPaginatedTransactions = async (request: Request) => {
	return await getTransactions(request)
}
export const getFilteredTransactions = async (request: Request) => {
	return await getTransactions(request, true)
}
const getTransactions = async (request: Request, returnAll?: boolean) => {
	const tableParams = getItemTableParams(request, transactionsPaginationSchema)

	let result: TransactionData = {
		transactions: [],
		displays: [],
		filters: [],
		tableParams,
		total: 0,
	}

	const select: Prisma.TransactionsSelect = {
		id: true,
		scheduleId: true,
		ditch: true,
		userId: true,
		date: true,
		debit: true,
		credit: true,
		note: true,
		user: { select: { id: true, display: true } },
	}
	const filter: Prisma.TransactionsFindManyArgs = returnAll
		? { select, where: {} }
		: {
				select,
				where: {},
				skip: tableParams.items * (tableParams.page - 1),
				take: tableParams.items,
			}

	if (tableParams.search) {
		filter.where = {
			...filter.where,
			OR: [{ note: { contains: tableParams.search } }, { user: { display: { contains: tableParams.search } } }],
		}
	}

	if (tableParams.ditch) {
		filter.where = {
			...filter.where,
			ditch: tableParams.ditch,
		}
	}

	if (tableParams.display) {
		filter.where = {
			...filter.where,
			user: { display: tableParams.display },
		}
	}

	if (tableParams.age) {
		filter.where = {
			...filter.where,
			updatedAt: {
				gte: new Date(
					[6, 12].includes(tableParams.age) //6 and 12 are months so hardcoded this bit, otherwise it's days
						? new Date().setMonth(-tableParams.age)
						: new Date().setHours(-tableParams.age * 24),
				),
			},
		}
	}

	if (tableParams.filter) {
		filter.where = {
			...filter.where,
			date: tableParams.filter,
		}
	}

	if (tableParams.hide) {
		filter.where = {
			...filter.where,
			[tableParams.hide]: 0,
		}
	}

	if (tableParams.sort) {
		switch (tableParams.sort) {
			case 'display':
				filter.orderBy = {
					user: { display: tableParams.direction },
				}
				break
			default:
				filter.orderBy = {
					[tableParams.sort]: tableParams.direction,
				}
				break
		}
	}

	const getCount = async () => {
		const res = await prisma.transactions.count({
			where: filter.where,
		})
		return res || 0
	}

	const getTransactions = async () => {
		// @ts-ignore
		const res: Transactions = await prisma.transactions.findMany(filter)
		return res || []
	}

	const distinctDisplays = async () => {
		// @ts-ignore
		const res = await prisma.user.findMany({
			distinct: ['display'],
			select: { display: true },
			orderBy: { display: 'asc' },
		})
		return res.map(r => r.display)
	}

	const distinctNoteDates = async () => {
		const res = await prisma.transactions.findMany({
			distinct: ['date'],
			select: { date: true },
			orderBy: { date: 'desc' },
		})
		return res.map(r => r.date)
	}

	const res = await Promise.all([getCount(), getTransactions(), distinctDisplays(), distinctNoteDates()])

	result.total = res[0]
	result.transactions = res[1]
	// @ts-ignore
	result.displays = res[2]
	// @ts-ignore
	result.filters = res[3]

	return result
}
