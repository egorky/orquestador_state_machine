const express = require('express');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());

// Mock data
const cities = [
    { city_id: 1, city_name: "Guayaquil" },
    { city_id: 2, city_name: "Quito" },
    { city_id: 3, city_name: "Cuenca" }
];

const branches = {
    1: [{ branch_id: 101, branch_name: "Kennedy" }, { branch_id: 102, branch_name: "Alborada" }],
    2: [{ branch_id: 201, branch_name: "La Carolina" }],
    3: [{ branch_id: 301, branch_name: "Centro Histórico" }]
};

const specialities = {
    101: [{ speciality_id: 1, speciality_name: "Medicina General" }, { speciality_id: 2, speciality_name: "Pediatría" }],
    102: [{ speciality_id: 1, speciality_name: "Medicina General" }, { speciality_id: 3, speciality_name: "Cardiología" }],
    201: [{ speciality_id: 1, speciality_name: "Medicina General" }, { speciality_id: 4, speciality_name: "Dermatología" }],
    301: [{ speciality_id: 1, speciality_name: "Medicina General" }],
};

const availableTimes = {
    1: ["2025-07-15 10:00", "2025-07-15 14:00"],
    2: ["2025-07-15 11:00", "2025-07-15 15:00"],
    3: ["2025-07-16 09:00", "2025-07-16 13:00"],
    4: ["2025-07-17 10:00", "2025-07-17 12:00"]
};

// Mock API endpoints
app.get('/cities', (req, res) => {
    res.status(200).json(cities);
});

app.get('/branches', (req, res) => {
    const cityId = parseInt(req.query.city_id);
    if (!cityId || !branches[cityId]) {
        return res.status(400).json({ error: "Invalid or missing city_id" });
    }
    res.status(200).json(branches[cityId]);
});

app.get('/specialities', (req, res) => {
    const branchId = parseInt(req.query.branch_id);
    if (!branchId || !specialities[branchId]) {
        return res.status(400).json({ error: "Invalid or missing branch_id" });
    }
    res.status(200).json(specialities[branchId]);
});

app.get('/times', (req, res) => {
    const specialityId = parseInt(req.query.speciality_id);
    if (!specialityId || !availableTimes[specialityId]) {
        return res.status(400).json({ error: "Invalid or missing speciality_id" });
    }
    res.status(200).json(availableTimes[specialityId]);
});

app.post('/appointments', (req, res) => {
    const { id_number, city_id, branch_id, speciality_id, date_time } = req.body;
    if (!id_number || !city_id || !branch_id || !speciality_id || !date_time) {
        return res.status(400).json({ error: "Missing required parameters" });
    }
    res.status(201).json({ status: "success", appointmentId: uuidv4() });
});

const port = process.env.MOCK_API_PORT || 3001;
app.listen(port, () => console.log(`Mock API running on http://localhost:${port}`));