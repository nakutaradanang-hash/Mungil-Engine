import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AudioChannelPool,
  DoubleBufferedTransforms,
  QOLBU_12_LAYERS,
  QOLBU_CONSTANTS,
  SoAWorld,
  evaluateOriginRebase,
  fastClampDt,
  isValidMove,
  runQolbu8StageAudit,
} from './qolbuCore';
import {
  createDefaultStateMachine,
  generateTechnicalDocs,
  runAssetCompilationGuard,
  runAutomatedLogicTests,
  stepStateMachine,
  validateStateMachine,
} from './stateMachine';
import {
  AAA_DEPARTMENTS_18,
  buildProjectFromPrompt,
  generateAndroidItelA70BuildPack,
  generateProcedural3DMeshExport,
} from './studioPipeline';
import { GITHUB_33_GROUPS, GITHUB_33_KEYWORDS, search33KeywordsCatalog } from './github33Catalog';

test('Qolbu v13.0 enforces 9 Larangan Mutlak, 12 Layers, SoA ECS, and passes 8-stage Itel A70 audit', () => {
  assert.equal(QOLBU_12_LAYERS.length, 12);
  const totalSystems = QOLBU_12_LAYERS.reduce((acc, l) => acc + l.systems.length, 0);
  assert.ok(totalSystems >= 50);

  assert.equal(fastClampDt(0.001), QOLBU_CONSTANTS.DT_MIN_SEC);
  assert.equal(fastClampDt(0.9), QOLBU_CONSTANTS.DT_MAX_SEC);
  assert.equal(fastClampDt(Number.NaN), QOLBU_CONSTANTS.DT_MAX_SEC);

  assert.equal(isValidMove(0, 0, 0, 3, 0, 4), true);
  assert.equal(isValidMove(0, 0, 0, Number.NaN, 0, 0), false);
  assert.equal(isValidMove(0, 0, 0, 0, -250, 0), false);
  assert.equal(isValidMove(0, 0, 0, 999, 0, 0), false);

  const rebase = evaluateOriginRebase(1250, -640, 0, 0);
  assert.equal(rebase.rebased, true);
  assert.equal(rebase.shiftX, 1000);
  assert.equal(rebase.shiftZ, -500);

  const ecs = new SoAWorld(128);
  const ids: number[] = [];
  for (let i = 0; i < 128; i++) ids.push(ecs.alloc());
  assert.equal(ecs.activeCount, 128);
  assert.equal(ecs.alloc(), -1);
  for (const id of ids) ecs.free(id);
  assert.equal(ecs.activeCount, 0);

  const db = new DoubleBufferedTransforms(128);
  assert.equal(db.writeBack(0, 15, 2, -9), true);
  assert.equal(db.writeBack(0, Number.NaN, 2, -9), false);
  db.swapBuffers();
  assert.equal(db.frontX[0], 15);

  const audioPool = new AudioChannelPool(16);
  for (let i = 0; i < 16; i++) assert.ok(audioPool.acquire(i + 1) >= 0);
  assert.equal(audioPool.acquire(99), -1);

  const audit = runQolbu8StageAudit(24, 187);
  assert.equal(audit.allPassed, true);
  assert.equal(audit.fuzzBlockedCount, 2000);
});

test('State machine validates transitions, catches asset compile issues, and updates tech docs', () => {
  const fsm = createDefaultStateMachine('3D Action');
  const report = validateStateMachine(fsm);
  assert.equal(report.valid, true);
  assert.equal(report.unreachableStates.length, 0);

  const step1 = stepStateMachine(fsm, 'boot', 'ASSETS_VERIFIED');
  assert.equal(step1.transitioned, true);
  assert.equal(step1.nextStateId, 'idle');

  const guard = runAssetCompilationGuard([
    { name: 'hero_rig.glb', kind: 'mesh', sizeKb: 420, tris: 85000 },
    { name: 'bad_norm.obj', kind: 'mesh', sizeKb: 120, hasNaN: true },
    { name: 'arena_tile.png', kind: 'texture', sizeKb: 640 },
    { name: 'oversized.pak', kind: 'mesh', sizeKb: 90000 },
  ]);
  assert.equal(guard.recoveredCount, 2);
  assert.equal(guard.fatalCount, 1);

  const tests = runAutomatedLogicTests(fsm, 24, 187);
  assert.equal(tests.every((t) => t.passed), true);

  const project = buildProjectFromPrompt('Nusantara Sanctuary 3D Parkour');
  const docs = generateTechnicalDocs(project.brief, project.gdd, project.styleBible, fsm, tests, 'v13.0.1');
  assert.ok(docs.includes('State Machine Specification'));
  assert.ok(docs.includes('6/6 Passed'));
});

test('AAA Multi-Agent Studio builds 18 departments, 3D exports, Android Itel A70 pack, and 33x10 GitHub catalog', () => {
  assert.equal(AAA_DEPARTMENTS_18.length, 18);
  const project = buildProjectFromPrompt('Cyber Nusantara 3D Action RPG');
  assert.equal(project.agents.length, 18);
  assert.ok(project.eventBus.length >= 4);
  assert.equal(project.gdd.pillars.length, 3);
  assert.equal(project.styleBible.palette.length, 5);

  const mesh = generateProcedural3DMeshExport('Guardian', 'hero');
  assert.ok(mesh.objText.includes('v ') && mesh.objText.includes('f '));
  const gltf = JSON.parse(mesh.gltfJson) as { asset: { version: string } };
  assert.equal(gltf.asset.version, '2.0');

  const apk = generateAndroidItelA70BuildPack(project.brief);
  assert.ok(apk.buildGradleKts.includes('minSdk = 21'));
  assert.ok(apk.mainActivityKt.includes('Dispatchers.IO'));

  assert.equal(GITHUB_33_KEYWORDS.length, 33);
  assert.equal(GITHUB_33_GROUPS.length, 33);
  for (const grp of GITHUB_33_GROUPS) {
    assert.equal(grp.repos.length, 10, `Expected 10 repos for ${grp.keyword}`);
  }
  const filtered = search33KeywordsCatalog('three', '3d');
  assert.equal(filtered.length, 1);
  assert.ok(filtered[0].repos.some((r) => r.repo === 'mrdoob/three.js'));

  assert.ok(apk.proguardRulesPro.includes('-optimizationpasses 5'));
  assert.ok(apk.androidManifestXml.includes('hardwareAccelerated="true"'));
});

test('Pre-build asset pipeline validates draw calls, texel density, and message-bus feedback loops', async () => {
  const { validateAssetPipelinePreBuild } = await import('./stateMachine');
  const { StudioMessageBus } = await import('./studioPipeline');

  const clean = validateAssetPipelinePreBuild(
    [
      { name: 'hero.gltf', kind: 'mesh', drawCalls: 6, texelDensityPxPerM: 512, tris: 4200, sizeKb: 420 },
      { name: 'stone.astc', kind: 'texture', drawCalls: 1, texelDensityPxPerM: 512, sizeKb: 900 },
    ],
    24
  );
  assert.equal(clean.passed, true);
  assert.equal(clean.flaggedAssets.length, 0);

  const flagged = validateAssetPipelinePreBuild(
    [
      { name: 'heavy_city.fbx', kind: 'mesh', drawCalls: 18, texelDensityPxPerM: 2048, tris: 74000, sizeKb: 8200 },
    ],
    42
  );
  assert.equal(flagged.passed, false);
  assert.ok(flagged.flaggedAssets.length >= 3);

  const bus = new StudioMessageBus();
  let receivedCount = 0;
  const unsub = bus.subscribe('*', () => {
    receivedCount += 1;
  });
  const proj = buildProjectFromPrompt('Isometric 2.5D Tactical Action');
  const history = bus.runTriadValidationLoop(proj.brief, 42, 310);
  unsub();
  assert.equal(receivedCount, 3);
  assert.ok(history.some((m) => m.channel === 'error'));
  assert.ok(proj.agents.some((a) => a.triadRole === 'Creative Director'));
  assert.ok(proj.agents.some((a) => a.triadRole === 'Art Lead'));
  assert.ok(proj.agents.some((a) => a.triadRole === 'Lead Engineer'));
});

test('18-Agent DAG resolves in topological order, tunes RuntimeConfig accurately, and generates Playable HTML5 build', async () => {
  const {
    resolveAgentDagOrder,
    synthesizeRuntimeConfig,
    runAll18AgentsPipeline,
    generatePlayableHtml5Export,
  } = await import('./studioPipeline');
  const { qolbuAudio } = await import('./audioSynth');

  const ordered = resolveAgentDagOrder();
  assert.equal(ordered.length, 18);
  const seen = new Set<string>();
  for (const dept of ordered) {
    for (const dep of dept.dependsOn) {
      assert.equal(seen.has(dep), true, `Expected dependency ${dep} before ${dept.id}`);
    }
    seen.add(dept.id);
  }

  const isoRacing = buildProjectFromPrompt(
    'Isometric 2.5D Cyber Drift Racing with neon cyber soundtrack and 7 shards',
    'Neon Drift'
  );
  assert.equal(isoRacing.runtimeConfig.projectionMode, '2.5d_isometric');
  assert.equal(isoRacing.runtimeConfig.audioScale, 'cyber_minor');
  assert.ok(isoRacing.runtimeConfig.moveSpeed >= 10);
  assert.ok(isoRacing.runtimeConfig.audioTempoBpm >= 130);
  assert.equal(isoRacing.runtimeConfig.shardCount, 7);

  const customCfg = synthesizeRuntimeConfig(
    'Survival horror pseudo-3d dungeon',
    isoRacing.brief,
    isoRacing.styleBible,
    ['mrdoob/three.js', 'Tonejs/Tone.js']
  );
  assert.equal(customCfg.projectionMode, 'pseudo_3d');
  assert.equal(customCfg.audioScale, 'tension_phrygian');
  assert.equal(customCfg.activeDnaSummary.length, 2);
  assert.ok(customCfg.activeDnaSummary.some((s) => s.includes('three.js')));

  const executed = runAll18AgentsPipeline(isoRacing, 24, 187);
  assert.equal(executed.agents.length, 18);
  assert.equal(executed.agents.every((a) => a.approved), true);
  assert.equal(executed.eventBus.length, 19);
  assert.ok(executed.eventBus.some((e) => e.toTopic === 'sync.tokens.locked'));

  const overBudget = runAll18AgentsPipeline(isoRacing, 42, 310);
  const perfAgent = overBudget.agents.find((a) => a.id === 'performance');
  assert.equal(perfAgent?.approved, false);
  assert.ok(overBudget.eventBus.some((e) => e.channel === 'error'));

  const html = generatePlayableHtml5Export(isoRacing);
  assert.ok(html.includes('<canvas id="game"'));
  assert.ok(html.includes('Neon Drift'));
  assert.ok(html.includes('"shardCount":7'));

  qolbuAudio.configureAudio({ tempoBpm: 140, scale: 'heroic_major' });
  qolbuAudio.setVolumes({ bgm: 0.4, sfx: 0.85 });
  assert.deepEqual(qolbuAudio.getVolumes(), { bgm: 0.4, sfx: 0.85 });
  assert.equal(qolbuAudio.getActiveVoiceCount(), 0);
  qolbuAudio.dispose();
});

test('AssetAtlas packs .qbin RLE + CRC32 cleanly, GameplayKernel enforces collisions/tokens/trauma, and Orchestration self-heals', async () => {
  const {
    compressBinaryRle,
    createStudioTextureAtlasSpec,
    decompressBinaryRle,
    packGameBinaryBundle,
    verifyQbinBundle,
  } = await import('./assetAtlas');
  const {
    AttackTokenPool,
    SeededPrng,
    advanceTrauma,
    resolveCircleAabbCollision,
    stepExponentialDamp,
  } = await import('./gameplayKernel');
  const { runSynchronizedOrchestrationCycle } = await import('./studioPipeline');

  // RLE + CRC32 round-trip
  const raw = new Uint8Array([1, 1, 1, 1, 1, 9, 2, 7, 7, 7, 7, 3, 4]);
  const rle = compressBinaryRle(raw);
  const restored = decompressBinaryRle(rle, raw.length);
  assert.deepEqual(restored, raw);

  // Project .qbin packing & verification
  const project = buildProjectFromPrompt('Nusantara Obsidian 3D Action', 'Garuda Sanctuary');
  const atlas = createStudioTextureAtlasSpec(project.styleBible, project.runtimeConfig);
  assert.equal(atlas.atlasWidth, 512);
  assert.equal(atlas.tiles.length, 5);

  const qbin = packGameBinaryBundle(project);
  assert.equal(qbin.headerSummary.magic, 'QBIN13');
  const verified = verifyQbinBundle(qbin.bytes);
  assert.equal(verified.valid, true);
  assert.equal(verified.crc32Match, true);
  assert.ok(verified.manifestJson.includes('Garuda Sanctuary'));

  // Tamper byte -> CRC32 mismatch check
  const tampered = new Uint8Array(qbin.bytes);
  tampered[tampered.length - 1] ^= 0xff;
  const badVerify = verifyQbinBundle(tampered);
  assert.equal(badVerify.valid, false);

  // GameplayKernel Circle vs AABB push-out
  const hit = resolveCircleAabbCollision(0.9, 0.2, 0.55, 0, 0, 1.0, 1.0);
  assert.equal(hit.collided, true);
  assert.ok(hit.x >= 1.54);
  const miss = resolveCircleAabbCollision(4, 4, 0.55, 0, 0, 1.0, 1.0);
  assert.equal(miss.collided, false);

  // AttackTokenPool crowd limit
  const pool = new AttackTokenPool(2);
  assert.equal(pool.acquire(0), true);
  assert.equal(pool.acquire(1), true);
  assert.equal(pool.acquire(2), false);
  pool.release(0);
  assert.equal(pool.acquire(2), true);

  // Trauma, PRNG & Exponential damping
  const t = advanceTrauma(0.5, 0.1, 2.0);
  assert.equal(t.shakeIntensity, 0.25);
  assert.ok(t.nextTrauma < 0.5);
  const prngA = new SeededPrng(42);
  const prngB = new SeededPrng(42);
  assert.equal(prngA.next(), prngB.next());
  assert.ok(stepExponentialDamp(0.8, 1.0, 14, 0.03) > 0.8);

  // Synchronized 4-agent feedback loop self-healing convergence
  const healed = runSynchronizedOrchestrationCycle(project, 44, 312);
  assert.ok(healed.orchestration);
  assert.equal(healed.orchestration.roundsExecuted, 2);
  assert.equal(healed.orchestration.converged, true);
  assert.ok(healed.orchestration.autoHealedIssues.length >= 1);
  assert.ok(healed.eventBus.some((m) => m.toTopic === 'orchestrator.qa.feedback_repair'));

  // Zero-deprecation Android 5+ APK pack checks (including C++/CMake NDK native VM)
  const apk = generateAndroidItelA70BuildPack(project.brief);
  assert.ok(apk.mainActivityKt.includes('WebViewAssetLoader'));
  assert.ok(apk.mainActivityKt.includes('OnBackPressedCallback'));
  assert.ok(apk.mainActivityKt.includes('onTrimMemory'));
  assert.equal(apk.mainActivityKt.includes('file:///android_asset'), false);
  assert.ok(apk.cmakeListsTxt.includes('qolbu_native_vm'));
  assert.ok(apk.nativeVmCpp.includes('MainActivity_nativeStepQvm'));
  assert.ok(qbin.headerSummary.ratioPct <= 100.0);
});

test('QolbuVM v13 assembles .qasm to CRC32 bytecode, executes zero-GC ops, and SyncProtocol detects/locks token drift', async () => {
  const {
    QASM_PRESETS,
    QolbuBytecodeVm,
    assembleQolbuAsm,
    disassembleQvmBinary,
    verifyQvmBinary,
  } = await import('./bytecodeVm');
  const {
    generatePlayableHtml5Export,
    reconcileProjectSyncProtocol,
  } = await import('./studioPipeline');

  // Assemble & verify locomotion preset
  const asm = assembleQolbuAsm(QASM_PRESETS[0].source);
  assert.equal(asm.valid, true);
  assert.equal(asm.errors.length, 0);
  const check = verifyQvmBinary(asm.binary);
  assert.equal(check.valid, true);
  assert.equal(check.crc32Match, true);

  const disasm = disassembleQvmBinary(asm.binary);
  assert.equal(disasm.length, asm.instructions.length);

  // Tamper bytecode -> CRC32 fails
  const badBin = new Uint8Array(asm.binary);
  badBin[badBin.length - 1] ^= 0x55;
  assert.equal(verifyQvmBinary(badBin).valid, false);

  // Execute locomotion kernel & 500m rebase preset in VM
  const vm = new QolbuBytecodeVm();
  const trace0 = vm.run(asm.binary);
  assert.equal(trace0.halted, true);
  assert.equal(trace0.registers[2], 41); // 5^2 + 4^2
  assert.equal(trace0.registers[3], 1); // CHECK_MOVE valid
  assert.deepEqual(trace0.emittedSignals, [101]);

  const rebaseAsm = assembleQolbuAsm(QASM_PRESETS[1].source);
  const trace1 = vm.run(rebaseAsm.binary);
  assert.equal(trace1.registers[2], 1000);
  assert.equal(trace1.registers[3], -500);
  assert.equal(trace1.registers[4], 240);
  assert.equal(trace1.registers[5], -140);
  assert.deepEqual(trace1.emittedSignals, [202]);

  // Centralized Sync Protocol token hash updates deterministically on edits
  const proj = buildProjectFromPrompt('Retro 2D dungeon adventure', 'PixelVault');
  assert.ok(proj.syncProtocol);
  assert.equal(proj.syncProtocol.barrierLocked, true);
  const hashBefore = proj.syncProtocol.designTokenHash;
  const modified = reconcileProjectSyncProtocol({
    ...proj,
    runtimeConfig: { ...proj.runtimeConfig, shardCount: 8, projectionMode: '2.5d_isometric' },
  });
  assert.ok(modified.syncProtocol);
  assert.notEqual(modified.syncProtocol.designTokenHash, hashBefore);
  assert.equal(modified.syncProtocol.stateChecksum, proj.syncProtocol.stateChecksum);

  const html = generatePlayableHtml5Export(modified);
  assert.ok(html.includes('2.5d_isometric'));
  assert.ok(html.includes('DASH PARRY'));
});

test('Workspace persistence saves CRC32 envelope, recovers backup on corruption, and hardens HTML5/JSON I/O', async () => {
  const {
    WORKSPACE_BACKUP_KEY,
    WORKSPACE_STORAGE_KEY,
    loadStudioWorkspaceSnapshot,
    saveStudioWorkspaceSnapshot,
    validateAndMigrateImportedProjectJson,
  } = await import('./storageRecovery');
  const { generatePlayableHtml5Export } = await import('./studioPipeline');

  const store = new Map<string, string>();
  const mockStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => {
      store.set(k, v);
    },
    removeItem: (k: string) => {
      store.delete(k);
    },
  };

  const proj1 = buildProjectFromPrompt('Nusantara Temple Runner', 'Garuda Dawn');
  const firstSave = saveStudioWorkspaceSnapshot(mockStorage, {
    project: proj1,
    builds: [],
    tickets: [],
    commits: [],
    importedAssets: [],
    projectionMode: '3d_pbr',
  });
  assert.equal(firstSave.ok, true);

  const proj2 = buildProjectFromPrompt('Cyber Drift Racing', 'Neon Circuit');
  saveStudioWorkspaceSnapshot(mockStorage, {
    project: proj2,
    builds: [],
    tickets: [],
    commits: [],
    importedAssets: [],
    projectionMode: '2.5d_isometric',
  });

  const cleanLoad = loadStudioWorkspaceSnapshot(mockStorage);
  assert.equal(cleanLoad.recoveredFromBackup, false);
  assert.equal(cleanLoad.snapshot?.project.brief.title, 'Neon Circuit');

  // Corrupt primary save -> should recover proj1 from CRC32-verified backup slot
  store.set(WORKSPACE_STORAGE_KEY, '{"schemaVersion":2,"checksumCrc32":"DEADBEEF","payload":{}}');
  assert.ok(store.get(WORKSPACE_BACKUP_KEY));
  const recovered = loadStudioWorkspaceSnapshot(mockStorage);
  assert.equal(recovered.recoveredFromBackup, true);
  assert.equal(recovered.snapshot?.project.brief.title, 'Garuda Dawn');

  // Reject malformed or incomplete JSON project imports
  assert.equal(validateAndMigrateImportedProjectJson('{bad json').ok, false);
  assert.equal(validateAndMigrateImportedProjectJson('{"hello":1}').ok, false);

  // Sanitize out-of-range numeric tuning and invalid hex on import
  const validImport = validateAndMigrateImportedProjectJson(
    JSON.stringify({
      ...proj1,
      runtimeConfig: { ...proj1.runtimeConfig, skyHex: 'red;position:fixed', moveSpeed: 999 },
    })
  );
  assert.equal(validImport.ok, true);
  assert.ok(/^#[0-9a-fA-F]{6}$/.test(validImport.project?.runtimeConfig.skyHex || ''));
  assert.ok((validImport.project?.runtimeConfig.moveSpeed || 0) <= 15);

  // Escape </script> injection inside playable HTML5 export
  const xssProject = buildProjectFromPrompt('Test arena', 'Title</script><script>alert(1)</script>');
  const exportedHtml = generatePlayableHtml5Export(xssProject);
  assert.equal(exportedHtml.includes('</script><script>alert(1)'), false);
  assert.ok(exportedHtml.includes('\\u003c/script\\u003e'));
});

test('Canvas2D fallback engine supports shard pickup, pillar collision, dash parry, and victory state', async () => {
  const { createCanvas2DFallbackState, stepCanvas2DFallback } = await import('./canvas2dFallback');
  const proj = buildProjectFromPrompt('Isometric Shrine Guardian', 'Shrine Fallback');
  const fb = createCanvas2DFallbackState(4);
  assert.equal(fb.shards.length, 4);

  // Move player onto shard 0 and verify pickup
  fb.playerX = fb.shards[0].x;
  fb.playerZ = fb.shards[0].z;
  const ev = stepCanvas2DFallback(fb, 0.033, proj.runtimeConfig, { moveX: 0, moveZ: 0, dashJustPressed: false });
  assert.equal(ev.collectedShard, true);
  assert.equal(fb.score, 200);

  // Dash parry stuns nearby enemy
  fb.enemies[0].x = fb.playerX + 0.5;
  fb.enemies[0].z = fb.playerZ;
  const parryEv = stepCanvas2DFallback(fb, 0.033, proj.runtimeConfig, { moveX: 0, moveZ: 0, dashJustPressed: true });
  assert.equal(parryEv.parried, true);
  assert.ok(fb.enemies[0].stunTimer > 0);

  // Collect remaining shards and enter gate -> victory
  fb.shards.forEach((s) => {
    s.collected = true;
  });
  fb.playerX = fb.gateX;
  fb.playerZ = fb.gateZ;
  const winEv = stepCanvas2DFallback(fb, 0.033, proj.runtimeConfig, { moveX: 0, moveZ: 0, dashJustPressed: false });
  assert.equal(winEv.outcomeChanged, 'victory');
  assert.equal(fb.status, 'victory');
});

