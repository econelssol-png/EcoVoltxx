/**
 * SocietyCharge — Seed Data
 * 
 * Creates:
 * - 1 Super Admin
 * - 2 Societies (Green Valley Residency, Sunrise Towers)
 * - 2 Society Admins
 * - 10 Residents (5 per society)
 * - 6 Chargers (3 per society)
 * - Sample vehicles, bookings, sessions, and invoices
 * 
 * All passwords: "password123"
 */

const bcrypt = require('bcryptjs');

exports.seed = async function (knex) {
  // Clean all tables in reverse dependency order
  await knex('refresh_tokens').del();
  await knex('maintenance_records').del();
  await knex('complaints').del();
  await knex('notifications').del();
  await knex('payments').del();
  await knex('invoices').del();
  await knex('charging_sessions').del();
  await knex('bookings').del();
  await knex('chargers').del();
  await knex('vehicles').del();
  await knex('society_members').del();
  await knex('societies').del();
  await knex('users').del();

  const hash = await bcrypt.hash('password123', 12);
  const now = new Date().toISOString();

  // ════════════════════════════════════════════════════════
  // USERS
  // ════════════════════════════════════════════════════════
  await knex('users').insert([
    // Super Admin
    { id: 1, email: 'superadmin@societycharge.com', phone: '9999900000', password_hash: hash, name: 'Platform Admin', role: 'super_admin' },

    // Society A Admin
    { id: 2, email: 'admin_gvr@test.com', phone: '9999900001', password_hash: hash, name: 'Rajesh Kumar', role: 'user' },

    // Society A Residents
    { id: 3, email: 'rahul@test.com', phone: '9999900101', password_hash: hash, name: 'Rahul Sharma', role: 'user' },
    { id: 4, email: 'priya@test.com', phone: '9999900102', password_hash: hash, name: 'Priya Patel', role: 'user' },
    { id: 5, email: 'amit@test.com', phone: '9999900103', password_hash: hash, name: 'Amit Verma', role: 'user' },
    { id: 6, email: 'sneha@test.com', phone: '9999900104', password_hash: hash, name: 'Sneha Gupta', role: 'user' },
    { id: 7, email: 'vikram@test.com', phone: '9999900105', password_hash: hash, name: 'Vikram Singh', role: 'user' },

    // Society B Admin
    { id: 8, email: 'admin_srt@test.com', phone: '9999900002', password_hash: hash, name: 'Sunita Reddy', role: 'user' },

    // Society B Residents
    { id: 9, email: 'neha@test.com', phone: '9999900201', password_hash: hash, name: 'Neha Joshi', role: 'user' },
    { id: 10, email: 'rohan@test.com', phone: '9999900202', password_hash: hash, name: 'Rohan Mehta', role: 'user' },
    { id: 11, email: 'kavita@test.com', phone: '9999900203', password_hash: hash, name: 'Kavita Nair', role: 'user' },
    { id: 12, email: 'arjun@test.com', phone: '9999900204', password_hash: hash, name: 'Arjun Desai', role: 'user' },
    { id: 13, email: 'meera@test.com', phone: '9999900205', password_hash: hash, name: 'Meera Iyer', role: 'user' },
  ]);

  // ════════════════════════════════════════════════════════
  // SOCIETIES
  // ════════════════════════════════════════════════════════
  await knex('societies').insert([
    {
      id: 1,
      name: 'Green Valley Residency',
      code: 'GVR2024',
      address: '123 Green Valley Road, Whitefield',
      city: 'Bangalore',
      state: 'Karnataka',
      pincode: '560066',
      description: 'A premium residential community with 200 apartments and dedicated EV charging infrastructure.',
      status: 'active',
      default_price_per_kwh: 8.0,
    },
    {
      id: 2,
      name: 'Sunrise Towers',
      code: 'SRT2024',
      address: '456 Sunrise Boulevard, Hinjewadi',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411057',
      description: 'Modern high-rise towers with integrated smart EV charging facilities.',
      status: 'active',
      default_price_per_kwh: 7.5,
    },
  ]);

  // ════════════════════════════════════════════════════════
  // SOCIETY MEMBERS
  // ════════════════════════════════════════════════════════
  await knex('society_members').insert([
    // Society A — Green Valley Residency
    { user_id: 2, society_id: 1, flat_number: 'Admin', role: 'admin', status: 'approved', joined_at: now },
    { user_id: 3, society_id: 1, flat_number: 'A-101', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 4, society_id: 1, flat_number: 'A-204', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 5, society_id: 1, flat_number: 'B-302', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 6, society_id: 1, flat_number: 'C-105', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 7, society_id: 1, flat_number: 'D-401', role: 'resident', status: 'approved', joined_at: now },

    // Society B — Sunrise Towers
    { user_id: 8, society_id: 2, flat_number: 'Admin', role: 'admin', status: 'approved', joined_at: now },
    { user_id: 9, society_id: 2, flat_number: '101', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 10, society_id: 2, flat_number: '205', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 11, society_id: 2, flat_number: '310', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 12, society_id: 2, flat_number: '412', role: 'resident', status: 'approved', joined_at: now },
    { user_id: 13, society_id: 2, flat_number: '503', role: 'resident', status: 'approved', joined_at: now },
  ]);

  // ════════════════════════════════════════════════════════
  // VEHICLES
  // ════════════════════════════════════════════════════════
  await knex('vehicles').insert([
    // Society A residents
    { user_id: 3, make: 'Tata', model: 'Nexon EV', year: 2024, registration_number: 'KA-01-EV-1001', battery_capacity_kwh: 40.5, connector_type: 'CCS2', color: 'Blue' },
    { user_id: 4, make: 'MG', model: 'ZS EV', year: 2023, registration_number: 'KA-01-EV-1002', battery_capacity_kwh: 50.3, connector_type: 'CCS2', color: 'White' },
    { user_id: 5, make: 'Hyundai', model: 'Kona Electric', year: 2024, registration_number: 'KA-01-EV-1003', battery_capacity_kwh: 39.2, connector_type: 'CCS2', color: 'Silver' },
    { user_id: 6, make: 'Tata', model: 'Tiago EV', year: 2024, registration_number: 'KA-01-EV-1004', battery_capacity_kwh: 24.0, connector_type: 'Type2', color: 'Red' },
    { user_id: 7, make: 'Mahindra', model: 'XUV400', year: 2024, registration_number: 'KA-01-EV-1005', battery_capacity_kwh: 39.4, connector_type: 'CCS2', color: 'Green' },

    // Society B residents
    { user_id: 9, make: 'BYD', model: 'Atto 3', year: 2024, registration_number: 'MH-12-EV-2001', battery_capacity_kwh: 60.5, connector_type: 'CCS2', color: 'Grey' },
    { user_id: 10, make: 'Tata', model: 'Punch EV', year: 2024, registration_number: 'MH-12-EV-2002', battery_capacity_kwh: 35.0, connector_type: 'Type2', color: 'Orange' },
    { user_id: 11, make: 'Citroen', model: 'eC3', year: 2024, registration_number: 'MH-12-EV-2003', battery_capacity_kwh: 29.2, connector_type: 'Type2', color: 'Blue' },
    { user_id: 12, make: 'MG', model: 'Comet EV', year: 2024, registration_number: 'MH-12-EV-2004', battery_capacity_kwh: 17.3, connector_type: 'Type2', color: 'Yellow' },
    { user_id: 13, make: 'Tata', model: 'Nexon EV Max', year: 2024, registration_number: 'MH-12-EV-2005', battery_capacity_kwh: 40.5, connector_type: 'CCS2', color: 'Black' },
  ]);

  // ════════════════════════════════════════════════════════
  // CHARGERS
  // ════════════════════════════════════════════════════════
  await knex('chargers').insert([
    // Society A — Green Valley Residency
    { id: 1, society_id: 1, charger_number: 'C-01', name: 'Parking Lot A Charger', location_description: 'Ground Floor, Parking Lot A', connector_type: 'Type2', power_rating_kw: 7.4, price_per_kwh: 8.0, status: 'available', is_simulated: true },
    { id: 2, society_id: 1, charger_number: 'C-02', name: 'Parking Lot B Fast Charger', location_description: 'Ground Floor, Parking Lot B', connector_type: 'CCS2', power_rating_kw: 22.0, price_per_kwh: 12.0, status: 'available', is_simulated: true },
    { id: 3, society_id: 1, charger_number: 'C-03', name: 'Basement Charger', location_description: 'Basement Level 1', connector_type: 'Type2', power_rating_kw: 7.4, price_per_kwh: 8.0, status: 'available', is_simulated: true },

    // Society B — Sunrise Towers
    { id: 4, society_id: 2, charger_number: 'C-01', name: 'Tower A Charger', location_description: 'Tower A, Ground Floor Parking', connector_type: 'Type2', power_rating_kw: 7.4, price_per_kwh: 7.5, status: 'available', is_simulated: true },
    { id: 5, society_id: 2, charger_number: 'C-02', name: 'Tower B Charger', location_description: 'Tower B, Basement Parking', connector_type: 'Type2', power_rating_kw: 11.0, price_per_kwh: 9.0, status: 'available', is_simulated: true },
    { id: 6, society_id: 2, charger_number: 'C-03', name: 'Visitor Parking Fast Charger', location_description: 'Visitor Parking Area', connector_type: 'CCS2', power_rating_kw: 22.0, price_per_kwh: 12.0, status: 'available', is_simulated: true },
  ]);

  // ════════════════════════════════════════════════════════
  // SAMPLE COMPLETED CHARGING SESSIONS (for history & billing)
  // ════════════════════════════════════════════════════════
  const daysAgo = (d) => {
    const date = new Date();
    date.setDate(date.getDate() - d);
    return date;
  };

  const sessions = [
    // Society A sessions
    { user_id: 3, society_id: 1, charger_id: 1, start_time: daysAgo(5).toISOString(), end_time: new Date(daysAgo(5).getTime() + 3 * 3600000).toISOString(), energy_kwh: 18.5, cost: 148.0, price_per_kwh_at_time: 8.0, power_rating_kw_at_time: 7.4, status: 'completed', duration_minutes: 180, is_simulated: true },
    { user_id: 3, society_id: 1, charger_id: 2, start_time: daysAgo(2).toISOString(), end_time: new Date(daysAgo(2).getTime() + 1.5 * 3600000).toISOString(), energy_kwh: 28.0, cost: 336.0, price_per_kwh_at_time: 12.0, power_rating_kw_at_time: 22.0, status: 'completed', duration_minutes: 90, is_simulated: true },
    { user_id: 4, society_id: 1, charger_id: 1, start_time: daysAgo(4).toISOString(), end_time: new Date(daysAgo(4).getTime() + 4 * 3600000).toISOString(), energy_kwh: 22.0, cost: 176.0, price_per_kwh_at_time: 8.0, power_rating_kw_at_time: 7.4, status: 'completed', duration_minutes: 240, is_simulated: true },
    { user_id: 5, society_id: 1, charger_id: 3, start_time: daysAgo(3).toISOString(), end_time: new Date(daysAgo(3).getTime() + 2 * 3600000).toISOString(), energy_kwh: 12.5, cost: 100.0, price_per_kwh_at_time: 8.0, power_rating_kw_at_time: 7.4, status: 'completed', duration_minutes: 120, is_simulated: true },
    { user_id: 6, society_id: 1, charger_id: 1, start_time: daysAgo(1).toISOString(), end_time: new Date(daysAgo(1).getTime() + 2.5 * 3600000).toISOString(), energy_kwh: 15.8, cost: 126.4, price_per_kwh_at_time: 8.0, power_rating_kw_at_time: 7.4, status: 'completed', duration_minutes: 150, is_simulated: true },

    // Society B sessions
    { user_id: 9, society_id: 2, charger_id: 4, start_time: daysAgo(4).toISOString(), end_time: new Date(daysAgo(4).getTime() + 3 * 3600000).toISOString(), energy_kwh: 19.2, cost: 144.0, price_per_kwh_at_time: 7.5, power_rating_kw_at_time: 7.4, status: 'completed', duration_minutes: 180, is_simulated: true },
    { user_id: 10, society_id: 2, charger_id: 5, start_time: daysAgo(3).toISOString(), end_time: new Date(daysAgo(3).getTime() + 2 * 3600000).toISOString(), energy_kwh: 16.0, cost: 144.0, price_per_kwh_at_time: 9.0, power_rating_kw_at_time: 11.0, status: 'completed', duration_minutes: 120, is_simulated: true },
    { user_id: 11, society_id: 2, charger_id: 6, start_time: daysAgo(2).toISOString(), end_time: new Date(daysAgo(2).getTime() + 1 * 3600000).toISOString(), energy_kwh: 20.0, cost: 240.0, price_per_kwh_at_time: 12.0, power_rating_kw_at_time: 22.0, status: 'completed', duration_minutes: 60, is_simulated: true },
    { user_id: 12, society_id: 2, charger_id: 4, start_time: daysAgo(1).toISOString(), end_time: new Date(daysAgo(1).getTime() + 2.5 * 3600000).toISOString(), energy_kwh: 14.0, cost: 105.0, price_per_kwh_at_time: 7.5, power_rating_kw_at_time: 7.4, status: 'completed', duration_minutes: 150, is_simulated: true },
  ];

  await knex('charging_sessions').insert(sessions);

  // ════════════════════════════════════════════════════════
  // SAMPLE NOTIFICATIONS
  // ════════════════════════════════════════════════════════
  await knex('notifications').insert([
    { user_id: 3, society_id: 1, title: 'Welcome to SocietyCharge', message: 'Welcome to Green Valley Residency EV charging! You can now book chargers and start charging.', type: 'welcome', read: false },
    { user_id: 3, society_id: 1, title: 'Charging Completed', message: 'Your charging session on Charger C-01 is complete. Energy: 18.5 kWh, Cost: ₹148.00', type: 'charging_completed', read: true },
    { user_id: 9, society_id: 2, title: 'Welcome to SocietyCharge', message: 'Welcome to Sunrise Towers EV charging! You can now book chargers and start charging.', type: 'welcome', read: false },
  ]);

  console.log('✅ Seed data inserted successfully!');
  console.log('');
  console.log('📋 Test Credentials (all passwords: password123):');
  console.log('   Super Admin:  superadmin@societycharge.com');
  console.log('   GVR Admin:    admin_gvr@test.com');
  console.log('   GVR Resident: rahul@test.com');
  console.log('   SRT Admin:    admin_srt@test.com');
  console.log('   SRT Resident: neha@test.com');
  console.log('');
};
