export interface CatalogMedicine {
  name: string;
  generic?: string;
  category: string;
  dose: string;
  timesPerDay: string;
  intakeTime: string;
  duration: string;
  foodInstruction: string;
  instructions: string;
}

export const COMMON_MEDICINES: CatalogMedicine[] = [
  // Analgesics & Antipyretics
  {
    name: 'Paracetamol 500 mg',
    generic: 'Paracetamol',
    category: 'Antipyretic / Analgesic',
    dose: '1 Tablet',
    timesPerDay: '3 times/day',
    intakeTime: 'Morning, Afternoon, Night',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'For fever and body ache'
  },
  {
    name: 'Paracetamol 650 mg (Dolo 650)',
    generic: 'Paracetamol',
    category: 'Antipyretic / Analgesic',
    dose: '1 Tablet',
    timesPerDay: '3 times/day',
    intakeTime: 'Morning, Afternoon, Night',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'For high fever and headache'
  },
  {
    name: 'Aceclofenac 100 mg + Paracetamol 325 mg (Zerodol-P)',
    generic: 'Aceclofenac + Paracetamol',
    category: 'NSAID / Pain Relief',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'For acute pain and inflammation'
  },
  {
    name: 'Ibuprofen 400 mg (Brufen 400)',
    generic: 'Ibuprofen',
    category: 'NSAID / Pain Relief',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'Take strictly after meals'
  },
  {
    name: 'Mefenamic Acid + Dicyclomine (Meftal-Spas)',
    generic: 'Mefenamic Acid + Dicyclomine',
    category: 'Antispasmodic',
    dose: '1 Tablet',
    timesPerDay: 'As needed (SOS)',
    intakeTime: 'As needed',
    duration: '2 Days',
    foodInstruction: 'After Food',
    instructions: 'For abdominal cramps or colic pain'
  },
  {
    name: 'Tramadol 37.5 mg + Paracetamol 325 mg (Ultracet)',
    generic: 'Tramadol + Paracetamol',
    category: 'Opioid Analgesic Combination',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'For severe pain under medical advice'
  },

  // Antacids & Gastrointestinal
  {
    name: 'Pantoprazole 40 mg (Pan 40)',
    generic: 'Pantoprazole',
    category: 'Proton Pump Inhibitor (PPI)',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '5 Days',
    foodInstruction: 'Before Food',
    instructions: 'Take 30 mins before breakfast'
  },
  {
    name: 'Pantoprazole 40 mg + Domperidone 30 mg (Pan-D)',
    generic: 'Pantoprazole + Domperidone SR',
    category: 'PPI + Prokinetic',
    dose: '1 Capsule',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '5 Days',
    foodInstruction: 'Before Food',
    instructions: 'Take on an empty stomach'
  },
  {
    name: 'Omeprazole 20 mg (Omez 20)',
    generic: 'Omeprazole',
    category: 'Proton Pump Inhibitor',
    dose: '1 Capsule',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '5 Days',
    foodInstruction: 'Before Food',
    instructions: 'For hyperacidity and heartburn'
  },
  {
    name: 'Rabeprazole 20 mg + Domperidone 30 mg (Razo-D)',
    generic: 'Rabeprazole + Domperidone SR',
    category: 'PPI + Anti-emetic',
    dose: '1 Capsule',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '5 Days',
    foodInstruction: 'Before Food',
    instructions: 'Before morning breakfast'
  },
  {
    name: 'Ondansetron 4 mg (Emeset 4)',
    generic: 'Ondansetron',
    category: 'Anti-emetic',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '3 Days',
    foodInstruction: 'Before Food',
    instructions: 'For nausea and vomiting'
  },
  {
    name: 'Domperidone 10 mg (Vomistop)',
    generic: 'Domperidone',
    category: 'Prokinetic',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Evening',
    duration: '3 Days',
    foodInstruction: 'Before Food',
    instructions: '15 mins before meals'
  },
  {
    name: 'ORS (200 ml) (Electral)',
    generic: 'Oral Rehydration Salts',
    category: 'Electrolyte Replenisher',
    dose: '200 ml',
    timesPerDay: '3 times/day',
    intakeTime: 'Morning, Afternoon, Evening',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'Dissolve in 200ml clean water, maintain hydration'
  },
  {
    name: 'Sucralfate 1000 mg + Oxetacaine 20 mg Suspension',
    generic: 'Sucralfate + Oxetacaine',
    category: 'Ulcer Protectant',
    dose: '10 ml',
    timesPerDay: '3 times/day',
    intakeTime: 'Morning, Afternoon, Night',
    duration: '7 Days',
    foodInstruction: 'Before Food',
    instructions: 'Take 1 hour before meals'
  },

  // Antibiotics
  {
    name: 'Amoxicillin + Potassium Clavulanate 625 mg (Augmentin 625 Duo)',
    generic: 'Amoxicillin + Clavulanic Acid',
    category: 'Broad Spectrum Antibiotic',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '5 Days',
    foodInstruction: 'With Food',
    instructions: 'Complete full course, do not skip'
  },
  {
    name: 'Azithromycin 500 mg (Azee 500)',
    generic: 'Azithromycin',
    category: 'Macrolide Antibiotic',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'Take at the same time each day'
  },
  {
    name: 'Cefixime 200 mg (Zifi 200)',
    generic: 'Cefixime',
    category: 'Cephalosporin Antibiotic',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '5 Days',
    foodInstruction: 'After Food',
    instructions: 'Complete 5-day regimen'
  },
  {
    name: 'Ofloxacin 200 mg + Ornidazole 500 mg (O2)',
    generic: 'Ofloxacin + Ornidazole',
    category: 'Antidiarrheal / Antibiotic',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '3 Days',
    foodInstruction: 'After Food',
    instructions: 'For gastrointestinal infection'
  },
  {
    name: 'Ciprofloxacin 500 mg (Ciplox 500)',
    generic: 'Ciprofloxacin',
    category: 'Fluoroquinolone Antibiotic',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '5 Days',
    foodInstruction: 'After Food',
    instructions: 'Drink plenty of water'
  },
  {
    name: 'Doxycycline 100 mg (Doxil 100)',
    generic: 'Doxycycline',
    category: 'Tetracycline Antibiotic',
    dose: '1 Capsule',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '5 Days',
    foodInstruction: 'After Food',
    instructions: 'Take with full glass of water, do not lie down immediately'
  },
  {
    name: 'Metronidazole 400 mg (Flagyl 400)',
    generic: 'Metronidazole',
    category: 'Antiprotozoal / Antibacterial',
    dose: '1 Tablet',
    timesPerDay: '3 times/day',
    intakeTime: 'Morning, Afternoon, Night',
    duration: '5 Days',
    foodInstruction: 'After Food',
    instructions: 'Avoid alcohol completely'
  },

  // Antihistamines & Respiratory
  {
    name: 'Cetirizine 10 mg (Cetzine 10)',
    generic: 'Cetirizine',
    category: 'Antihistamine',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Night',
    duration: '5 Days',
    foodInstruction: 'After Food',
    instructions: 'At bedtime for allergy symptoms'
  },
  {
    name: 'Levocetirizine 5 mg + Montelukast 10 mg (Montair LC)',
    generic: 'Levocetirizine + Montelukast',
    category: 'Anti-allergic / Bronchodilator',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Night',
    duration: '7 Days',
    foodInstruction: 'After Food',
    instructions: 'At bedtime for cold, cough and rhinitis'
  },
  {
    name: 'Fexofenadine 120 mg (Allegra 120)',
    generic: 'Fexofenadine',
    category: 'Non-sedating Antihistamine',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '5 Days',
    foodInstruction: 'Before Food',
    instructions: 'For allergic rhinitis / urticaria'
  },
  {
    name: 'Cough Syrup (Ascoril-D Plus)',
    generic: 'Dextromethorphan + Phenylephrine + CPM',
    category: 'Dry Cough Syrup',
    dose: '10 ml',
    timesPerDay: '3 times/day',
    intakeTime: 'Morning, Afternoon, Night',
    duration: '5 Days',
    foodInstruction: 'After Food',
    instructions: 'For dry throat irritation and cough'
  },
  {
    name: 'Cough Syrup (Ascoril-LS)',
    generic: 'Levosalbutamol + Ambroxol + Guaiphenesin',
    category: 'Productive Cough Syrup',
    dose: '10 ml',
    timesPerDay: '3 times/day',
    intakeTime: 'Morning, Afternoon, Night',
    duration: '5 Days',
    foodInstruction: 'After Food',
    instructions: 'For wet cough with phlegm'
  },

  // Vitamins, Supplements & Nutrition
  {
    name: 'Vitamin D3 60K (Sachet) (Calcirol)',
    generic: 'Cholecalciferol 60,000 IU',
    category: 'Vitamin D Supplement',
    dose: '1 Sachet',
    timesPerDay: '1 time/week',
    intakeTime: 'Sunday Morning',
    duration: '4 Weeks',
    foodInstruction: 'After Food',
    instructions: 'Mix with warm milk once weekly'
  },
  {
    name: 'Vitamin B Complex + Zinc (Becosules Z)',
    generic: 'B-Complex + Vitamin C + Zinc',
    category: 'Nutritional Supplement',
    dose: '1 Capsule',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '15 Days',
    foodInstruction: 'After Food',
    instructions: 'Take after breakfast'
  },
  {
    name: 'Calcium 500 mg + Vitamin D3 (Shelcal 500)',
    generic: 'Calcium Carbonate + Cholecalciferol',
    category: 'Mineral Supplement',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Afternoon',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'Take after lunch'
  },
  {
    name: 'Ferrous Ascorbate + Folic Acid (Orofer XT)',
    generic: 'Iron + Folic Acid',
    category: 'Hematinic / Iron Supplement',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Night',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'For anemia; avoid taking with tea/coffee'
  },
  {
    name: 'Multivitamin & Minerals (Supradyn Daily)',
    generic: 'Multivitamins & Multi-minerals',
    category: 'Daily Wellness Supplement',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'Take once daily after breakfast'
  },

  // Cardiovascular & Antihypertensive
  {
    name: 'Telmisartan 40 mg (Telma 40)',
    generic: 'Telmisartan',
    category: 'ARB / Antihypertensive',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'Take regularly at the same time each morning'
  },
  {
    name: 'Telmisartan 40 mg + Amlodipine 5 mg (Telma-AM)',
    generic: 'Telmisartan + Amlodipine',
    category: 'Combination Antihypertensive',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'Monitor blood pressure weekly'
  },
  {
    name: 'Amlodipine 5 mg (Amlong 5)',
    generic: 'Amlodipine',
    category: 'Calcium Channel Blocker',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'For hypertension'
  },
  {
    name: 'Atorvastatin 10 mg (Atorva 10)',
    generic: 'Atorvastatin',
    category: 'Statin / Lipid Lowering',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Night',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'At bedtime for cholesterol control'
  },
  {
    name: 'Rosuvastatin 10 mg (Rosuvas 10)',
    generic: 'Rosuvastatin',
    category: 'Statin / Lipid Lowering',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Night',
    duration: '30 Days',
    foodInstruction: 'After Food',
    instructions: 'At bedtime'
  },

  // Antidiabetic
  {
    name: 'Metformin 500 mg (Glycomet 500)',
    generic: 'Metformin Hydrochloride',
    category: 'Biguanide / Antidiabetic',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '30 Days',
    foodInstruction: 'With Food',
    instructions: 'Take with or immediately after meals'
  },
  {
    name: 'Metformin 500 mg SR + Glimepiride 1 mg (Amaryl M1)',
    generic: 'Glimepiride + Metformin SR',
    category: 'Oral Hypoglycemic Combination',
    dose: '1 Tablet',
    timesPerDay: '1 time/day',
    intakeTime: 'Morning',
    duration: '30 Days',
    foodInstruction: 'Before Breakfast',
    instructions: 'Take just before morning meal'
  },
  {
    name: 'Vildagliptin 50 mg + Metformin 500 mg (Galvus Met)',
    generic: 'Vildagliptin + Metformin',
    category: 'DPP-4 Inhibitor + Metformin',
    dose: '1 Tablet',
    timesPerDay: '2 times/day',
    intakeTime: 'Morning, Night',
    duration: '30 Days',
    foodInstruction: 'With Food',
    instructions: 'For glycemic control'
  }
];

export function searchMedicineCatalog(query: string, clinicInventory: any[] = []): CatalogMedicine[] {
  if (!query || query.trim().length === 0) return [];
  const q = query.toLowerCase().trim();

  const results: CatalogMedicine[] = [];
  const seen = new Set<string>();

  // 1. First search clinic inventory items
  if (Array.isArray(clinicInventory) && clinicInventory.length > 0) {
    for (const inv of clinicInventory) {
      const name = inv.name || '';
      if (name.toLowerCase().includes(q)) {
        const key = name.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            name: inv.name,
            generic: inv.generic_name || inv.category || 'Clinic Stock',
            category: inv.category || 'Medicine',
            dose: '1 Tablet',
            timesPerDay: '2 times/day',
            intakeTime: 'Morning, Night',
            duration: '5 Days',
            foodInstruction: 'After Food',
            instructions: 'As advised by doctor'
          });
        }
      }
    }
  }

  // 2. Next search common medicine catalog
  for (const med of COMMON_MEDICINES) {
    const nameMatch = med.name.toLowerCase().includes(q);
    const genericMatch = med.generic && med.generic.toLowerCase().includes(q);
    if (nameMatch || genericMatch) {
      const key = med.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        results.push(med);
      }
    }
  }

  return results.slice(0, 8); // Top 8 relevant matches
}
