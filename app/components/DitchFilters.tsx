import { Link } from '@remix-run/react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu'
import { getNewTableUrl, type ItemTableParams } from '#app/utils/pagination/transactions'
import { Button } from './ui/button'

interface DitchProps {
	baseUrl: string
	dropdownDefault: string
	ditches: string[]
	tableParams: ItemTableParams
}

const DitchDitchs: React.FC<DitchProps> = ({ baseUrl, tableParams, ditches, dropdownDefault }) => {
	const currentDitch = tableParams.ditch ? `Ditch ${tableParams.ditch}` : 'All'
	return (
		<DropdownMenu>
			<DropdownMenuTrigger className="w-full">
				<Button variant="secondary" className="w-full">
					{/* <CalendarIcon className="mr-2 w-4" /> */}
					{currentDitch}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent className="w-full" style={{ width: 'var(--radix-popper-anchor-width)'}}>
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
