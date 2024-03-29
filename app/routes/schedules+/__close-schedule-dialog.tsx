import { Button } from '#app/components/ui/button.tsx'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '#app/components/ui/dialog'
import { Icon } from '#app/components/ui/icon.tsx'
import { ScheduleActionButton } from './__schedule-action-button'

export function DialogCloseSchedule({ id }: { id: string }) {
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button className="min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0" variant="destructive">
					<Icon name="lock-closed" className="scale-125 max-md:scale-150">
						<span className="overflow-ellipsis text-nowrap max-md:hidden">Close Scheduling</span>
					</Icon>
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Finalize and Close Schedule?</DialogTitle>
					<DialogDescription>
						<p>Finalizing this schedule will create Debit transactions</p>
						<p>(Hours * CostPerHour) for every user who has scheduled hours for this schedule.</p>
						<p>This can only be done once.</p>
					</DialogDescription>
				</DialogHeader>
				<DialogFooter className="sm:justify-start">
					<ScheduleActionButton
						id={id}
						icon="lock-closed"
						value="close-schedule"
						text="Close Scheduling"
						variant="destructive"
					/>
					<DialogClose asChild>
						<Button type="button" variant="default">
							Cancel
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}
