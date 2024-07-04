import { type Prisma } from '@prisma/client'
import { prisma } from '#app/utils/db.server.ts'
import { getItemTableParams } from '#app/utils/pagination/itemTable'
import {
	transactionsPaginationSchema,
	type TransactionData,
	type Transactions,
} from '#app/utils/pagination/transactions'

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

	const distinctNoteDates = async () => {
		const res = await prisma.transactions.findMany({
			distinct: ['date'],
			select: { date: true },
			orderBy: { date: 'desc' },
		})
		return res.map(r => r.date)
	}

	const res = await Promise.all([getCount(), getTransactions(), distinctNoteDates()])

	result.total = res[0]
	result.transactions = res[1]
	// @ts-ignore
	result.filters = res[2]

	return result
}
