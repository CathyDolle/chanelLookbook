import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { rhapsody } from '@/fonts/Rhapsody';
import '@/style/globals.scss'
import { Lenis } from '@/components'
import clsx from 'clsx';
import { Grid } from '@/components/grid/Grid';

const inter = Inter(
	{ 
		subsets: ['latin'],
		variable: '--font-inter',
	}
)

export const metadata: Metadata = {
	title: 'Next Starter',
	description: 'Next.js starter template',
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode
}) {
	return (
		<html lang="en">
			<body className={clsx(
				'font-normal bg-black text-white',
				inter.className,
				inter.variable,
				rhapsody.variable,
			)}>
				{children}
				<Grid />
				<Lenis key={`lenis${(children as React.ReactElement)?.key}`} />
			</body>
		</html>
	)
}
