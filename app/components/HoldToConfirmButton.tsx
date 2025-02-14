import React from 'react'
import { Button } from './ui/button'

interface HoldToConfirmButtonProps {
	className?: string
	variant?: 'default' | 'destructive' | 'outline' | 'outline-link' | 'secondary' | 'ghost' | 'link' | null | undefined
	onSubmit: () => void
	holdDelay?: number
	children: React.ReactNode
}

export const HoldToConfirmButton: React.FC<HoldToConfirmButtonProps> = ({
	className,
	variant,
	onSubmit,
	holdDelay = 1000,
	children,
}) => {
	const [percentage, setPercentage] = React.useState(0)
	const startTime = React.useRef<number | null>(null)
	const holdIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

	React.useEffect(() => {
		return () => {
			holdIntervalRef.current && clearInterval(holdIntervalRef.current)
		}
	}, [])

	const startCounter = () => {
		if (holdIntervalRef.current) return
		startTime.current = Date.now()
		holdIntervalRef.current = setInterval(() => {
			if (startTime.current) {
				setPercentage(Math.floor(((Date.now() - startTime.current) / holdDelay) * 100))
				if (Date.now() - startTime.current > holdDelay) {
					stopCounter()
					onSubmit()
				}
			}
		}, 10)
	}

	const stopCounter = () => {
		startTime.current = null
		setPercentage(0)
		if (holdIntervalRef.current) {
			clearInterval(holdIntervalRef.current)
			holdIntervalRef.current = null
		}
	}

	return (
		<Button
			className={className}
			variant={variant}
			onMouseDown={startCounter}
			onMouseUp={stopCounter}
			onMouseLeave={stopCounter}
			onTouchStart={startCounter}
			onTouchCancel={stopCounter}
			onTouchEnd={stopCounter}
			style={{
				background: 'linear-gradient(green, green) no-repeat top left',
				backgroundSize: `${percentage}%`,
			}}
		>
			{children}
		</Button>
	)
}
