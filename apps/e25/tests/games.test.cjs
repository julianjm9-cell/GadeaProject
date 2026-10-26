const test = require('node:test');
const assert = require('node:assert/strict');
const {topicQuiz, topicPairs, pairsScore} = require('../assets/eso-games.js');

const moduleData = {
  id: 'matematicas',
  tasks: [
    {id:'a',title:'Fracciones',detail:'Partes de un entero.',note:'Usa el mismo denominador.',example:'Un medio de una pizza.'},
    {id:'b',title:'Porcentajes',detail:'Partes de cada cien.',note:'Multiplica y divide entre cien.',example:'Un descuento del veinte por ciento.'},
    {id:'c',title:'Medidas',detail:'Unidades de magnitud.',note:'Comprueba la unidad final.',example:'Dos metros de tela.'},
    {id:'d',title:'Geometría',detail:'Formas y espacio.',note:'Dibuja la figura.',example:'El área de un rectángulo.'},
  ],
};

test('cada tema sin preguntas redactadas genera un reto jugable y estable', () => {
  for (const topic of moduleData.tasks) {
    const rounds = topicQuiz(topic, moduleData);
    assert.equal(rounds.length, 3);
    assert.deepEqual(rounds, topicQuiz(topic, moduleData));
    for (const round of rounds) {
      assert.ok(round.choices.length >= 3);
      assert.ok(round.correct >= 0 && round.correct < round.choices.length);
      assert.ok(round.choices[round.correct]);
    }
  }
});

test('las preguntas redactadas se usan antes que el reto derivado del tema', () => {
  const model = {a:{questions:[
    ['Uno', ['A','B'], 0, 'Por A'],
    ['Dos', ['A','B'], 1, 'Por B'],
    ['Tres', ['A','B'], 0, 'Por A'],
  ]}};
  const rounds = topicQuiz(moduleData.tasks[0], moduleData, model);
  assert.equal(rounds.length, 3);
  assert.equal(rounds[0].prompt, 'Uno');
  assert.equal(rounds[1].correct, 1);
});

test('las parejas tienen correspondencia única y puntúan los intentos', () => {
  const cards = topicPairs(moduleData.tasks[0], moduleData);
  assert.equal(cards.length, 8);
  const counts = new Map();
  for (const card of cards) counts.set(card.pair, (counts.get(card.pair) || 0) + 1);
  assert.deepEqual([...counts.values()], [2,2,2,2]);
  assert.equal(pairsScore(4,4), 100);
  assert.ok(pairsScore(8,4) < 100);
});
