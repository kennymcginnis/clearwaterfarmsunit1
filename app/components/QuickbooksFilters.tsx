import { Link } from '@remix-run/react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu'
import { getNewTableUrl, type ItemTableParams } from '#app/utils/pagination/transactions'
import { Button } from './ui/button'
import { Icon } from './ui/icon'

interface FilterProps {
	baseUrl: string
	dropdownDefault: string
	quickbooks: string[]
	tableParams: ItemTableParams
}

const QuickbooksFilters: React.FC<FilterProps> = ({ baseUrl, tableParams, quickbooks, dropdownDefault }) => {
	const currentFilter =
		tableParams.quickbooks ?? quickbooks.find(d => d === tableParams.quickbooks) ?? 'Quickbooks Name'
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="w-full">
				<Button variant="secondary" className="w-full">
					<Icon name="users" className="mr-2 w-4" />
					{currentFilter}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-full" style={{ width: 'var(--radix-popper-anchor-width)' }}>
				<Link to={getNewTableUrl(baseUrl, tableParams, 'quickbooks')}>
					<DropdownMenuItem className="capitalize">{dropdownDefault}</DropdownMenuItem>
				</Link>
				<div className="max-h-[420px] overflow-auto">
					{quickbooks.map((quickbooks, i) => (
						<Link key={`quickbooks-${i}`} to={getNewTableUrl(baseUrl, tableParams, 'quickbooks', quickbooks)}>
							<DropdownMenuItem>{quickbooks}</DropdownMenuItem>
						</Link>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default QuickbooksFilters
