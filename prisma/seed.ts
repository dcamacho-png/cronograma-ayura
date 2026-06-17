import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

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

// Máquinas del Excel (placa/identificador + operario oficial).
const MAQUINAS: { nombre: string; operario: string | null }[] = [
  { nombre: '5403', operario: 'Duván' },
  { nombre: '4299', operario: 'Jairo' },
  { nombre: '5075 E', operario: 'Daveis Ramírez' },
  { nombre: '5090 E', operario: null },
  { nombre: '6603', operario: 'Carlos Botiva' },
  { nombre: 'SAME 55', operario: 'Luis Olaya' },
  { nombre: '8030', operario: 'Santos' },
  { nombre: '108', operario: 'Duván' },
  { nombre: 'ZETOR', operario: 'Diego' },
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
    for (const m of MAQUINAS) {
      await prisma.maquina.create({ data: { nombre: m.nombre, operario: m.operario } })
    }
  }

  const [areas, fincas, motivos, responsables, maquinas] = await Promise.all([
    prisma.area.count(),
    prisma.finca.count(),
    prisma.motivo.count(),
    prisma.responsable.count(),
    prisma.maquina.count(),
  ])
  console.log(
    `Seed listo: ${areas} áreas, ${fincas} fincas, ${motivos} motivos, ${responsables} responsables, ${maquinas} máquinas.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
