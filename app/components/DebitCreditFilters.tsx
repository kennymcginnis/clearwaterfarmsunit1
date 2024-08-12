import { Link } from '@remix-run/react'
import React from 'react'
import { ToggleGroup, ToggleGroupItem } from '#app/components/ui/toggle-group'
import { type ItemTableParams, getNewTableUrl } from '#app/utils/pagination/transactions'

interface FilterProps {
	baseUrl: string
	filters: string[]
	tableParams: ItemTableParams
}

const DebitCreditFilters: React.FC<FilterProps> = ({ baseUrl, tableParams }) => {
	return (
		<ToggleGroup
			type="single"
			variant="secondary"
			className="text-align-webkit-center w-full"
			value={tableParams.hide ?? ''}
		>
			<Link
				to={getNewTableUrl(baseUrl, tableParams, 'hide', tableParams.hide === 'debit' ? undefined : 'debit')}
				className="w-full"
			>
				<ToggleGroupItem value="debit" aria-label="Toggle bold" className="w-[40%]">
					Debit
				</ToggleGroupItem>
			</Link>
			<Link
				to={getNewTableUrl(baseUrl, tableParams, 'hide', tableParams.hide === 'credit' ? undefined : 'credit')}
				className="w-full"
			>
				<ToggleGroupItem value="credit" aria-label="Toggle italic" className="w-[40%]">
					Credit
				</ToggleGroupItem>
			</Link>
		</ToggleGroup>
	)
}

export default DebitCreditFilters
