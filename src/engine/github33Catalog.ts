import type { GitHubKeywordGroup, GitHubRepoEntry } from './types';

export const GITHUB_33_KEYWORDS = [
  'mcp',
  'plug-in',
  'modul',
  'komponen',
  'logic',
  'physics',
  'mekanik',
  'video',
  'music',
  'game',
  'ai',
  'generator',
  'image',
  'isometric',
  '3d',
  '2.5d',
  '2d',
  'pseudo 3d',
  'fake 3D',
  'mobile',
  'web',
  'js',
  'html',
  'engine',
  'design',
  'constructor',
  'prosedural',
  'prompt',
  'connector',
  'coding',
  'android',
  'apk',
  'PWA',
] as const;

type SeedTuple = [string, string, string, string, string];

const KEYWORD_SEEDS: Record<(typeof GITHUB_33_KEYWORDS)[number], { category: string; items: SeedTuple[] }> = {
  mcp: {
    category: 'Agent Protocol & Tooling',
    items: [
      ['modelcontextprotocol/servers', 'MIT', '42k★', 'Reference Model Context Protocol servers for filesystem, git, and search tools.', 'Attach local workspace & git context to Studio Director'],
      ['modelcontextprotocol/typescript-sdk', 'MIT', '11k★', 'Official TypeScript SDK for MCP clients and servers.', 'Wire typed Studio MCP tool invocations'],
      ['modelcontextprotocol/inspector', 'MIT', '6.5k★', 'Visual testing and debugging tool for MCP servers.', 'Audit agent tool latency & schemas'],
      ['punkpeye/fastmcp', 'MIT', '4.1k★', 'Lightweight TypeScript framework for rapid MCP server authoring.', 'Register custom game-engine MCP endpoints'],
      ['cyanheads/git-mcp-server', 'Apache-2.0', '1.8k★', 'MCP server exposing git status, branch diffs, and commit history.', 'Sync VCS commits with AI Director'],
      ['executeautomation/mcp-playwright', 'MIT', '3.9k★', 'Browser automation MCP server for UI & canvas verification.', 'Automate regression checks on playable builds'],
      ['chrishayuk/mcp-cli', 'MIT', '2.1k★', 'Command-line host for inspecting and chaining MCP tool calls.', 'Debug multi-agent event pipelines'],
      ['browserbase/mcp-server-browserbase', 'MIT', '2.4k★', 'Headless browser orchestration over MCP.', 'Capture cross-device viewport telemetry'],
      ['zricethezav/gitleaks', 'MIT', '19k★', 'Secret scanning engine integrateable as pre-commit MCP guard.', 'Prevent accidental key leaks in exports'],
      ['smithery-ai/cli', 'MIT', '1.5k★', 'Package manager and registry CLI for MCP connectors.', 'One-click install for studio connectors'],
    ],
  },
  'plug-in': {
    category: 'Extensible Plug-in Architecture',
    items: [
      ['unjs/hookable', 'MIT', '2.2k★', 'Awaitable lifecycle hook system for modular JavaScript plugins.', 'Power Qolbu layer hook registration'],
      ['rollup/plugins', 'MIT', '4.3k★', 'Official Rollup & Vite plugin architecture patterns.', 'Tree-shake mobile bundle plugins'],
      ['fastify/fastify-plugin', 'MIT', '1.1k★', 'Encapsulated plugin dependency registration helper.', 'Isolate studio service plugins cleanly'],
      ['remarkjs/remark', 'MIT', '8.2k★', 'Plugin-driven Markdown AST processor for technical docs.', 'Auto-format GDD & build documentation'],
      ['tweakpane/tweakpane', 'MIT', '5.1k★', 'Compact plugin-extensible parameter inspector for live canvases.', 'Tune 3D material & physics constants live'],
      ['codemirror/dev', 'MIT', '6.4k★', 'Extensible browser editor with language & lint plugins.', 'Inspect state machine script hooks'],
      ['vitejs/vite-plugin-pwa', 'MIT', '3.4k★', 'Zero-config PWA Service Worker plugin for Vite.', 'Generate offline Android WebView cache'],
      ['pmndrs/leva', 'MIT', '4.6k★', 'Declarative GUI control panel plugin for Three.js scenes.', 'Bind debug sliders to quality presets'],
      ['eslint/eslint', 'MIT', '25k★', 'Pluggable static AST linter for JavaScript & TypeScript.', 'Enforce Qolbu 9 Larangan Mutlak rules'],
      ['prettier/prettier', 'MIT', '50k★', 'Opinionated plugin-backed code formatter.', 'Keep exported project scripts clean'],
    ],
  },
  modul: {
    category: 'Modular Runtime & ECS',
    items: [
      ['NateTheGreatt/bitECS', 'MIT', '2.9k★', 'Functional, data-oriented TypedArray ECS for zero-GC JS games.', 'Direct inspiration for Qolbu SoAWorld'],
      ['pmndrs/miniplex', 'MIT', '1.6k★', 'Gentle entity management library for React & Three.js games.', 'Organize entity queries cleanly'],
      ['unjs/jiti', 'MIT', '2.8k★', 'Runtime TypeScript and ESM module loader.', 'Hot-validate studio config modules'],
      ['sindresorhus/emittery', 'MIT', '1.9k★', 'Simple and modern async event emitter.', 'Drive Multi-Agent Event Bus dispatch'],
      ['pmndrs/zustand', 'MIT', '51k★', 'Minimalist flux state module with zero boilerplate.', 'Decouple HUD snapshots from 60fps loop'],
      ['statelyai/xstate', 'MIT', '28k★', 'Finite state machines and statecharts for JS/TS.', 'Reference pattern for FSM transitions'],
      ['colyseus/colyseus', 'MIT', '6.1k★', 'Multiplayer authoritative game server framework.', 'Layer 8 snapshot & room sync pattern'],
      ['davidkpiano/flip', 'MIT', '1.4k★', 'Lightweight layout transition helpers.', 'Smooth panel reflow transitions'],
      ['immerjs/immer', 'MIT', '28k★', 'Immutable state updates via structural sharing.', 'Safe undo/redo in Scene & FSM editors'],
      ['zloirock/core-js', 'MIT', '24k★', 'Modular standard library polyfills for legacy browsers.', 'Android 5+ WebView compatibility guard'],
    ],
  },
  komponen: {
    category: 'UI & Engine Components',
    items: [
      ['lucide-icons/lucide', 'ISC', '15k★', 'Crisp tree-shakeable SVG icon component library.', 'Affordance-only studio icons'],
      ['radix-ui/primitives', 'MIT', '16k★', 'Unstyled accessible UI primitives with keyboard focus.', 'Accessible modals, tabs & dialogs'],
      ['tailwindlabs/headlessui', 'MIT', '27k★', 'Accessible UI components styled via Tailwind CSS.', 'Quick Search command palette & menus'],
      ['floating-ui/floating-ui', 'MIT', '31k★', 'Smart positioning engine for tooltips and popovers.', 'Zero-overlap inspector popovers'],
      ['tanstack/table', 'MIT', '26k★', 'Headless high-density data table component.', 'Compilation logs & ticket grids'],
      ['recharts/recharts', 'MIT', '25k★', 'Composable React chart components.', 'Customizable build metric visualization'],
      ['pmndrs/drei', 'MIT', '8.6k★', 'Useful helpers and abstractions for Three.js scenes.', 'Camera rigs & environment helpers'],
      ['cmdk/cmdk', 'MIT', '10k★', 'Fast, composable command menu component.', 'Ctrl+K studio-wide quick search'],
      ['sonner/sonner', 'MIT', '9.8k★', 'Opinionated toast notification component.', 'Non-blocking build & sync alerts'],
      ['motiondivision/motion', 'MIT', '28k★', 'Hardware-accelerated React animation primitives.', '<200ms compositor UI transitions'],
    ],
  },
  logic: {
    category: 'State Machines, AI & Rules',
    items: [
      ['statelyai/xstate', 'MIT', '28k★', 'Industry-standard finite state machine & actor model.', 'Deterministic script transition graphs'],
      ['Mugen87/yuka', 'MIT', '4.3k★', 'JavaScript game AI library with steering, FSM, and perception.', 'Layer 5 15Hz enemy tactical AI'],
      ['jakesgordon/javascript-state-machine', 'MIT', '3.5k★', 'Compact finite state machine library.', 'Lightweight guard-checked state hooks'],
      ['qiao/PathFinding.js', 'MIT', '8.1k★', 'Comprehensive grid pathfinding library (A*, JPS).', 'Tactical NPC & companion navigation'],
      ['ashblue/fluid-behavior-tree', 'MIT', '1.2k★', 'Behavior tree logic runner for game AI.', 'Modular boss phase decision trees'],
      ['anvaka/ngraph.path', 'MIT', '1.4k★', 'Fast graph pathfinding in JS.', 'Validate FSM state reachability'],
      ['nodejs/node', 'MIT', '110k★', 'Built-in node:test runner for zero-dependency logic testing.', 'Automated pre-build logic validation'],
      ['colinhacks/zod', 'MIT', '36k★', 'TypeScript-first schema validation.', 'Validate GDD & API payloads strictly'],
      ['ajv-validator/ajv', 'MIT', '14k★', 'Fast JSON Schema validator.', 'Asset manifest & blueprint verification'],
      ['craftyjs/Crafty', 'MIT', '3.7k★', 'Component-based entity logic framework.', 'Clean trait composition patterns'],
    ],
  },
  physics: {
    category: '2D/3D Physics & Collision',
    items: [
      ['dimforge/rapier.js', 'Apache-2.0', '4.1k★', 'Fast deterministic 2D & 3D WASM physics engine.', 'Optional high-precision rigidbody backend'],
      ['pmndrs/cannon-es', 'MIT', '2.3k★', 'Lightweight 3D rigidbody physics in pure TypeScript.', 'Three.js crate, bounce & ragdoll physics'],
      ['liabru/matter-js', 'MIT', '17k★', '2D rigidbody physics engine for the web.', '2D arcade & puzzle physics presets'],
      ['shakiba/planck.js', 'MIT', '5.3k★', 'Box2D-inspired deterministic 2D physics in JS.', 'Deterministic replay & CCD collision'],
      ['jriecken/sat-js', 'MIT', '1.7k★', 'Separating Axis Theorem 2D collision detection.', 'Polygon & circle overlap inspector'],
      ['kripken/ammo.js', 'Zlib', '5.1k★', 'Bullet Physics compiled to WebAssembly/JS.', 'Vehicle suspension & ballistic raycasts'],
      ['schteppe/p2.js', 'MIT', '3.3k★', '2D physics engine with springs and constraints.', '2-bone cloth & cape spring physics'],
      ['brm/joltphysics.js', 'MIT', '1.1k★', 'Jolt Physics WASM bindings for 3D games.', 'High-entity multi-threaded physics'],
      ['mourner/rbush', 'MIT', '3.3k★', 'High-performance R-tree spatial index for 2D/AABB.', 'Fast broadphase culling for 128 entities'],
      ['erincatto/box2d', 'MIT', '8.4k★', 'Canonical 2D rigidbody physics reference.', 'Restitution & friction preset calibration'],
    ],
  },
  mekanik: {
    category: 'Gameplay Mechanics & Feel',
    items: [
      ['photonstorm/phaser', 'MIT', '37k★', 'Complete HTML5 2D game mechanics framework.', 'Input buffering, coyote time & tilemaps'],
      ['melonjs/melonJS', 'MIT', '4.8k★', 'Lightweight HTML5 game mechanics & tweening.', 'Camera shake & hitstop timing'],
      ['pixijs/pixijs', 'MIT', '45k★', 'High-speed 2D WebGL sprite & particle batcher.', '64-slot zero-GC particle burst patterns'],
      ['kontrajs/kontra', 'MIT', '2.5k★', 'Micro-sized JS game library for tight mobile budgets.', 'Small bundle size mechanics design'],
      ['goldfire/howler.js', 'MIT', '24k★', 'Cross-browser Web Audio playback & pooling.', '16-channel mono-safe SFX pooling'],
      ['tweenjs/tween.js', 'MIT', '10k★', 'Smooth easing and spring interpolation curves.', 'Damped camera & squash-stretch motion'],
      ['excaliburjs/Excalibur', 'BSD-2', '2.6k★', 'TypeScript 2D game engine with built-in timers & actions.', 'Clean actor action queues'],
      ['kaboom/kaboom', 'MIT', '3.1k★', 'Expressive declarative gameplay mechanics DSL.', 'Rapid prototype mechanic presets'],
      ['kitao/pyxel', 'MIT', '15k★', 'Retro pixel game engine design patterns.', 'Crisp pixel-grid & chiptune rules'],
      ['jakesgordon/javascript-racer', 'MIT', '2.1k★', 'Classic pseudo-3D Mode-7 racing mechanics.', 'Horizon road & speed curve mechanics'],
    ],
  },
  video: {
    category: 'Video Capture, Sequencer & Codecs',
    items: [
      ['ffmpegwasm/ffmpeg.wasm', 'MIT', '15k★', 'WebAssembly FFmpeg for client-side video transcoding.', 'Trim & compress captured 3D trailers'],
      ['remotion-dev/remotion', 'MIT/Custom', '22k★', 'Programmatic React video composition patterns.', 'Keyframe camera rail & title overlays'],
      ['spite/ccapture.js', 'MIT', '3.2k★', 'Fixed-timestep canvas video frame capture.', 'Deterministic 30fps cutscene recording'],
      ['muaz-khan/RecordRTC', 'MIT', '6.1k★', 'Browser MediaRecorder WebM/audio capture helper.', 'Record live 3D sandbox gameplay clips'],
      ['videojs/video.js', 'Apache-2.0', '38k★', 'Extensible HTML5 video player.', 'Preview & scrub generated game trailers'],
      ['gpac/mp4box.js', 'BSD-3', '1.9k★', 'MP4 muxer/demuxer in JavaScript.', 'Inspect frame tracks in browser'],
      ['motion-canvas/motion-canvas', 'MIT', '17k★', 'Procedural vector & timeline animation engine.', 'Cutscene sequencer timeline UX'],
      ['theatre-js/theatre', 'Apache-2.0', '11k★', '3D motion design & keyframe sequencer for Three.js.', 'Layer 9.2 Cinematic Camera Rail'],
      ['webmproject/libwebm', 'BSD-3', '1.1k★', 'Lightweight WebM container tooling.', 'Mobile-friendly trailer export'],
      ['kripken/speak.js', 'MIT', '1.3k★', 'Client-side audio/video synthesis fallback.', 'Offline voice cue testing'],
    ],
  },
  music: {
    category: 'Procedural Audio, Synth & Tracker',
    items: [
      ['Tonejs/Tone.js', 'MIT', '14k★', 'Web Audio framework for interactive music & stems.', 'Adaptive combat/explore stem transitions'],
      ['zzfx/ZzFX', 'MIT', '1.4k★', 'Tiny zero-dependency retro sound effects synthesizer.', '0 KB external asset SFX generation'],
      ['mmckegg/soundbank', 'MIT', '1.1k★', 'Modular Web Audio synthesizer rack.', 'Procedural boss & pickup synth patches'],
      ['keithwhor/audiosynth', 'MIT', '2.3k★', 'Dynamic waveform instrument generator.', 'Chiptune & ambient pad synthesis'],
      ['scribbletune/scribbletune', 'MIT', '3.8k★', 'Generate musical patterns and arpeggios in JS.', 'Procedural sanctuary background loops'],
      ['danigb/tonal', 'MIT', '4.1k★', 'Music theory library for scales and chords.', 'Key-locked dynamic tension layers'],
      ['magenta/magenta-js', 'Apache-2.0', '3.2k★', 'Browser music generation models.', 'AI-assisted melody sketching'],
      ['janesconference/KievII', 'MIT', '1.2k★', 'Web Audio DSP & reverb utilities.', 'Material acoustic cave/stone reverb'],
      ['mohayonao/web-audio-scheduler', 'MIT', '0.9k★', 'Sample-accurate Web Audio event scheduler.', 'Tight rhythm & foley synchronization'],
      ['audiokit/AudioKit', 'MIT', '10k★', 'Mobile audio synthesis reference patterns.', 'Low-latency mobile speaker mixing'],
    ],
  },
  game: {
    category: 'Full Game Engines & Templates',
    items: [
      ['godotengine/godot', 'MIT', '95k★', 'Full-featured 2D/3D open-source game engine.', 'Scene tree, FSM & mobile GLES3 patterns'],
      ['photonstorm/phaser', 'MIT', '37k★', 'Production 2D HTML5 game framework.', 'Arcade & tilemap gameplay reference'],
      ['BabylonJS/Babylon.js', 'Apache-2.0', '24k★', 'Powerful WebGL/WebGPU 3D game engine.', 'PBR materials & physics plugins'],
      ['playcanvas/engine', 'MIT', '10k★', 'Lightweight mobile-first WebGL 3D game engine.', 'Low draw-call batching & glTF loading'],
      ['cocos/cocos-engine', 'MIT', '8.3k★', 'Mobile-optimized 2D/3D TypeScript game engine.', 'Android APK & low-RAM asset budgets'],
      ['bevyengine/bevy', 'MIT/Apache-2.0', '39k★', 'Data-driven ECS game engine in Rust.', 'Zero-GC system scheduling architecture'],
      ['stride3d/stride', 'MIT', '6.8k★', 'C# 3D engine with PBR & scene editor.', 'Component inspector & asset compiler'],
      ['defold/defold', 'Defold/MIT', '4.9k★', 'Ultra-compact mobile 2D/3D game engine.', 'Sub-5MB runtime binary architecture'],
      ['gdevelop/GDevelop', 'MIT', '13k★', 'No-code event-sheet game creator.', 'Visual state & event-sheet ergonomics'],
      ['LÖVE/love', 'Zlib', '5.1k★', 'Fast 2D Lua game framework.', 'Simple fixed-timestep loop craft'],
    ],
  },
  ai: {
    category: 'Multi-Agent AI & NPC Brains',
    items: [
      ['google/adk-js', 'Apache-2.0', '4.2k★', 'Agent Development Kit patterns for multi-agent orchestration.', '18-Department Studio orchestrator'],
      ['langchain-ai/langgraphjs', 'MIT', '2.5k★', 'Stateful multi-agent graph execution with feedback loops.', 'Directed GDD -> QA -> Build feedback loop'],
      ['Mugen87/yuka', 'MIT', '4.3k★', 'Autonomous steering, perception & memory for game NPCs.', '15Hz sight-cone & flank behavior'],
      ['vercel/ai', 'Apache-2.0', '13k★', 'Streaming AI tool & structured output SDK patterns.', 'Live streaming agent deliverables'],
      ['xenova/transformers.js', 'Apache-2.0', '13k★', 'Run ML models directly in browser.', 'Offline semantic search fallback'],
      ['microsoft/autogen', 'MIT', '42k★', 'Multi-agent conversation & role-based studio pattern.', 'Department specialist collaboration'],
      ['crewAIInc/crewAI', 'MIT', '29k★', 'Role-playing autonomous AI agent crews.', 'Producer -> Director -> Engineer handoff'],
      ['openai/swarm', 'MIT', '19k★', 'Lightweight ergonomic multi-agent handoff pattern.', 'Zero-latency agent topic routing'],
      ['BrainJS/brain.js', 'MIT', '15k★', 'Neural networks in JavaScript.', 'Adaptive difficulty tuning'],
      ['cazala/synaptic', 'MIT', '7.2k★', 'Architecture-free neural network library for JS.', 'Lightweight NPC decision scoring'],
    ],
  },
  generator: {
    category: 'Procedural World, Mesh & GDD Generators',
    items: [
      ['mrdoob/three.js', 'MIT', '105k★', 'Procedural Lathe, Extrude, Tube & BufferGeometry generators.', 'Composite 3-12 part 3D models'],
      ['josephg/noisejs', 'ISC', '1.9k★', 'Fast 2D/3D Perlin & Simplex noise generator.', 'Procedural terrain height & bump maps'],
      ['jwagner/simplex-noise.js', 'MIT', '2.1k★', 'Deterministic seeded Simplex noise in TypeScript.', 'Seed-locked reproducible worlds'],
      ['ondras/rot.js', 'BSD-3', '3.5k★', 'Roguelike dungeon, FOV, and maze generator toolkit.', 'Procedural arena & corridor layouts'],
      ['amitp/mapgen2', 'MIT', '2.8k★', 'Polygonal island & biome map generator.', 'Biome scatter & elevation rules'],
      ['pmndrs/three-stdlib', 'MIT', '1.2k★', 'Standard Three.js procedural exporters (GLTF/OBJ).', 'Export generated 3D meshes cleanly'],
      ['faker-js/faker', 'MIT', '13k★', 'Deterministic seeded data & lore generator.', 'Seeded NPC names, tickets & QA fuzzing'],
      ['mishoo/UglifyJS', 'BSD-2', '13k★', 'AST-driven JS code generator & minifier.', 'Generate clean runtime script bundles'],
      ['d3/d3-delaunay', 'ISC', '1.5k★', 'Fast Voronoi & Delaunay triangulation.', 'Procedural fracture & terrain regions'],
      ['mapbox/earcut', 'ISC', '2.9k★', 'Tiny fast polygon triangulation for 3D extrusion.', 'Extruded architectural walls & pillars'],
    ],
  },
  image: {
    category: 'Procedural Textures, Sprites & PBR Maps',
    items: [
      ['fabricjs/fabric.js', 'MIT', '30k★', 'Interactive HTML5 canvas image & decal editor.', 'Concept board & sprite decal layering'],
      ['konvajs/konva', 'MIT', '12k★', 'Layered 2D canvas engine for sprite & UI compositing.', 'Fast texture & sprite-sheet preview'],
      ['oliver-moran/jimp', 'MIT', '14k★', 'Pure JS image processing without native bindings.', 'Resize & pack ASTC-ready sprite atlases'],
      ['nodeca/pica', 'MIT', '5.3k★', 'High-quality Lanczos image resizing in browser.', 'Downscale 4K textures to 512px Itel A70'],
      ['lovell/sharp', 'Apache-2.0', '30k★', 'High-speed server image pipeline.', 'Optimize uploaded concept screenshots'],
      ['adobe/leonardo', 'Apache-2.0', '2.4k★', 'Contrast-ratio-safe adaptive color palette generator.', 'WCAG AA Style Bible palette verification'],
      ['gka/chroma.js', 'BSD-3', '10k★', 'Color space & gradient math library.', 'Generate harmonious 60-30-10 swatches'],
      ['cpettitt/dagre', 'MIT', '5.1k★', 'Directed graph layout for visual node diagrams.', 'Auto-layout State Machine diagrams'],
      ['html2canvas/html2canvas', 'MIT', '31k★', 'Client DOM snapshot capture.', 'Shareable social studio cards'],
      ['eligrey/FileSaver.js', 'MIT', '21k★', 'Reliable cross-browser blob download helper.', 'Export textures, PDFs, and meshes'],
    ],
  },
  isometric: {
    category: 'Isometric 2:1 Projection & Tile Engines',
    items: [
      ['sebleedelisle/JSIso', 'MIT', '0.8k★', 'Lightweight HTML5 isometric tile & depth-sort engine.', '2:1 diamond tile math'],
      ['obelisk-js/obelisk.js', 'MIT', '3.1k★', 'Pixel-crisp isometric 3D primitive renderer on Canvas.', 'Extruded isometric blocks & ramps'],
      ['desandro/zdog', 'MIT', '11k★', 'Round, flat, designer-friendly pseudo-3D engine.', 'Stylized rounded isometric props'],
      ['mapeditor/tiled', 'GPL/BSD', '11k★', 'Universal 2D & isometric tilemap format (.tmj/.tmx).', 'Standard isometric level import/export'],
      ['photonstorm/phaser', 'MIT', '37k★', 'Built-in isometric tilemap & camera projection.', 'Isometric depth sorting'],
      ['rot-js/rot.js', 'BSD-3', '3.5k★', 'Isometric & hexagonal grid projection utilities.', 'Tile coordinate picking math'],
      ['mrdoob/three.js', 'MIT', '105k★', 'OrthographicCamera isometric 3D PBR rendering.', 'Studio Isometric Camera Preset'],
      ['HexagonEngine/Hexagon', 'MIT', '0.9k★', 'Tactical iso & hex grid overlay math.', 'Strategy tile highlight overlays'],
      ['pixijs/tilemap', 'MIT', '0.8k★', 'GPU-batched multi-layer tilemap renderer.', 'Zero-GC static tile chunk batching'],
      ['redblobgames/grids', 'CC0/MIT', '1.6k★', 'Canonical isometric & hex grid coordinate reference.', 'World-to-tile & tile-to-world math'],
    ],
  },
  '3d': {
    category: 'WebGL / Three.js / PBR 3D Engines',
    items: [
      ['mrdoob/three.js', 'MIT', '105k★', 'Premier JavaScript 3D WebGL/WebGPU library.', 'Core 3D Sandbox Viewport & PBR'],
      ['pmndrs/react-three-fiber', 'MIT', '28k★', 'React reconciler patterns for Three.js.', 'Clean mount/unmount lifecycle inspiration'],
      ['BabylonJS/Babylon.js', 'Apache-2.0', '24k★', 'Enterprise WebGL/WebGPU 3D engine.', 'PBR+ clearcoat & environment lighting'],
      ['playcanvas/engine', 'MIT', '10k★', 'Mobile-optimized 3D runtime.', 'Itel A70 draw-call & LOD budgeting'],
      ['google/model-viewer', 'Apache-2.0', '7.3k★', 'Web component for interactive glTF inspection.', 'Asset preview & turntable framing'],
      ['KhronosGroup/glTF', 'Apache-2.0', '6.1k★', 'Official glTF 2.0 3D transmission format spec.', 'Standardized 3D mesh export schema'],
      ['CesiumGS/cesium', 'Apache-2.0', '13k★', 'Double-precision 3D geospatial & origin rebasing.', 'Layer 0.1 500m Origin Rebasing'],
      ['stackgl/regl', 'MIT', '6.4k★', 'Stateless functional WebGL abstraction.', 'Single-shader SRP batching insight'],
      ['visgl/luma.gl', 'MIT', '2.7k★', 'High-performance WebGL2/WebGPU compute & render toolkit.', 'Instanced particle rendering'],
      ['n64decomp/tiny3d', 'MIT', '1.4k★', 'Ultra-fast low-poly fixed-point 3D renderer.', 'Low-memory vertex budget discipline'],
    ],
  },
  '2.5d': {
    category: '2.5D Parallax, Mode-7 & Billboard Depth',
    items: [
      ['photonstorm/phaser', 'MIT', '37k★', 'Multi-layer parallax scroll & depth-sorted sprites.', '2.5D parallax background bands'],
      ['pixijs/layers', 'MIT', '0.7k★', 'Explicit z-index & camera depth sorting for 2.5D.', 'Depth-sorted actors & pillars'],
      ['mrdoob/three.js', 'MIT', '105k★', '2.5D side-scroller & 3/4 follow camera over 3D geometry.', '3/4 Chase Camera Preset'],
      ['jakesgordon/javascript-racer', 'MIT', '2.1k★', '2.5D pseudo-perspective road & elevation bands.', 'High-speed horizon lane curvature'],
      ['melonjs/melonJS', 'MIT', '4.8k★', '2.5D isometric & parallax stage containers.', 'Parallax depth factor scaling'],
      ['kaboom/kaboom', 'MIT', '3.1k★', 'Layered 2.5D Z-order camera system.', 'Clean Y-sort actor depth'],
      ['excaliburjs/Excalibur', 'BSD-2', '2.6k★', '2.5D parallax layers with camera damping.', 'Exponential camera follow damping'],
      ['desandro/zdog', 'MIT', '11k★', '2.5D vector-extruded volumetric UI & sprites.', 'Clean volumetric 2.5D icons'],
      ['bobbyroe/threejs-parallax', 'MIT', '0.6k★', 'Depth-layered 2.5D planes in Three.js.', 'Layered horizon vista composition'],
      ['akm2/simplex-terrain', 'MIT', '0.5k★', 'Layered 2.5D ridge silhouettes.', 'Distant mountain horizon layers'],
    ],
  },
  '2d': {
    category: '2D Canvas, Sprites & Tilemaps',
    items: [
      ['photonstorm/phaser', 'MIT', '37k★', 'Leading 2D HTML5 game framework.', '2D arcade physics & animation curves'],
      ['pixijs/pixijs', 'MIT', '45k★', 'Fastest 2D WebGL sprite renderer.', 'Batched 2D particle & sprite draws'],
      ['kontrajs/kontra', 'MIT', '2.5k★', 'Tiny 2D game loop & sprite pool.', 'Zero-bloat 2D mobile runtime'],
      ['littlejs/LittleJS', 'MIT', '4.3k★', 'Super-fast 2D WebGL game engine with zero dependencies.', '60fps 10,000+ sprite & sound engine'],
      ['craftyjs/Crafty', 'MIT', '3.7k★', '2D entity-component canvas/DOM engine.', 'Clean 2D collision triggers'],
      ['melonjs/melonJS', 'MIT', '4.8k★', '2D platformer & Tiled map engine.', 'Slope & one-way platform physics'],
      ['excaliburjs/Excalibur', 'BSD-2', '2.6k★', 'TypeScript 2D game engine.', 'Typed 2D actor lifecycles'],
      ['konvajs/konva', 'MIT', '12k★', '2D canvas scene graph & hit testing.', 'Visual collision shape editor'],
      ['paperjs/paper.js', 'MIT', '14k★', 'Vector graphics scripting framework.', 'Crisp vector sprite & decal authoring'],
      ['p5js/p5.js', 'LGPL-2.1', '22k★', 'Creative coding 2D canvas primitives.', 'Procedural shader & art experiments'],
    ],
  },
  'pseudo 3d': {
    category: 'Pseudo-3D Z-Stack, Mode-7 & Projection',
    items: [
      ['ssloy/tinyraycaster', 'WTFPL/MIT', '3.2k★', 'Minimalist software pseudo-3D renderer.', 'Column projection & sprite Z-buffer'],
      ['desandro/zdog', 'MIT', '11k★', '3D-projected 2D vector stacking.', 'Z-stack layered volumetric sprites'],
      ['jakesgordon/javascript-racer', 'MIT', '2.1k★', 'OutRun-style Mode-7 pseudo-3D road projection.', 'Scanline perspective floor projection'],
      ['Code-It-Yourself/ConsoleGameEngine', 'MIT', '5.8k★', 'Educational Mode-7 & raycast math.', 'Pure math floor & wall projection'],
      ['hunterloftis/playfuljs-demos', 'MIT', '2.2k★', 'First-person pseudo-3D canvas raycaster.', 'Zero-WebGL fallback corridor renderer'],
      ['lodev/lode-raycaster', 'BSD', '1.9k★', 'Canonical DDA raycasting tutorial & code.', 'Fast grid DDA ray traversal'],
      ['mattdesl/canvas-sketch', 'MIT', '4.9k★', 'Algorithmic pseudo-3D perspective canvas patterns.', 'Procedural 2.5D/pseudo-3D geometry'],
      ['greggman/twgl.js', 'MIT', '2.9k★', 'Tiny WebGL helper for custom projection passes.', 'Lightweight shader projection'],
      ['glslify/glslify', 'MIT', '2.9k★', 'Modular GLSL shader snippets.', 'Perspective & fog fragment helpers'],
      ['stackgl/gl-mat4', 'MIT', '0.8k★', 'Zero-alloc Float32Array 4x4 matrix math.', 'Pre-allocated camera projection math'],
    ],
  },
  'fake 3D': {
    category: 'Fake-3D Raycasting & Billboard Tricks',
    items: [
      ['AghlaAbdo/42_Cub3D', 'MIT', '0.9k★', 'Clean 16x16 DDA raycaster with textured walls.', 'Zero-WebGL corridor exploration'],
      ['shiro1307/raycast_wolfenstein_renderer', 'MIT', '0.7k★', 'Wolfenstein-style vertical slice renderer.', 'Depth-darkening corridor fog'],
      ['ssloy/tinyraycaster', 'MIT', '3.2k★', 'Compact C++/JS billboard Z-buffer raycaster.', 'Sprite occlusion behind walls'],
      ['TheMozg/awk-raycaster', 'MIT', '1.4k★', 'Ultra-minimalist raycasting math proof.', 'Sub-50-line DDA engine'],
      ['vinibiavatti1/RayCastingTutorial', 'MIT', '1.1k★', 'Step-by-step JavaScript raycaster.', 'Clean 2D-to-3D wall height projection'],
      ['id-Software/wolf3d', 'GPL-2.0', '8.2k★', 'Historic Wolfenstein 3D raycasting source.', 'Fixed-point DDA performance heritage'],
      ['id-Software/DOOM', 'GPL-2.0', '16k★', 'Classic BSP fake-3D sector renderer.', 'Sector height & portal culling concepts'],
      ['fogleman/Craft', 'MIT', '10k★', 'Lightweight voxel chunk culling engine.', 'Chunk face culling & greedy meshing'],
      ['mikolalysenko/ao-mesher', 'MIT', '0.6k★', 'Fast voxel ambient occlusion mesher.', 'Baked vertex AO for low-poly blocks'],
      ['d3/d3-geo', 'BSD-3', '3.2k★', 'Spherical & orthographic projection math.', 'Fake-3D globe & horizon warping'],
    ],
  },
  mobile: {
    category: 'Mobile Optimization & Touch Ergonomics',
    items: [
      ['ionic-team/capacitor', 'MIT', '13k★', 'Modern web-to-native Android/iOS bridge.', 'Package web/3D games to Android APK'],
      ['apache/cordova-android', 'Apache-2.0', '2.5k★', 'Android WebView native runtime wrapper.', 'Android 5.0+ WebView compatibility'],
      ['nipplejs/nipplejs', 'MIT', '3.8k★', 'Responsive virtual touch joystick for mobile games.', 'Ergonomic left/right thumb stick'],
      ['hammerjs/hammer.js', 'MIT', '24k★', 'Multi-touch gesture recognizer.', 'Swipe dash & pinch camera zoom'],
      ['GoogleChrome/lighthouse', 'Apache-2.0', '28k★', 'Mobile performance, memory & PWA auditing.', 'Verify <=16ms main-thread budget'],
      ['pmndrs/detect-gpu', 'MIT', '1.7k★', 'GPU tier classification for mobile devices.', 'Auto-select Itel A70 Eco vs Ultra preset'],
      ['WICG/InputDeviceCapabilities', 'W3C', '0.6k★', 'Touch vs pointer capability detection.', 'Adaptive mobile HUD sizing (>=44px)'],
      ['zloirock/core-js', 'MIT', '24k★', 'Safe JS polyfills for older Android WebViews.', 'Android 5+ runtime safety'],
      ['GoogleChrome/workbox', 'MIT', '12k★', 'Production Service Worker caching strategies.', 'Zero-network offline mobile play'],
      ['androidx/androidx', 'Apache-2.0', '4.3k★', 'Official Android Jetpack lifecycle & coroutines.', 'Worker-thread init (Zero ANR)'],
    ],
  },
  web: {
    category: 'Full-Stack Web & Browser APIs',
    items: [
      ['vitejs/vite', 'MIT', '71k★', 'Instant ESM dev server and Rollup production bundler.', 'Sub-second studio build pipeline'],
      ['expressjs/express', 'MIT', '66k★', 'Minimalist Node.js HTTP server & middleware.', 'Secure /api/ai/* & /api/db/* routes'],
      ['websockets/ws', 'MIT', '22k★', 'Fast Node.js WebSocket server.', 'Bridge Gemini Live real-time voice'],
      ['facebook/react', 'MIT', '233k★', 'Declarative UI library.', 'Modular studio workspace panels'],
      ['tailwindlabs/tailwindcss', 'MIT', '86k★', 'Utility-first CSS with v4 dark mode variants.', 'Clean 60-30-10 dark/light theme'],
      ['drizzle-team/drizzle-orm', 'Apache-2.0', '26k★', 'Type-safe TypeScript SQL ORM.', 'Cloud SQL PostgreSQL persistence'],
      ['firebase/firebase-js-sdk', 'Apache-2.0', '5.3k★', 'Firebase Auth client SDK.', 'Google Sign-In cross-device sync'],
      ['parallax/jsPDF', 'MIT', '29k★', 'Client-side PDF document generator.', 'Automated build analysis PDF export'],
      ['honojs/hono', 'MIT', '22k★', 'Ultrafast Web Standards router.', 'Edge-ready API validation patterns'],
      ['trpc/trpc', 'MIT', '36k★', 'End-to-end typesafe API contracts.', 'Strict frontend-backend payload types'],
    ],
  },
  js: {
    category: 'JavaScript Performance & Data Structures',
    items: [
      ['lodash/lodash', 'MIT', '60k★', 'Battle-tested utility functions.', 'Debounce quick search & deep clone'],
      ['date-fns/date-fns', 'MIT', '35k★', 'Modular immutable date utilities.', 'Format build & commit timestamps'],
      ['nanoid/nanoid', 'MIT', '25k★', 'Compact URL-safe unique ID generator.', 'Traceable ticket, commit & bus IDs'],
      ['fusejs/Fuse', 'Apache-2.0', '18k★', 'Zero-dependency fuzzy search in JS.', 'Instant fuzzy quick-search across menus'],
      ['nodeca/js-yaml', 'MIT', '6.6k★', 'Fast YAML parser and dumper.', 'Export clean studio CI/CD configs'],
      ['Stuk/jszip', 'MIT', '10k★', 'Create and read .zip bundles in JS.', 'Package downloadable Android/PWA kits'],
      ['markedjs/marked', 'MIT', '34k★', 'Fast Markdown compiler.', 'Preview auto-generated technical docs'],
      ['cure53/DOMPurify', 'Apache-2.0', '14k★', 'XSS sanitizer for HTML strings.', 'Strict safe rendering policy'],
      ['developit/mitt', 'MIT', '10k★', '200-byte functional event emitter.', 'Zero-overhead UI event decoupling'],
      ['sindresorhus/p-limit', 'MIT', '4.2k★', 'Run multiple promise-returning ops with concurrency limit.', '4-thread bounded multi-agent runner'],
    ],
  },
  html: {
    category: 'HTML5 Canvas, SVG & Accessibility',
    items: [
      ['mdn/dom-examples', 'CC0', '4.5k★', 'Canonical Web Audio, Canvas & WebGL API examples.', 'Standards-compliant browser media'],
      ['w3c/aria-practices', 'W3C', '6.1k★', 'Authoritative WCAG accessibility widget patterns.', 'Keyboard-accessible tabs & dialogs'],
      ['a11yproject/a11yproject.com', 'MIT', '4.1k★', 'Practical accessibility checklists.', 'Contrast, focus rings & 44px touch'],
      ['svg/svgo', 'MIT', '21k★', 'Node.js SVG optimizer.', 'Crisp minimal title & HUD vector icons'],
      ['whatwg/html', 'W3C', '5.3k★', 'Living HTML specification.', 'Semantic landmark structure'],
      ['GoogleChromeLabs/comlink', 'Apache-2.0', '11k★', 'Ergonomic Web Worker RPC wrapper.', 'Keep Main Thread < 16ms (No ANR)'],
      ['immerjs/immer', 'MIT', '28k★', 'Safe immutable state snapshots.', 'State machine undo snapshots'],
      ['pmndrs/use-gesture', 'MIT', '9.2k★', 'Pointer & wheel gesture bindings.', 'Touch camera & gizmo dragging'],
      ['greensock/GSAP', 'Standard', '20k★', 'High-precision timeline animation curves.', 'Choreographed UI & camera eases'],
      ['eligrey/canvas-toBlob.js', 'MIT', '1.1k★', 'Cross-browser canvas screenshot export.', 'Photo Mode & social share capture'],
    ],
  },
  engine: {
    category: 'Core Game Engine Architectures',
    items: [
      ['godotengine/godot', 'MIT', '95k★', 'Scene tree, signals, and cross-platform export.', 'Unified Editor -> Export architecture'],
      ['bevyengine/bevy', 'MIT', '39k★', 'Strict ECS + Plugin + Schedule architecture.', 'Deterministic frame-stage scheduling'],
      ['playcanvas/engine', 'MIT', '10k★', 'Fast WebGL2 PBR engine for mobile.', 'PBR + RoomEnvironment lighting'],
      ['cocos/cocos-engine', 'MIT', '8.3k★', 'Scene hierarchy + prefab asset pipeline.', 'Mobile asset LRU memory caps'],
      ['axmolengine/axmol', 'MIT', '1.8k★', 'Modernized Cocos2d-x C++ mobile engine.', 'Low-end Android NDK build flags'],
      ['turbulenz/turbulenz_engine', 'MIT', '3.3k★', 'Modular JS/WebGL HTML5 game engine.', 'TypedArray resource pool patterns'],
      ['urho3d/Urho3D', 'MIT', '4.9k★', 'Lightweight C++ 3D engine for Android/Desktop.', 'Single-binary C++ / WASM core inspiration'],
      ['bkaradzic/bgfx', 'BSD-2', '15k★', 'Cross-platform rendering API abstraction.', 'Draw-call sorting & shader uniformity'],
      ['ocornut/imgui', 'MIT', '63k★', 'Immediate-mode profiler & debug overlay.', 'Sub-ms CPU/GPU/DrawCall telemetry'],
      ['libsdl-org/SDL', 'Zlib', '11k★', 'Cross-platform input, audio & window layer.', 'Unified keyboard/gamepad/touch input'],
    ],
  },
  design: {
    category: 'Design Systems, Style Bibles & UX',
    items: [
      ['tailwindlabs/tailwindcss', 'MIT', '86k★', 'Systematic spacing, color & dark-mode tokens.', 'Consistent studio design language'],
      ['adobe/spectrum-tokens', 'Apache-2.0', '1.2k★', 'Enterprise design token architecture.', 'Semantic surface/text pairing'],
      ['radix-ui/colors', 'MIT', '3.2k★', 'Perceptually uniform light & dark color scales.', 'AA contrast in both themes'],
      ['primer/design', 'MIT', '1.4k★', 'Developer tool UX & hierarchy guidelines.', 'Clean GitHub & VCS diff layouts'],
      ['storybookjs/storybook', 'MIT', '85k★', 'Isolated component state documentation.', 'Empty/loading/error state completeness'],
      ['excalidraw/excalidraw', 'MIT', '93k★', 'Clean diagramming & node sketching UX.', 'Interactive State Machine visual canvas'],
      ['xyflow/xyflow', 'MIT', '27k★', 'Node-based editor UI for workflows & FSMs.', 'State transition graph UX inspiration'],
      ['shadcn-ui/ui', 'MIT', '81k★', 'Clean accessible component patterns.', 'Minimalist single-elevation panels'],
      ['rsms/inter', 'OFL', '16k★', 'Open-source font engineering reference.', 'Tabular numeral spacing standards'],
      ['tonsky/FiraCode', 'OFL', '77k★', 'Monospace developer typography.', 'Clear telemetry & script readability'],
    ],
  },
  constructor: {
    category: 'Visual Game Constructors & Builders',
    items: [
      ['gdevelop/GDevelop', 'MIT', '13k★', 'Visual no-code game constructor.', 'Accessible prompt + visual rule workflow'],
      ['ct-js/ct-js', 'MIT', '2.4k★', 'Visual 2D game constructor with live preview.', 'Beginner-friendly studio tabs'],
      ['craftyjs/Crafty', 'MIT', '3.7k★', 'Composable entity builder API.', 'Prefab & component assembly'],
      ['grapesjs/grapesjs', 'BSD-3', '23k★', 'Web & UI drag-and-drop constructor.', 'HUD layout & screen builder patterns'],
      ['tldraw/tldraw', 'Apache-2.0', '38k★', 'Infinite canvas spatial editor.', 'Level layout & diagramming UX'],
      ['mrdoob/three.js', 'MIT', '105k★', 'Three.js Editor scene constructor.', 'Transform gizmo & property inspector'],
      ['pmndrs/gltfjsx', 'MIT', '5.3k★', 'Convert 3D assets into declarative JSX trees.', 'Inspectable 3D scene hierarchies'],
      ['blockly/blockly', 'Apache-2.0', '12k★', 'Visual logic block constructor.', 'Safe guard expression builder'],
      ['retejs/rete', 'MIT', '10k★', 'Visual node programming framework.', 'Shader & FSM node graphs'],
      ['litegraph/litegraph.js', 'MIT', '6.6k★', 'Canvas-based node graph execution engine.', 'Real-time event-bus visual wiring'],
    ],
  },
  prosedural: {
    category: 'Procedural Content & Simulation',
    items: [
      ['jwagner/simplex-noise.js', 'MIT', '2.1k★', 'Seeded deterministic procedural noise.', 'Procedural terrain & foliage placement'],
      ['ondras/rot.js', 'BSD-3', '3.5k★', 'Procedural dungeon, cellular automata & BSP.', 'Auto-generated arena obstacles'],
      ['mxgmn/WaveFunctionCollapse', 'MIT', '23k★', 'Constraint-based tile & level synthesis.', 'Coherent sanctuary ruin generation'],
      ['mxgmn/MarkovJunior', 'MIT', '5.1k★', 'Rule-based procedural rewrite engine.', 'Procedural quest & room grammar'],
      ['d3/d3-random', 'ISC', '0.8k★', 'Seeded statistical distributions.', 'Fair loot & enemy spawn pacing'],
      ['mrdoob/texgen.js', 'MIT', '0.9k★', 'Procedural canvas texture synthesis.', '0-byte procedural bump & normal maps'],
      ['soulwire/sketch.js', 'MIT', '3.9k★', 'Procedural particle & field simulation.', 'Ambient dust & ember particle fields'],
      ['matteobruni/tsparticles', 'MIT', '7.8k★', 'Configurable particle emitter system.', 'Pooled burst & trail presets'],
      ['stegu/webgl-noise', 'MIT', '1.8k★', 'Procedural GLSL noise shaders.', 'Animated water & mist shaders'],
      ['cabreraalex/procedural-generation', 'MIT', '0.7k★', 'Curated procedural algorithms reference.', 'Biome & heightmap math'],
    ],
  },
  prompt: {
    category: 'Prompt Engineering & AI Workflows',
    items: [
      ['googleapis/js-genai', 'Apache-2.0', '3.1k★', 'Official @google/genai TypeScript SDK.', 'Structured JSON, Thinking & Live API'],
      ['microsoft/promptflow', 'MIT', '10k★', 'DAG-based prompt orchestration & evaluation.', 'Multi-stage GDD -> QA prompt chains'],
      ['promptfoo/promptfoo', 'MIT', '6.2k★', 'Automated prompt regression & rubric testing.', 'Validate GDD & FSM output consistency'],
      ['stanfordnlp/dspy', 'MIT', '22k★', 'Programmatic prompt optimization & feedback loops.', 'Self-refining AAA studio prompts'],
      ['jxnl/instructor', 'MIT', '9.5k★', 'Structured JSON schema extraction patterns.', 'Strict typed GDD & Style Bible output'],
      ['langchain-ai/langchainjs', 'MIT', '14k★', 'Composable prompt templates & chains.', 'Department-specific system prompts'],
      ['f/awesome-chatgpt-prompts', 'CC0', '120k★', 'Role-based prompt persona library.', '18 specialist studio personas'],
      ['Significant-Gravitas/AutoGPT', 'MIT', '172k★', 'Autonomous goal-to-task decomposition.', 'Prompt-to-playable-blueprint loop'],
      ['openai/evals', 'MIT', '15k★', 'Automated AI output evaluation suites.', 'Verify AI-generated game logic'],
      ['dair-ai/Prompt-Engineering-Guide', 'MIT', '53k★', 'Structured reasoning & CoT prompt patterns.', 'High-thinking architectural prompts'],
    ],
  },
  connector: {
    category: 'Engine Connectors & Integrations',
    items: [
      ['modelcontextprotocol/servers', 'MIT', '42k★', 'Universal tool & data connectors for AI agents.', 'Connect studio state to AI Director'],
      ['colyseus/colyseus', 'MIT', '6.1k★', 'Realtime WebSocket multiplayer connector.', 'Team presence & live collab sync'],
      ['firebase/firebase-js-sdk', 'Apache-2.0', '5.3k★', 'Auth & cloud identity connector.', 'Cross-device Google Sign-In'],
      ['drizzle-team/drizzle-orm', 'Apache-2.0', '26k★', 'PostgreSQL relational connector.', 'Cloud SQL persistent project store'],
      ['octokit/octokit.js', 'MIT', '7.2k★', 'Official GitHub REST & GraphQL connector.', 'Live repository search & sync'],
      ['axios/axios', 'MIT', '106k★', 'Promise-based HTTP connector.', 'Reliable API & webhook transport'],
      ['nodemailer/nodemailer', 'MIT', '17k★', 'Email alert transport connector.', 'Instant build-failure notifications'],
      ['web-push-libs/web-push', 'MIT', '4.4k★', 'VAPID Web Push notification connector.', 'Push alerts for releases & feedback'],
      ['yjs/yjs', 'MIT', '18k★', 'CRDT real-time collaboration connector.', 'Conflict-free multi-user GDD editing'],
      ['socketio/socket.io', 'MIT', '62k★', 'Bidirectional real-time event connector.', 'Live studio activity & build stream'],
    ],
  },
  coding: {
    category: 'Developer Tooling, AST & Testing',
    items: [
      ['microsoft/TypeScript', 'Apache-2.0', '103k★', 'Strict structural typing for zero-typo codebases.', 'Compile-time contract enforcement'],
      ['biomejs/biome', 'MIT', '17k★', 'Ultra-fast Rust linter & formatter.', 'Instant code quality checks'],
      ['vitest-dev/vitest', 'MIT', '14k★', 'Fast unit testing framework.', 'Automated logic validation pattern'],
      ['evanw/esbuild', 'MIT', '38k★', 'Sub-second JS/TS bundler.', 'Fast build & bundle size verification'],
      ['privatenumber/tsx', 'MIT', '10k★', 'Zero-config TypeScript execution.', 'Run server & node:test suites directly'],
      ['pmndrs/zustand', 'MIT', '51k★', 'Clean TypeScript state management.', 'Predictable studio state store'],
      ['isomorphic-git/isomorphic-git', 'MIT', '7.8k★', 'Pure JS git implementation in browser.', 'Integrated VCS commits & diffs'],
      ['kpdecker/jsdiff', 'BSD-3', '8.2k★', 'Text & JSON diffing library.', 'Compare GDD & script revisions'],
      ['prettier/prettier', 'MIT', '50k★', 'Consistent formatting across generated scripts.', 'Zero syntax drift'],
      ['eslint/eslint', 'MIT', '25k★', 'Static bug & dead-code detector.', 'Eliminate unused variables & leaks'],
    ],
  },
  android: {
    category: 'Android Native, NDK & WebView',
    items: [
      ['ionic-team/capacitor', 'MIT', '13k★', 'Cross-platform native Android app runtime.', 'Ship web/3D games as native Android apps'],
      ['nicb/godot-android', 'MIT', '1.1k★', 'Android Gradle & NDK game build templates.', 'Reference for Itel A70 release flags'],
      ['google/oboe', 'Apache-2.0', '4.1k★', 'Low-latency C++ Android audio library.', 'Zero-glitch Android 5+ audio design'],
      ['google/filament', 'Apache-2.0', '18k★', 'Lightweight physically-based rendering for Android.', 'Mobile PBR shader efficiency'],
      ['Android/ndk-samples', 'Apache-2.0', '11k★', 'Official Android NDK & GLES3 samples.', 'libqolbu.so native C++ integration'],
      ['square/leakcanary', 'Apache-2.0', '29k★', 'Memory leak detection for Android.', 'Verify Zero-Leak 4-hour stability'],
      ['Kotlin/kotlinx.coroutines', 'Apache-2.0', '13k★', 'Asynchronous worker-thread IO on Android.', 'Eliminate ANR on MainActivity'],
      ['JetBrains/compose-multiplatform', 'Apache-2.0', '16k★', 'Declarative mobile UI patterns.', 'Clean responsive Android shell'],
      ['termux/termux-app', 'GPL-3.0', '39k★', 'Android terminal & tooling reference.', 'On-device mobile profiling habits'],
      ['bumptech/glide', 'BSD/MIT', '35k★', 'Memory-aware Android image LRU cache.', '40MB LRU texture eviction model'],
    ],
  },
  apk: {
    category: 'APK / AAB Packaging & Release',
    items: [
      ['google/bundletool', 'Apache-2.0', '2.7k★', 'Official tool to build & test Android App Bundles (.aab).', 'Generate split APKs for Itel A70'],
      ['iBotPeaches/Apktool', 'Apache-2.0', '21k★', 'Inspect & verify compiled APK manifests and resources.', 'Audit APK size & permissions'],
      ['google/android-gradle-plugin', 'Apache-2.0', '1.5k★', 'Release minification, R8 & ProGuard shrinking.', 'Shrink binary to 214 MB target'],
      ['fastlane/fastlane', 'MIT', '39k★', 'Automated APK/AAB signing and Play Console deployment.', 'CI/CD mobile release automation'],
      ['Guardsquare/proguard', 'GPL-2.0', '2.8k★', 'Bytecode shrinking and obfuscation for Android.', 'Strip dead code & protect release'],
      ['GoogleChromeLabs/bubblewrap', 'Apache-2.0', '2.5k★', 'Package PWA directly into a Play-ready Android APK/TWA.', '1-click PWA-to-APK wrapper'],
      ['nicolasgramlich/AndEngine', 'Apache-2.0', '4.3k★', 'Classic lightweight Android 2D OpenGL ES engine.', 'Android 5+ low-end device benchmarks'],
      ['libgdx/libgdx', 'Apache-2.0', '23k★', 'Cross-platform Android/Desktop Java game framework.', 'Multi-platform export structure'],
      ['skylot/jadx', 'Apache-2.0', '43k★', 'Dex & APK static analyzer.', 'Verify zero deprecated API calls'],
      ['react-native-community/cli', 'MIT', '2.1k★', 'Automated Android release Gradle runner.', 'Standardized CLI APK build flags'],
    ],
  },
  PWA: {
    category: 'Progressive Web App & Offline',
    items: [
      ['GoogleChrome/workbox', 'MIT', '12k★', 'Production Service Worker precaching & runtime routing.', 'Offline-first game asset caching'],
      ['vite-pwa/vite-plugin-pwa', 'MIT', '3.4k★', 'Zero-config PWA manifest & SW generator for Vite.', 'Instant mobile home-screen install'],
      ['jakearchibald/idb', 'ISC', '6.1k★', 'Tiny Promise wrapper for IndexedDB.', 'Offline save slots & asset cache'],
      ['localForage/localForage', 'Apache-2.0', '25k★', 'Offline storage with IndexedDB/localStorage fallback.', 'Resilient offline project drafts'],
      ['GoogleChromeLabs/bubblewrap', 'Apache-2.0', '2.5k★', 'Trusted Web Activity APK generator from PWA.', 'Turn studio PWA into Android APK'],
      ['pwa-builder/PWABuilder', 'MIT', '3.2k★', 'Package PWAs for Android, Windows & iOS stores.', 'Multi-platform store packaging'],
      ['mdn/pwa-examples', 'CC0', '3.1k★', 'Reference offline-first PWA architecture.', 'Install prompt & offline indicator'],
      ['web-push-libs/web-push', 'MIT', '4.4k★', 'Browser push notification protocol.', 'Push alerts for build & user feedback'],
      ['dexie/Dexie.js', 'Apache-2.0', '12k★', 'Fast IndexedDB wrapper for structured offline data.', 'Offline ticket & telemetry queue'],
      ['nicb/web-app-manifest-validator', 'MIT', '0.5k★', 'Validate PWA manifest icons & display modes.', 'Verify installability compliance'],
    ],
  },
};

export const GITHUB_33_GROUPS: GitHubKeywordGroup[] = GITHUB_33_KEYWORDS.map((keyword) => {
  const seed = KEYWORD_SEEDS[keyword];
  return {
    keyword,
    category: seed.category,
    repos: seed.items.map(([repo, license, starsLabel, description, dnaIntegration], idx) => ({
      rank: idx + 1,
      repo,
      url: `https://github.com/${repo}`,
      license,
      starsLabel,
      description,
      dnaIntegration,
    })),
  };
});

export function search33KeywordsCatalog(query: string, keywordFilter = 'all'): GitHubKeywordGroup[] {
  const q = query.trim().toLowerCase();
  return GITHUB_33_GROUPS.filter((g) => keywordFilter === 'all' || g.keyword.toLowerCase() === keywordFilter.toLowerCase())
    .map((group) => {
      if (!q) return group;
      const keywordMatches = group.keyword.toLowerCase().includes(q) || group.category.toLowerCase().includes(q);
      if (keywordMatches) return group;
      const filteredRepos = group.repos.filter(
        (r) =>
          r.repo.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.dnaIntegration.toLowerCase().includes(q) ||
          r.license.toLowerCase().includes(q)
      );
      return { ...group, repos: filteredRepos };
    })
    .filter((g) => g.repos.length > 0);
}

export async function fetchLiveGitHubTop10(keyword: string): Promise<GitHubRepoEntry[]> {
  const res = await fetch(
    `https://api.github.com/search/repositories?q=${encodeURIComponent(`${keyword} in:name,description`)}&sort=stars&order=desc&per_page=10`,
    { headers: { Accept: 'application/vnd.github+json' } }
  );
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status}`);
  }
  const data = (await res.json()) as {
    items?: Array<{
      full_name: string;
      html_url: string;
      stargazers_count: number;
      description: string | null;
      license?: { spdx_id?: string | null } | null;
    }>;
  };
  return (data.items ?? []).slice(0, 10).map((item, idx) => ({
    rank: idx + 1,
    repo: item.full_name,
    url: item.html_url,
    license: item.license?.spdx_id || 'Open Source',
    starsLabel: `${item.stargazers_count >= 1000 ? `${(item.stargazers_count / 1000).toFixed(1)}k` : item.stargazers_count}★`,
    description: item.description || 'Open-source repository.',
    dnaIntegration: `Live GitHub match for '${keyword}'`,
  }));
}
