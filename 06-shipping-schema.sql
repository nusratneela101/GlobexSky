-- Table: shipments
CREATE TABLE shipments (
    id SERIAL PRIMARY KEY,
    carrier_id INT REFERENCES shipping_carriers(id),
    shipment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tracking_number VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table: shipping_carriers
CREATE TABLE shipping_carriers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_info JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: shipping_rates
CREATE TABLE shipping_rates (
    id SERIAL PRIMARY KEY,
    carrier_id INT REFERENCES shipping_carriers(id),
    weight_limit DECIMAL NOT NULL,
    cost DECIMAL NOT NULL,
    delivery_time VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: tracking_events
CREATE TABLE tracking_events (
    id SERIAL PRIMARY KEY,
    shipment_id INT REFERENCES shipments(id),
    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(100),
    location VARCHAR(255),
    description TEXT
);

-- Table: returns
CREATE TABLE returns (
    id SERIAL PRIMARY KEY,
    shipment_id INT REFERENCES shipments(id),
    return_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: return_items
CREATE TABLE return_items (
    id SERIAL PRIMARY KEY,
    return_id INT REFERENCES returns(id),
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: warehouses
CREATE TABLE warehouses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: inventory
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    warehouse_id INT REFERENCES warehouses(id),
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table: stock_movements
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    inventory_id INT REFERENCES inventory(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    movement_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data
INSERT INTO shipping_carriers (name, contact_info) VALUES
('Carrier A', '{"phone": "123-456-7890", "email": "contact@carriera.com"}'),
('Carrier B', '{"phone": "098-765-4321", "email": "contact@carrierb.com"}');

INSERT INTO shipments (carrier_id, tracking_number, status) VALUES
(1, 'TRACK123456', 'Shipped'),
(2, 'TRACK654321', 'In Transit');

INSERT INTO shipping_rates (carrier_id, weight_limit, cost, delivery_time) VALUES
(1, 50.0, 9.99, '3-5 business days'),
(2, 30.0, 12.99, '2-4 business days');

INSERT INTO warehouses (name, location) VALUES
('Main Warehouse', '123 Main St, City A'),
('Secondary Warehouse', '456 Secondary St, City B');

-- Additional sample inserts can be added as needed.
