export function RenderField({
	mainId,
	colXl,
	label,
	labelClass,
	value,
	PopupTooltipComponent,
	tooltip,
	colMg,
	colLg,
	wrapperClass,
}) {
	// There are four type of offer details field:
	//
	//              Label       Value
	//                |           |
	// Example: OFFER NAME  Glasses.com
	//
	// 1. Normal offer detail field: Label + value
	// 2. Tooltip for whole offer detail field: Display tooltip when we do mouse hover on either label or value
	// 3. Icon with tooltip for label: An icon rendered on the right side of label. When we do mouse hover on the icon, the tooltip will be displayed
	//
	//              Icon with tooltip
	//                     |
	// Example: OFFER NAME© Glasses.com
	//
	// 4. Icon with tooltip for value: An icon rendered on the right side of value. When we do mouse hover on the icon, the tooltip will be displayed
	//
	//                          Icon with tooltip
	//                                 |
	// Example: OFFER NAME Glasses.com©
	//
	// PopupTooltipComponent: For value which use PopupTooltipComponent to display a popup.
	let offerDetailsField
	let isTooltipForWholeDetailsField =
		tooltip && Object.keys(tooltip).length && tooltip.iconWithTooltip && tooltip.iconWithTooltip === 'field'
	let isIconWithTooltipForValue =
		tooltip && Object.keys(tooltip).length && tooltip.iconWithTooltip && tooltip.iconWithTooltip === 'value'
	let isIconWithTooltipForLabel =
		tooltip && Object.keys(tooltip).length && tooltip.iconWithTooltip && tooltip.iconWithTooltip === 'label'
	if (isTooltipForWholeDetailsField) {
		offerDetailsField = (
			<span>
				<a data-tip data-for={tooltip.tooltipId}>
					<b className={labelClass}>{T.translate(`texts.${label}`)}</b>
					<span className={tooltip.spanClass}>{value}</span>
				</a>
				<ReactTooltip id={tooltip.tooltipId} type="dark" place={tooltip.tooltipDirection} effect="solid">
					<span>{tooltip.tooltipContent}</span>
				</ReactTooltip>
			</span>
		)
	} else if (isIconWithTooltipForValue) {
		offerDetailsField = (
			<span>
				<b className={labelClass}>{T.translate(`texts.${label}`)}</b>
				<span className={tooltip.spanClass}>
					{value}
					<a data-tip data-for={tooltip.tooltipId}>
						<span className={`glyph-lg ${tooltip.icon} bottom-5px padding-left-4px position-relative`}></span>
					</a>
					<ReactTooltip id={tooltip.tooltipId} type="dark" place={tooltip.tooltipDirection} effect="solid">
						<span>{tooltip.tooltipContent}</span>
					</ReactTooltip>
				</span>
			</span>
		)
	} else if (isIconWithTooltipForLabel) {
		offerDetailsField = (
			<span>
				<b className={labelClass}>{T.translate(`texts.${label}`)}</b>
				<span className={tooltip.spanClass}>
					<a data-tip data-for={tooltip.tooltipId}>
						<span className={`glyph-lg ${tooltip.icon} bottom-5px padding-left-4px position-relative`}></span>
					</a>
					<ReactTooltip id={tooltip.tooltipId} type="dark" place={tooltip.tooltipDirection} effect="solid">
						<span>{tooltip.tooltipContent}</span>
					</ReactTooltip>
				</span>
				<span className="offerDetails-Value">{value}</span>
			</span>
		)
	} else {
		offerDetailsField = (
			<span>
				<b className={labelClass}>{T.translate(`texts.${label}`)}</b>
				{PopupTooltipComponent ? PopupTooltipComponent : <span className="offerDetails-Value">{value}</span>}
			</span>
		)
	}
	return (
		<div
			id={mainId}
			key={mainId}
			className={`col-md-${colMg} col-lg-${colLg} col-xl-${colXl} offer-det-row ${wrapperClass}`}
		>
			{offerDetailsField}
		</div>
	)
}
