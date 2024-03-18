import { CalendarIcon } from '@heroicons/react/24/outline'
import { Link } from '@remix-run/react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu'
import { getNewTableUrl, type ItemTableParams } from '#app/utils/pagination/itemTable'
import { Button } from './ui/button'

interface DitchProps {
	baseUrl: string
	dropdownDefault: string
	ditches: string[]
	tableParams: ItemTableParams
}

const DitchDitchs: React.FC<DitchProps> = ({ baseUrl, tableParams, ditches, dropdownDefault }) => {
	const currentDitch = tableParams.ditch ? `Ditch ${tableParams.ditch}` :  'All Ditches'
	return (
		<DropdownMenu>
			<DropdownMenuTrigger>
				<Button variant="secondary">
					<CalendarIcon className="mr-2 w-4" />
					{currentDitch}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent>
				<Link to={getNewTableUrl(baseUrl, tableParams, 'ditch')}>
					<DropdownMenuItem className="capitalize">{dropdownDefault}</DropdownMenuItem>
				</Link>
				{ditches.map(ditch => (
					<Link key={`ditch-${ditch}`} to={getNewTableUrl(baseUrl, tableParams, 'ditch', ditch)}>
						<DropdownMenuItem className="capitalize">Ditch {ditch}</DropdownMenuItem>
					</Link>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

export default DitchDitchs
