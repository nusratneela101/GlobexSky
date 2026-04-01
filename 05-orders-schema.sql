-- Orders Schema

CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    user_id INT NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'completed', 'canceled')),
    total_amount DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    order_item_id INT PRIMARY KEY,
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    UNIQUE(order_item_id)
);

CREATE TABLE order_timeline (
    timeline_id INT PRIMARY KEY,
    order_id INT NOT NULL,
    status VARCHAR(50) NOT NULL,
    status_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE order_addresses (
    address_id INT PRIMARY KEY,
    order_id INT NOT NULL,
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE payments (
    payment_id INT PRIMARY KEY,
    order_id INT NOT NULL,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    amount DECIMAL(10, 2) NOT NULL,
    payment_method_id INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE payment_methods (
    payment_method_id INT PRIMARY KEY,
    method_name VARCHAR(50) NOT NULL
);

CREATE TABLE invoices (
    invoice_id INT PRIMARY KEY,
    order_id INT NOT NULL,
    invoice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE
);

CREATE TABLE quotes (
    quote_id INT PRIMARY KEY,
    user_id INT NOT NULL,
    quote_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10, 2) NOT NULL
);

CREATE TABLE quote_items (
    quote_item_id INT PRIMARY KEY,
    quote_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (quote_id) REFERENCES quotes(quote_id) ON DELETE CASCADE
);

-- Sample Data
INSERT INTO orders (order_id, user_id, status, total_amount) VALUES
(1, 101, 'pending', 150.00),
(2, 102, 'completed', 250.00);

INSERT INTO order_items (order_item_id, order_id, product_id, quantity, price) VALUES
(1, 1, 1, 2, 75.00),
(2, 1, 2, 1, 150.00),
(3, 2, 1, 1, 200.00);

INSERT INTO order_timeline (timeline_id, order_id, status) VALUES
(1, 1, 'pending'),
(2, 2, 'completed');

INSERT INTO order_addresses (address_id, order_id, address_line_1, city, state, postal_code, country) VALUES
(1, 1, '123 Main St', 'Anytown', 'CA', '12345', 'USA');

INSERT INTO payment_methods (payment_method_id, method_name) VALUES
(1, 'Credit Card'),
(2, 'Paypal');

INSERT INTO payments (payment_id, order_id, amount, payment_method_id) VALUES
(1, 1, 150.00, 1);

INSERT INTO invoices (invoice_id, order_id, total_amount) VALUES
(1, 1, 150.00);

INSERT INTO quotes (quote_id, user_id, total_amount) VALUES
(1, 101, 100.00);

INSERT INTO quote_items (quote_item_id, quote_id, product_id, quantity, price) VALUES
(1, 1, 1, 1, 100.00);