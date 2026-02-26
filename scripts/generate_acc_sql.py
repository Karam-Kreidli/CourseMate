
import re

text = """
0301327 Department of Accounting Taxation and Zakat
0301425 Department of Accounting Financial Statement Analysis
0302254 Department of Management Business Communicationl
0302383 Department of Management Business and Government
0308334 Department of Finance and Economics Real Estate Finance
0308450 Department of Finance and Economics Money and Banking
1503211 Department of Buisiness Information Systems Business Analytics
1503228 Department of Buisiness Information Systems E-Business
0302461 Department of Management Research Methods
0302467 Department of Management Strategic Management
0308151 Department of Finance and Economics Principles of Microeconomics
0308230 Department of Finance and Economics Financial Management
0308252 Department of Finance and Economics Principles of Macroeconomics
1440100 Department of Mathematics Mathematics for Business
1440264 Department of Mathematics Business Statistics
1503130 Department of Buisiness Information Systems Introducation to BIS
0301120 Department of Accounting Financial Accounting
0301211 Department of Accounting Managerial Accounting
0302160 Department of Management Principles of Management
0302170 Department of Management Principles of Marketing
0302250 Department of Management Legal Environment of Business
0302262 Department of Management Organizational Behavior
0302350 Department of Management Ethics and Islamic Val. In Bus
0302361 Department of Management Operat. And Supply Chain Mgt.
0302461 Department of Management Research Methods
0302467 Department of Management Strategic Management
0308151 Department of Finance and Economics Principles of Microeconomics
0308331 Department of Finance and Economics Corporate Finance
0308332 Department of Finance and Economics Investment Analysis
0308334 Department of Finance and Economics Real Estate Finance
0308361 Department of Finance and Economics Banking Operations Management
0308362 Department of Finance and Economics Intro. to Islamic Bank. & Fin.
0308365 Department of Finance and Economics Risk Management
0308430 Department of Finance and Economics International Financial Manag.
0308431 Department of Finance and Economics Financial Markets and Instit.
0308461 Department of Finance and Economics Credit Analy. and Lending Mng.
0308230 Department of Finance and Economics Financial Management
0301324 Department of Accounting Government &Non-Profit Acct(A)
0301325 Department of Accounting International Accounting
0301310 Department of Accounting Cost and Management Accounting
0301321 Department of Accounting Intermediate Accounting I
0301322 Department of Accounting Intermediate Accounting II
0301329 Department of Accounting Accounting Internship
0301420 Department of Accounting Advanced Financial Accounting
0301421 Department of Accounting Auditing Principles
0301429 Department of Accounting Accounting Seminar
0103103 College of Sharia & Islamic Studies Islamic System
0103104 College of Sharia & Islamic Studies Prof. Ethics in Islamic Sharia
0104100 College of Sharia & Islamic Studies Islamic Culture
0104130 College of Sharia & Islamic Studies Analytical Biog of the Prophet
0201102 College of Arts & Humanities Arabic Language
0201140 College of Arts & Humanities Intro. to Arabic Literature
0202112 College of Arts & Humanities English for Academic Purposes
0202130 College of Arts & Humanities French Language
0202227 College of Arts & Humanities Critical Reading and Writing
0203100 College of Arts & Humanities Islamic Civilization
0203102 College of Arts & Humanities History of the Arabian Gulf
0203200 College of Arts & Humanities Hist of Sciences among Muslims
0204102 College of Arts & Humanities UAE Society
0204103 College of Arts & Humanities Principles of Sign Language
0206102 College of Arts & Humanities Fundamentals/Islamic Education
0206103 College of Arts & Humanities Introduction to Psychology
0302150 College of Business Administration Intro.to Bus for Non-Bus.
0302200 College of Business Administration Fund. of Innovation & Entrep.
0308131 College of Business Administration Personal Finance
0308150 College of Business Administration Intro to Economics(Non-B)
0401142 College of Sciences Man and The Environment
0406102 College of Sciences Introduction to Sustainability
0503101 College of Health Sciences Health and Safety
0505100 College of Health Sciences Understanding Disabilities
0505101 College of Health Sciences Fitness and Wellness
0507101 College of Health Sciences Health Awareness and Nutrition
0601109 College of Law Legal Culture
0602246 College of Law Human Rights in Islam
0700100 College of Fine Arts & Design Intro to Islamic Art & Design
0800107 College of Communication Media in Modern Societies
0900107 College of Medicine History of Medical and H.Sc.
1602100 College of Education Smart & Effec. Learning Skills
1501100 Department of Computer Science Introduction to IT (English)
"""

# Additional courses embedded in the list logic... I will just parse this block.
# I had a bug in previous thought where I didn't see the text. Now I have it.

parsed_courses = []
seen_codes = set()

lines = text.strip().split('\n')
for line in lines:
    line = line.strip()
    if not line:
        continue
    
# Known departments list (longest matches first)
KNOWN_DEPARTMENTS = [
    "Department of Buisiness Information Systems", # Handle typo in source
    "Department of Business Information Systems",
    "Department of Finance and Economics",
    "Department of Accounting",
    "Department of Management",
    "Department of Mathematics",
    "Department of Computer Science",
    "College of Sharia & Islamic Studies",
    "College of Arts & Humanities",
    "College of Business Administration",
    "College of Health Sciences",
    "College of Fine Arts & Design",
    "College of Sciences",
    "College of Communication",
    "College of Medicine",
    "College of Education",
    "College of Law"
]

parsed_courses = []
seen_codes = set()

lines = text.strip().split('\n')
for line in lines:
    line = line.strip()
    if not line:
        continue
    
    # Try to match code first
    code_match = re.match(r"^(\d+)\s+(.+)$", line)
    if not code_match:
        print(f"Skipping malformed line: {line}")
        continue
        
    code = code_match.group(1)
    rest = code_match.group(2)
    
    matched_dept = None
    course_name = None
    
    for dept in KNOWN_DEPARTMENTS:
        if rest.startswith(dept):
            matched_dept = dept
            # The rest of the string after dept is the name
            # Remove dept and leading whitespace
            course_name = rest[len(dept):].strip()
            break
    
    if matched_dept:
        if code in seen_codes:
            continue
        seen_codes.add(code)
        
        # Cleanup typos
        clean_dept = matched_dept.replace("Buisiness", "Business")
        
        parsed_courses.append({
            "id": code,
            "dept": clean_dept,
            "name": course_name,
            "college_code": code[:4],
            "course_number": code[4:]
        })
    else:
        print(f"Could not parse department for line: {line}")

# Generate SQL
sql_lines = []
sql_lines.append("-- =====================================================")
sql_lines.append("-- ACCOUNTING MAJOR COURSES")
sql_lines.append("-- Generated by script")
sql_lines.append("-- =====================================================")
sql_lines.append("")
sql_lines.append("-- STEP 1: Add Accounting major")
sql_lines.append("INSERT INTO majors (code, name, college) VALUES")
sql_lines.append("    ('ACC', 'Accounting', 'College of Business Administration')")
sql_lines.append("ON CONFLICT (code) DO NOTHING;")
sql_lines.append("")
sql_lines.append("-- STEP 2: Add missing courses")
sql_lines.append("INSERT INTO courses (course_id, college_code, college_name, course_number, course_name) VALUES")

values_list = []
for c in parsed_courses:
    # Escape quotes
    safe_name = c['name'].replace("'", "''")
    safe_dept = c['dept'].replace("'", "''")
    values_list.append(f"('{c['id']}', '{c['college_code']}', '{safe_dept}', '{c['course_number']}', '{safe_name}')")

sql_lines.append(",\n".join(values_list))
sql_lines.append("ON CONFLICT (course_id) DO UPDATE SET")
sql_lines.append("    course_name = EXCLUDED.course_name,")
sql_lines.append("    college_name = EXCLUDED.college_name;")
sql_lines.append("")
sql_lines.append("-- STEP 3: Link courses to Accounting major")
sql_lines.append("INSERT INTO major_courses (major_code, course_id) VALUES")

link_values = []
for c in parsed_courses:
    link_values.append(f"('ACC', '{c['id']}')")

sql_lines.append(",\n".join(link_values))
sql_lines.append("ON CONFLICT (major_code, course_id) DO NOTHING;")

final_sql = "\n".join(sql_lines)

# Write directly to the supabase file instead of printing
with open(r'c:\Users\karoo\University\CourseMate\supabase\add_accounting_courses.sql', 'w', encoding='utf-8') as f:
    f.write(final_sql)

print("SQL file generated successfully.")
