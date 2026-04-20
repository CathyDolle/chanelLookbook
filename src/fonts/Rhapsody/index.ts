import localFont from 'next/font/local'

export const rhapsody = localFont({
	src: [
		{
			path: './Rhapsody-Regular.otf',
			weight: 'normal',
			style: 'normal',
		},
	],
	variable: '--font-rhapsody',
	fallback: ['serif'],
})
