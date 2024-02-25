import { CaretSortIcon, CheckIcon } from '@radix-ui/react-icons'
import * as React from 'react'
import { Button } from '#app/components/ui/button'
import { Command, CommandGroup, CommandItem } from '#app/components/ui/command'
import { Label } from '#app/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '#app/components/ui/popover'
import { cn } from '#app/utils/misc.tsx'

const options = [
	{
		value: 'surface',
		label: 'Surface Water',
	},
	{
		value: 'well',
		label: 'Well Water',
	},
]

export function SourceCombobox({ value, setValue }: { value: string; setValue: Function }) {
	const [open, setOpen] = React.useState(false)

	return (
		<>
			<Label htmlFor="source" children="Source" />
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button variant="outline" role="combobox" aria-expanded={open} className="md:w-[250px] justify-between">
						{value ? options.find(framework => framework.value === value)?.label : 'Select source...'}
						<CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
					</Button>
				</PopoverTrigger>
				<PopoverContent className="md:w-[250px] p-0">
					<Command>
						<CommandGroup>
							{options.map(framework => (
								<CommandItem
									key={framework.value}
									value={framework.value}
									onSelect={(currentValue: string) => {
										setValue(currentValue === value ? 'surface' : currentValue)
										setOpen(false)
									}}
								>
									{framework.label}
									<CheckIcon
										className={cn('ml-auto h-4 w-4', value === framework.value ? 'opacity-100' : 'opacity-0')}
									/>
								</CommandItem>
							))}
						</CommandGroup>
					</Command>
				</PopoverContent>
			</Popover>
		</>
	)
}
