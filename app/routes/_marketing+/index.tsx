import { type MetaFunction } from '@remix-run/node'

export const meta: MetaFunction = () => [{ title: 'Clearwater Farms 1' }]

export default function Index() {
	return (
		<main className="font-poppins grid h-full place-items-center">
			<div className="grid place-items-center px-4 py-16 xl:grid-cols-2 xl:gap-24">
				<div className="flex max-w-md flex-col items-center text-center"></div>
			</div>
		</main>
	)
}
