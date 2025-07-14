const express = require('express');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(express.json());

// Mock data
const cities = [
    { id: 1, name: "New York" },
    { id: 2, name: "Los Angeles" },
    { id: 3, name: "Chicago" }
];

const branches = {
    1: [{ id: 101, name: "NY Downtown Clinic" }, { id: 102, name: "NY Uptown Clinic" }],
    2: [{ id: 201, name: "LA Central Clinic" }],
    3: [{ id: 301, name: "Chicago Main Clinic" }]
};

const availableTimes = {
    101: ["2025-07-15 10:00", "2025-07-15 14:00"],
    102: ["2025-07-15 11:00", "2025-07-15 15:00"],
    201: ["2025-07-16 09:00", "2025-07-16 13:00"],
    301: ["2025-07-17 10:00", "2025-07-17 12:00"]
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

app.get('/times', (req, res) => {
    const branchId = parseInt(req.query.branch_id);
    if (!branchId || !availableTimes[branchId]) {
        return res.status(400).json({ error: "Invalid or missing branch_id" });
    }
    res.status(200).json(availableTimes[branchId]);
});

app.post('/appointments', (req, res) => {
    const { id_number, city_id, branch_id, date_time } = req.body;
    if (!id_number || !city_id || !branch_id || !date_time) {
        return res.status(400).json({ error: "Missing required parameters" });
    }
    res.status(201).json({ status: "success", appointmentId: uuidv4() });
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Mock API running on http://localhost:${PORT}`));