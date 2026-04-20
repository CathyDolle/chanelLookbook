import { Container, Lookbook } from "@/components"

export default function Home() {
	return (
		<main>
			<Container className="w-full flex justify-center items-center flex-col py-72">
				<span className="font-serif text-10">Automne hiver 2026</span>
				<h1 className="font-serif text-24 mb-8">silhouettes</h1>
			</Container>
			<Lookbook />
		</main>
	)
}
