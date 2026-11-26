/**
 * Visitor (public) charging hardening.
 *
 * - charging_sessions.guest_token: a random secret returned only to the visitor
 *   who started the session; required to read or stop that session.
 * - Visitor accounts were created with the shared password "Guest@123", so
 *   anyone who knew a visitor's phone number could sign in as them. Replace
 *   those passwords with random ones nobody knows (visitors never sign in).
 */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

exports.up = async function (knex) {
  const hasToken = await knex.schema.hasColumn('charging_sessions', 'guest_token');
  if (!hasToken) {
    await knex.schema.alterTable('charging_sessions', (t) => {
      t.string('guest_token', 64).nullable();
    });
  }

  const guests = await knex('users').where('email', 'like', 'guest%@ecovoltx.public').select('id');
  for (const guest of guests) {
    const hash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    await knex('users').where({ id: guest.id }).update({ password_hash: hash });
  }
};

exports.down = async function (knex) {
  const hasToken = await knex.schema.hasColumn('charging_sessions', 'guest_token');
  if (hasToken) {
    await knex.schema.alterTable('charging_sessions', (t) => {
      t.dropColumn('guest_token');
    });
  }
};
