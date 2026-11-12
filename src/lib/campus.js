// Which campus a student counts as for Banner's section restrictions.
//
// Banner names 13 campus codes, but every student we serve is on a UOS campus,
// so for now gender maps straight onto the two UOS codes. When students from
// other campuses are supported this becomes a profile field instead.
export const MEN = 'MAM';
export const WOMEN = 'MAW';

export function campusForGender(gender) {
    return gender === 'male' ? MEN : WOMEN;
}

// PostgREST filter for "this section admits my campus".
//
// The null branch is not optional: a section Banner places no campus rule on is
// open to everyone and stores null, so a containment test alone would hide
// every unrestricted section.
// A mixed section is one both men and women may register for. Decided by the
// allow-list, not by where it meets: a health-science lab can be open to both
// while meeting on "Medical Men's Campus", and a no-rule section (null) is open
// to everyone wherever it is.
export function isMixed(section) {
    const allowed = section?.allowed_campuses;
    return allowed == null || (allowed.includes(MEN) && allowed.includes(WOMEN));
}

export function campusFilter(gender) {
    const campus = campusForGender(gender);
    return `allowed_campuses.is.null,allowed_campuses.cs.{${campus}}`;
}
