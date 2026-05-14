# SRS Template - Modern Smart Restaurant Management System

## 1. Introduction
### 1.1 Purpose
This document defines the software requirements for a modern restaurant management system.

### 1.2 Scope
The system supports reservation, menu, ordering, kitchen workflow, billing, mock payment, inventory, loyalty, and dashboard.

## 2. Actors
- Guest
- Customer
- Receptionist
- Waiter
- Chef
- Cashier
- Manager
- Admin
- Inventory Staff

## 3. Functional Requirements
| ID | Requirement | Actor | Priority |
|---|---|---|---|
| FR-01 | Guest can view menu | Guest | Must |
| FR-02 | Customer can register and login | Customer | Must |
| FR-03 | Customer can reserve table | Customer | Must |
| FR-04 | Receptionist can confirm/reject reservation | Receptionist | Must |
| FR-05 | Customer/Waiter can create order | Customer/Waiter | Must |
| FR-06 | Chef can update cooking status | Chef | Must |
| FR-07 | Cashier can generate bill | Cashier | Must |
| FR-08 | Cashier can process mock payment | Cashier | Must |
| FR-09 | Manager can view dashboard | Manager | Should |
| FR-10 | Inventory Staff can update stock | Inventory Staff | Should |
| FR-11 | Customer can receive loyalty points | Customer | Should |
| FR-12 | Admin can manage users and roles | Admin | Must |

## 4. Non-functional Requirements
- Role-based access control
- Password encryption
- Responsive UI
- RESTful API
- Input validation against SQL Injection and XSS
- MVC/layered architecture

## 5. Use Case List
- Login/Register
- Reserve Table
- Manage Reservation
- View Menu
- Manage Menu
- Create Order
- Manage Kitchen Queue
- Generate Bill
- Process Mock Payment
- Manage Inventory
- View Dashboard
- Manage Users and Roles
