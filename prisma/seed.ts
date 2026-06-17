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

  for (const nombre of ACTIVIDADES_ESTIPULADAS) {
    await prisma.actividadEstipulada.upsert({ where: { nombre }, update: {}, create: { nombre } })
  }

  const [areas, fincas, motivos, responsables, maquinas, estipuladas] = await Promise.all([
    prisma.area.count(),
    prisma.finca.count(),
    prisma.motivo.count(),
    prisma.responsable.count(),
    prisma.maquina.count(),
    prisma.actividadEstipulada.count(),
  ])
  console.log(
    `Seed listo: ${areas} áreas, ${fincas} fincas, ${motivos} motivos, ${responsables} responsables, ${maquinas} máquinas, ${estipuladas} actividades estipuladas.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
