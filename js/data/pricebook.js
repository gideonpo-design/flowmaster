/* ==========================================================================
   data/pricebook.js — master irrigation services catalog (150+ items)
   Loaded before db.js; the database seeds from window.PRICEBOOK_CATALOG on
   first run. Every item is editable later in the Price Book module.
   Format: [category, name, unit, defaultPrice]
   units: flat | hour | each | zone | ft | service
   ========================================================================== */
window.PRICEBOOK_CATALOG = [
  // ---- Spring Startups ----
  ['Startups', 'Spring System Startup — up to 4 zones', 'flat', 75],
  ['Startups', 'Spring System Startup — up to 6 zones', 'flat', 95],
  ['Startups', 'Spring System Startup — 7 to 9 zones', 'flat', 120],
  ['Startups', 'Spring System Startup — 10 to 12 zones', 'flat', 145],
  ['Startups', 'Spring System Startup — 13 to 16 zones', 'flat', 175],
  ['Startups', 'Additional Zone Activation', 'zone', 8],
  ['Startups', 'System Pressure Test', 'flat', 45],
  ['Startups', 'Controller Programming (seasonal)', 'flat', 35],
  ['Startups', 'Rain Sensor Test & Reset', 'each', 25],
  ['Startups', 'Full System Audit & Tune-Up', 'flat', 165],

  // ---- Winterizations ----
  ['Winterizations', 'Winterization / Blowout — up to 4 zones', 'flat', 65],
  ['Winterizations', 'Winterization / Blowout — up to 6 zones', 'flat', 85],
  ['Winterizations', 'Winterization / Blowout — 7 to 9 zones', 'flat', 105],
  ['Winterizations', 'Winterization / Blowout — 10 to 12 zones', 'flat', 120],
  ['Winterizations', 'Winterization / Blowout — 13 to 16 zones', 'flat', 150],
  ['Winterizations', 'Additional Zone Blowout', 'zone', 7],
  ['Winterizations', 'Backflow Winterization & Insulation', 'each', 35],
  ['Winterizations', 'Pump System Winterization', 'flat', 75],
  ['Winterizations', 'Drip Zone Winterization', 'zone', 12],

  // ---- Repairs ----
  ['Repairs', 'Diagnostic / Service Call', 'flat', 75],
  ['Repairs', 'Emergency Diagnostic (same day)', 'flat', 110],
  ['Repairs', 'Mainline Leak Repair', 'flat', 145],
  ['Repairs', 'Lateral Line Repair', 'flat', 95],
  ['Repairs', 'Poly Pipe Repair (per break)', 'each', 45],
  ['Repairs', 'PVC Pipe Repair (per break)', 'each', 55],
  ['Repairs', 'Fitting / Coupling Replacement', 'each', 18],
  ['Repairs', 'Swing Joint Replacement', 'each', 22],
  ['Repairs', 'Wire Tracing & Locate', 'hour', 95],
  ['Repairs', 'Solenoid Wire Splice Repair', 'each', 28],
  ['Repairs', 'Valve Wire Locate & Repair', 'flat', 125],
  ['Repairs', 'Stuck / Stripped Head Removal', 'each', 20],
  ['Repairs', 'Nozzle Cleaning / Replacement', 'each', 5],
  ['Repairs', 'Seal & Wiper Replacement', 'each', 12],
  ['Repairs', 'Leak Detection (acoustic)', 'flat', 135],

  // ---- Controllers ----
  ['Controllers', 'Smart WiFi Controller (WaterSense) — supply & install', 'flat', 285],
  ['Controllers', 'Smart WiFi Controller — install only (customer-supplied)', 'flat', 120],
  ['Controllers', 'Standard Controller Replacement — supply & install', 'flat', 175],
  ['Controllers', 'Controller Reprogramming', 'flat', 45],
  ['Controllers', 'Add-a-Zone Module', 'each', 55],
  ['Controllers', 'WiFi Module / Adapter', 'each', 65],
  ['Controllers', 'Rain Sensor — supply & install', 'each', 75],
  ['Controllers', 'Wireless Rain/Freeze Sensor', 'each', 95],
  ['Controllers', 'Soil Moisture Sensor', 'each', 145],
  ['Controllers', 'Flow Sensor — supply & install', 'each', 195],
  ['Controllers', 'Master Valve Installation', 'each', 165],
  ['Controllers', 'Surge Protector for Controller', 'each', 45],

  // ---- Valves ----
  ['Valves', 'Zone Valve Replacement', 'each', 110],
  ['Valves', 'Zone Valve Rebuild (diaphragm kit)', 'each', 55],
  ['Valves', 'Valve Solenoid Replacement', 'each', 35],
  ['Valves', 'Manifold Rebuild (per valve)', 'each', 95],
  ['Valves', 'Valve Box Replacement', 'each', 65],
  ['Valves', 'Valve Box Install — new', 'each', 85],
  ['Valves', 'Anti-Siphon Valve Replacement', 'each', 125],
  ['Valves', 'Quick Coupler Valve Install', 'each', 95],
  ['Valves', 'Isolation Valve Install', 'each', 110],

  // ---- Backflow ----
  ['Backflow', 'Backflow Preventer Test (certified)', 'flat', 65],
  ['Backflow', 'Backflow Preventer Repair (rebuild kit)', 'flat', 135],
  ['Backflow', 'Backflow Preventer Replacement — 3/4"', 'each', 285],
  ['Backflow', 'Backflow Preventer Replacement — 1"', 'each', 345],
  ['Backflow', 'Pressure Vacuum Breaker Replacement', 'each', 225],
  ['Backflow', 'Backflow Certification Filing', 'flat', 25],

  // ---- Heads ----
  ['Heads', 'Rotor Head Replacement', 'each', 22],
  ['Heads', 'Rotor Head Replacement — high-efficiency', 'each', 32],
  ['Heads', 'Spray Head Replacement — 4"', 'each', 14],
  ['Heads', 'Spray Head Replacement — 6"', 'each', 18],
  ['Heads', 'Spray Head Replacement — 12"', 'each', 26],
  ['Heads', 'Pop-Up Body Replacement', 'each', 16],
  ['Heads', 'High-Efficiency Nozzle Upgrade (MP Rotator)', 'each', 9],
  ['Heads', 'Head Adjustment / Alignment', 'each', 6],
  ['Heads', 'Head Raise / Lower to Grade', 'each', 12],
  ['Heads', 'Add New Spray Head', 'each', 35],
  ['Heads', 'Add New Rotor Head', 'each', 48],
  ['Heads', 'Bubbler Head Install', 'each', 28],
  ['Heads', 'Check Valve Head Upgrade', 'each', 14],
  ['Heads', 'Shrub Riser Install', 'each', 18],

  // ---- Drip Irrigation ----
  ['Drip Irrigation', 'Drip Zone Conversion', 'zone', 165],
  ['Drip Irrigation', 'Drip Line Install', 'ft', 1.75],
  ['Drip Irrigation', 'Drip Emitter Replacement', 'each', 4],
  ['Drip Irrigation', 'Drip Emitter Add', 'each', 6],
  ['Drip Irrigation', 'Drip Pressure Regulator', 'each', 35],
  ['Drip Irrigation', 'Drip Filter Replacement', 'each', 28],
  ['Drip Irrigation', 'Micro-Spray Head Install', 'each', 12],
  ['Drip Irrigation', 'Drip Zone Repair', 'flat', 85],
  ['Drip Irrigation', 'Inline Drip Tubing (per 50 ft roll)', 'each', 32],

  // ---- New Installation ----
  ['New Installation', 'New Zone Install — spray (per zone)', 'zone', 425],
  ['New Installation', 'New Zone Install — rotor (per zone)', 'zone', 525],
  ['New Installation', 'New System Design & Layout', 'flat', 250],
  ['New Installation', 'Trenching', 'ft', 2.5],
  ['New Installation', 'Boring Under Walkway / Driveway', 'ft', 8],
  ['New Installation', 'Mainline Install', 'ft', 4],
  ['New Installation', 'Lateral Line Install', 'ft', 3],
  ['New Installation', 'Water Tap / Point of Connection', 'flat', 285],
  ['New Installation', 'Sleeve Install Under Hardscape', 'ft', 6],
  ['New Installation', 'System Expansion Consultation', 'flat', 95],

  // ---- Commercial ----
  ['Commercial', 'Commercial System Inspection', 'flat', 195],
  ['Commercial', 'Commercial Startup (per controller)', 'flat', 165],
  ['Commercial', 'Commercial Winterization (per controller)', 'flat', 145],
  ['Commercial', 'Central Control System Setup', 'flat', 450],
  ['Commercial', 'Monthly Maintenance Visit', 'service', 125],
  ['Commercial', 'Water Use Audit & Report', 'flat', 295],
  ['Commercial', 'Mainline Repair — commercial', 'flat', 285],
  ['Commercial', 'Two-Wire Decoder Diagnosis', 'hour', 110],
  ['Commercial', 'Property Walk-Through & Estimate', 'flat', 0],
  ['Commercial', 'Smart Controller Fleet Upgrade (per unit)', 'each', 245],

  // ---- Pumps & Wells ----
  ['Pumps & Wells', 'Pump Diagnosis', 'flat', 95],
  ['Pumps & Wells', 'Pump Pressure Switch Replacement', 'each', 85],
  ['Pumps & Wells', 'Pump Priming & Service', 'flat', 75],
  ['Pumps & Wells', 'Pressure Tank Replacement', 'each', 285],
  ['Pumps & Wells', 'Foot Valve Replacement', 'each', 125],
  ['Pumps & Wells', 'Well Point Service', 'flat', 145],

  // ---- Lighting (add-on) ----
  ['Landscape Lighting', 'Low-Voltage Fixture Install', 'each', 85],
  ['Landscape Lighting', 'Transformer Install', 'each', 195],
  ['Landscape Lighting', 'Lighting Timer / Photocell', 'each', 65],
  ['Landscape Lighting', 'LED Bulb Replacement', 'each', 18],
  ['Landscape Lighting', 'Lighting Wire Run', 'ft', 2.25],

  // ---- Emergency ----
  ['Emergency', 'Emergency Service Call (after hours)', 'flat', 150],
  ['Emergency', 'Emergency Mainline Shutdown', 'flat', 95],
  ['Emergency', 'Weekend / Holiday Surcharge', 'flat', 85],
  ['Emergency', 'Same-Day Priority Fee', 'flat', 65],
  ['Emergency', 'Flood / Major Leak Response', 'hour', 135],

  // ---- Labor ----
  ['Labor', 'Standard Labor', 'hour', 85],
  ['Labor', 'Helper / Second Tech Labor', 'hour', 55],
  ['Labor', 'Skilled Diagnostic Labor', 'hour', 110],
  ['Labor', 'Hand Digging', 'hour', 75],
  ['Labor', 'Travel Time (beyond 20 mi)', 'hour', 65],
  ['Labor', 'Minimum Service Charge', 'flat', 95],

  // ---- Materials ----
  ['Materials', 'PVC Pipe — 3/4" (per ft)', 'ft', 1.25],
  ['Materials', 'PVC Pipe — 1" (per ft)', 'ft', 1.65],
  ['Materials', 'Poly Pipe — 3/4" (per ft)', 'ft', 0.95],
  ['Materials', 'Funny Pipe (per ft)', 'ft', 0.85],
  ['Materials', 'PVC Fittings (each)', 'each', 3.5],
  ['Materials', 'Wire — 18ga (per ft)', 'ft', 0.65],
  ['Materials', 'Waterproof Wire Connectors (each)', 'each', 2.5],
  ['Materials', 'Valve Box — standard', 'each', 28],
  ['Materials', 'Valve Box — jumbo', 'each', 45],
  ['Materials', 'Teflon Tape / Sealant', 'each', 4],
  ['Materials', 'Gravel / Drainage Rock (bag)', 'each', 9],
  ['Materials', 'Misc. Materials', 'flat', 0],

  // ---- Miscellaneous ----
  ['Miscellaneous', 'System Map / As-Built Documentation', 'flat', 125],
  ['Miscellaneous', 'Seasonal Maintenance Plan (annual)', 'flat', 220],
  ['Miscellaneous', 'Coverage / Head-to-Head Adjustment', 'flat', 75],
  ['Miscellaneous', 'Cap & Abandon Zone', 'each', 35],
  ['Miscellaneous', 'Relocate Head', 'each', 28],
  ['Miscellaneous', 'Sod / Turf Repair after dig', 'each', 25],
  ['Miscellaneous', 'Second-Opinion Inspection', 'flat', 65],
  ['Miscellaneous', 'Winter Storage of Equipment', 'flat', 0],
  ['Miscellaneous', 'Custom Line Item', 'flat', 0],

  // ---- Service Plans & Add-ons ----
  ['Miscellaneous', 'Annual Service Agreement — Residential', 'flat', 189],
  ['Miscellaneous', 'Annual Service Agreement — Commercial', 'flat', 480],
  ['Repairs', 'Zone Coverage Re-Design (per zone)', 'zone', 65],
  ['Heads', 'Rotary Nozzle Conversion (per head)', 'each', 11],
  ['Controllers', 'Weather-Based Watering Setup', 'flat', 55],
  ['Drip Irrigation', 'Drip Manifold Assembly', 'each', 75],
  ['New Installation', 'Rain Garden Drip Setup', 'flat', 385],
];
