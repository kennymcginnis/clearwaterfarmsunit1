import { type MetaFunction } from '@remix-run/node'
import { Outlet } from '@remix-run/react'
import { Spacer } from '#app/components/spacer.tsx'

export const meta: MetaFunction = () => [{ title: 'Clearwater Farms 1' }]

export default function MdxLayout() {
	return (
		// <div className="container mx-auto mb-48  flex flex-col items-center justify-center">
		<main className="container flex h-full min-h-[400px] max-w-6xl px-0 pb-12 md:px-8">
			<Spacer size="4xs" />
			<div className="container flex flex-col items-center rounded-3xl bg-muted p-12">
				<div className="prose prose-zinc mx-auto min-h-screen max-w-4xl lg:prose-lg dark:prose-invert">
					<Outlet />
				</div>
			</div>
		</main>
	)
}
