const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('apps/profesor/profesor-subjects.js', 'utf8');
function visibility(profile, material) {
  const context = vm.createContext({window: {}, state: {teacherProfile: profile}, materialCourseValue: item => item.course || ''});
  vm.runInContext(source, context);
  return context.teacherMaterialVisible(material);
}

test('published materials require subject and course when the teacher filters both', () => {
  const profile = {subjects: ['Matemáticas'], courses: ['3.º ESO']};
  assert.equal(visibility(profile, {id: 'public:1', subject: 'Matemáticas', course: '3.º ESO'}), true);
  assert.equal(visibility(profile, {id: 'public:2', subject: 'Matemáticas', course: '2.º ESO'}), false);
  assert.equal(visibility(profile, {id: 'public:3', subject: 'Lengua', course: '3.º ESO'}), false);
  assert.equal(visibility(profile, {id: 'public:4', subject: 'Matemáticas'}), false);
  assert.equal(visibility(profile, {id: 'public:5', course: '3.º ESO'}), false);
});

test('personal materials with missing labels remain available for editing', () => {
  const profile = {subjects: ['Matemáticas'], courses: ['3.º ESO']};
  assert.equal(visibility(profile, {id: 'own-1'}), true);
});
