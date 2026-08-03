import fs from 'fs'
import path from 'path'

const testDir = 'src/test'
const files = fs.readdirSync(testDir).filter((f) => f.endsWith('.test.ts'))

const replacements = [
  ['BAR_MODULE.adminNavItems).toHaveLength(25)', 'BAR_MODULE.adminNavItems).toHaveLength(26)'],
  ["getAdminNav(['bar'])).toHaveLength(25)", "getAdminNav(['bar'])).toHaveLength(26)"],
  ['getAdminNav(["bar"])).toHaveLength(25)', 'getAdminNav(["bar"])).toHaveLength(26)'],
  ['FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(23)', 'FOOD_TRUCK_MODULE.adminNavItems).toHaveLength(24)'],
  ['MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(23)', 'MOBILE_CAFE_MODULE.adminNavItems).toHaveLength(24)'],
  ["getAdminNav(['food_truck'])).toHaveLength(23)", "getAdminNav(['food_truck'])).toHaveLength(24)"],
  ['getAdminNav(["mobile_cafe"])).toHaveLength(23)', 'getAdminNav(["mobile_cafe"])).toHaveLength(24)'],
  ["getAdminNav(['mobile_cafe'])).toHaveLength(23)", "getAdminNav(['mobile_cafe'])).toHaveLength(24)"],
  ['RESTAURANT_MODULE.adminNavItems).toHaveLength(24)', 'RESTAURANT_MODULE.adminNavItems).toHaveLength(25)'],
  ['CAFE_MODULE.adminNavItems).toHaveLength(24)', 'CAFE_MODULE.adminNavItems).toHaveLength(25)'],
  ['FOOD_COURT_MODULE.adminNavItems).toHaveLength(24)', 'FOOD_COURT_MODULE.adminNavItems).toHaveLength(25)'],
  ["getAdminNav(['restaurant'])).toHaveLength(24)", "getAdminNav(['restaurant'])).toHaveLength(25)"],
  ["getAdminNav(['cafe'])).toHaveLength(24)", "getAdminNav(['cafe'])).toHaveLength(25)"],
  ["getAdminNav(['food_court'])).toHaveLength(24)", "getAdminNav(['food_court'])).toHaveLength(25)"],
  ['(RESTAURANT_MODULE.adminNavItems ?? []).length).toBe(24)', '(RESTAURANT_MODULE.adminNavItems ?? []).length).toBe(25)'],
  ['(CAFE_MODULE.adminNavItems ?? []).length).toBe(24)', '(CAFE_MODULE.adminNavItems ?? []).length).toBe(25)'],
  ['(BAR_MODULE.adminNavItems ?? []).length).toBe(25)', '(BAR_MODULE.adminNavItems ?? []).length).toBe(26)'],
  ['(FOOD_COURT_MODULE.adminNavItems ?? []).length).toBe(24)', '(FOOD_COURT_MODULE.adminNavItems ?? []).length).toBe(25)'],
  ['(FOOD_TRUCK_MODULE.adminNavItems ?? []).length).toBe(23)', '(FOOD_TRUCK_MODULE.adminNavItems ?? []).length).toBe(24)'],
  ['(MOBILE_CAFE_MODULE.adminNavItems ?? []).length).toBe(23)', '(MOBILE_CAFE_MODULE.adminNavItems ?? []).length).toBe(24)'],
]

let changed = 0
for (const file of files) {
  const fp = path.join(testDir, file)
  let content = fs.readFileSync(fp, 'utf8')
  const orig = content
  for (const [from, to] of replacements) {
    content = content.split(from).join(to)
  }
  if (content !== orig) {
    fs.writeFileSync(fp, content)
    changed++
    console.log('updated', file)
  }
}
console.log('files changed:', changed)
