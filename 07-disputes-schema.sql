-- 07-disputes-schema.sql
-- Complete Schema for Disputes and Related Tables

-- Disputes Table
CREATE TABLE disputes (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Sample Data for Disputes
INSERT INTO disputes (user_id, status) VALUES (1, 'open'), (2, 'resolved');

-- Dispute Messages Table
CREATE TABLE dispute_messages (
    id SERIAL PRIMARY KEY,
    dispute_id INT NOT NULL,
    message TEXT NOT NULL,
    sender_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dispute FOREIGN KEY(dispute_id) REFERENCES disputes(id),
    CONSTRAINT fk_sender FOREIGN KEY(sender_id) REFERENCES users(id)
);

-- Sample Data for Dispute Messages
INSERT INTO dispute_messages (dispute_id, message, sender_id) VALUES (1, 'I want to dispute this transaction.', 1);

-- Refunds Table
CREATE TABLE refunds (
    id SERIAL PRIMARY KEY,
    dispute_id INT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dispute_refund FOREIGN KEY(dispute_id) REFERENCES disputes(id)
);

-- Sample Data for Refunds
INSERT INTO refunds (dispute_id, amount, status) VALUES (1, 50.00, 'processed');

-- Support Tickets Table
CREATE TABLE support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_ticket FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Sample Data for Support Tickets
INSERT INTO support_tickets (user_id, subject, status) VALUES (1, 'Issue with my order', 'open');

-- Ticket Replies Table
CREATE TABLE ticket_replies (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL,
    message TEXT NOT NULL,
    sender_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_ticket_reply FOREIGN KEY(ticket_id) REFERENCES support_tickets(id),
    CONSTRAINT fk_sender_reply FOREIGN KEY(sender_id) REFERENCES users(id)
);

-- Sample Data for Ticket Replies
INSERT INTO ticket_replies (ticket_id, message, sender_id) VALUES (1, 'We are looking into your issue.', 2);

-- Support Categories Table
CREATE TABLE support_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data for Support Categories
INSERT INTO support_categories (name) VALUES ('Billing'), ('Technical Support');

-- FAQ Articles Table
CREATE TABLE faq_articles (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sample Data for FAQ Articles
INSERT INTO faq_articles (question, answer) VALUES ('How to reset my password?', 'Follow the steps in the settings.');

-- Notifications Table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_notification FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Sample Data for Notifications
INSERT INTO notifications (user_id, message) VALUES (1, 'You have a new message.');

-- Feedback Table
CREATE TABLE feedback (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    rating INT CHECK(rating BETWEEN 1 AND 5),
    comments TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_feedback FOREIGN KEY(user_id) REFERENCES users(id)
);

-- Sample Data for Feedback
INSERT INTO feedback (user_id, rating, comments) VALUES (1, 5, 'Great service!');

-- Escalations Table
CREATE TABLE escalations (
    id SERIAL PRIMARY KEY,
    dispute_id INT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dispute_escalation FOREIGN KEY(dispute_id) REFERENCES disputes(id)
);

-- Sample Data for Escalations
INSERT INTO escalations (dispute_id, reason) VALUES (1, 'Need higher management attention.');
