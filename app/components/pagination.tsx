import { useSearchParams } from '@remix-run/react'
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationFirst,
	PaginationItem,
	PaginationLast,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '#app/components/ui/pagination'

/**
 * @type {React.FC<{
 * totalPages: number|string
 * }>}
 */
function PaginationComponent({ totalPages = Number.MAX_SAFE_INTEGER, className = '', ...attrs }) {
	const [queryParams] = useSearchParams()
	const currentPage = Number(queryParams.get('page') || 1)
	totalPages = Number(totalPages)

	const firstQuery = new URLSearchParams(queryParams)
	firstQuery.set('page', '1')

	const previousQuery = new URLSearchParams(queryParams)
	previousQuery.set('page', (currentPage - 1).toString())

	const currentQuery = new URLSearchParams(queryParams)

	const nextQuery = new URLSearchParams(queryParams)
	nextQuery.set('page', (currentPage + 1).toString())

	const lastQuery = new URLSearchParams(queryParams)
	lastQuery.set('page', totalPages.toString())

	return (
		<Pagination>
			<PaginationContent>
				{/* first */}
				<PaginationItem>
					<PaginationFirst to={`?${firstQuery.toString()}`} />
				</PaginationItem>

				{/* pagination previous */}
				{currentPage > 1 ? (
					<PaginationItem>
						<PaginationPrevious to={`?${previousQuery.toString()}`} />
					</PaginationItem>
				) : null}

				{/* previous elipse */}
				{currentPage > 3 ? (
					<PaginationItem>
						<PaginationEllipsis />
					</PaginationItem>
				) : null}

				{/* previous */}
				{currentPage > 1 ? (
					<PaginationItem>
						<PaginationLink to={`?${previousQuery.toString()}`}>{currentPage - 1}</PaginationLink>
					</PaginationItem>
				) : null}

				{/* current */}
				<PaginationItem>
					<PaginationLink to={`?${currentQuery}`} isActive>
						{currentPage}
					</PaginationLink>
				</PaginationItem>

				{/* next */}
				{currentPage < totalPages ? (
					<PaginationItem>
						<PaginationLink to={`?${nextQuery.toString()}`}>{currentPage + 1}</PaginationLink>
					</PaginationItem>
				) : null}

				{/* next elipse */}
				{currentPage + 2 < totalPages ? (
					<PaginationItem>
						<PaginationEllipsis />
					</PaginationItem>
				) : null}

				{/* pagination next */}
				{currentPage < totalPages ? (
					<PaginationItem>
						<PaginationNext to={`?${nextQuery.toString()}`} />
					</PaginationItem>
				) : null}

				{/* last */}
				<PaginationItem>
					<PaginationLast to={`?${lastQuery.toString()}`} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	)
}

export { PaginationComponent }
