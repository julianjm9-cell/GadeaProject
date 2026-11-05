const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {existsSync} = require('node:fs');
const {chromium} = require('C:/Users/julia/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

test('las 57 misiones restantes usan objetos jugables y mantienen su corrección', async () => {
  const browser = await chromium.launch({headless:true,channel:'msedge'});
  try {
    const featured = new Set(['mat-numeros','mat-proporciones','mat-finanzas','mat-problemas','ing-reading','ing-vocabulary','ing-grammar','ing-writing']);
    const sampleKinds = new Set();
    for (const [width,height] of [[1366,768],[390,844]]) {
      const page = await browser.newPage({viewport:{width,height}});
      const errors = [];
      page.on('pageerror',error=>errors.push(error.message));
      await page.goto(pathToFileURL(resolve('apps/e25/index.html')).href+'?demo=1');
      const missions = await page.evaluate(() => MODULES.filter(module=>['ingles','lengua','geografia','historia','matematicas','ciencias'].includes(module.id)).flatMap(module=>module.tasks.map(topic=>({id:topic.id,module:module.id,board:EsoAdultGames.missionBoard(topic),art:EsoAdultGames.topicArt(topic,module)}))));
      assert.equal(missions.length,65);
      assert.equal(missions.filter(item=>item.board).length,57);
      assert.equal(new Set(missions.filter(item=>item.board).map(item=>item.art)).size,57,'cada misión restante tiene una escena visual distinta');
      for (const mission of missions.filter(item=>!featured.has(item.id))) {
        assert.ok(mission.board,`${mission.id} lacks scene design`);
        assert.ok(['document','map','dialogue','lab','route','dashboard','archive','ledger'].includes(mission.board.kind));
        assert.ok(existsSync(resolve('apps/profesor/assets/games',mission.art.split('/').at(-1))),`${mission.id} lacks artwork`);
        await page.evaluate(id=>startGame(id,'quest'),mission.id);
        const run=page.locator('.eso-object-run');
        assert.equal(await run.getAttribute('data-mission'),mission.id);
        assert.equal(await run.locator('.eso-object-answers button').count(),3);
        assert.equal(await run.locator('.eso-object-artefact > span').count(),4);
        const box=await page.evaluate(() => {
          const board=document.querySelector('.eso-object-board'),surface=board.querySelector('.eso-object-surface'),answers=board.querySelector('.eso-object-answers');
          const outer=board.getBoundingClientRect(),paper=surface.getBoundingClientRect(),choices=answers.getBoundingClientRect();
          return {overflow:board.scrollWidth-board.clientWidth,pageOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,paperOverflow:surface.scrollHeight-surface.clientHeight,paperLeft:paper.left-outer.left,paperRight:outer.right-paper.right,choicesLeft:choices.left-outer.left,choicesRight:outer.right-choices.right};
        });
        assert.ok(box.overflow<=2,`${mission.id} ${width}: ${JSON.stringify(box)}`);
        assert.ok(box.pageOverflow<=2,`${mission.id} ${width}: page overflows ${JSON.stringify(box)}`);
        assert.ok(box.paperOverflow<=2,`${mission.id} ${width}: content clipped in object ${JSON.stringify(box)}`);
        assert.ok(box.paperLeft>=-2&&box.paperRight>=-2&&box.choicesLeft>=-2&&box.choicesRight>=-2,`${mission.id} ${width}: clipped object`);
        if (!sampleKinds.has(mission.board.kind) && width===1366) {
          sampleKinds.add(mission.board.kind);
          await page.locator('.eso-object-board img').evaluate(img=>img.decode());
          const stages=await page.evaluate(id=>{const module=MODULES.find(mod=>mod.tasks.some(topic=>topic.id===id));const topic=module.tasks.find(item=>item.id===id);return EsoAdultGames.topicQuest(topic,module,MODEL_UNITS).stations;},mission.id);
          for (let i=0;i<stages.length;i++) {
            const wrong=(stages[i].correct+1)%3;
            await page.locator('.eso-object-answers button').nth(wrong).click();
            assert.equal(await page.locator('.eso-object-answers button.wrong').count(),1);
            await page.locator('.eso-object-answers button').nth(stages[i].correct).click();
            assert.equal(await page.locator('.eso-object-board').getAttribute('data-solved'),'true');
            assert.equal(await page.locator('.eso-object-artefact > span.complete').count(),i+1);
            await page.locator('.eso-object-feedback button').click();
          }
          assert.equal(await page.locator('.eso-game-result').count(),1);
        }
        if (mission.board.layout==='focus-right' && width===1366) {
          await page.evaluate(id=>startGame(id,'quest'),mission.id);
          const stages=await page.evaluate(id=>{const module=MODULES.find(mod=>mod.tasks.some(topic=>topic.id===id));const topic=module.tasks.find(item=>item.id===id);return EsoAdultGames.topicQuest(topic,module,MODEL_UNITS).stations;},mission.id);
          for (const stage of stages) {
            const fit=await page.evaluate(()=>{const surface=document.querySelector('.eso-object-surface'),answers=document.querySelector('.eso-object-answers');return {surface:surface.scrollHeight-surface.clientHeight,answers:answers.scrollHeight-answers.clientHeight}});
            assert.ok(fit.surface<=2&&fit.answers<=2,`${mission.id}: clipped stage ${stage.place} ${JSON.stringify(fit)}`);
            await page.locator('.eso-object-answers button').nth(stage.correct).click();
            await page.locator('.eso-object-feedback button').click();
          }
          assert.equal(await page.locator('.eso-game-result').count(),1);
        }
      }
      assert.deepEqual(errors,[],`browser errors at ${width}`);
      await page.close();
    }
    assert.equal(sampleKinds.size,8);
  } finally { await browser.close(); }
});
