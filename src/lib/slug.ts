// Gera slug a partir do nome do comércio: minúsculas, sem acento, hífens.
// Casa com o CHECK do banco: ^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$

export function slugify(nome: string): string {
  const base = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const limpo = base.replace(/-+$/g, '')
  return limpo.length >= 3 ? limpo : `${limpo || 'loja'}-${Math.random().toString(36).slice(2, 6)}`
}

// Acrescenta sufixo curto até não colidir com slugs já usados.
export function slugUnico(nome: string, existentes: Set<string>): string {
  const base = slugify(nome)
  if (!existentes.has(base)) return base
  for (let i = 2; i < 1000; i++) {
    const candidato = `${base}-${i}`.slice(0, 50)
    if (!existentes.has(candidato)) return candidato
  }
  return `${base}-${Math.random().toString(36).slice(2, 6)}`
}
