const grid = {
	mobile: {
		columns: 12,
		gutter: 5,
		gutters: {
			xs: 2,
			s: 3,
			m: 5,
			l: 9,
		},
		margin: 5,
		mockupWidth: 375,
		fontScalingMaxWidth: 475,
	},
	tablet: {
		columns: 6,
		gutter: 12,
		gutters: {
			xs: 2,
			s: 3,
			m: 5,
			l: 9,
		},
		margin: 12,
		mockupWidth: 768,
		screen: 'md',
	},
	desktop: {
		columns: 12,
		gutter: 8,
		gutters: {
			xs: 2,
			s: 3,
			m: 5,
			l: 9,
		},
		margin: 8,
		mockupWidth: 1440,
		// maxWidth: 1920,
		fontScalingMaxWidth: 1680,
		screen: 'lg',
	},
}

module.exports = grid
