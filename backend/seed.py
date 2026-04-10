"""Seed the MongoDB database with sample data."""
from db import classrooms_col, departments_col, teachers_col, timetable_col, users_col


def seed():
    print("[*] Seeding database...")

    # Clear existing data
    classrooms_col.delete_many({})
    departments_col.delete_many({})
    teachers_col.delete_many({})
    timetable_col.delete_many({})
    users_col.delete_many({})

    # --- Departments ---
    departments = [
        {"name": "Computer Science & Engineering", "building": "Block A", "hod": "Dr. Sanjay"},
        {"name": "CSE (Cyber Security)", "building": "Block A", "hod": "Dr. Ramesh"},
        {"name": "CSE (Data Science)", "building": "Block A", "hod": "Dr. Suresh"},
        {"name": "CSE (IoT)", "building": "Block A", "hod": "Dr. Kiran"},
        {"name": "CSE (Cloud Computing)", "building": "Block A", "hod": "Dr. Amit"},
        {"name": "CSE (AI & ML)", "building": "Block A", "hod": "Dr. Anita"},
        {"name": "Information Science & Engineering (ISE)", "building": "Block A", "hod": "Dr. Meena"},
        {"name": "Electronics & Communication Engineering", "building": "Block B", "hod": "Dr. Rajesh"},
        {"name": "Electrical & Electronics Engineering", "building": "Block B", "hod": "Dr. Vinay"},
        {"name": "Mechanical Engineering", "building": "Block C", "hod": "Dr. Suresh"},
        {"name": "Civil Engineering", "building": "Block C", "hod": "Dr. Mahesh"},
        {"name": "Robotics & Automation", "building": "Block D", "hod": "Dr. Kiran"},
        {"name": "Biotechnology", "building": "Block E", "hod": "Dr. Swathi"},
    ]
    departments_col.insert_many(departments)
    print(f"  [OK] {len(departments)} departments added")

    # --- Classrooms ---
    classrooms = [
        {"name": "CS Lab 1", "department": "Computer Science & Engineering", "building": "Block A", "floor": "1st Floor", "room_number": "A-101", "type": "laboratory", "capacity": 60, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "CS Room 102", "department": "Computer Science & Engineering", "building": "Block A", "floor": "1st Floor", "room_number": "A-102", "type": "classroom", "capacity": 80, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "CS Room 201", "department": "Computer Science & Engineering", "building": "Block A", "floor": "2nd Floor", "room_number": "A-201", "type": "classroom", "capacity": 75, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "EC Lab 1", "department": "Electronics & Communication Engineering", "building": "Block B", "floor": "Ground Floor", "room_number": "B-001", "type": "laboratory", "capacity": 40, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "EC Room 101", "department": "Electronics & Communication Engineering", "building": "Block B", "floor": "1st Floor", "room_number": "B-101", "type": "classroom", "capacity": 70, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "ME Workshop", "department": "Mechanical Engineering", "building": "Block C", "floor": "Ground Floor", "room_number": "C-001", "type": "laboratory", "capacity": 50, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "ME Room 201", "department": "Mechanical Engineering", "building": "Block C", "floor": "2nd Floor", "room_number": "C-201", "type": "classroom", "capacity": 65, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "CE Room 101", "department": "Civil Engineering", "building": "Block D", "floor": "1st Floor", "room_number": "D-101", "type": "classroom", "capacity": 70, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "IT Lab 1", "department": "Information Science & Engineering (ISE)", "building": "Block A", "floor": "3rd Floor", "room_number": "A-301", "type": "laboratory", "capacity": 55, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "IT Room 302", "department": "Information Science & Engineering (ISE)", "building": "Block A", "floor": "3rd Floor", "room_number": "A-302", "type": "classroom", "capacity": 80, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "Seminar Hall", "department": "Computer Science & Engineering", "building": "Block A", "floor": "Ground Floor", "room_number": "A-001", "type": "hall", "capacity": 200, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
        {"name": "HOD Chamber - CS", "department": "Computer Science & Engineering", "building": "Block A", "floor": "2nd Floor", "room_number": "A-210", "type": "chamber", "capacity": 5, "status": "free", "current_subject": "", "current_teacher": "", "current_teacher_id": ""},
    ]
    classrooms_col.insert_many(classrooms)
    print(f"  [OK] {len(classrooms)} classrooms added")

    # --- Teachers & Users ---
    teachers_data = [
        {"name": "Prof. Rajesh Kumar", "department": "Computer Science & Engineering", "subjects": ["Data Structures", "Algorithms"], "assigned_classrooms": ["CS Lab 1", "CS Room 102"], "username": "rajesh"},
        {"name": "Prof. Priya Sharma", "department": "Computer Science & Engineering", "subjects": ["Machine Learning", "AI"], "assigned_classrooms": ["CS Room 201", "CS Lab 1"], "username": "priya"},
        {"name": "Prof. Amit Patel", "department": "Electronics & Communication Engineering", "subjects": ["Digital Electronics", "VLSI"], "assigned_classrooms": ["EC Lab 1", "EC Room 101"], "username": "amit"},
        {"name": "Prof. Sneha Gupta", "department": "Information Science & Engineering (ISE)", "subjects": ["Web Development", "DBMS"], "assigned_classrooms": ["IT Lab 1", "IT Room 302"], "username": "sneha"},
        {"name": "Prof. Vikram Singh", "department": "Mechanical Engineering", "subjects": ["Thermodynamics", "Fluid Mechanics"], "assigned_classrooms": ["ME Workshop", "ME Room 201"], "username": "vikram"},
    ]

    for t in teachers_data:
        result = teachers_col.insert_one({
            "name": t["name"],
            "department": t["department"],
            "subjects": t["subjects"],
            "assigned_classrooms": t["assigned_classrooms"],
            "username": t["username"],
        })
        users_col.insert_one({
            "username": t["username"],
            "password": "password123",
            "role": "teacher",
            "name": t["name"],
            "teacher_id": str(result.inserted_id),
        })

    print(f"  [OK] {len(teachers_data)} teachers added")

    # Admin user
    users_col.insert_one({
        "username": "admin",
        "password": "admin123",
        "role": "admin",
        "name": "Administrator",
    })
    print("  [OK] Admin user added (admin / admin123)")

    # --- Timetable ---
    timetable_entries = [
        {"day": "Monday", "time_slot": "09:00-10:00", "subject": "Data Structures", "teacher": "Prof. Rajesh Kumar", "classroom": "CS Room 102", "department": "Computer Science & Engineering"},
        {"day": "Monday", "time_slot": "10:00-11:00", "subject": "Machine Learning", "teacher": "Prof. Priya Sharma", "classroom": "CS Lab 1", "department": "Computer Science & Engineering"},
        {"day": "Monday", "time_slot": "11:00-12:00", "subject": "Digital Electronics", "teacher": "Prof. Amit Patel", "classroom": "EC Lab 1", "department": "Electronics & Communication Engineering"},
        {"day": "Monday", "time_slot": "14:00-15:00", "subject": "Web Development", "teacher": "Prof. Sneha Gupta", "classroom": "IT Lab 1", "department": "Information Science & Engineering (ISE)"},
        {"day": "Tuesday", "time_slot": "09:00-10:00", "subject": "Algorithms", "teacher": "Prof. Rajesh Kumar", "classroom": "CS Room 201", "department": "Computer Science & Engineering"},
        {"day": "Tuesday", "time_slot": "10:00-11:00", "subject": "VLSI", "teacher": "Prof. Amit Patel", "classroom": "EC Room 101", "department": "Electronics & Communication Engineering"},
        {"day": "Tuesday", "time_slot": "11:00-12:00", "subject": "Thermodynamics", "teacher": "Prof. Vikram Singh", "classroom": "ME Room 201", "department": "Mechanical Engineering"},
        {"day": "Tuesday", "time_slot": "14:00-15:00", "subject": "DBMS", "teacher": "Prof. Sneha Gupta", "classroom": "IT Room 302", "department": "Information Science & Engineering (ISE)"},
        {"day": "Wednesday", "time_slot": "09:00-10:00", "subject": "AI", "teacher": "Prof. Priya Sharma", "classroom": "CS Room 201", "department": "Computer Science & Engineering"},
        {"day": "Wednesday", "time_slot": "10:00-11:00", "subject": "Fluid Mechanics", "teacher": "Prof. Vikram Singh", "classroom": "ME Workshop", "department": "Mechanical Engineering"},
        {"day": "Wednesday", "time_slot": "11:00-12:00", "subject": "Data Structures Lab", "teacher": "Prof. Rajesh Kumar", "classroom": "CS Lab 1", "department": "Computer Science & Engineering"},
        {"day": "Thursday", "time_slot": "09:00-10:00", "subject": "Digital Electronics", "teacher": "Prof. Amit Patel", "classroom": "EC Lab 1", "department": "Electronics & Communication Engineering"},
        {"day": "Thursday", "time_slot": "10:00-11:00", "subject": "Machine Learning Lab", "teacher": "Prof. Priya Sharma", "classroom": "CS Lab 1", "department": "Computer Science & Engineering"},
        {"day": "Thursday", "time_slot": "14:00-15:00", "subject": "Web Development Lab", "teacher": "Prof. Sneha Gupta", "classroom": "IT Lab 1", "department": "Information Science & Engineering (ISE)"},
        {"day": "Friday", "time_slot": "09:00-10:00", "subject": "Algorithms", "teacher": "Prof. Rajesh Kumar", "classroom": "CS Room 102", "department": "Computer Science & Engineering"},
        {"day": "Friday", "time_slot": "10:00-11:00", "subject": "VLSI Lab", "teacher": "Prof. Amit Patel", "classroom": "EC Lab 1", "department": "Electronics & Communication Engineering"},
        {"day": "Friday", "time_slot": "11:00-12:00", "subject": "Thermodynamics", "teacher": "Prof. Vikram Singh", "classroom": "ME Room 201", "department": "Mechanical Engineering"},
        {"day": "Friday", "time_slot": "14:00-15:00", "subject": "DBMS Lab", "teacher": "Prof. Sneha Gupta", "classroom": "IT Lab 1", "department": "Information Science & Engineering (ISE)"},
    ]
    timetable_col.insert_many(timetable_entries)
    print(f"  [OK] {len(timetable_entries)} timetable entries added")

    print("\n[SUCCESS] Database seeded successfully!")
    print("\n[INFO] Login Credentials:")
    print("  Admin: admin / admin123")
    print("  Teachers: rajesh, priya, amit, sneha, vikram / password123")


if __name__ == "__main__":
    seed()
