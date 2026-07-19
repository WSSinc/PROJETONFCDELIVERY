// Gerador de QR Code sem dependência externa (modo byte, ECC nível M, versões 1–10).
// Implementação baseada no algoritmo de referência do padrão ISO/IEC 18004
// (estrutura inspirada no qrcodegen de Nayuki, MIT). Cobre URLs de até ~200 chars —
// muito além do que /r/<slug> precisa.

// --- tabelas (índice = versão 1..10, posição 0 vazia) -----------------------
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
const ECC_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const NUM_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const ALIGN_POS: Record<number, number[]> = {
  2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30], 6: [6, 34],
  7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
}

// --- aritmética GF(256), polinômio 0x11D ------------------------------------
function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ (result.shift() as number)
    result.push(0)
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor) })
  }
  return result
}

// --- geração ----------------------------------------------------------------
export function qrMatrix(text: string): boolean[][] | null {
  const data = Array.from(new TextEncoder().encode(text))

  // menor versão que comporta os dados (modo byte)
  let version = 0
  for (let v = 1; v <= 10; v++) {
    const capBits = (TOTAL_CODEWORDS[v] - ECC_PER_BLOCK_M[v] * NUM_BLOCKS_M[v]) * 8
    const countBits = v <= 9 ? 8 : 16
    if (4 + countBits + data.length * 8 <= capBits) { version = v; break }
  }
  if (version === 0) return null

  const size = version * 4 + 17
  const capacityBits =
    (TOTAL_CODEWORDS[version] - ECC_PER_BLOCK_M[version] * NUM_BLOCKS_M[version]) * 8

  // bitstream: modo (0100) + contagem + dados + terminador + padding
  const bits: number[] = []
  const appendBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1)
  }
  appendBits(0b0100, 4)
  appendBits(data.length, version <= 9 ? 8 : 16)
  data.forEach((b) => appendBits(b, 8))
  appendBits(0, Math.min(4, capacityBits - bits.length))
  if (bits.length % 8 !== 0) appendBits(0, 8 - (bits.length % 8))
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(pad, 8)

  const dataCodewords: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]
    dataCodewords.push(b)
  }

  // divide em blocos, calcula ECC e intercala
  const numBlocks = NUM_BLOCKS_M[version]
  const eccLen = ECC_PER_BLOCK_M[version]
  const rawCodewords = TOTAL_CODEWORDS[version]
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks)
  const shortBlockLen = Math.floor(rawCodewords / numBlocks)
  const divisor = rsDivisor(eccLen)

  const blocks: number[][] = []
  let k = 0
  for (let i = 0; i < numBlocks; i++) {
    const datLen = shortBlockLen - eccLen + (i < numShortBlocks ? 0 : 1)
    const dat = dataCodewords.slice(k, k + datLen)
    k += datLen
    const ecc = rsRemainder(dat, divisor)
    if (i < numShortBlocks) dat.push(0) // marcador p/ intercalar sem deslocar
    blocks.push(dat.concat(ecc))
  }
  const allCodewords: number[] = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - eccLen || j >= numShortBlocks) allCodewords.push(block[i])
    })
  }

  // matrizes de módulos
  const modules: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const isFunction: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setFn = (x: number, y: number, dark: boolean) => {
    modules[y][x] = dark
    isFunction[y][x] = true
  }

  // timing
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0) }
  // localizadores + separadores
  const drawFinder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy
      if (x < 0 || x >= size || y < 0 || y >= size) continue
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      setFn(x, y, dist !== 2 && dist !== 4)
    }
  }
  drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4)
  // alinhamento
  const aligns = ALIGN_POS[version] ?? []
  const last = aligns.length - 1
  aligns.forEach((a, i) => aligns.forEach((b, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      setFn(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }))
  // info de versão (v >= 7)
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const vBits = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const bit = ((vBits >>> i) & 1) !== 0
      const a = Math.floor(i / 3), b = size - 11 + (i % 3)
      setFn(a, b, bit); setFn(b, a, bit)
    }
  }

  const drawFormat = (mask: number) => {
    const fmtData = (0b00 << 3) | mask // ECC M = 00
    let rem = fmtData
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const fmt = ((fmtData << 10) | rem) ^ 0x5412
    const bit = (i: number) => ((fmt >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i))
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i))
    setFn(8, size - 8, true) // módulo escuro fixo
  }
  drawFormat(0) // reserva as células como funcionais antes do zigue-zague

  // dados em zigue-zague
  let bitIndex = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!isFunction[y][x] && bitIndex < allCodewords.length * 8) {
          modules[y][x] = ((allCodewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0
          bitIndex++
        }
      }
    }
  }

  // máscaras: aplica cada uma, mede penalidade, fica com a melhor
  const maskFns: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (_x, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ]
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      if (!isFunction[y][x] && maskFns[mask](x, y)) modules[y][x] = !modules[y][x]
    }
  }
  const penalty = (): number => {
    let score = 0
    const at = (axis: number, a: number, b: number) => (axis === 0 ? modules[a][b] : modules[b][a])
    for (let axis = 0; axis < 2; axis++) {
      for (let a = 0; a < size; a++) {
        let run = 1
        for (let b = 1; b <= size; b++) {
          if (b < size && at(axis, a, b) === at(axis, a, b - 1)) run++
          else { if (run >= 5) score += 3 + (run - 5); run = 1 }
        }
        for (let b = 0; b + 7 <= size; b++) {
          const pat = [true, false, true, true, true, false, true]
            .every((v, i) => at(axis, a, b + i) === v)
          if (pat) {
            const claroAntes = b >= 4 && [1, 2, 3, 4].every((i) => !at(axis, a, b - i))
            const claroDepois = b + 11 <= size && [7, 8, 9, 10].every((i) => !at(axis, a, b + i))
            if (claroAntes || claroDepois) score += 40
          }
        }
      }
    }
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
      const c = modules[y][x]
      if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3
    }
    let dark = 0
    modules.forEach((row) => row.forEach((c) => { if (c) dark++ }))
    const total = size * size
    score += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
    return score
  }

  let bestMask = 0
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask)
    drawFormat(mask)
    const s = penalty()
    if (s < bestScore) { bestScore = s; bestMask = mask }
    applyMask(mask) // desfaz (XOR é involutivo)
  }
  applyMask(bestMask)
  drawFormat(bestMask)

  return modules
}

// path SVG dos módulos escuros; consumidor desenha com viewBox = tamanho + zona quieta
export function qrSvgPath(matrix: boolean[][]): string {
  const parts: string[] = []
  matrix.forEach((row, y) => row.forEach((dark, x) => {
    if (dark) parts.push(`M${x} ${y}h1v1h-1z`)
  }))
  return parts.join('')
}
