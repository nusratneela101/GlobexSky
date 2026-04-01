-- Pricing Schema for GlobexSky Database

-- Table for Pricing Tiers
CREATE TABLE pricing_tiers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tier_name VARCHAR(255) NOT NULL,
    min_purchase_amount DECIMAL(10, 2) NOT NULL,
    max_purchase_amount DECIMAL(10, 2),
    discount_percentage DECIMAL(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100)
);

-- Sample Data for Pricing Tiers
INSERT INTO pricing_tiers (tier_name, min_purchase_amount, max_purchase_amount, discount_percentage) VALUES
('Basic', 0, 99.99, 0),
('Silver', 100, 499.99, 10),
('Gold', 500, 999.99, 15),
('Platinum', 1000, NULL, 20);

-- Table for Product Pricing
CREATE TABLE product_pricing (
    id INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Sample Data for Product Pricing
INSERT INTO product_pricing (product_id, price) VALUES
(1, 29.99),
(2, 49.99),
(3, 99.99);

-- Table for Discounts
CREATE TABLE discounts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    discount_code VARCHAR(50) UNIQUE NOT NULL,
    discount_percentage DECIMAL(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    valid_until DATE NOT NULL
);

-- Sample Data for Discounts
INSERT INTO discounts (discount_code, discount_percentage, valid_until) VALUES
('SPRING2026', 10, '2026-06-30'),
('SUMMER2026', 15, '2026-08-31');

-- Table for Discount Usage
CREATE TABLE discount_usage (
    id INT PRIMARY KEY AUTO_INCREMENT,
    order_id INT NOT NULL,
    discount_id INT NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (discount_id) REFERENCES discounts(id)
);

-- Sample Data for Discount Usage
INSERT INTO discount_usage (order_id, discount_id) VALUES
(1, 1),
(2, 2);

-- Table for Promotions
CREATE TABLE promotions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    promotion_name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
);

-- Sample Data for Promotions
INSERT INTO promotions (promotion_name, start_date, end_date) VALUES
('Easter Sale', '2026-04-01', '2026-04-30'),
('Summer Sale', '2026-06-01', '2026-06-30');

-- Table for Loyalty Programs
CREATE TABLE loyalty_programs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    program_name VARCHAR(255) NOT NULL,
    points_per_dollar DECIMAL(10, 2) NOT NULL
);

-- Sample Data for Loyalty Programs
INSERT INTO loyalty_programs (program_name, points_per_dollar) VALUES
('Standard', 1.00),
('Premium', 1.50);

-- Table for Loyalty Points
CREATE TABLE loyalty_points (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    total_points INT DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sample Data for Loyalty Points
INSERT INTO loyalty_points (user_id, total_points) VALUES
(1, 100),
(2, 250);

-- Table for Points Transactions
CREATE TABLE points_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    loyalty_points_id INT NOT NULL,
    transaction_type VARCHAR(50) CHECK (transaction_type IN ('earn', 'redeem')),
    amount INT NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (loyalty_points_id) REFERENCES loyalty_points(id)
);

-- Sample Data for Points Transactions
INSERT INTO points_transactions (loyalty_points_id, transaction_type, amount) VALUES
(1, 'earn', 50),
(2, 'redeem', 30);

-- Table for Referral Programs
CREATE TABLE referral_program (
    id INT PRIMARY KEY AUTO_INCREMENT,
    referral_code VARCHAR(50) UNIQUE NOT NULL,
    reward_points INT NOT NULL
);

-- Sample Data for Referral Programs
INSERT INTO referral_program (referral_code, reward_points) VALUES
('FRIEND2026', 100);

-- Table for Referral Transactions
CREATE TABLE referral_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    referral_program_id INT NOT NULL,
    user_id INT NOT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (referral_program_id) REFERENCES referral_program(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sample Data for Referral Transactions
INSERT INTO referral_transactions (referral_program_id, user_id) VALUES
(1, 1);