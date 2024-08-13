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
	displays: string[]
	tableParams: ItemTableParams
}

const DisplayFilters: React.FC<FilterProps> = ({ baseUrl, tableParams, displays, dropdownDefault }) => {
	const currentFilter = tableParams.filter ?? displays.find(d => d === tableParams.display) ?? 'Display Name Filter'
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="w-full">
				<Button variant="secondary" className="w-full">
				<Icon name="users" className="mr-2 w-4" />
					{currentFilter}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-full" style={{ width: 'var(--radix-popper-anchor-width)'}}>
				<Link to={getNewTableUrl(baseUrl, tableParams, 'display')}>
					<DropdownMenuItem className="capitalize">{dropdownDefault}</DropdownMenuItem>
				</Link>
				<div className="max-h-[420px] overflow-auto">
					{displays.map((display, i) => (
						<Link key={`display-${i}`} to={getNewTableUrl(baseUrl, tableParams, 'display', display)}>
							<DropdownMenuItem>{display}</DropdownMenuItem>
						</Link>
					))}
				</div>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default DisplayFilters
