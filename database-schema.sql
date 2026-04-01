-- Step 1: Admin Tables
CREATE TABLE Users (
    UserID INT PRIMARY KEY,
    Username VARCHAR(50) NOT NULL,
    PasswordHash VARCHAR(255) NOT NULL,
    Role VARCHAR(50),
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Roles (
    RoleID INT PRIMARY KEY,
    RoleName VARCHAR(50) NOT NULL
);

-- Step 2: CMS & Content Tables
CREATE TABLE Articles (
    ArticleID INT PRIMARY KEY,
    Title VARCHAR(255) NOT NULL,
    Content TEXT,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE Categories (
    CategoryID INT PRIMARY KEY,
    CategoryName VARCHAR(50) NOT NULL
);

-- Step 3: Inspection & Quality Management
CREATE TABLE Inspections (
    InspectionID INT PRIMARY KEY,
    ProductID INT,
    InspectionDate DATETIME,
    Status VARCHAR(50),
    Comments TEXT
);

-- Step 4: Pricing Discounts & Promotions
CREATE TABLE Discounts (
    DiscountID INT PRIMARY KEY,
    DiscountCode VARCHAR(50) NOT NULL,
    DiscountPercentage DECIMAL(5,2),
    ValidUntil DATETIME
);

-- Step 5: Orders Commerce & Payments
CREATE TABLE Orders (
    OrderID INT PRIMARY KEY,
    UserID INT,
    OrderDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    TotalAmount DECIMAL(10, 2)
);

CREATE TABLE Payments (
    PaymentID INT PRIMARY KEY,
    OrderID INT,
    PaymentDate DATETIME,
    Amount DECIMAL(10, 2),
    PaymentMethod VARCHAR(50)
);

-- Step 6: Logistics Shipping & Tracking
CREATE TABLE Shipments (
    ShipmentID INT PRIMARY KEY,
    OrderID INT,
    ShipmentDate DATETIME,
    DeliveryDate DATETIME
);

-- Step 7: Disputes Refunds & Support
CREATE TABLE Disputes (
    DisputeID INT PRIMARY KEY,
    OrderID INT,
    DisputeDate DATETIME,
    Status VARCHAR(50),
    ResolutionComments TEXT
);

-- Initial Data (for demonstration purposes)
INSERT INTO Users (UserID, Username, PasswordHash, Role) VALUES (1, 'admin', 'hashed_password', 'Admin');
INSERT INTO Roles (RoleID, RoleName) VALUES (1, 'Admin');
INSERT INTO Categories (CategoryID, CategoryName) VALUES (1, 'General'), (2, 'Promotion');