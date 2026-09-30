import type { EvidenceType } from '@/lib/types'

export type DemoEvidence = {
  day: number
  title: string
  type: EvidenceType
  content: string
}

export type DemoCase = {
  slug: string
  title: string
  description: string
  evidence: DemoEvidence[]
}

/** Synthetic, fictional data only. */
export const DEMO_CASES: DemoCase[] = [
  {
    slug: 'warehouse-theft',
    title: 'Warehouse Theft Investigation',
    description:
      'A pallet of consumer electronics was reported missing from Northgate Distribution Warehouse after a scheduled afternoon delivery. The investigation is reconstructing the delivery timeline and who was connected to the loading area.',
    evidence: [
      {
        day: 1,
        title: 'Night security guard statement',
        type: 'Witness Statement',
        content:
          'Statement from Witness 1 (night security guard at Northgate Distribution Warehouse): "The delivery happened at approximately 8:00 PM. I remember the loading bay door being open around then, but I did not see who was there." The shift roster lists Person A as an inventory handler on duty that day.',
      },
      {
        day: 3,
        title: 'Delivery management system log',
        type: 'System Log',
        content:
          'Export from the delivery management system: Delivery #DL-4471 to Northgate Distribution Warehouse was recorded as completed at 3:42 PM. The completion was scanned by handheld device HS-12 at the loading bay.',
      },
      {
        day: 5,
        title: 'Badge access log — loading bay door',
        type: 'System Log',
        content:
          'Badge access log for the loading-bay side door: the badge assigned to Person A entered the warehouse at 3:35 PM. No exit event is recorded for that badge until 4:20 PM.',
      },
      {
        day: 6,
        title: 'CCTV review report',
        type: 'CCTV Report',
        content:
          "CCTV review report, camera 4 (loading area): an individual matching Person A's description was present near the loading area between 3:35 PM and 3:50 PM. The face is not clearly visible. A second, unidentified individual appears briefly at 3:47 PM.",
      },
      {
        day: 7,
        title: "Driver's assistant statement",
        type: 'Witness Statement',
        content:
          'Statement from Witness 2 (driver\'s assistant on delivery #DL-4471): "The delivery truck left around 3:50 PM. At about 3:45 PM I saw Person A at the front office desk on a phone call, not in the loading area."',
      },
    ],
  },
  {
    slug: 'missing-equipment',
    title: 'Missing Equipment Investigation',
    description:
      'Thermal imaging camera TC-9 can no longer be located at the Harbor Research Lab. The investigation is tracing how the equipment moved between rooms and which people are connected to those locations.',
    evidence: [
      {
        day: 1,
        title: 'Weekly inventory report',
        type: 'Report',
        content:
          'Weekly inventory report: thermal imaging camera TC-9 was last recorded in Storage Room A on Monday at 9:00 AM. It was not found during the Friday inventory check.',
      },
      {
        day: 2,
        title: 'Storage Room A access register',
        type: 'System Log',
        content:
          'Access register for Storage Room A: Person B (lab technician) entered Storage Room A on Monday at 10:15 AM and exited at 10:40 AM.',
      },
      {
        day: 3,
        title: 'Facilities movement report',
        type: 'Report',
        content:
          'Facilities movement report: equipment TC-9 was transferred from Storage Room A to Room C on Monday at 11:00 AM. The transfer was authorised by facilities; the person who physically moved it is not recorded.',
      },
      {
        day: 4,
        title: 'Room C access log',
        type: 'System Log',
        content: 'Access log for Room C: Person C (project engineer) accessed Room C on Monday at 11:20 AM and again at 3:10 PM.',
      },
      {
        day: 5,
        title: 'Technician witness statement',
        type: 'Witness Statement',
        content:
          'Statement from Witness 3 (lab technician): "I saw the thermal camera TC-9 still on its shelf in Storage Room A at around 2:00 PM on Monday. It was definitely not moved in the morning."',
      },
      {
        day: 6,
        title: 'Updated inventory record',
        type: 'Report',
        content:
          'Updated inventory record: TC-9 was scanned into Room C on Monday at 3:05 PM. Facilities corrected the transfer entry from 11:00 AM to 2:45 PM, noting the original entry was the scheduled time, not the actual move.',
      },
    ],
  },
]
