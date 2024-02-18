/* eslint-disable react-hooks/exhaustive-deps */
import PropTypes from 'prop-types'
import { useCallback, useState, useEffect } from 'react'

/**
 * ScrollSync provider component
 *
 */
const useScrollSync = ({ enabled = true, onSync, proportional = true, vertical = true, horizontal = true }) => {
	const [panes, setPanes] = useState([])

	const findPane = useCallback(
		node => {
			return panes.find(pane => pane === node)
		},
		[panes],
	)

	const syncScrollPosition = useCallback(
		(scrolledPane, pane) => {
			const { scrollTop, scrollHeight, clientHeight, scrollLeft, scrollWidth, clientWidth } = scrolledPane

			const scrollTopOffset = scrollHeight - clientHeight
			const scrollLeftOffset = scrollWidth - clientWidth

			/* Calculate the actual pane height */
			const paneHeight = pane.scrollHeight - clientHeight
			const paneWidth = pane.scrollWidth - clientWidth
			/* Adjust the scrollTop position of it accordingly */
			if (vertical && scrollTopOffset > 0) {
				pane.scrollTop = proportional ? (paneHeight * scrollTop) / scrollTopOffset : scrollTop // eslint-disable-line
			}
			if (horizontal && scrollLeftOffset > 0) {
				pane.scrollLeft = proportional ? (paneWidth * scrollLeft) / scrollLeftOffset : scrollLeft // eslint-disable-line
			}
		},
		[vertical, horizontal],
	)

	const removeEvents = useCallback(node => {
		/* For some reason element.removeEventListener doesnt work with document.body */
		node.onscroll = null // eslint-disable-line
	}, [])

	const syncScrollPositions = useCallback(
		(scrolledPane, _panes) => {
			_panes.forEach(paneNodeRef => {
				/* For all panes beside the currently scrolling one */
				if (scrolledPane !== paneNodeRef) {
					/* Remove event listeners from the node that we'll manipulate */
					removeEvents(paneNodeRef)
					syncScrollPosition(scrolledPane, paneNodeRef)
					/* Re-attach event listeners after we're done scrolling */
					window.requestAnimationFrame(() => {
						addEvents(paneNodeRef, _panes)
					})
				}
			})
			if (onSync) onSync(scrolledPane)
		},
		[removeEvents, syncScrollPosition, onSync],
	)

	const handlePaneScroll = useCallback(
		(node, _panes) => {
			if (!enabled) {
				return
			}
			window.requestAnimationFrame(() => {
				syncScrollPositions(node, _panes)
			})
		},
		[syncScrollPosition],
	)

	const addEvents = useCallback(
		(node, _panes) => {
			/* For some reason element.addEventListener doesnt work with document.body */
			node.onscroll = handlePaneScroll.bind(this, node, _panes) // eslint-disable-line
		},
		[handlePaneScroll],
	)

	const registerPane = useCallback(
		node => {
			if (!findPane(node)) {
				if (panes.length > 0) {
					syncScrollPosition(panes[0], node)
				}
				setPanes(prev => [...prev, node])
			}
		},
		[panes, findPane, addEvents],
	)

	const unregisterPane = useCallback(
		node => {
			if (findPane(node)) {
				removeEvents(node)
				setPanes(prev => prev.splice(prev.indexOf(node), 1))
			}
		},
		[findPane, removeEvents],
	)

	useEffect(() => {
		// Update events when registering more panes
		panes.forEach(pane => {
			addEvents(pane, panes)
		})
	}, [panes])

	return {
		registerPane,
		unregisterPane,
	}
}

useScrollSync.propTypes = {
	/**
	 * Callback to be invoked any time synchronization happens
	 *
	 * @param {Element} el The element that has received the scroll event
	 */
	onSync: PropTypes.func,
	children: PropTypes.element.isRequired,
	proportional: PropTypes.bool,
	vertical: PropTypes.bool,
	horizontal: PropTypes.bool,
	enabled: PropTypes.bool,
}

useScrollSync.defaultProps = {
	proportional: true,
	vertical: true,
	horizontal: true,
	enabled: true,
}

useScrollSync.childContextTypes = {
	registerPane: PropTypes.func,
	unregisterPane: PropTypes.func,
}

export default useScrollSync

export const useScrollSyncWrap = ({ nodeRefs, options = {} }) => {
	const { registerPane, unregisterPane } = useScrollSync(options)

	useEffect(() => {
		nodeRefs.forEach(nodeRef => {
			if (nodeRef && nodeRef.current) {
				registerPane(nodeRef.current)
			}
		})
		return () =>
			nodeRefs.forEach(nodeRef => {
				if (nodeRef && nodeRef.current) {
					unregisterPane(nodeRef.current)
				}
			})
	}, [nodeRefs, registerPane, unregisterPane])

	return {}
}
