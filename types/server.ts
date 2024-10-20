export interface TagsCount {
	[tag: string]: number
}

export interface PaginationType {
	currentPage: number
	totalPages: number
}

export interface TOC {
	value: string
	url: string
	depth: number
}

export interface RemarkTocHeadingOptions {
	exportRef: TOC[]
}
