
import re

text = """
103103 College of Sharia & Islamic Studies Islamic System
103104 College of Sharia & Islamic Studies Prof. Ethics in Islamic Sharia
104100 College of Sharia & Islamic Studies Islamic Culture
104130 College of Sharia & Islamic Studies Analytical Biog of the Prophet
201102 College of Arts & Humanities Arabic Language
201140 College of Arts & Humanities Intro. to Arabic Literature
202112 College of Arts & Humanities English for Academic Purposes
202130 College of Arts & Humanities French Language
202227 College of Arts & Humanities Critical Reading and Writing
203100 College of Arts & Humanities Islamic Civilization
203102 College of Arts & Humanities History of the Arabian Gulf
203200 College of Arts & Humanities Hist of Sciences among Muslims
204102 College of Arts & Humanities UAE Society
204103 College of Arts & Humanities Principles of Sign Language
206102 College of Arts & Humanities Fundamentals/Islamic Education
206103 College of Arts & Humanities Introduction to Psychology
302150 College of Business Administration Intro.to Bus for Non-Bus.
302200 College of Business Administration Fund. of Innovation & Entrep.
308131 College of Business Administration Personal Finance
308150 College of Business Administration Intro to Economics(Non-B)
401142 College of Sciences Man and The Environment
406102 College of Sciences Introduction to Sustainability
503101 College of Health Sciences Health and Safety
505100 College of Health Sciences Understanding Disabilities
505101 College of Health Sciences Fitness and Wellness
507101 College of Health Sciences Health Awareness and Nutrition
601109 College of Law Legal Culture
602246 College of Law Human Rights in Islam
700100 College of Fine Arts & Design Intro to Islamic Art & Design
800107 College of Communication Media in Modern Societies
900107 College of Medicine History of Medical and H.Sc.
1602100 College of Education Smart & Effec. Learning Skills
1501100 Department of Computer Science Introduction to IT (English)
1430101 Department of Physics Astro & Space Sciences
1450100 Department of Biology Biology and Society
0402434 Department of Electrical Engineering Digital Control Systems
0402436 Department of Electrical Engineering Applied Control Engneering
0408345 Department of Mechanical Engineering Mechanical Vibrations
0408442 Department of Mechanical Engineering Reverse Engineering
0408443 Department of Mechanical Engineering MEMS and NEMS
0408444 Department of Mechanical Engineering Autotronics
0408445 Department of Mechanical Engineering Smart Materials
0408446 Department of Mechanical Engineering Intro. to Est and K.F.
0408447 Department of Mechanical Engineering Intelligent Robotics
0408449 Department of Mechanical Engineering Special Topics in MRE
1502416 Department of Computer Engineering Real-Time Systems Design
1502446 Department of Computer Engineering Computational Vision
0408457 Department of Mechanical Engineering Mech. System Design & Integ.
1430118 Department of Physics Physics 2 Lab
1501113 Department of Computer Science Programming for Engineers
1502244 Department of Computer Engineering Digital Systems
1502344 Department of Computer Engineering Microcontroller Systems
1502410 Department of Computer Engineering Artificial Intelligence Eng.
0408318 Department of Mechanical Engineering Instrumentation & Measurements
0408320 Department of Mechanical Engineering Mod. & Control of Dynamic Sys.
0408351 Department of Mechanical Engineering C & M Manufacturing Pro.
0408352 Department of Mechanical Engineering Engineering Analysis for MRE
0408451 Department of Mechanical Engineering Senior Design Project I
0408452 Department of Mechanical Engineering Senior Design Project II
0408453 Department of Mechanical Engineering Practical Training I in MRE
0408454 Department of Mechanical Engineering Practical Training II in MRE
0408455 Department of Mechanical Engineering Robotics & Automation 1
0408456 Department of Mechanical Engineering Robotics & Automation 2
0202207 Department of Foreign Languages & Literature Technical Writing
0401301 Department of Civil Engineering Engineering Economics
1420101 Department of Chemistry General Chemistry (1)
1420102 Department of Chemistry General Chemistry (1 ) Lab
1430106 Department of Physics Remedial Physics
1430115 Department of Physics Physics 1
1430116 Department of Physics Physics 1 Lab
1430117 Department of Physics Physics 2
1440098 Department of Mathematics Remedial Math
1440133 Department of Mathematics Calculus I for Engineering
1440161 Department of Mathematics Calculus II for Engineers
1440261 Department of Mathematics Diff. Equs for Engs
0402207 Department of Electrical Engineering Applied Electronic Circuits
0402210 Department of Electrical Engineering Industrial Power Electronics
0402211 Department of Electrical Engineering Electrical Drive and Actuators
0402349 Department of Electrical Engineering Analog & Digital Signal Proc.
0405221 Department of Industrial Engineering Eng. Probability & Statistics
0408151 Department of Mechanical Engineering Introduction to MRE
0408200 Department of Mechanical Engineering Dynamics for Mechanical Eng.
0408251 Department of Mechanical Engineering Statics & Strength of Mat.
0408252 Department of Mechanical Engineering Fluid and Thermal Sciences
0408253 Department of Mechanical Engineering Mechanical Components Design
0408300 Department of Mechanical Engineering Analytical Methods in Eng.
"""

# Known departments list (longest matches first)
KNOWN_DEPARTMENTS = [
    "Department of Buisiness Information Systems", 
    "Department of Business Information Systems",
    "Department of Finance and Economics",
    "Department of Accounting",
    "Department of Management",
    "Department of Mathematics",
    "Department of Computer Science",
    "Department of Computer Engineering",
    "Department of Electrical Engineering",
    "Department of Mechanical Engineering",
    "Department of Civil Engineering",
    "Department of Industrial Engineering",
    "Department of Physics",
    "Department of Biology",
    "Department of Foreign Languages & Literature",
    "Department of Chemistry",
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
        # Some codes in the image text might have leading zeros stripped or weird spacing
        print(f"Skipping malformed line: {line}")
        continue
        
    code = code_match.group(1)
    # Pad code to 7 digits if it's 6 digits (common issue with some inputs)
    # But wait, looking at the input, checks: 103103 -> 6 digits?
    # Actually UOS codes are usually 7 digits.
    # The input text seems to have missed leading zeros for some College courses.
    # E.g. '103103' should likely be '0103103' based on `add_accounting_courses.sql`?
    # Let's check `add_accounting_courses.sql` for '103103'.
    # It has '0103103'. So yes, leading zeros are missing for College courses (starts with 01, 02, etc).
    # Heuristic: If length is 6, prepend '0'.
    
    if len(code) == 6:
        code = '0' + code
        
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
            
    if not matched_dept:
         # Try flexible matching if exact string not found (e.g. spacing issues)
         # But for now, let's print and see.
         # Actually, "Department of Foreign Languages & Literature" might be tricky if "Foreign Languages" is key.
         pass
    
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
sql_lines.append("-- MECHATRONICS AND ROBOTICS ENGINEERING MAJOR COURSES")
sql_lines.append("-- Generated by script")
sql_lines.append("-- =====================================================")
sql_lines.append("")
sql_lines.append("-- STEP 1: Add MRE major")
sql_lines.append("INSERT INTO majors (code, name, college) VALUES")
sql_lines.append("    ('MRE', 'Mechatronics and Robotics Engineering', 'College of Engineering')")
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
sql_lines.append("-- STEP 3: Link courses to MRE major")
sql_lines.append("INSERT INTO major_courses (major_code, course_id) VALUES")

link_values = []
for c in parsed_courses:
    link_values.append(f"('MRE', '{c['id']}')")

sql_lines.append(",\n".join(link_values))
sql_lines.append("ON CONFLICT (major_code, course_id) DO NOTHING;")

final_sql = "\n".join(sql_lines)

# Write directly to the supabase file instead of printing
with open(r'c:\Users\karoo\University\Course Swap\supabase\add_mre_courses.sql', 'w', encoding='utf-8') as f:
    f.write(final_sql)

print("SQL file generated successfully.")
