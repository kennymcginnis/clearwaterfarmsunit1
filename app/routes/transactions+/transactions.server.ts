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
	return await getTransactions(request, false)
}
const getTransactions = async (request: Request, returnAll?: boolean) => {
	const tableParams = getItemTableParams(request, transactionsPaginationSchema)

	let result: TransactionData = {
		transactions: [],
		filters: [],
		tableParams,
		total: 0,
	}

	const transactionsSelect: Prisma.TransactionsSelect = {
		id: true,
		date: true,
		debit: true,
		credit: true,
		note: true,
		user: { select: { username: true } },
	}

	const filter: Prisma.TransactionsFindManyArgs = returnAll
		? { select: transactionsSelect, where: {} }
		: {
				select: transactionsSelect,
				where: {},
				skip: tableParams.items * (tableParams.page - 1),
				take: tableParams.items,
			}

	if (tableParams.search) {
		filter.where = {
			...filter.where,
			OR: [{ note: { contains: tableParams.search } }, { user: { username: { contains: tableParams.search } } }],
		}
	}

	if (tableParams.age) {
		filter.where = {
			...filter.where,
			createdAt: {
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
			case 'username':
				filter.orderBy = {
					user: { username: tableParams.direction },
				}
				break
			case 'date':
				filter.orderBy = {
					date: tableParams.direction,
				}
				break
			case 'debit':
				filter.orderBy = {
					debit: tableParams.direction,
				}
				break
			case 'credit':
				filter.orderBy = {
					credit: tableParams.direction,
				}
			case 'note':
				filter.orderBy = {
					note: tableParams.direction,
				}
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

	const distinctNotes = async () => {
		const res = await prisma.transactions.findMany({
			distinct: ['date'],
			select: { date: true },
		})
		return res.map(r => r.date)
	}

	const res = await Promise.all([getCount(), getTransactions(), distinctNotes()])

	result.total = res[0]
	result.transactions = res[1]
	// @ts-ignore
	result.filters = res[2]

	return result
}
