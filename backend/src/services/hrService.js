const db = require('../config/database');
const { parsePaginationParams, formatPaginatedResponse } = require('../utils/pagination');

class HrService {
  /**
   * Generate unique employee ID
   */
  _generateEmployeeId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `EMP-${timestamp}-${random}`;
  }

  /**
   * Get all employees
   */
  async getEmployees(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['e.tenant_id = ?'];
    const params = [tenantId];

    if (filters.department) {
      whereConditions.push('e.department = ?');
      params.push(filters.department);
    }

    if (filters.status) {
      whereConditions.push('e.status = ?');
      params.push(filters.status);
    }

    if (filters.employmentType) {
      whereConditions.push('e.employment_type = ?');
      params.push(filters.employmentType);
    }

    if (filters.search) {
      whereConditions.push('(e.first_name LIKE ? OR e.last_name LIKE ? OR e.email LIKE ? OR e.employee_id LIKE ?)');
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM hr_employees e ${whereClause}`, params);
    const total = countResult?.total || 0;

    const employees = await db.allAsync(`
      SELECT 
        e.*,
        m.first_name || ' ' || m.last_name as manager_name,
        u.email as user_email
      FROM hr_employees e
      LEFT JOIN hr_employees m ON e.manager_id = m.id
      LEFT JOIN users u ON e.user_id = u.id
      ${whereClause}
      ORDER BY e.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(employees, total, page, limit);
  }

  /**
   * Get employee by ID
   */
  async getEmployeeById(tenantId, employeeId) {
    const employee = await db.getAsync(`
      SELECT 
        e.*,
        m.first_name || ' ' || m.last_name as manager_name,
        u.email as user_email
      FROM hr_employees e
      LEFT JOIN hr_employees m ON e.manager_id = m.id
      LEFT JOIN users u ON e.user_id = u.id
      WHERE e.id = ? AND e.tenant_id = ?
    `, [employeeId, tenantId]);

    if (!employee) {
      throw new Error('Employee not found');
    }

    return employee;
  }

  /**
   * Create employee
   */
  async createEmployee(tenantId, employeeData) {
    const {
      userId, firstName, lastName, email, phone, department, position,
      jobTitle, hireDate, employmentType = 'full_time', status = 'active',
      salary, managerId, address, emergencyContactName, emergencyContactPhone, notes
    } = employeeData;

    if (!firstName || !lastName) {
      throw new Error('First name and last name are required');
    }

    const employeeId = this._generateEmployeeId();

    const result = await db.runAsync(`
      INSERT INTO hr_employees (
        tenant_id, user_id, employee_id, first_name, last_name, email, phone,
        department, position, job_title, hire_date, employment_type, status,
        salary, manager_id, address, emergency_contact_name, emergency_contact_phone, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, userId || null, employeeId, firstName, lastName, email || null,
      phone || null, department || null, position || null, jobTitle || null,
      hireDate || null, employmentType, status, salary || null, managerId || null,
      address || null, emergencyContactName || null, emergencyContactPhone || null, notes || null
    ]);

    return this.getEmployeeById(tenantId, result.lastID);
  }

  /**
   * Update employee
   */
  async updateEmployee(tenantId, employeeId, updateData) {
    const existing = await this.getEmployeeById(tenantId, employeeId);

    const updates = [];
    const params = [];

    const fields = {
      userId: 'user_id',
      firstName: 'first_name',
      lastName: 'last_name',
      email: 'email',
      phone: 'phone',
      department: 'department',
      position: 'position',
      jobTitle: 'job_title',
      hireDate: 'hire_date',
      employmentType: 'employment_type',
      status: 'status',
      salary: 'salary',
      managerId: 'manager_id',
      address: 'address',
      emergencyContactName: 'emergency_contact_name',
      emergencyContactPhone: 'emergency_contact_phone',
      notes: 'notes'
    };

    Object.keys(fields).forEach(key => {
      if (updateData[key] !== undefined) {
        updates.push(`${fields[key]} = ?`);
        params.push(updateData[key] || null);
      }
    });

    if (updates.length === 0) {
      return existing;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(employeeId, tenantId);

    await db.runAsync(`
      UPDATE hr_employees
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return this.getEmployeeById(tenantId, employeeId);
  }

  /**
   * Get attendance records
   */
  async getAttendance(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['a.tenant_id = ?'];
    const params = [tenantId];

    if (filters.employeeId) {
      whereConditions.push('a.employee_id = ?');
      params.push(filters.employeeId);
    }

    if (filters.startDate) {
      whereConditions.push('a.date >= ?');
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereConditions.push('a.date <= ?');
      params.push(filters.endDate);
    }

    if (filters.status) {
      whereConditions.push('a.status = ?');
      params.push(filters.status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM hr_attendance a ${whereClause}`, params);
    const total = countResult?.total || 0;

    const attendance = await db.allAsync(`
      SELECT 
        a.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_id as employee_number
      FROM hr_attendance a
      JOIN hr_employees e ON a.employee_id = e.id
      ${whereClause}
      ORDER BY a.date DESC, a.check_in_time DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(attendance, total, page, limit);
  }

  /**
   * Record attendance (check-in/check-out)
   */
  async recordAttendance(tenantId, employeeId, attendanceData) {
    const { date, checkInTime, checkOutTime, breakDurationMinutes, status, notes } = attendanceData;

    const attendanceDate = date || new Date().toISOString().split('T')[0];

    // Check if record exists
    const existing = await db.getAsync(`
      SELECT * FROM hr_attendance
      WHERE employee_id = ? AND date = ? AND tenant_id = ?
    `, [employeeId, attendanceDate, tenantId]);

    let totalHours = null;
    if (checkInTime && checkOutTime) {
      const checkIn = new Date(checkInTime);
      const checkOut = new Date(checkOutTime);
      const diffMs = checkOut - checkIn;
      const diffHours = (diffMs / (1000 * 60 * 60)) - ((breakDurationMinutes || 0) / 60);
      totalHours = Math.max(0, diffHours);
    }

    if (existing) {
      // Update existing record
      const updates = [];
      const params = [];

      if (checkInTime !== undefined) {
        updates.push('check_in_time = ?');
        params.push(checkInTime);
      }

      if (checkOutTime !== undefined) {
        updates.push('check_out_time = ?');
        params.push(checkOutTime);
      }

      if (breakDurationMinutes !== undefined) {
        updates.push('break_duration_minutes = ?');
        params.push(breakDurationMinutes);
      }

      if (status !== undefined) {
        updates.push('status = ?');
        params.push(status);
      }

      if (notes !== undefined) {
        updates.push('notes = ?');
        params.push(notes);
      }

      if (totalHours !== null) {
        updates.push('total_hours = ?');
        params.push(totalHours);
      }

      if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(existing.id, tenantId);

        await db.runAsync(`
          UPDATE hr_attendance
          SET ${updates.join(', ')}
          WHERE id = ? AND tenant_id = ?
        `, params);
      }

      return await db.getAsync('SELECT * FROM hr_attendance WHERE id = ?', [existing.id]);
    } else {
      // Create new record
      const result = await db.runAsync(`
        INSERT INTO hr_attendance (
          tenant_id, employee_id, date, check_in_time, check_out_time,
          break_duration_minutes, total_hours, status, notes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        tenantId, employeeId, attendanceDate, checkInTime || null, checkOutTime || null,
        breakDurationMinutes || 0, totalHours, status || 'present', notes || null
      ]);

      return await db.getAsync('SELECT * FROM hr_attendance WHERE id = ?', [result.lastID]);
    }
  }

  /**
   * Get leave requests
   */
  async getLeaveRequests(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['l.tenant_id = ?'];
    const params = [tenantId];

    if (filters.employeeId) {
      whereConditions.push('l.employee_id = ?');
      params.push(filters.employeeId);
    }

    if (filters.status) {
      whereConditions.push('l.status = ?');
      params.push(filters.status);
    }

    if (filters.leaveType) {
      whereConditions.push('l.leave_type = ?');
      params.push(filters.leaveType);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM hr_leave_requests l ${whereClause}`, params);
    const total = countResult?.total || 0;

    const requests = await db.allAsync(`
      SELECT 
        l.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_id as employee_number,
        u.first_name || ' ' || u.last_name as approved_by_name
      FROM hr_leave_requests l
      JOIN hr_employees e ON l.employee_id = e.id
      LEFT JOIN users u ON l.approved_by = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(requests, total, page, limit);
  }

  /**
   * Create leave request
   */
  async createLeaveRequest(tenantId, employeeId, requestData) {
    const {
      leaveType, startDate, endDate, reason
    } = requestData;

    if (!leaveType || !startDate || !endDate) {
      throw new Error('Leave type, start date, and end date are required');
    }

    // Calculate days requested
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const result = await db.runAsync(`
      INSERT INTO hr_leave_requests (
        tenant_id, employee_id, leave_type, start_date, end_date, days_requested, reason
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [tenantId, employeeId, leaveType, startDate, endDate, diffDays, reason || null]);

    return await db.getAsync(`
      SELECT 
        l.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM hr_leave_requests l
      JOIN hr_employees e ON l.employee_id = e.id
      WHERE l.id = ?
    `, [result.lastID]);
  }

  /**
   * Update leave request status
   */
  async updateLeaveRequestStatus(tenantId, requestId, status, approvedBy, rejectionReason) {
    const updates = ['status = ?'];
    const params = [status];

    if (status === 'approved') {
      updates.push('approved_by = ?');
      updates.push('approved_at = CURRENT_TIMESTAMP');
      params.push(approvedBy);
    }

    if (status === 'rejected' && rejectionReason) {
      updates.push('rejection_reason = ?');
      params.push(rejectionReason);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(requestId, tenantId);

    await db.runAsync(`
      UPDATE hr_leave_requests
      SET ${updates.join(', ')}
      WHERE id = ? AND tenant_id = ?
    `, params);

    return await db.getAsync(`
      SELECT 
        l.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM hr_leave_requests l
      JOIN hr_employees e ON l.employee_id = e.id
      WHERE l.id = ?
    `, [requestId]);
  }

  /**
   * Get payroll records
   */
  async getPayroll(tenantId, filters = {}) {
    const { page, limit, offset } = parsePaginationParams(filters);
    
    let whereConditions = ['p.tenant_id = ?'];
    const params = [tenantId];

    if (filters.employeeId) {
      whereConditions.push('p.employee_id = ?');
      params.push(filters.employeeId);
    }

    if (filters.status) {
      whereConditions.push('p.status = ?');
      params.push(filters.status);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const countResult = await db.getAsync(`SELECT COUNT(*) as total FROM hr_payroll p ${whereClause}`, params);
    const total = countResult?.total || 0;

    const payroll = await db.allAsync(`
      SELECT 
        p.*,
        e.first_name || ' ' || e.last_name as employee_name,
        e.employee_id as employee_number
      FROM hr_payroll p
      JOIN hr_employees e ON p.employee_id = e.id
      ${whereClause}
      ORDER BY p.pay_period_end DESC
      LIMIT ? OFFSET ?
    `, [...params, limit, offset]);

    return formatPaginatedResponse(payroll, total, page, limit);
  }

  /**
   * Create payroll record
   */
  async createPayroll(tenantId, employeeId, payrollData) {
    const {
      payPeriodStart, payPeriodEnd, baseSalary, overtimeHours = 0,
      overtimePay = 0, bonuses = 0, deductions = 0, taxAmount = 0, notes
    } = payrollData;

    if (!payPeriodStart || !payPeriodEnd || baseSalary === undefined) {
      throw new Error('Pay period dates and base salary are required');
    }

    const netPay = baseSalary + overtimePay + bonuses - deductions - taxAmount;

    const result = await db.runAsync(`
      INSERT INTO hr_payroll (
        tenant_id, employee_id, pay_period_start, pay_period_end,
        base_salary, overtime_hours, overtime_pay, bonuses, deductions,
        tax_amount, net_pay, notes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tenantId, employeeId, payPeriodStart, payPeriodEnd,
      baseSalary, overtimeHours, overtimePay, bonuses, deductions,
      taxAmount, netPay, notes || null
    ]);

    return await db.getAsync(`
      SELECT 
        p.*,
        e.first_name || ' ' || e.last_name as employee_name
      FROM hr_payroll p
      JOIN hr_employees e ON p.employee_id = e.id
      WHERE p.id = ?
    `, [result.lastID]);
  }

  /**
   * Get departments
   */
  async getDepartments(tenantId) {
    const departments = await db.allAsync(`
      SELECT 
        d.*,
        e.first_name || ' ' || e.last_name as manager_name,
        (SELECT COUNT(*) FROM hr_employees WHERE department = d.name AND tenant_id = ?) as employee_count
      FROM hr_departments d
      LEFT JOIN hr_employees e ON d.manager_id = e.id
      WHERE d.tenant_id = ?
      ORDER BY d.name ASC
    `, [tenantId, tenantId]);

    return departments;
  }

  /**
   * Create department
   */
  async createDepartment(tenantId, departmentData) {
    const { name, description, managerId, budget } = departmentData;

    if (!name) {
      throw new Error('Department name is required');
    }

    const result = await db.runAsync(`
      INSERT INTO hr_departments (tenant_id, name, description, manager_id, budget)
      VALUES (?, ?, ?, ?, ?)
    `, [tenantId, name, description || null, managerId || null, budget || null]);

    return await db.getAsync('SELECT * FROM hr_departments WHERE id = ?', [result.lastID]);
  }
}

module.exports = new HrService();
