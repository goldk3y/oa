import AaLobbyEnters from './components/AaLobbyEnters';

export default function Home() {
  return (
    <div className="min-h-screen p-8 pb-20 sm:p-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col items-center">
        <AaLobbyEnters />
      </main>
    </div>
  );
}
