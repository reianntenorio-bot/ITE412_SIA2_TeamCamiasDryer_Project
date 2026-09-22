const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

// ===============================
// MODULE 1: DRYING MONITORING
// ===============================

let monitoringRecords = [
  {
    id: 1,
    temperature: 45,
    humidity: 60,
    status: "Drying"
  }
];

// GET /monitoring
app.get("/monitoring", (req, res) => {
  res.status(200).json(monitoringRecords);
});

// POST /monitoring
app.post("/monitoring", (req, res) => {
  const { temperature, humidity, status } = req.body;

  const newRecord = {
    id: monitoringRecords.length + 1,
    temperature,
    humidity,
    status
  };

  monitoringRecords.push(newRecord);

  res.status(201).json(newRecord);
});

// ===============================
// MODULE 2: PRODUCT
// ===============================

let products = [
  {
    id: 1,
    name: "Dried Camias",
    price: 150,
    stock: 20
  }
];

// GET /products
app.get("/products", (req, res) => {
  res.status(200).json(products);
});

// POST /products
app.post("/products", (req, res) => {
  const { name, price, stock } = req.body;

  const newProduct = {
    id: products.length + 1,
    name,
    price,
    stock
  };

  products.push(newProduct);

  res.status(201).json(newProduct);
});

// ===============================
// START SERVER
// ===============================

app.listen(PORT, () => {
  console.log(`REST API running at http://localhost:${PORT}`);
});