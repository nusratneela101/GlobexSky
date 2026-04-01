-- Admin Schema for GlobexSky Database

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE roles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    role_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE permissions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    permission_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE role_permissions (
    role_id INT NOT NULL,
    permission_id INT NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    action VARCHAR(255) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE audit_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    change_description TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE backup_records (
    id INT PRIMARY KEY AUTO_INCREMENT,
    backup_date DATETIME NOT NULL,
    backup_size INT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_name VARCHAR(255) NOT NULL UNIQUE,
    setting_value TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Sample Data

INSERT INTO users (username, email, password) VALUES 
('admin', 'admin@example.com', 'securepassword123'), 
('user1', 'user1@example.com', 'securepassword456');

INSERT INTO roles (role_name, description) VALUES 
('Admin', 'Administrator role with full permissions'), 
('User', 'Standard user role');

INSERT INTO permissions (permission_name, description) VALUES 
('create_user', 'Permission to create a user'), 
('delete_user', 'Permission to delete a user');

INSERT INTO role_permissions (role_id, permission_id) VALUES 
(1, 1), 
(1, 2), 
(2, 1);

INSERT INTO activity_logs (user_id, action) VALUES 
(1, 'Created User: user1'), 
(2, 'Attempted to create user');

INSERT INTO audit_logs (user_id, change_description) VALUES 
(1, 'Changed setting_value for some_setting');

INSERT INTO backup_records (backup_date, backup_size) VALUES 
('2026-04-01 10:00:00', 5120);

INSERT INTO system_settings (setting_name, setting_value) VALUES 
('some_setting', 'some_value');
