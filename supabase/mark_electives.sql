-- =====================================================
-- MARK ELECTIVES SCRIPT
-- Use this script to mark courses as University Electives or Major Electives
-- =====================================================

-- Basket 1 courses
UPDATE courses
SET university_elective_basket = 'Basket 1'
WHERE course_id IN (
    '0103103',
    '0103104',
    '0104130',
    '0201140',
    '0202130',
    '0203100',
    '0203102',
    '0203200',
    '0204103',
    '0206102',
    '0206103',
    '0302150',
    '0308131',
    '0308150',
    '0601109',
    '0602246',
    '0700100',
    '0800107',
    '0900107',
    '1602100'
);

-- Basket 2 courses
UPDATE courses
SET university_elective_basket = 'Basket 2'
WHERE course_id IN (
    '0401142',
    '0406102',
    '0503101',
    '0505100',
    '0505101',
    '0507101',
    '1430101',
    '1450100',
    '1502133'
);


