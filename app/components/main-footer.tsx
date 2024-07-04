/* eslint-disable remix-react-routes/use-link-for-routes */
/* eslint-disable jsx-a11y/anchor-is-valid */
import { Link } from '@remix-run/react'
import { type Theme } from '#app/utils/theme.server.ts'

export function Footer({ userPreference }: { userPreference?: Theme | null }) {
	const mailingAddress = `Clearwater Farms Property Owners Association, 
Unit #1 (C.F.P.O.A. Unit 1)
PO BOX 597 
Waddell, Arizona 85355`
	return (
		<footer className="bg-white dark:bg-gray-900">
			<div className="w-full p-4 lg:p-8">
				<div className="md:flex md:justify-between">
					<div className="mb-6 md:mb-0">
						<div className="flex content-start">
							<img src="/img/cwf.svg" className="dark:light-filter h-12" alt="CWF" />
							<Link to="/" className="group flex flex-wrap items-center leading-snug">
								<span className="text-lg font-bold transition group-hover:translate-y-1">Clearwater Farms&nbsp;</span>
								<span className="text-md text-nowrap font-light transition group-hover:-translate-y-1">Unit 1</span>
							</Link>
						</div>
						<pre>
							<pre>{mailingAddress}</pre>
						</pre>
					</div>
					<div className="grid grid-cols-2 gap-8 sm:gap-6">
						<div>
							<h2 className="mb-6 text-sm font-semibold uppercase text-gray-900 dark:text-white">Resources</h2>
							<ul className="font-medium text-gray-500 dark:text-gray-400">
								<li className="mb-4">
									<a href="https://homeowners.cityproperty.com/" className="hover:underline">
										City Property
									</a>
								</li>
								<li className="mb-4 hover:underline">
									<Link to="/trade-list">Trade List</Link>
								</li>
							</ul>
						</div>
						<div>
							<Link to="/contact-us">
								<h2 className="mb-6 text-sm font-semibold uppercase text-gray-900 hover:underline dark:text-white">
									Contact us
								</h2>
							</Link>
							<ul className="font-medium text-gray-500 dark:text-gray-400">
								<li className="mb-4">Laurie Morgan:</li>
								<li>(623) 326-1875</li>
							</ul>
						</div>
					</div>
				</div>
				<hr className="my-6 border-gray-200 dark:border-gray-700 sm:mx-auto lg:my-8" />
				<div className="sm:flex sm:items-center sm:justify-between">
					<span className="text-sm text-gray-500 dark:text-gray-400 sm:text-center">
						© 2024 Clearwater Farms Unit 1. All Rights Reserved.
					</span>
					<div className="mt-4 flex sm:mt-0 sm:justify-center">
						<a
							href="https://www.facebook.com/groups/182246863357297/"
							className="text-gray-500 hover:text-gray-900 dark:hover:text-white"
						>
							<svg
								className="h-5 w-5"
								aria-hidden="true"
								xmlns="http://www.w3.org/2000/svg"
								fill="#1976D2"
								viewBox="0 0 8 19"
							>
								<path
									fill-rule="evenodd"
									d="M6.135 3H8V0H6.135a4.147 4.147 0 0 0-4.142 4.142V6H0v3h2v9.938h3V9h2.021l.592-3H5V3.591A.6.6 0 0 1 5.592 3h.543Z"
									clip-rule="evenodd"
								/>
							</svg>
							<span className="sr-only">Facebook</span>
						</a>
						<a
							href="https://nextdoor.com/neighborhood/clearwaterfarms--waddell--az"
							className="ms-2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5"
								aria-hidden="true"
								fill="currentColor"
								viewBox="0 0 24 24"
								id="nextdoor"
							>
								<path
									fill="#8BC94D"
									d="M2.5 3.75C2.08579 3.75 1.75 4.08579 1.75 4.5V7.5C1.75 9.84721 3.65279 11.75 6 11.75H6.75V19.5C6.75 19.9142 7.08579 20.25 7.5 20.25H11.5C11.9142 20.25 12.25 19.9142 12.25 19.5V11.5C12.25 10.2574 13.2574 9.25 14.5 9.25C15.7426 9.25 16.75 10.2574 16.75 11.5V19.5C16.75 19.9142 17.0858 20.25 17.5 20.25H21.5C21.9142 20.25 22.25 19.9142 22.25 19.5V11.5C22.25 7.21979 18.7802 3.75 14.5 3.75C11.7881 3.75 9.40238 5.14326 8.01833 7.25H8C7.58579 7.25 7.25 6.91421 7.25 6.5V4.5C7.25 4.08579 6.91421 3.75 6.5 3.75H2.5Z"
								></path>
							</svg>
							<span className="sr-only">Nextdoor</span>
						</a>
					</div>
				</div>
			</div>
		</footer>
	)
}
