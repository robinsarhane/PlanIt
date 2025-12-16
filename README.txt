PlanIt
======

PlanIt helps students create their schedules based on the university's available courses.
It uses a Node.js backend, a PostgreSQL database, and includes additional processing through Java and Python.

Requirements
------------

- Node.js (latest stable version recommended)
- PostgreSQL (local database setup)
- Java Development Kit (JDK) (for running Java code)
- Python (version compatible with spaCy, e.g., Python 3.11)
- Python libraries:
  - spacy (install using 'pip install spacy')

Setup Instructions
------------------

1. Open the Folder using any IDE

2. Database Setup:
   - Make sure you have a running PostgreSQL instance.
   - Create the necessary tables in your local database (8 tables are required):
	1 - subjects -> from database folder
		cols: subject (TEXT) || subject_name ([PK] TEXT)     
	2 - courses  -> from database folder
		cols: course_id ([PK] VARCHAR(10)) || subject (VARCHAR(5)) || course_number (VARCHAR(5)) || course_name (TEXT) || credits (INT)
	3 - sections -> from database folder
		cols: crn ([PK] INT) || section (VARCHAR(5)) || campus (INT) || course_id ([FK] VARCHAR(10)) || days (VARCHAR(6) || start_time (TIME WITHOUT TIME ZONE) || end_time (TIME WITHOUT TIME ZONE) || instructor (TEXT) || location (TEXT)
	4 - student_profile
		cols: student_id ([PK] INT SERIAL) || first_name (TEXT) || last_name (TEXT) || email (TEXT) || password (VARCHAR(60)) || supervisor (BOOLEAN)
	5 - student_course_selections
		cols:  student_id ([PK] INT) || course_Selection (VARCHAR[](10))
	6 - valid_schedules
		cols: schudule_id ([PK] VARCHAR(60)) || schedules (TEXT[])
	7 - history
		cols: student_id (INT) || schedule_name (TEXT) || schedule (TEXT)
	8 - inbox
		cols: student_id (INT) || message(TEXT) || read (BOOLEAN) || message_id (INT SERIAL) || name (TEXT)


3. Python Setup:
   - Ensure you have Python 3.11 (or a version that is compatible with spaCy) installed.
   - Install spaCy:
     pip install spacy

4. Java Setup:
   - Install JDK.
   - Make sure 'javac' and 'java' commands are available in your terminal.

5. Backend Setup:
   - Install Node.js dependencies:
     npm install
   - Start the backend server:
     node index.js


Enjoy your experience! ~ Developers
