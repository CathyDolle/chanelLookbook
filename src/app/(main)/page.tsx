import { Container, Lookbook } from "@/components";

export default function Home() {
  return (
    <main>
      <Container className="flex w-full flex-col items-center justify-center py-72">
        <span className="font-serif text-10">Automne hiver 2026</span>
        <h1 className="mb-8 font-serif text-24">silhouettes</h1>
      </Container>
      <Lookbook />
    </main>
  );
}
