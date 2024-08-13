import { CalendarIcon } from '@heroicons/react/24/outline'
import { Link } from '@remix-run/react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu'
import { getNewTableUrl, type ItemTableParams } from '#app/utils/pagination/transactions'
import { Button } from './ui/button'

interface FilterProps {
	ages: Array<{ value: number; label: string }>
	baseUrl: string
	dropdownDefault: string
	filters: string[]
	tableParams: ItemTableParams
}

const DateFilters: React.FC<FilterProps> = ({ baseUrl, tableParams, filters, ages, dropdownDefault }) => {
	const currentFilter = tableParams.filter ?? ages.find(a => a.value === tableParams.age)?.label ?? 'Date Filter'
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="w-full">
				<Button variant="secondary" className="w-full">
					<CalendarIcon className="mr-2 w-4" />
					{currentFilter}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" style={{ width: 'var(--radix-popper-anchor-width)'}}>
				<Link to={getNewTableUrl(baseUrl, tableParams, 'filter')}>
					<DropdownMenuItem className="capitalize">{dropdownDefault}</DropdownMenuItem>
				</Link>
				<DropdownMenuSeparator />
				{ages.map((age, i) => (
					<Link key={`age-${i}`} to={getNewTableUrl(baseUrl, tableParams, 'age', age.value.toString())}>
						<DropdownMenuItem>{age.label}</DropdownMenuItem>
					</Link>
				))}
				<DropdownMenuSeparator />
				<div className="max-h-[200px] overflow-auto">
					{filters.map((filter, i) => (
						<Link key={`filter-${i}`} to={getNewTableUrl(baseUrl, tableParams, 'filter', filter)}>
							<DropdownMenuItem className="capitalize">{filter}</DropdownMenuItem>
						</Link>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default DateFilters
