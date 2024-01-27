import { conform, useFieldset, type FieldConfig } from '@conform-to/react'
import { useRef, useState } from 'react'
import { z } from 'zod'
import { Icon } from '#app/components/ui/icon.tsx'

type csv = { [name: string]: string }

const MAX_UPLOAD_SIZE = 1024 * 1024 * 3 // 3MB

const FileFieldsetSchema = z.object({
	id: z.string().optional(),
	file: z
		.instanceof(File)
		.optional()
		.refine(file => {
			return !file || file.size <= MAX_UPLOAD_SIZE
		}, 'File size must be less than 3MB'),
})

export function FileChooser() {
	const config: FieldConfig<z.infer<typeof FileFieldsetSchema>> = {}

	const ref = useRef<HTMLFieldSetElement>(null)
	const fields = useFieldset(ref, config)

	const [file, setFile] = useState()
	const [array, setArray] = useState()

	const handleOnChange = (event: any) => {
		setFile(event.target.files?.[0])
		if (file) {
			const reader = new FileReader()
			reader.onloadend = () => {
				csvFileToArray(reader.result as string)
			}
			reader.readAsText(file)
		} else {
			setArray([])
		}
	}

	const csvFileToArray = (string: string) => {
		const csvHeader = string.slice(0, string.indexOf('\n')).split(',')
		const csvRows = string.slice(string.indexOf('\n') + 1).split('\n')

		const rows = csvRows.map((csvRow: string) => {
			const values = csvRow.split(',')
			const obj = csvHeader.reduce((agg: csv, header: string, index: number) => {
				agg[header] = values[index]
				return agg
			}, {})
			return obj
		})

		setArray(rows)
	}

	return (
		<fieldset ref={ref}>
			<label htmlFor={fields.file.id}>
				<div className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground outline-none ring-ring ring-offset-2 ring-offset-background transition-colors focus-within:ring-2 hover:bg-primary/80 focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50 min-[525px]:max-md:aspect-square min-[525px]:max-md:px-0">
					<Icon name="upload" className="scale-125 max-md:scale-150">
						<span className="max-md:hidden">Upload Time Schedule</span>
					</Icon>
				</div>
				<input
					aria-label="File"
					className="absolute left-0 top-0 z-0 h-full w-full cursor-pointer opacity-0"
					onChange={handleOnChange}
					accept=".csv"
					{...conform.input(fields.file, {
						type: 'file',
						ariaAttributes: true,
					})}
				/>
			</label>
		</fieldset>
	)
}
