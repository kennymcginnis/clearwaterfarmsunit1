import { parse } from '@conform-to/zod'
import { invariantResponse } from '@epic-web/invariant'
import { type Prisma } from '@prisma/client'
import { type ActionFunctionArgs, json } from '@remix-run/node'
import { z } from 'zod'
import { prisma } from '#app/utils/db.server'
import {
	getItemTableParams,
	transactionsPaginationSchema,
	type TransactionData,
	type Transactions,
} from '#app/utils/pagination/transactions'

import { requireUserWithRole } from '#app/utils/permissions'
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

export async function action({ request }: ActionFunctionArgs) {
	await requireUserWithRole(request, 'admin')
	const formData = await request.formData()
	const intent = formData.get('intent')
	try {
		switch (intent) {
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
		quickbooks: [],
		filters: [],
		tableParams,
		total: 0,
		balance: 0,
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
		user: { select: { id: true, display: true, quickbooks: true } },
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

	if (tableParams.quickbooks) {
		filter.where = {
			...filter.where,
			user: { quickbooks: tableParams.quickbooks },
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
			case 'quickbooks':
				filter.orderBy = {
					user: { quickbooks: tableParams.direction },
				}
				break
			default:
				filter.orderBy = {
					[tableParams.sort]: tableParams.direction,
				}
				break
		}
	} else {
		filter.orderBy = {
			date: 'desc',
		}
	}

	const getCount = async () => {
		const res = await prisma.transactions.count({
			where: filter.where,
		})
		return res || 0
	}

	const getBalance = async () => {
		const res = await prisma.transactions.aggregate({
			_sum: { debit: true, credit: true },
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

	const distinctQuickbooks = async () => {
		// @ts-ignore
		const res = await prisma.user.findMany({
			distinct: ['quickbooks'],
			select: { quickbooks: true },
			orderBy: { quickbooks: 'asc' },
		})
		return res.map(r => r.quickbooks)
	}

	const distinctNoteDates = async () => {
		const res = await prisma.transactions.findMany({
			distinct: ['date'],
			select: { date: true },
			orderBy: { date: 'desc' },
		})
		return res.map(r => r.date)
	}

	const res = await Promise.all([
		getCount(),
		getBalance(),
		getTransactions(),
		distinctDisplays(),
		distinctQuickbooks(),
		distinctNoteDates(),
	])

	result.total = res[0]
	result.transactions = res[2]
	// @ts-ignore
	result.displays = res[3]
	// @ts-ignore
	result.quickbooks = res[4]
	// @ts-ignore
	result.filters = res[5]


	result.balance = (res[1]._sum.debit ?? 0) - (res[1]._sum.credit ?? 0)

	return result
}
