const express = require('express');
const hospitalService = require('../services/hospitalService');
const { authenticate, tenantFilter } = require('../middleware/auth');
const { asyncHandler, formatSuccessResponse } = require('../utils/errorHandler');

const router = express.Router();

// Patients routes
router.get('/patients', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    status: req.query.status,
    search: req.query.search,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await hospitalService.getPatients(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.get('/patients/:id', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const patientId = parseInt(req.params.id);
  const patient = await hospitalService.getPatientById(tenantId, patientId);
  res.json(formatSuccessResponse(patient));
}));

router.post('/patients', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const patient = await hospitalService.createPatient(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(patient));
}));

// Appointments routes
router.get('/appointments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const filters = {
    patientId: req.query.patientId,
    doctorId: req.query.doctorId,
    status: req.query.status,
    startDate: req.query.startDate,
    endDate: req.query.endDate,
    page: req.query.page,
    limit: req.query.limit
  };
  const result = await hospitalService.getAppointments(tenantId, filters);
  res.json(formatSuccessResponse(result));
}));

router.post('/appointments', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const appointment = await hospitalService.createAppointment(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(appointment));
}));

// Admissions routes
router.post('/admissions', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const admission = await hospitalService.createAdmission(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(admission));
}));

router.put('/admissions/:id/discharge', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const admissionId = parseInt(req.params.id);
  const { dischargeDate } = req.body;
  const admission = await hospitalService.dischargePatient(tenantId, admissionId, dischargeDate);
  res.json(formatSuccessResponse(admission));
}));

// Medications routes
router.post('/medications', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const medication = await hospitalService.prescribeMedication(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(medication));
}));

// Billing routes
router.post('/billing', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const bill = await hospitalService.createBill(tenantId, req.body);
  res.status(201).json(formatSuccessResponse(bill));
}));

router.put('/billing/:id/payment', authenticate, tenantFilter, asyncHandler(async (req, res) => {
  const tenantId = req.tenantId;
  const billId = parseInt(req.params.id);
  const bill = await hospitalService.updatePayment(tenantId, billId, req.body);
  res.json(formatSuccessResponse(bill));
}));

module.exports = router;
