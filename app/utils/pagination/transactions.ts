import { z } from 'zod'
import { itemTableSchema } from './itemTable'

export type Transactions = Transaction[]
export type Transaction = {
	id: string
	scheduleId: string
	ditch: string
	date: string
	debit: number
	credit: number
	note: string | null
	user: { id: string; username: string }
}

export interface TransactionData {
	transactions: Transaction[]
	tableParams: TransactionTableParams
	filters: string[]
	total: number
}

export type TransactionHeader =
	| 'id'
	| 'scheduleId'
	| 'ditch'
	| 'userId'
	| 'username'
	| 'date'
	| 'debit'
	| 'credit'
	| 'note'
export const TransactionHeaders: TransactionHeader[] = [
	'id',
	'scheduleId',
	'ditch',
	'userId',
	'username',
	'date',
	'debit',
	'credit',
	'note',
]
export const DitchesArray = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
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
		sort: z.enum(['id', 'scheduleId', 'ditch', 'userId', 'username', 'date', 'debit', 'credit', 'note']).optional(),
	}),
)

export type TransactionTableParams = z.infer<typeof transactionsPaginationSchema>
