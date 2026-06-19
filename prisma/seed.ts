import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'node:fs'
import { hashPassword } from '../src/auth/password'
const lotes: { nombre: string; finca: string | null; hectareas: number | null; tipoPasto: string | null }[] =
  JSON.parse(readFileSync(new URL('./lotes.json', import.meta.url), 'utf-8'))

const prisma = new PrismaClient()

const AREAS = ['Maíz', 'Riego', 'Maquinaria', 'Ganadería ceba', 'Nelore']
const FINCAS = ['Entremontes', 'Acajure', 'Normandia']
const MOTIVOS = [
  'Clima',
  'Daño de máquina',
  'Falta de personal',
  'Falta de insumos',
  'Cambio de prioridad',
  'Otro',
]

// Responsables por nombre de área (del Excel).
const RESPONSABLES: Record<string, string[]> = {
  'Ganadería ceba': [
    'David Zuleta',
    'Duván Peña',
    'Raúl Piñeros',
    'Guillermo Bravo',
    'Alirio Bravo',
    'Jhones Andrés',
  ],
  Maquinaria: [
    'Andrés Mosquera',
    'José Losada',
    'Carlos Botiva',
    'Daveis Ramírez',
    'Jairo Leal',
    'Luis Olaya',
    'Santos Bastos',
  ],
  'Maíz': ['Diego (Zetor)'],
  Riego: [],
  Nelore: [],
}

const ACTIVIDADES_ESTIPULADAS = [
  'ENCALADORA', 'RENOVADOR', 'FERTILIZACION GRANULADA', 'FERTILIZACION POLLINAZA',
  'REGAR COMPOST', 'FUMIGACION CONTROL MALEZAS', 'FUMIGACION CONTROL PLAGAS',
  'RASTRA SIEMBRA', 'CINCEL SIEMBRA', 'PULIDOR SIEMBRA', 'PULIDOR SIEMBRA NEWMAN',
  'SIEMBRA PASTOS', 'ESTERCOLERO', 'MOVIMIENTOS MATERIALES Y INSUMOS', 'MOVIVIMIENTOS RIEGO',
  'MOVIMIENTO CARRETE', 'ROTOSPEED', 'COSECHAR PASTOS', 'COSECHA SILO', 'ROLO',
  'ESPARCIDOR', 'TAIPA', 'DESBROZADORA', 'PALA', 'SEMBRAR CON VOLEADORA', 'SIEMBRA MAIZ',
  'ZANJADORA', 'ALQUILER MAQUINAS CEBA ENTREMONTES', 'ALQUILER MAQUINAS MAIZ', 'GRANEL',
  'COSECHAR MAIZ', 'RIEL', 'BOLA', 'CADENA',
]

// Tractores de la hoja "I. MAQUINAS" (col C) — sin operario (el operario puede cambiar de máquina).
const MAQUINAS: string[] = [
  '6603', '5090E', '5090E PALA', '5075E', '5403',
  '8030', '4299', '365', 'SAME 55', 'KUBOTA 108s', 'ZETOR 5711',
]

async function main() {
  for (const nombre of AREAS) {
    await prisma.area.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }
  for (const nombre of FINCAS) {
    await prisma.finca.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }
  for (const nombre of MOTIVOS) {
    await prisma.motivo.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }

  // Lotes (potreros): upsert por nombre; finca por nombre.
  for (const l of lotes) {
    if (!l.finca) continue
    const finca = await prisma.finca.findUnique({ where: { nombre: l.finca } })
    if (!finca) continue
    await prisma.lote.upsert({
      where: { nombre: l.nombre },
      update: {},
      create: { nombre: l.nombre, fincaId: finca.id, hectareas: l.hectareas, tipoPasto: l.tipoPasto },
    })
  }

  const totalResponsables = await prisma.responsable.count()
  if (totalResponsables === 0) {
    for (const [nombreArea, nombres] of Object.entries(RESPONSABLES)) {
      const area = await prisma.area.findUnique({ where: { nombre: nombreArea } })
      if (!area) continue
      for (const nombre of nombres) {
        await prisma.responsable.create({ data: { nombre, areaId: area.id } })
      }
    }
  }

  const totalMaquinas = await prisma.maquina.count()
  if (totalMaquinas === 0) {
    for (const nombre of MAQUINAS) {
      await prisma.maquina.create({ data: { nombre } })
    }
  }

  for (const nombre of ACTIVIDADES_ESTIPULADAS) {
    await prisma.actividadEstipulada.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }

  // Usuarios: un admin + uno por área (idempotente por 'usuario'). Contraseña por defecto: clave123
  const USUARIOS: { usuario: string; nombre: string; rol: string; area: string | null }[] = [
    { usuario: 'admin', nombre: 'Coordinación general', rol: 'ADMIN', area: null },
    { usuario: 'ganaderia', nombre: 'Ganadería ceba', rol: 'AREA', area: 'Ganadería ceba' },
    { usuario: 'maquinaria', nombre: 'Maquinaria', rol: 'AREA', area: 'Maquinaria' },
    { usuario: 'maiz', nombre: 'Maíz', rol: 'AREA', area: 'Maíz' },
    { usuario: 'riego', nombre: 'Riego', rol: 'AREA', area: 'Riego' },
    { usuario: 'nelore', nombre: 'Nelore', rol: 'AREA', area: 'Nelore' },
  ]
  for (const u of USUARIOS) {
    const areaId = u.area ? (await prisma.area.findUnique({ where: { nombre: u.area } }))?.id ?? null : null
    await prisma.usuario.upsert({
      where: { usuario: u.usuario },
      update: {},
      create: { usuario: u.usuario, nombre: u.nombre, rol: u.rol, areaId, hash: hashPassword('clave123') },
    })
  }
  const totalUsuarios = await prisma.usuario.count()

  const [areas, fincas, motivos, responsables, maquinas, estipuladas] = await Promise.all([
    prisma.area.count(),
    prisma.finca.count(),
    prisma.motivo.count(),
    prisma.responsable.count(),
    prisma.maquina.count(),
    prisma.actividadEstipulada.count(),
  ])
  const totalLotes = await prisma.lote.count()
  console.log(
    `Seed listo: ${areas} áreas, ${fincas} fincas, ${motivos} motivos, ${responsables} responsables, ${maquinas} máquinas, ${estipuladas} actividades estipuladas, ${totalLotes} lotes, ${totalUsuarios} usuarios.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
