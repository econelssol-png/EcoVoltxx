/**
 * Rotate predictable charger OCPP auth keys.
 *
 * Earlier seeds/routes derived auth keys from the charger number
 * (e.g. "key_ecovolt_c_01"), which anyone could guess. Replace those,
 * and any missing keys, with random secrets. Admin-chosen keys are kept.
 */

const crypto = require('crypto');

function predictableKeys(chargerNumber) {
  const number = String(chargerNumber || '').toLowerCase();
  return [
    `key_ecovolt_${number.replace('-', '_')}`,
    `key_${number.replace(/[^a-z0-9]/g, '_')}`,
  ];
}

exports.up = async function (knex) {
  const chargers = await knex('chargers').select('id', 'charger_number', 'auth_key');

  for (const charger of chargers) {
    const isMissing = !charger.auth_key;
    const isPredictable = predictableKeys(charger.charger_number).includes(charger.auth_key);

    if (isMissing || isPredictable) {
      await knex('chargers')
        .where({ id: charger.id })
        .update({ auth_key: `ck_${crypto.randomBytes(24).toString('hex')}` });
    }
  }
};

exports.down = async function () {
  // Old predictable keys are intentionally not restored.
};
