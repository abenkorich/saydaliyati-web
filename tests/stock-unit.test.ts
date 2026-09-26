import assert from 'node:assert/strict';
import { test } from 'node:test';
import { suggestedStockUnit } from '../src/components/stock-unit';
const cases = [
  [{ dosageForm: 'COMPRIMÉ PELLICULÉ SÉCABLE', packageSize: 'B/10' }, 'TABLET'],
  [{ dosageForm: 'GÉLULE', packageSize: 'B/30' }, 'CAPSULE'],
  [{ dosageForm: 'SUPPOSITOIRE', packageSize: 'B/6' }, 'SUPPOSITORY'],
  [{ dosageForm: 'SOLUTION BUVABLE', packageSize: 'FL/150ML' }, 'ML'],
  [{ dosageForm: 'CREME', packageSize: 'TUBE DE 30 G' }, 'G'],
  [{ dosageForm: 'POUDRE POUR SOLUTION INJECTABLE', packageSize: 'B/1 FLACON' }, 'VIAL'],
  [{ dosageForm: 'SOLUTION INJECTABLE', packageSize: 'B/5 AMPOULES DE 2ML' }, 'AMPOULE'],
  [{ dosageForm: 'POUDRE', packageSize: 'B/10 SACHETS DE 3 G' }, 'SACHET'],
  [{ dosageForm: 'SPRAY', packageSize: '200 DOSES' }, 'DOSE'],
  [{ dosageForm: 'UNKNOWN', packageSize: null }, ''],
  [{ dosageForm: 'COMPRIME + CAPSULE', packageSize: 'B/10' }, ''],
  [{ dosageForm: 'KIT', packageSize: '1 VIAL + 1 AMPOULE' }, ''],
  [{ dosageForm: 'KIT', packageSize: '30 ML + 20 G' }, ''],
  [{ dosageForm: 'SOLUTION', packageSize: 'B/1', strength: '100MG/5ML' }, ''],
] as const;
test('stock unit follows presentation without treating strength or ambiguous kits as stock units', () => {
  for (const [medicine, expected] of cases) assert.equal(suggestedStockUnit(medicine), expected, JSON.stringify(medicine));
});
