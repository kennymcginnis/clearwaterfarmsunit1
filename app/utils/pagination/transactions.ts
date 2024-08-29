import { z } from 'zod'

export type Transactions = Transaction[]
export type Transaction = {
	id: string
	scheduleId: string
	ditch: string
	date: string
	debit: number
	credit: number
	note: string | null
	user: { id: string; display: string; quickbooks: string }
}

export interface TransactionData {
	transactions: Transaction[]
	displays: string[]
	quickbooks: string[]
	tableParams: TransactionTableParams
	filters: string[]
	total: number
	balance: number
}

export type TransactionHeader =
	| 'id'
	| 'scheduleId'
	| 'ditch'
	| 'userId'
	| 'display'
	| 'quickbooks'
	| 'date'
	| 'debit'
	| 'credit'
	| 'note'
export const TransactionHeaders: TransactionHeader[] = [
	'id',
	'scheduleId',
	'ditch',
	'userId',
	'display',
	'quickbooks',
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

export const itemTableSchema = z.object({
	page: z.number().min(1),
	items: z.number().min(1),
	search: z.string().optional(),
	age: z.number().min(0).optional(),
	ditch: z.number().min(1).max(9).optional(),
	display: z.string().optional(),
	quickbooks: z.string().optional(),
	direction: z.enum(['asc', 'desc']).optional(),
	//Override these two with an enum of possible keys
	filter: z.string().optional(),
	hide: z.string().optional(),
	sort: z.string().optional(),
})

export const transactionsPaginationSchema = itemTableSchema.merge(
	z.object({
		search: z.string().optional(),
		sort: z
			.enum(['id', 'scheduleId', 'ditch', 'userId', 'display', 'quickbooks', 'date', 'debit', 'credit', 'note'])
			.optional(),
	}),
)

export type TransactionTableParams = z.infer<typeof transactionsPaginationSchema>

export type ItemTableParams = z.infer<typeof itemTableSchema>

export const getItemTableParams = <ZodSchema>(request: Request, schema: z.Schema<ZodSchema>) => {
	const query = new URL(request.url).searchParams
	const age = query.get('age')
	const ditch = query.get('ditch')

	const params = Object.fromEntries(
		Object.entries({
			page: parseInt(query.get('page') || '1'),
			items: parseInt(query.get('items') || '10'),
			search: query.get('search'),
			age: age ? parseInt(age) : null,
			ditch: ditch ? parseInt(ditch) : null,
			display: query.get('display'),
			quickbooks: query.get('quickbooks'),
			filter: query.get('filter'),
			hide: query.get('hide'),
			sort: query.get('sort'),
			direction: query.get('direction'),
		}).filter(([, v]) => v != null),
	)

	return schema.parse(params)
}

export const defaultTableParams: Record<string, any> = {
	page: 1,
	items: 10,
}

export const getNewTableUrl = (
	baseUrl: string,
	oldParams: ItemTableParams,
	newKey: keyof ItemTableParams,
	newValue?: string,
) => {
	let params = new URLSearchParams()
	//Set params from the last query that have a non-default value
	Object.entries(oldParams).forEach(([key, value]) => {
		const isDefault = defaultTableParams[key] === value
		if (!!value && !isDefault) {
			params.set(key, typeof value !== 'string' ? JSON.stringify(value) : value)
		}
	})

	if (!newValue) {
		//Passing an empty value means we want to clear the key
		params.delete(newKey)
		if (newKey === 'filter') params.delete('age')
	} else {
		switch (newKey) {
			case 'sort':
				if (!oldParams.sort || oldParams.sort !== newValue) {
					params.set(newKey, newValue)
					params.set('direction', 'asc')
				} else if (oldParams.direction === 'asc') {
					params.set(newKey, newValue)
					params.set('direction', 'desc')
				} else {
					//Third consecutive click resets the sort
					params.delete('direction')
					params.delete('sort')
				}
				break
			case 'search':
				//Searching resets the table
				params = new URLSearchParams()
				params.set(newKey, newValue)
				params.set('page', '1')
				break
			case 'ditch':
			case 'display':
			case 'quickbooks':
				params.set(newKey, newValue)
				params.set('page', '1')
				break
			case 'age':
				params.set(newKey, newValue)
				params.set('page', '1')
				params.delete('filter')
				break
			case 'filter':
				params.set(newKey, newValue)
				params.set('page', '1')
				params.delete('age')
				break
			default:
				params.set(newKey, newValue)
		}
	}

	return `${baseUrl}?${params.toString()}`
}
