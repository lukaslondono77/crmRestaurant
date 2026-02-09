const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class HospitalService {
  /**
   * Generate unique patient ID
   */
  _generatePatientId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `PAT-${timestamp}-${random}`;
  }

  /**
   * Get all patients
   */
  async getPatients(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['p.tenant_id = ?'];
    const params = [tenantId];

    if (filters.status) {
      whereConditions.push('p.status = ?');
      params.push(filters.status);
    }

    if (filters.search) {
      whereConditions.push('(p.first_name LIKE ? OR p.last_name LIKE ? OR p.email LIKE ? OR p.patient_id LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM hospital_patients p ${whereClause}`, params);
    const total = countResult?.total || 0;

    const patients = await db.allAsync(`
      SELECT * FROM hospital_patients p
      ${whereClause}
      ORDER BY p.last_name ASC, p.first_name ASC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(patients, total, page, limit);
  }

  /**
   * Get patient by ID
   */
  async getPatientById(tenantId, patientId) {
    const patient = await db.getAsync(`
      SELECT * FROM hospital_patients
      WHERE id = ? AND tenant_id = ?
    `, [patientId, tenantId]);

    if (!patient) {
      throw new Error('Patient not found');
    }

    // Get appointments
    patient.appointments = await db.allAsync(`
      SELECT 
        a.*,
        u.first_name || ' ' || u.last_name as doctor_name
      FROM hospital_appointments a
      LEFT JOIN users u ON a.doctor_id = u.id
      WHERE a.patient_id = ? AND a.tenant_id = ?
      ORDER BY a.appointment_date DESC
    `, [patientId, tenantId]);

    // Get admissions
    patient.admissions = await db.allAsync(`
      SELECT 
        ad.*,
        u.first_name || ' ' || u.last_name as doctor_name
      FROM hospital_admissions ad
      LEFT JOIN users u ON ad.doctor_id = u.id
      WHERE ad.patient_id = ? AND ad.tenant_id = ?
      ORDER BY ad.admission_date DESC
    `, [patientId, tenantId]);

    // Get medications
    patient.medications = await db.allAsync(`
      SELECT 
        m.*,
        u.first_name || ' ' || u.last_name as prescribed_by_name
      FROM hospital_medications m
      LEFT JOIN users u ON m.prescribed_by = u.id
      WHERE m.patient_id = ? AND m.tenant_id = ?
      ORDER BY m.start_date DESC
    `, [patientId, tenantId]);

    return patient;
  }

  /**
   * Create patient
   */
  async createPatient(tenantId, patientData) {
    const {
      firstName, lastName, dateOfBirth, gender, phone, email,
      address, emergencyContactName, emergencyContactPhone,
      bloodType, allergies, medicalHistory,
      insuranceProvider, insuranceNumber, status = 'active'
    } = patientData;

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required');
    }

    const patientId = this._generatePatientId();

    const result = await db.runAsync(`
      INSERT INTO hospital_patients (
        tenant_id, patient_id, first_name, last_name, date_of_birth, gender,
        phone, email, address, emergency_contact_name, emergency_contact_phone,
        blood_type, allergies, medical_history,
        insurance_provider, insurance_number, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, patientId, firstName, lastName, dateOfBirth || null, gender || null,
      phone || null, email || null, address || null,
      emergencyContactName || null, emergencyContactPhone || null,
      bloodType || null, allergies || null, medicalHistory || null,
      insuranceProvider || null, insuranceNumber || null, status
    ]);

    return this.getPatientById(tenantId, result.lastID);
  }

  /**
   * Create appointment
   */
  async createAppointment(tenantId, appointmentData) {
    const {
      patientId, doctorId, appointmentDate, appointmentType,
      department, notes
    } = appointmentData;

    if (!patientId || !appointmentDate) {
      throw new Error('Patient ID and appointment date are required');
    }

    const result = await db.runAsync(`
      INSERT INTO hospital_appointments (
        tenant_id, patient_id, doctor_id, appointment_date,
        appointment_type, department, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, patientId, doctorId || null, appointmentDate,
      appointmentType || null, department || null, notes || null
    ]);

    return await db.getAsync(`
      SELECT 
        a.*,
        p.first_name || ' ' || p.last_name as patient_name,
        u.first_name || ' ' || u.last_name as doctor_name
      FROM hospital_appointments a
      JOIN hospital_patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.doctor_id = u.id
      WHERE a.id = ?
    `, [result.lastID]);
  }

  /**
   * Create admission
   */
  async createAdmission(tenantId, admissionData) {
    const {
      patientId, admissionDate, roomNumber, bedNumber,
      department, diagnosis, doctorId, notes
    } = admissionData;

    if (!patientId || !admissionDate) {
      throw new Error('Patient ID and admission date are required');
    }

    const result = await db.runAsync(`
      INSERT INTO hospital_admissions (
        tenant_id, patient_id, admission_date, room_number, bed_number,
        department, diagnosis, doctor_id, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, patientId, admissionDate, roomNumber || null, bedNumber || null,
      department || null, diagnosis || null, doctorId || null, notes || null
    ]);

    return await db.getAsync(`
      SELECT 
        ad.*,
        p.first_name || ' ' || p.last_name as patient_name,
        u.first_name || ' ' || u.last_name as doctor_name
      FROM hospital_admissions ad
      JOIN hospital_patients p ON ad.patient_id = p.id
      LEFT JOIN users u ON ad.doctor_id = u.id
      WHERE ad.id = ?
    `, [result.lastID]);
  }

  /**
   * Discharge patient
   */
  async dischargePatient(tenantId, admissionId, dischargeDate) {
    await db.runAsync(`
      UPDATE hospital_admissions
      SET discharge_date = ?, status = 'discharged', updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND tenant_id = ?
    `, [dischargeDate || new Date().toISOString(), admissionId, tenantId]);

    return await db.getAsync(`
      SELECT * FROM hospital_admissions
      WHERE id = ? AND tenant_id = ?
    `, [admissionId, tenantId]);
  }

  /**
   * Prescribe medication
   */
  async prescribeMedication(tenantId, medicationData) {
    const {
      patientId, medicationName, dosage, frequency,
      startDate, endDate, prescribedBy, notes
    } = medicationData;

    if (!patientId || !medicationName) {
      throw new Error('Patient ID and medication name are required');
    }

    const result = await db.runAsync(`
      INSERT INTO hospital_medications (
        tenant_id, patient_id, medication_name, dosage, frequency,
        start_date, end_date, prescribed_by, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, patientId, medicationName, dosage || null, frequency || null,
      startDate || null, endDate || null, prescribedBy || null, notes || null
    ]);

    return await db.getAsync(`
      SELECT 
        m.*,
        p.first_name || ' ' || p.last_name as patient_name,
        u.first_name || ' ' || u.last_name as prescribed_by_name
      FROM hospital_medications m
      JOIN hospital_patients p ON m.patient_id = p.id
      LEFT JOIN users u ON m.prescribed_by = u.id
      WHERE m.id = ?
    `, [result.lastID]);
  }

  /**
   * Create bill
   */
  async createBill(tenantId, billData) {
    const {
      patientId, admissionId, appointmentId, billDate,
      totalAmount, dueDate, insuranceCovered, notes
    } = billData;

    if (!patientId || !totalAmount) {
      throw new Error('Patient ID and total amount are required');
    }

    const result = await db.runAsync(`
      INSERT INTO hospital_billing (
        tenant_id, patient_id, admission_id, appointment_id,
        bill_date, total_amount, due_date, insurance_covered, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, patientId, admissionId || null, appointmentId || null,
      billDate || new Date().toISOString().split('T')[0], totalAmount,
      dueDate || null, insuranceCovered || 0, notes || null
    ]);

    return await db.getAsync(`
      SELECT 
        b.*,
        p.first_name || ' ' || p.last_name as patient_name
      FROM hospital_billing b
      JOIN hospital_patients p ON b.patient_id = p.id
      WHERE b.id = ?
    `, [result.lastID]);
  }

  /**
   * Update payment
   */
  async updatePayment(tenantId, billId, paymentData) {
    const { paidAmount, paymentMethod, paymentStatus } = paymentData;

    const updates = [];
    const params = [];

    if (paidAmount !== undefined) {
      updates.push('paid_amount = ?');
      params.push(paidAmount);
    }

    if (paymentMethod !== undefined) {
      updates.push('payment_method = ?');
      params.push(paymentMethod);
    }

    if (paymentStatus !== undefined) {
      updates.push('payment_status = ?');
      params.push(paymentStatus);
    }

    if (updates.length === 0) {
      return await db.getAsync('SELECT * FROM hospital_billing WHERE id = ? AND tenant_id = ?', [billId, tenantId]);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(billId, tenantId);

    await db.runAsync(`
      UPDATE hospital_billing
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return await db.getAsync('SELECT * FROM hospital_billing WHERE id = ?', [billId]);
  }

  /**
   * Get appointments
   */
  async getAppointments(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['a.tenant_id = ?'];
    const params = [tenantId];

    if (filters.patientId) {
      whereConditions.push('a.patient_id = ?');
      params.push(filters.patientId);
    }

    if (filters.doctorId) {
      whereConditions.push('a.doctor_id = ?');
      params.push(filters.doctorId);
    }

    if (filters.status) {
      whereConditions.push('a.status = ?');
      params.push(filters.status);
    }

    if (filters.startDate) {
      whereConditions.push('a.appointment_date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereConditions.push('a.appointment_date <= ?');
      params.push(filters.endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM hospital_appointments a ${whereClause}`, params);
    const total = countResult?.total || 0;

    const appointments = await db.allAsync(`
      SELECT 
        a.*,
        p.first_name || ' ' || p.last_name as patient_name,
        u.first_name || ' ' || u.last_name as doctor_name
      FROM hospital_appointments a
      JOIN hospital_patients p ON a.patient_id = p.id
      LEFT JOIN users u ON a.doctor_id = u.id
      ${whereClause}
      ORDER BY a.appointment_date DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(appointments, total, page, limit);
  }
}

module.exports = new HospitalService();
