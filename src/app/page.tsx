export const runtime = 'edge'

export default function Home() {
  return (
    <main style={{ fontFamily: 'sans-serif', padding: 40 }}>
      <h1>Projeto NFC</h1>
      <p>
        Painel do comércio: <a href="/painel">/painel</a> · Admin:{' '}
        <a href="/admin">/admin</a>
      </p>
    </main>
  )
}
