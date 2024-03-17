import { z } from 'zod'
import { itemTableSchema } from './itemTable'

export type Transactions = Transaction[]
export type Transaction = {
	id: string
	date: string
	debit: number
	credit: number
	note: string | null
	user: { username: string }
}

export interface TransactionData {
	transactions: Transaction[]
	tableParams: TransactionTableParams
	filters: string[]
	total: number
}

export type TransactionHeader = 'id' | 'username' | 'date' | 'debit' | 'credit' | 'note'
export const TransactionHeaders: TransactionHeader[] = ['id', 'username', 'date', 'debit', 'credit', 'note']
export const TransactionAges = [
	{
		value: 1,
		label: 'Last day',
	},
	{
		value: 7,
		label: 'Last 7 days',
	},
	{
		value: 30,
		label: 'Last 30 days',
	},
	{
		value: 6,
		label: 'Last 6 months',
	},
	{
		value: 12,
		label: 'Last 12 months',
	},
]

export const transactionsPaginationSchema = itemTableSchema.merge(
	z.object({
		search: z.string().optional(),
		sort: z.enum(['id', 'username', 'date', 'debit', 'credit', 'note']).optional(),
	}),
)

export type TransactionTableParams = z.infer<typeof transactionsPaginationSchema>
