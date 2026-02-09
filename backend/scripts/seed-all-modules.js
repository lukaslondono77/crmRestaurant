#!/usr/bin/env node

/**
 * Seed demo data for Apps & Pages modules.
 * Run after DB migrations. Uses first tenant and first user.
 *
 * Usage: node scripts/seed-all-modules.js
 * Optional: TENANT_ID=1 USER_ID=1 node scripts/seed-all-modules.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const db = require('../src/config/database');

async function getTenantAndUser() {
  const tenant = await db.getAsync('SELECT id FROM tenants LIMIT 1');
  if (!tenant) {
    console.error('No tenant found. Register a user first (creates tenant).');
    process.exit(1);
  }
  const user = await db.getAsync('SELECT id, email FROM users WHERE tenant_id = ? LIMIT 1', [tenant.id]);
  if (!user) {
    console.error('No user found for tenant.', tenant.id);
    process.exit(1);
  }
  return {
    tenantId: process.env.TENANT_ID ? parseInt(process.env.TENANT_ID, 10) : tenant.id,
    userId: process.env.USER_ID ? parseInt(process.env.USER_ID, 10) : user.id,
    userEmail: user.email || 'user@example.com'
  };
}

async function seedTodos(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM todos WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const tasks = [
    { task_id: '#951', name: 'Hotel management system', assigned_to_name: 'Shawn Kennedy', due_date: '2025-11-15', priority: 'high', status: 'in_progress' },
    { task_id: '#587', name: 'Send proposal to APR Ltd', assigned_to_name: 'Roberto Cruz', due_date: '2025-11-14', priority: 'medium', status: 'pending' },
    { task_id: '#618', name: 'Python upgrade', assigned_to_name: 'Juli Johnson', due_date: '2025-11-13', priority: 'high', status: 'completed' },
    { task_id: '#367', name: 'Schedule meeting with Fila', assigned_to_name: 'Catalina Engles', due_date: '2025-11-12', priority: 'low', status: 'pending' },
    { task_id: '#761', name: 'Engineering lite touch', assigned_to_name: 'Louis Nagle', due_date: '2025-11-11', priority: 'medium', status: 'in_progress' },
    { task_id: '#431', name: 'Refund bill payment', assigned_to_name: 'Michael Marquez', due_date: '2025-11-10', priority: 'low', status: 'pending' },
    { task_id: '#421', name: 'Public beta release', assigned_to_name: 'James Andy', due_date: '2025-11-09', priority: 'high', status: 'in_progress' },
    { task_id: '#624', name: 'Fix platform errors', assigned_to_name: 'Alina Smith', due_date: '2025-11-08', priority: 'medium', status: 'completed' },
    { task_id: '#513', name: 'Launch our mobile app', assigned_to_name: 'David Warner', due_date: '2025-11-07', priority: 'low', status: 'pending' }
  ];
  for (const t of tasks) {
    await db.runAsync(
      `INSERT INTO todos (tenant_id, user_id, task_id, task_name, priority, status, due_date, assigned_to_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, userId, t.task_id, t.name, t.priority, t.status, t.due_date, t.assigned_to_name]
    );
  }
  console.log('  Seeded todos');
}

async function seedCalendar(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM calendar_events WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const events = [
    {
      title: 'Annual Conference',
      description: 'Company annual conference meeting',
      start: '2025-11-21T10:00:00',
      end: '2025-11-21T11:00:00',
      location: 'Main Conference Hall',
      event_type: 'conference',
      color: '#3b82f6'
    },
    {
      title: 'Product Launch Webinar',
      description: 'Launch new product webinar',
      start: '2025-12-06T14:00:00',
      end: '2025-12-06T15:00:00',
      location: 'Online',
      event_type: 'webinar',
      color: '#10b981'
    },
    {
      title: 'Tech Summit 2025',
      description: 'Annual tech summit',
      start: '2025-12-13T15:00:00',
      end: '2025-12-13T16:00:00',
      location: 'Auditorium',
      event_type: 'conference',
      color: '#f59e0b'
    }
  ];
  for (const e of events) {
    await db.runAsync(
      `INSERT INTO calendar_events (tenant_id, user_id, title, description, start_date, end_date, all_day, location, event_type, status, color)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, 'scheduled', ?)`,
      [tenantId, userId, e.title, e.description, e.start, e.end, e.location, e.event_type, e.color]
    );
  }
  console.log('  Seeded calendar_events');
}

async function seedContacts(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM contacts WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const list = [
    { contact_id: '#ARP-1217', avatar: 'user15', first: 'Marcia', last: 'Baker', email: 'marcia@example.com', phone: '+1 555-123-4567', last_contacted: '2025-11-10', company: 'ABC Corporation', lead_score: 50, status: 'active' },
    { contact_id: '#ARP-1364', avatar: 'user2', first: 'Carolyn', last: 'Barnes', email: 'barnes@example.com', phone: '+1 555-987-6543', last_contacted: '2025-11-11', company: 'XYZ Ltd', lead_score: 35, status: 'active' },
    { contact_id: '#ARP-2951', avatar: 'user12', first: 'Donna', last: 'Miller', email: 'donna@example.com', phone: '+1 555-456-7890', last_contacted: '2025-11-12', company: 'Tech Solutions', lead_score: 40, status: 'inactive' },
    { contact_id: '#ARP-7342', avatar: 'user5', first: 'Barbara', last: 'Cross', email: 'cross@example.com', phone: '+1 555-369-7878', last_contacted: '2025-11-13', company: 'Global Solutions', lead_score: 25, status: 'active' },
    { contact_id: '#ARP-4619', avatar: 'user16', first: 'Rebecca', last: 'Block', email: 'block@example.com', phone: '+1 555-658-4488', last_contacted: '2025-11-14', company: 'Acma Industries', lead_score: 27, status: 'inactive' },
    { contact_id: '#ARP-7346', avatar: 'user9', first: 'Ramiro', last: 'McCarty', email: 'ramiro@example.com', phone: '+1 555-558-9966', last_contacted: '2025-11-15', company: 'Synergy Ltd', lead_score: 16, status: 'active' },
    { contact_id: '#ARP-7612', avatar: 'user1', first: 'Robert', last: 'Fairweather', email: 'robert@example.com', phone: '+1 555-357-5888', last_contacted: '2025-11-16', company: 'Summit Solutions', lead_score: 38, status: 'active' },
    { contact_id: '#ARP-7642', avatar: 'user6', first: 'Marcelino', last: 'Haddock', email: 'haddock@example.com', phone: '+1 555-456-8877', last_contacted: '2025-11-17', company: 'Strategies Ltd', lead_score: 15, status: 'active' },
    { contact_id: '#ARP-4652', avatar: 'user13', first: 'Thomas', last: 'Wilson', email: 'wildon@example.com', phone: '+1 555-622-4488', last_contacted: '2025-11-18', company: 'Tech Enterprises', lead_score: 41, status: 'inactive' },
    { contact_id: '#ARP-7895', avatar: 'user14', first: 'Nathaniel', last: 'Hulsey', email: 'hulsey@example.com', phone: '+1 555-225-4488', last_contacted: '2025-11-19', company: 'Synetic Solutions', lead_score: 29, status: 'active' }
  ];
  for (const c of list) {
    await db.runAsync(
      `INSERT INTO contacts (tenant_id, user_id, contact_id, first_name, last_name, email, phone, company, lead_score, last_contacted, status, avatar_url, contact_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'customer')`,
      [tenantId, userId, c.contact_id, c.first, c.last, c.email, c.phone, c.company, c.lead_score, c.last_contacted, c.status, c.avatar]
    );
  }
  console.log('  Seeded contacts');
}

async function seedChat(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM chat_conversations WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const conversations = [
    {
      name: 'Marcia Baker',
      messages: [
        'Hey Micheals, have you had a chance to check out the new admin dashboard?',
        "Oh, they've got this Kanban board for task management. You can drag and drop tasks between columns – it's so intuitive. Makes managing tasks a breeze. 🔥"
      ]
    },
    {
      name: 'Carolyn Barnes',
      messages: ['Hello Mateo...']
    },
    {
      name: 'Donna Miller',
      messages: ['Great ! 🔥']
    }
  ];
  for (const conv of conversations) {
    const r = await db.runAsync(
      `INSERT INTO chat_conversations (tenant_id, conversation_type, name, created_by) VALUES (?, 'direct', ?, ?)`,
      [tenantId, conv.name, userId]
    );
    const convId = r.lastID;
    await db.runAsync(
      `INSERT INTO chat_participants (tenant_id, conversation_id, user_id) VALUES (?, ?, ?)`,
      [tenantId, convId, userId]
    );
    for (const message of conv.messages) {
      await db.runAsync(
        `INSERT INTO chat_messages (tenant_id, conversation_id, user_id, message) VALUES (?, ?, ?, ?)`,
        [tenantId, convId, userId, message]
      );
    }
  }
  console.log('  Seeded chat');
}

async function seedEmails(tenantId, userId, userEmail) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM emails WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const list = [
    {
      from_name: 'Facebook',
      from_email: 'noreply@facebook.com',
      subject: 'Exclusive Product Offer on Facebook - Limited Time Only!',
      body: '<h3>Hello Micheal Collins</h3><p>Pellentesque viverra lorem malesuada nunc tristique sapien. Imperdiet sit hendrerit tincidunt bibendum donec adipiscing.</p>',
      sent_at: '2025-11-20'
    },
    {
      from_name: 'Dribbble',
      from_email: 'noreply@dribbble.com',
      subject: 'Get 70% off Dribbble Pro for Cyber Monday! Today',
      body: '<p>Special offer for your design team. Upgrade your plan and save big.</p>',
      sent_at: '2025-11-19'
    },
    {
      from_name: 'Instagram',
      from_email: 'noreply@instagram.com',
      subject: 'Dictum mauris vestibulum proin velit turpis integer tellus tellus.',
      body: '<p>Dictum mauris vestibulum proin velit turpis integer tellus tellus.</p>',
      sent_at: '2025-11-18'
    }
  ];
  for (const e of list) {
    await db.runAsync(
      `INSERT INTO emails (tenant_id, user_id, subject, body, from_email, from_name, to_emails, folder, status, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'inbox', 'unread', ?)`,
      [tenantId, userId, e.subject, e.body, e.from_email, e.from_name, JSON.stringify([userEmail]), e.sent_at]
    );
  }
  console.log('  Seeded emails');
}

async function seedKanban(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM kanban_boards WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const br = await db.runAsync(
    `INSERT INTO kanban_boards (tenant_id, user_id, name, description) VALUES (?, ?, 'Kanban Board', 'Project tasks overview')`,
    [tenantId, userId]
  );
  const boardId = br.lastID;
  const cols = [
    { name: 'To Do', pos: 0 },
    { name: 'In Progress', pos: 1 },
    { name: 'To Review', pos: 2 },
    { name: 'To Completed', pos: 3 }
  ];
  const colIds = [];
  for (const c of cols) {
    const cr = await db.runAsync(
      `INSERT INTO kanban_columns (tenant_id, board_id, name, position) VALUES (?, ?, ?, ?)`,
      [tenantId, boardId, c.name, c.pos]
    );
    colIds.push(cr.lastID);
  }
  const description = 'This column represents tasks that have been identified but are not yet scheduled for work.';
  const cards = [
    {
      title: 'Project monitoring',
      colIdx: 0,
      pos: 0,
      tag: { label: 'Design', members: ['user2', 'user4', 'user5'], createdLabel: 'Created 20 Nov', dueLabel: '3 days left' },
      createdAt: '2025-11-20',
      dueDate: '2025-11-23'
    },
    {
      title: 'Social media campaign',
      colIdx: 0,
      pos: 1,
      tag: { label: 'Marketing', members: ['user6', 'user7', 'user8'], createdLabel: 'Created 19 Nov', dueLabel: '2 days left' },
      createdAt: '2025-11-19',
      dueDate: '2025-11-21'
    },
    {
      title: 'Project',
      colIdx: 0,
      pos: 2,
      tag: { label: 'Fila', members: ['user9', 'user10'], createdLabel: 'Created 18 Nov', dueLabel: '4 days left' },
      createdAt: '2025-11-18',
      dueDate: '2025-11-22'
    },
    {
      title: 'Project',
      colIdx: 0,
      pos: 3,
      tag: { label: 'Development', members: ['user11'], createdLabel: 'Created 17 Nov', dueLabel: '2 days left' },
      createdAt: '2025-11-17',
      dueDate: '2025-11-19'
    },
    {
      title: 'eCommerce development',
      colIdx: 1,
      pos: 0,
      tag: { label: 'Marketing', members: ['user17', 'user1'], createdLabel: 'Created 20 Nov', dueLabel: '3 days left' },
      createdAt: '2025-11-20',
      dueDate: '2025-11-23'
    },
    {
      title: 'WordPress development',
      colIdx: 1,
      pos: 1,
      tag: { label: 'Design', members: ['user15'], createdLabel: 'Created 19 Nov', dueLabel: '2 days left' },
      createdAt: '2025-11-19',
      dueDate: '2025-11-21'
    },
    {
      title: 'Web development',
      colIdx: 1,
      pos: 2,
      tag: { label: 'Development', members: ['user14', 'user13', 'user12'], createdLabel: 'Created 18 Nov', dueLabel: '4 days left' },
      createdAt: '2025-11-18',
      dueDate: '2025-11-22'
    },
    {
      title: 'Digital marketing',
      colIdx: 1,
      pos: 3,
      tag: { label: 'Fila', members: ['user15', 'user17', 'user9'], createdLabel: 'Created 17 Nov', dueLabel: '5 days left' },
      createdAt: '2025-11-17',
      dueDate: '2025-11-22'
    },
    {
      title: 'Frontend design update',
      colIdx: 1,
      pos: 4,
      tag: { label: 'Design', members: ['user7', 'user8'], createdLabel: 'Created 16 Nov', dueLabel: '2 days left' },
      createdAt: '2025-11-16',
      dueDate: '2025-11-18'
    },
    {
      title: 'Fila dashboard design',
      colIdx: 1,
      pos: 5,
      tag: { label: 'Dashboard', members: ['user5', 'user6'], createdLabel: 'Created 15 Nov', dueLabel: '3 days left' },
      createdAt: '2025-11-15',
      dueDate: '2025-11-18'
    },
    {
      title: 'Mobile app development',
      colIdx: 1,
      pos: 6,
      tag: { label: 'Mobile', members: ['user2', 'user4'], createdLabel: 'Created 14 Nov', dueLabel: '1 days left' },
      createdAt: '2025-11-14',
      dueDate: '2025-11-15'
    },
    {
      title: 'Project monitoring',
      colIdx: 2,
      pos: 0,
      tag: { label: 'IT', members: ['user2', 'user4'], createdLabel: 'Created 10 Nov', dueLabel: '10 days left' },
      createdAt: '2025-11-10',
      dueDate: '2025-11-20'
    },
    {
      title: 'Social media campaign',
      colIdx: 2,
      pos: 1,
      tag: { label: 'Social', members: ['user5', 'user6'], createdLabel: 'Created 11 Nov', dueLabel: '5 days left' },
      createdAt: '2025-11-11',
      dueDate: '2025-11-16'
    },
    {
      title: 'Mobile app development',
      colIdx: 2,
      pos: 2,
      tag: { label: 'Website', members: ['user9', 'user10'], createdLabel: 'Created 13 Nov', dueLabel: '8 days left' },
      createdAt: '2025-11-13',
      dueDate: '2025-11-21'
    },
    {
      title: 'Digital marketing',
      colIdx: 2,
      pos: 3,
      tag: { label: 'Digital', members: ['user11', 'user12', 'user13'], createdLabel: 'Created 14 Nov', dueLabel: '4 days left' },
      createdAt: '2025-11-14',
      dueDate: '2025-11-18'
    },
    {
      title: 'WordPress development',
      colIdx: 2,
      pos: 4,
      tag: { label: 'WordPress', members: ['user14', 'user15'], createdLabel: 'Created 15 Nov', dueLabel: '6 days left' },
      createdAt: '2025-11-15',
      dueDate: '2025-11-21'
    },
    {
      title: 'App project update',
      colIdx: 3,
      pos: 0,
      tag: { label: 'App', members: ['user17', 'user16', 'user15'], createdLabel: 'Created 25 Nov', dueLabel: 'Done' },
      createdAt: '2025-11-25',
      dueDate: '2025-11-25'
    },
    {
      title: 'E-commerce site',
      colIdx: 3,
      pos: 1,
      tag: { label: 'site', members: ['user14', 'user13', 'user12'], createdLabel: 'Created 24 Nov', dueLabel: 'Done' },
      createdAt: '2025-11-24',
      dueDate: '2025-11-24'
    },
    {
      title: 'LMS & education site design',
      colIdx: 3,
      pos: 2,
      tag: { label: 'Education', members: ['user11', 'user10'], createdLabel: 'Created 23 Nov', dueLabel: 'Done' },
      createdAt: '2025-11-23',
      dueDate: '2025-11-23'
    },
    {
      title: 'Creative portfolio design',
      colIdx: 3,
      pos: 3,
      tag: { label: 'Portfolio', members: ['user9', 'user8'], createdLabel: 'Created 22 Nov', dueLabel: 'Done' },
      createdAt: '2025-11-22',
      dueDate: '2025-11-22'
    },
    {
      title: 'Vaxo admin dashboard',
      colIdx: 3,
      pos: 4,
      tag: { label: 'Admin', members: ['user7'], createdLabel: 'Created 21 Nov', dueLabel: 'Done' },
      createdAt: '2025-11-21',
      dueDate: '2025-11-21'
    }
  ];
  for (const c of cards) {
    await db.runAsync(
      `INSERT INTO kanban_cards (
        tenant_id, board_id, column_id, user_id, title, description, position, due_date, tags, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId,
        boardId,
        colIds[c.colIdx],
        userId,
        c.title,
        description,
        c.pos,
        c.dueDate,
        JSON.stringify([c.tag]),
        `${c.createdAt} 09:00:00`
      ]
    );
  }
  console.log('  Seeded kanban');
}

async function seedFileManager(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM file_folders WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  await db.runAsync(
    `INSERT INTO file_folders (tenant_id, user_id, name, path) VALUES (?, ?, 'Documents', '/Documents')`,
    [tenantId, userId]
  );
  await db.runAsync(
    `INSERT INTO file_folders (tenant_id, user_id, name, path) VALUES (?, ?, 'Invoices', '/Invoices')`,
    [tenantId, userId]
  );
  console.log('  Seeded file_folders');
}

async function seedEcommerce(tenantId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM ecommerce_products WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const products = [
    { name: 'Organic Chicken Breast', price: 8.99, qty: 50 },
    { name: 'Tomato Sauce', price: 3.49, qty: 120 },
    { name: 'Basmati Rice', price: 4.99, qty: 80 }
  ];
  for (const p of products) {
    await db.runAsync(
      `INSERT INTO ecommerce_products (tenant_id, name, price, stock_quantity, status) VALUES (?, ?, ?, ?, 'active')`,
      [tenantId, p.name, p.price, p.qty]
    );
  }
  console.log('  Seeded ecommerce_products');
}

async function seedCRM(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM crm_leads WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const leads = [
    { first: 'Alice', last: 'Smith', email: 'alice@co.com', company: 'Co Inc', source: 'website' },
    { first: 'Bob', last: 'Jones', email: 'bob@vendor.com', company: 'Vendor Co', source: 'referral' }
  ];
  let leadId;
  for (const l of leads) {
    const r = await db.runAsync(
      `INSERT INTO crm_leads (tenant_id, user_id, first_name, last_name, email, company, source, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`,
      [tenantId, userId, l.first, l.last, l.email, l.company, l.source]
    );
    if (!leadId) leadId = r.lastID;
  }
  const dr = await db.runAsync(
    `INSERT INTO crm_deals (tenant_id, lead_id, user_id, name, value, stage, probability)
     VALUES (?, ?, ?, 'Co Inc - Annual contract', 12000, 'qualification', 25)`,
    [tenantId, leadId, userId]
  );
  console.log('  Seeded crm_leads, crm_deals');
}

async function seedProjects(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM projects WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const pr = await db.runAsync(
    `INSERT INTO projects (tenant_id, user_id, name, description, status, progress) VALUES (?, ?, ?, ?, ?, ?)`,
    [tenantId, userId, 'Q1 Cost Reduction', 'Reduce food cost by 5%', 'active', 20]
  );
  const projectId = pr.lastID;
  const tasks = [
    { title: 'Audit current suppliers', status: 'in_progress' },
    { title: 'Implement portion control', status: 'todo' },
    { title: 'Review waste logs', status: 'todo' }
  ];
  for (let i = 0; i < tasks.length; i++) {
    await db.runAsync(
      `INSERT INTO project_tasks (tenant_id, project_id, user_id, title, status, position) VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, projectId, userId, tasks[i].title, tasks[i].status, i]
    );
  }
  console.log('  Seeded projects, project_tasks');
}

async function seedLMS(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM lms_courses WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const cr = await db.runAsync(
    `INSERT INTO lms_courses (tenant_id, instructor_id, title, description, category, status, level)
     VALUES (?, ?, 'Food Cost Fundamentals', 'Learn to track and reduce food cost.', 'Operations', 'published', 'beginner')`,
    [tenantId, userId]
  );
  const courseId = cr.lastID;
  await db.runAsync(
    `INSERT INTO lms_lessons (tenant_id, course_id, title, description, lesson_type, order_index, duration_minutes)
     VALUES (?, ?, 'Introduction to food cost', 'Overview of key metrics.', 'text', 0, 15)`,
    [tenantId, courseId]
  );
  await db.runAsync(
    `INSERT INTO lms_lessons (tenant_id, course_id, title, description, lesson_type, order_index, duration_minutes)
     VALUES (?, ?, 'Tracking waste', 'How to measure and reduce waste.', 'text', 1, 20)`,
    [tenantId, courseId]
  );
  await db.runAsync(
    `INSERT INTO lms_enrollments (tenant_id, course_id, student_id, progress, status) VALUES (?, ?, ?, 0, 'active')`,
    [tenantId, courseId, userId]
  );
  console.log('  Seeded lms_courses, lms_lessons, lms_enrollments');
}

async function seedHelpdesk(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM helpdesk_tickets WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const tickets = [
    { subj: 'Invoice upload not working', cat: 'technical', pri: 'high' },
    { subj: 'Dashboard numbers incorrect', cat: 'bug', pri: 'medium' },
    { subj: 'Feature: export to Excel', cat: 'feature_request', pri: 'low' }
  ];
  const t = Date.now();
  for (let i = 0; i < tickets.length; i++) {
    const num = `TKT-${t}-${i + 1}`;
    await db.runAsync(
      `INSERT INTO helpdesk_tickets (tenant_id, ticket_number, created_by, assigned_to, subject, description, category, priority, status, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', 'web')`,
      [tenantId, num, userId, userId, tickets[i].subj, 'Demo ticket.', tickets[i].cat, tickets[i].pri]
    );
  }
  console.log('  Seeded helpdesk_tickets');
}

async function seedEvents(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM events WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  const start = new Date();
  start.setDate(start.getDate() + 7);
  start.setHours(14, 0, 0, 0);
  const end = new Date(start);
  end.setHours(17, 0, 0, 0);
  await db.runAsync(
    `INSERT INTO events (tenant_id, created_by, title, description, event_type, start_date, end_date, location, status)
     VALUES (?, ?, 'Team Training: Cost Control', 'Quarterly training session.', 'workshop', ?, ?, 'Main office', 'published')`,
    [tenantId, userId, start.toISOString(), end.toISOString()]
  );
  const s2 = new Date();
  s2.setDate(s2.getDate() + 14);
  s2.setHours(9, 0, 0, 0);
  const e2 = new Date(s2);
  e2.setHours(10, 0, 0, 0);
  await db.runAsync(
    `INSERT INTO events (tenant_id, created_by, title, description, event_type, start_date, end_date, status)
     VALUES (?, ?, 'Supplier Review Meeting', 'Review supplier performance.', 'meeting', ?, ?, 'published')`,
    [tenantId, userId, s2.toISOString(), e2.toISOString()]
  );
  console.log('  Seeded events');
}

async function seedSocial(tenantId, userId) {
  const existing = await db.getAsync('SELECT COUNT(*) as c FROM social_posts WHERE tenant_id = ?', [tenantId]);
  if (existing.c > 0) return;
  await db.runAsync(
    `INSERT INTO social_posts (tenant_id, user_id, content, post_type, is_published) VALUES (?, ?, 'Welcome to Cloudignite! Start tracking your restaurant costs today.', 'text', 1)`,
    [tenantId, userId]
  );
  await db.runAsync(
    `INSERT INTO social_posts (tenant_id, user_id, content, post_type, is_published) VALUES (?, ?, 'Tip: Run a weekly inventory count to keep food cost accurate.', 'text', 1)`,
    [tenantId, userId]
  );
  console.log('  Seeded social_posts');
}

async function run() {
  console.log('\n🌱 Seed all modules (Apps & Pages)\n');
  const { tenantId, userId, userEmail } = await getTenantAndUser();
  console.log(`   Tenant ID: ${tenantId}, User ID: ${userId}\n`);

  await seedTodos(tenantId, userId);
  await seedCalendar(tenantId, userId);
  await seedContacts(tenantId, userId);
  await seedChat(tenantId, userId);
  await seedEmails(tenantId, userId, userEmail);
  await seedKanban(tenantId, userId);
  await seedFileManager(tenantId, userId);
  await seedEcommerce(tenantId);
  await seedCRM(tenantId, userId);
  await seedProjects(tenantId, userId);
  await seedLMS(tenantId, userId);
  await seedHelpdesk(tenantId, userId);
  await seedEvents(tenantId, userId);
  await seedSocial(tenantId, userId);

  console.log('\n✅ Done.\n');
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
