-- Checking schema creation for inspection management

CREATE TABLE inspectors (
    inspector_id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone_number VARCHAR(15),
    hire_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_phone_number CHECK (phone_number REGEXP '^[0-9]+$')
);

CREATE TABLE inspections (
    inspection_id INT PRIMARY KEY AUTO_INCREMENT,
    inspector_id INT,
    inspection_date DATETIME NOT NULL,
    description TEXT,
    status ENUM('Pending', 'Complete', 'Cancelled') DEFAULT 'Pending',
    FOREIGN KEY (inspector_id) REFERENCES inspectors(inspector_id)
);

CREATE TABLE inspection_items (
    item_id INT PRIMARY KEY AUTO_INCREMENT,
    inspection_id INT,
    item_description VARCHAR(255) NOT NULL,
    status ENUM('Pass', 'Fail') DEFAULT 'Pass',
    comments TEXT,
    FOREIGN KEY (inspection_id) REFERENCES inspections(inspection_id)
);

CREATE TABLE inspection_reports (
    report_id INT PRIMARY KEY AUTO_INCREMENT,
    inspection_id INT,
    report_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    findings TEXT,
    recommendations TEXT,
    FOREIGN KEY (inspection_id) REFERENCES inspections(inspection_id)
);

CREATE TABLE inspection_timeline (
    timeline_id INT PRIMARY KEY AUTO_INCREMENT,
    inspection_id INT,
    timeline_date DATETIME,
    event_description TEXT,
    FOREIGN KEY (inspection_id) REFERENCES inspections(inspection_id)
);

CREATE TABLE quality_standards (
    standard_id INT PRIMARY KEY AUTO_INCREMENT,
    standard_name VARCHAR(100) NOT NULL,
    description TEXT
);

CREATE TABLE quality_checklist (
    checklist_id INT PRIMARY KEY AUTO_INCREMENT,
    standard_id INT,
    item_description VARCHAR(255) NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (standard_id) REFERENCES quality_standards(standard_id)
);

-- Sample Data
INSERT INTO inspectors (name, email, phone_number) VALUES
('John Doe', 'john.doe@example.com', '1234567890'),
('Jane Smith', 'jane.smith@example.com', '0987654321');

INSERT INTO inspections (inspector_id, inspection_date, description) VALUES
(1, '2026-04-01 10:00:00', 'Quarterly site inspection'),
(2, '2026-04-02 11:00:00', 'Annual safety audit');

INSERT INTO inspection_items (inspection_id, item_description, status) VALUES
(1, 'Check fire extinguishers', 'Pass'),
(1, 'Inspect electrical wiring', 'Fail'),
(2, 'Verify safety equipment', 'Pass');

INSERT INTO inspection_reports (inspection_id, findings, recommendations) VALUES
(1, 'All good except electrical wiring issues.', 'Fix wiring issues immediately.'),
(2, 'Safety equipment verified.', 'Continue regular audits.');

INSERT INTO inspection_timeline (inspection_id, timeline_date, event_description) VALUES
(1, '2026-04-01 10:00:00', 'Inspection started'),
(1, '2026-04-01 12:00:00', 'Inspection completed'),
(2, '2026-04-02 11:00:00', 'Audit started');

INSERT INTO quality_standards (standard_name, description) VALUES
('Fire Safety Standards', 'Standards related to fire safety regulations.'),
('Electrical Standards', 'Standards for electrical installations.');

INSERT INTO quality_checklist (standard_id, item_description) VALUES
(1, 'Install fire alarms in every room'),
(1, 'Maintain clear fire exits'),
(2, 'Use certified electrical components');