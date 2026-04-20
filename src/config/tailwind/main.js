const {fontSize, letterSpacing, lineHeight, fontFamily} = require('./fonts')
const grid = require('./grid')
const colors = require('./colors')
const spacing = require('./spacing')
const zIndex = require('./z-index')
const transitionTimingFunction = require('./transition')
const screens = require('./screens')
const keyframes = require('./keyframes')
const animation = require('./animation')
const supports = require('./supports')
const width = require('./width')
const height = require('./height')
const plugin = require('tailwindcss/plugin')

module.exports = {
	future: {
		hoverOnlyWhenSupported: true,
	},
	theme: {
		spacing,
		fontSize,
		grid,
		screens,
		colors,
		fontFamily,
		extend: {
			letterSpacing,
			lineHeight,
			zIndex,
			transitionTimingFunction,
			keyframes,
			width,
			minWidth: {...spacing, width},
			maxWidth: {...spacing, width},
			height,
			minHeight: {...spacing, height},
			animation,
			...supports,
		},
	},
	plugins: [
		require('@numbered/tailwind-fluid-layout-system')({color: 'rgba(255,0,0,0.5)'}),
		plugin(function({addUtilities, theme}) {
			const gridTheme = theme('grid') || {}
			// On prend les valeurs depuis `theme.grid.mobile.gutters` comme source de vérité.
			const gutters = (gridTheme.mobile && gridTheme.mobile.gutters) ? gridTheme.mobile.gutters : {
				xs: 2, s: 3, m: 5, l: 9,
			}

			addUtilities({
				// Classe "globale" (lit la variable). À utiliser partout sur la page.
				'.gutter-gap': { gap: 'var(--gutter-gap, 5px)' },

				// Variantes: set la variable (et donc impacte toutes les zones qui utilisent `.gutter-gap`).
				'.gutter-gap-xs': { '--gutter-gap': `${gutters.xs}px` },
				'.gutter-gap-s': { '--gutter-gap': `${gutters.s}px` },
				'.gutter-gap-m': { '--gutter-gap': `${gutters.m}px` },
				'.gutter-gap-l': { '--gutter-gap': `${gutters.l}px` },
			})
		}),
	],
}
