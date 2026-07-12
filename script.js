(function (root) {
  "use strict";

  const GRID_WIDTH = 10;
  const GRID_HEIGHT = 8;
  const STEP_DELAY = 420;
  const CONTROL_DELAY = 220;

  const STORAGE_KEYS = {
    level: "codeRobot.v2.currentLevel",
    done: "codeRobot.v2.doneLevels",
    commands: "codeRobot.v2.commandsByLevel",
    actionLog: "codeRobot.v2.actionLog",
    teacherAccess: "codeRobot.v2.teacherAccess",
    campaign: "codeRobot.v2.campaignVersion",
  };

  const MAX_ACTION_LOG = 500;
  const CAMPAIGN_VERSION = "23-levels-v1";

  const COMMANDS = {
    MOVE: "move",
    TURN: "turn",
    WAIT: "wait",
    TAKE_KEY: "takeKey",
    OPEN_DOOR: "openDoor",
    REPEAT: "repeat",
    REPEAT_UNTIL: "repeatUntil",
    IF: "if",
    IF_ELSE: "ifElse",
  };

  const CONDITIONS = {
    FRONT_CLEAR: "frontClear",
    ON_KEY: "onKey",
    DOOR_AHEAD: "doorAhead",
    HAS_KEY: "hasKey",
    ABYSS_AHEAD: "abyssAhead",
    ENEMY_AHEAD: "enemyAhead",
    TRAP_AHEAD: "trapAhead",
    PATH_AHEAD: "pathAhead",
    PATH_LEFT: "pathLeft",
    PATH_RIGHT: "pathRight",
  };

  const REPEAT_VALUES = Array.from({ length: 14 }, (_, index) => index + 2);

  const COMMAND_DEFINITIONS = {
    [COMMANDS.MOVE]: {
      label: "рухатися",
      kind: "method",
      color: "blue",
      fields: [],
    },
    [COMMANDS.TURN]: {
      label: "повернути",
      kind: "method",
      color: "gold",
      fields: [
        {
          name: "direction",
          label: "куди",
          type: "select",
          default: "right",
          values: [
            { value: "left", label: "ліворуч" },
            { value: "right", label: "праворуч" },
          ],
        },
      ],
    },
    [COMMANDS.WAIT]: { label: "чекати()", kind: "method", color: "blue", fields: [] },
    [COMMANDS.TAKE_KEY]: { label: "взяти ключ()", kind: "method", color: "gold", fields: [] },
    [COMMANDS.OPEN_DOOR]: { label: "відкрити двері()", kind: "method", color: "brown", fields: [] },
    [COMMANDS.REPEAT]: {
      label: "повторити",
      kind: "loop",
      color: "green",
      acceptsBody: true,
      fields: [{ name: "times", label: "разів", type: "number", min: 2, max: 15, default: 3, values: REPEAT_VALUES }],
    },
    [COMMANDS.REPEAT_UNTIL]: {
      label: "повторювати до кристала",
      kind: "loop",
      color: "green",
      acceptsBody: true,
      fields: [],
    },
    [COMMANDS.IF]: {
      label: "якщо",
      kind: "condition",
      color: "purple",
      acceptsBody: true,
      fields: [
        {
          name: "condition",
          label: "умова",
          type: "select",
          default: CONDITIONS.PATH_AHEAD,
          values: [
            { value: CONDITIONS.PATH_AHEAD, label: "попереду шлях" },
            { value: CONDITIONS.PATH_LEFT, label: "ліворуч шлях" },
            { value: CONDITIONS.PATH_RIGHT, label: "праворуч шлях" },
            { value: CONDITIONS.ABYSS_AHEAD, label: "попереду безодня" },
            { value: CONDITIONS.ENEMY_AHEAD, label: "попереду ворог" },
            { value: CONDITIONS.TRAP_AHEAD, label: "попереду пастка" },
            { value: CONDITIONS.ON_KEY, label: "робот на ключі" },
            { value: CONDITIONS.DOOR_AHEAD, label: "попереду двері" },
            { value: CONDITIONS.HAS_KEY, label: "ключ у робота" },
          ],
        },
      ],
    },
    [COMMANDS.IF_ELSE]: {
      label: "якщо / інакше",
      kind: "condition",
      color: "purple",
      acceptsBody: true,
      acceptsElseBody: true,
      fields: [
        {
          name: "condition",
          label: "умова",
          type: "select",
          default: CONDITIONS.PATH_AHEAD,
          values: [],
        },
      ],
    },
  };

  COMMAND_DEFINITIONS[COMMANDS.IF_ELSE].fields[0].values = COMMAND_DEFINITIONS[COMMANDS.IF].fields[0].values;

  const DIRS = ["up", "right", "down", "left"];
  const DELTAS = {
    up: { x: 0, y: -1 },
    right: { x: 1, y: 0 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
  };

  const assetMap = {
    robotUp: "assets/svg/robot-up.svg",
    robotRight: "assets/svg/robot-right.svg",
    robotDown: "assets/svg/robot-down.svg",
    robotLeft: "assets/svg/robot-left.svg",
    wall: "assets/svg/wall.svg",
    floor: "assets/svg/floor.svg",
    key: "assets/svg/key.svg",
    doorClosed: "assets/svg/door-closed.svg",
    doorOpen: "assets/svg/door-open.svg",
    crystal: "assets/svg/crystal.svg",
    treasure: "assets/svg/treasure.svg",
  };

  function b(type, args = {}, body = [], elseBody = []) {
    const definition = COMMAND_DEFINITIONS[type];
    const finalArgs = {};
    for (const field of definition.fields || []) finalArgs[field.name] = args[field.name] ?? field.default;
    if (!definition.acceptsBody) return { type, args: finalArgs };
    const block = { type, args: finalArgs, body };
    if (definition.acceptsElseBody) block.elseBody = elseBody;
    return block;
  }

  function walk(steps) {
    return b(COMMANDS.REPEAT, { times: steps }, [b(COMMANDS.MOVE)]);
  }

  function line(x1, y1, x2, y2) {
    const points = [];
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let index = 0; index <= steps; index += 1) {
      points.push({ x: x1 + dx * index, y: y1 + dy * index });
    }
    return points;
  }

  function borderWalls(width, height) {
    return [
      ...line(0, 0, width - 1, 0),
      ...line(0, height - 1, width - 1, height - 1),
      ...line(0, 1, 0, height - 2),
      ...line(width - 1, 1, width - 1, height - 2),
    ];
  }

  function withoutPositions(list, holes) {
    return list.filter((item) => !holes.some((hole) => item.x === hole.x && item.y === hole.y));
  }

  function appendUnique(points, point) {
    if (!points.some((item) => samePos(item, point))) points.push({ x: point.x, y: point.y });
  }

  function route(...segments) {
    const points = [];
    segments.flat().forEach((point) => appendUnique(points, point));
    return points;
  }

  const LEVELS = [
    {
      name: "Метод руху",
      hint: "Один блок руху робить один крок.",
      robot: { x: 1, y: 3, dir: "right" },
      availableBlocks: [COMMANDS.MOVE],
      walls: [],
      key: null,
      door: null,
      crystal: { x: 2, y: 3 },
      solution: [b(COMMANDS.MOVE)],
    },
    {
      name: "Поворот",
      hint: "Метод повертає робота, але не рухає.",
      robot: { x: 1, y: 5, dir: "up" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN],
      walls: [],
      key: null,
      door: null,
      crystal: { x: 3, y: 4 },
      solution: [
        b(COMMANDS.MOVE),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.MOVE),
        b(COMMANDS.MOVE),
      ],
    },
    {
      name: "Обхід",
      hint: "Склади маршрут як послідовність методів.",
      robot: { x: 1, y: 4, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN],
      walls: [{ x: 3, y: 4 }],
      key: null,
      door: null,
      crystal: { x: 5, y: 3 },
      solution: [
        b(COMMANDS.MOVE),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.MOVE),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.MOVE),
        b(COMMANDS.MOVE),
        b(COMMANDS.MOVE),
      ],
    },
    {
      name: "Ключ і двері",
      hint: "Викликай методи в правильному порядку.",
      robot: { x: 1, y: 5, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.TAKE_KEY, COMMANDS.OPEN_DOOR],
      walls: [
        { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 },
        { x: 4, y: 4 }, { x: 4, y: 6 }, { x: 4, y: 7 },
      ],
      key: { x: 2, y: 5 },
      door: { x: 4, y: 5 },
      crystal: { x: 6, y: 5 },
      solution: [
        b(COMMANDS.MOVE),
        b(COMMANDS.TAKE_KEY),
        b(COMMANDS.MOVE),
        b(COMMANDS.OPEN_DOOR),
        b(COMMANDS.MOVE),
        b(COMMANDS.MOVE),
        b(COMMANDS.MOVE),
      ],
    },
    {
      name: "Цикл",
      hint: "Повторення стискає однакові кроки.",
      robot: { x: 1, y: 1, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT],
      maxBlocks: 5,
      walls: [{ x: 7, y: 1 }, { x: 7, y: 2 }],
      key: null,
      door: null,
      crystal: { x: 6, y: 4 },
      solution: [walk(5), b(COMMANDS.TURN, { direction: "right" }), walk(3)],
    },
    {
      name: "Два повторення",
      hint: "Довгі відрізки краще стискати повторенням.",
      robot: { x: 1, y: 1, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT],
      maxBlocks: 8,
      walls: [{ x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 }, { x: 7, y: 5 }],
      key: null,
      door: null,
      crystal: { x: 7, y: 4 },
      solution: [
        walk(2),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.REPEAT, { times: 3 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.REPEAT, { times: 4 }, [b(COMMANDS.MOVE)]),
      ],
    },
    {
      name: "Три перевірки",
      hint: "Один код має пройти шлях, ворога і пастку.",
      robot: { x: 2, y: 3, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT, COMMANDS.IF],
      maxBlocks: 7,
      walls: [],
      safePath: line(2, 3, 7, 3),
      enemies: [],
      traps: [],
      key: null,
      door: null,
      crystal: { x: 7, y: 3 },
      trials: [
        {
          label: "Шлях",
          robot: { x: 2, y: 3, dir: "right" },
          crystal: { x: 7, y: 3 },
          safePath: line(2, 3, 7, 3),
          enemies: [],
          traps: [],
        },
        {
          label: "Ворог",
          robot: { x: 2, y: 3, dir: "right" },
          crystal: { x: 2, y: 7 },
          safePath: line(2, 3, 2, 7),
          enemies: [{ x: 3, y: 3 }],
          traps: [],
        },
        {
          label: "Пастка",
          robot: { x: 2, y: 3, dir: "right" },
          crystal: { x: 2, y: 0 },
          safePath: line(2, 3, 2, 0),
          enemies: [],
          traps: [{ x: 3, y: 3 }],
        },
      ],
      solution: [
        b(COMMANDS.REPEAT, { times: 6 }, [
          b(COMMANDS.IF, { condition: CONDITIONS.ENEMY_AHEAD }, [b(COMMANDS.TURN, { direction: "right" })]),
          b(COMMANDS.IF, { condition: CONDITIONS.TRAP_AHEAD }, [b(COMMANDS.TURN, { direction: "left" })]),
          b(COMMANDS.IF, { condition: CONDITIONS.PATH_AHEAD }, [b(COMMANDS.MOVE)]),
        ]),
      ],
    },
    {
      name: "Два виходи",
      hint: "Одна умова обирає дію, а «інакше» — другий варіант.",
      robot: { x: 2, y: 4, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT, COMMANDS.IF_ELSE],
      maxBlocks: 5,
      walls: [],
      safePath: line(2, 4, 2, 7),
      enemies: [{ x: 3, y: 4 }],
      key: null,
      door: null,
      crystal: { x: 2, y: 7 },
      trials: [
        {
          label: "Ворог праворуч",
          robot: { x: 2, y: 4, dir: "right" },
          safePath: line(2, 4, 2, 7),
          enemies: [{ x: 3, y: 4 }],
          crystal: { x: 2, y: 7 },
        },
        {
          label: "Шлях ліворуч",
          robot: { x: 2, y: 4, dir: "right" },
          safePath: line(2, 4, 2, 1),
          enemies: [],
          crystal: { x: 2, y: 1 },
        },
      ],
      solution: [
        b(
          COMMANDS.IF_ELSE,
          { condition: CONDITIONS.ENEMY_AHEAD },
          [b(COMMANDS.TURN, { direction: "right" })],
          [b(COMMANDS.TURN, { direction: "left" })],
        ),
        walk(3),
      ],
    },
    {
      name: "Посунь ящик",
      hint: "Крок у бік ящика штовхає його на одну вільну клітинку.",
      robot: { x: 1, y: 4, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.REPEAT],
      maxBlocks: 2,
      walls: [],
      safePath: line(1, 4, 6, 4),
      crates: [{ x: 3, y: 4 }],
      key: null,
      door: null,
      crystal: { x: 5, y: 4 },
      solution: [walk(4)],
    },
    {
      name: "Ящик на кнопку",
      hint: "Залиш ящик на круглій кнопці, щоб відкрити ворота.",
      robot: { x: 1, y: 5, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT],
      walls: [],
      safePath: route(line(1, 5, 5, 5), line(4, 5, 4, 3), line(4, 3, 8, 3), line(8, 3, 8, 2)),
      crates: [{ x: 3, y: 5 }],
      buttons: [{ id: "crate-gate", x: 5, y: 5, requires: "crate" }],
      gates: [{ x: 5, y: 3, buttonId: "crate-gate" }],
      key: null,
      door: null,
      crystal: { x: 8, y: 2 },
      solution: [
        walk(3),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(2),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.MOVE),
      ],
    },
    {
      name: "Кнопка вмикає міст",
      hint: "Спочатку наступи на кнопку, тоді переходь воду по ввімкненому мосту.",
      robot: { x: 1, y: 6, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT],
      maxBlocks: 8,
      walls: [],
      safePath: route(line(1, 6, 5, 6), line(5, 6, 5, 2), line(5, 2, 8, 2)),
      water: line(1, 4, 8, 4),
      toggleBridges: [{ x: 5, y: 4, buttonId: "bridge-button" }],
      buttons: [{ id: "bridge-button", x: 3, y: 6, requires: "robotOrCrate" }],
      key: null,
      door: null,
      crystal: { x: 8, y: 2 },
      solution: [
        walk(4),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(3),
      ],
    },
    {
      name: "Дочекайся патруля",
      hint: "Пунктир показує маршрут ворога: зачекай у безпечній клітинці.",
      robot: { x: 1, y: 4, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.WAIT, COMMANDS.REPEAT],
      maxBlocks: 3,
      walls: [],
      safePath: line(1, 4, 8, 4),
      movingEnemies: [{ path: line(5, 1, 5, 6), startIndex: 0 }],
      key: null,
      door: null,
      crystal: { x: 8, y: 4 },
      solution: [b(COMMANDS.WAIT), walk(7)],
    },
    {
      name: "Запас енергії",
      hint: "Енергії рівно на найкоротший маршрут — зайвий крок її витратить.",
      robot: { x: 1, y: 6, dir: "up" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT],
      maxBlocks: 5,
      openFloor: true,
      energy: 10,
      walls: [],
      key: null,
      door: null,
      crystal: { x: 7, y: 2 },
      solution: [
        walk(4),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(6),
      ],
    },
    {
      name: "До самого кристала",
      hint: "На кожному кроці спочатку перевіряй, чи є шлях праворуч.",
      robot: { x: 1, y: 1, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.IF, COMMANDS.REPEAT_UNTIL],
      maxBlocks: 5,
      walls: [],
      safePath: route(
        line(1, 1, 8, 1),
        line(8, 1, 8, 6),
        line(8, 6, 3, 6),
        line(3, 6, 3, 3),
        line(3, 3, 6, 3),
        line(6, 3, 6, 4),
      ),
      key: null,
      door: null,
      crystal: { x: 6, y: 4 },
      solution: [
        b(COMMANDS.REPEAT_UNTIL, {}, [
          b(COMMANDS.IF, { condition: CONDITIONS.PATH_RIGHT }, [b(COMMANDS.TURN, { direction: "right" })]),
          b(COMMANDS.IF, { condition: CONDITIONS.PATH_AHEAD }, [b(COMMANDS.MOVE)]),
        ]),
      ],
    },
    {
      name: "Ворог на розвилці",
      hint: "Якщо попереду ворог, поверни в безпечну кишеню за ключем.",
      robot: { x: 1, y: 6, dir: "up" },
      walls: [
        { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 4 },
        { x: 7, y: 4 }, { x: 7, y: 5 },
      ],
      enemies: [{ x: 1, y: 4 }],
      key: { x: 4, y: 3 },
      door: { x: 6, y: 6 },
      crystal: { x: 8, y: 6 },
      solution: [
        b(COMMANDS.MOVE),
        b(COMMANDS.IF, { condition: CONDITIONS.ENEMY_AHEAD }, [b(COMMANDS.TURN, { direction: "right" })]),
        b(COMMANDS.REPEAT, { times: 3 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TAKE_KEY),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.IF, { condition: CONDITIONS.DOOR_AHEAD }, [b(COMMANDS.OPEN_DOOR)]),
        b(COMMANDS.MOVE),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(2),
      ],
    },
    {
      name: "Пастка біля ключа",
      hint: "Пастку краще помітити умовою і обійти вузькою стежкою.",
      robot: { x: 1, y: 1, dir: "right" },
      walls: [
        { x: 2, y: 0 }, { x: 4, y: 0 },
        { x: 5, y: 3 }, { x: 7, y: 3 }, { x: 8, y: 3 },
      ],
      traps: [{ x: 5, y: 1 }],
      key: { x: 3, y: 1 },
      door: { x: 7, y: 2 },
      crystal: { x: 8, y: 2 },
      solution: [
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TAKE_KEY),
        b(COMMANDS.MOVE),
        b(COMMANDS.IF, { condition: CONDITIONS.TRAP_AHEAD }, [b(COMMANDS.TURN, { direction: "right" })]),
        b(COMMANDS.REPEAT, { times: 3 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.IF, { condition: CONDITIONS.DOOR_AHEAD }, [b(COMMANDS.OPEN_DOOR)]),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
      ],
    },
    {
      name: "Скарб за мостом",
      hint: "Фінал знайомства: ключ, міст, двері й перевірка шляху.",
      robot: { x: 1, y: 6, dir: "right" },
      walls: [
        { x: 4, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 },
        { x: 4, y: 1 }, { x: 6, y: 1 }, { x: 7, y: 1 },
      ],
      water: [
        { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 4, y: 4 },
        { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 }, { x: 8, y: 4 },
      ],
      bridges: [{ x: 5, y: 4 }],
      key: { x: 3, y: 6 },
      door: { x: 8, y: 2 },
      crystal: { x: 8, y: 1 },
      solution: [
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TAKE_KEY),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.MOVE),
        b(COMMANDS.IF, { condition: CONDITIONS.PATH_AHEAD }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.IF, { condition: CONDITIONS.DOOR_AHEAD }, [b(COMMANDS.OPEN_DOOR)]),
        b(COMMANDS.MOVE),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.MOVE),
      ],
    },
    {
      name: "Вантажний міст",
      hint: "Достав ящик на кнопку: вона ввімкне міст на іншому боці маршруту.",
      width: 20,
      height: 20,
      robot: { x: 1, y: 16, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.REPEAT],
      maxBlocks: 11,
      walls: borderWalls(20, 20),
      safePath: route(
        line(1, 16, 7, 16),
        line(6, 16, 6, 8),
        line(6, 8, 17, 8),
        line(17, 8, 17, 4),
      ),
      crates: [{ x: 4, y: 16 }],
      buttons: [{ id: "cargo-bridge", x: 7, y: 16, requires: "crate" }],
      water: line(10, 1, 10, 18),
      toggleBridges: [{ x: 10, y: 8, buttonId: "cargo-bridge" }],
      key: null,
      door: null,
      crystal: { x: 17, y: 4 },
      solution: [
        walk(5),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(8),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(11),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(4),
      ],
    },
    {
      name: "Патрульний канал",
      hint: "Починай перехід, коли патруль відходить від клітинки мосту.",
      width: 20,
      height: 20,
      robot: { x: 1, y: 10, dir: "right" },
      availableBlocks: [COMMANDS.MOVE, COMMANDS.WAIT, COMMANDS.REPEAT],
      maxBlocks: 5,
      walls: borderWalls(20, 20),
      safePath: line(1, 10, 18, 10),
      water: line(9, 1, 9, 18),
      bridges: [{ x: 9, y: 10 }],
      movingEnemies: [{ path: line(9, 6, 9, 14), startIndex: 5 }],
      key: null,
      door: null,
      crystal: { x: 18, y: 10 },
      solution: [b(COMMANDS.WAIT), walk(15), walk(2)],
    },
    {
      name: "Річка і вороги",
      hint: "Повний рівень: переходь воду тільки мостом і не заходь на ворогів.",
      width: 30,
      height: 30,
      robot: { x: 1, y: 24, dir: "right" },
      walls: [
        ...borderWalls(30, 30),
        ...line(3, 12, 8, 12),
        ...line(16, 16, 24, 16),
        ...withoutPositions(line(18, 8, 25, 8), [{ x: 20, y: 8 }]),
        ...line(5, 5, 5, 13),
      ],
      water: line(9, 1, 9, 28),
      bridges: [{ x: 9, y: 8 }, { x: 9, y: 20 }],
      enemies: [
        { x: 6, y: 19 }, { x: 11, y: 19 }, { x: 16, y: 13 }, { x: 18, y: 11 },
        { x: 21, y: 6 }, { x: 23, y: 12 }, { x: 26, y: 5 },
      ],
      key: null,
      door: null,
      crystal: { x: 25, y: 5 },
      solution: [
        b(COMMANDS.IF, { condition: CONDITIONS.PATH_AHEAD }, [b(COMMANDS.REPEAT, { times: 4 }, [b(COMMANDS.MOVE)])]),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(4),
        walk(6),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(8),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(7),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(5),
      ],
    },
    {
      name: "Лава і пастки",
      hint: "Активуй кнопку перед довгим шляхом: вона ввімкне міст над лавою.",
      width: 30,
      height: 30,
      robot: { x: 3, y: 27, dir: "right" },
      walls: [
        ...borderWalls(30, 30),
        ...withoutPositions(line(3, 20, 15, 20), [{ x: 6, y: 20 }]),
        ...withoutPositions(line(10, 9, 21, 9), [
          { x: 10, y: 9 }, { x: 11, y: 9 }, { x: 12, y: 9 }, { x: 13, y: 9 }, { x: 14, y: 9 }, { x: 15, y: 9 },
        ]),
        ...line(18, 10, 18, 13),
        ...line(20, 19, 26, 19),
      ],
      lava: line(1, 14, 28, 14),
      bridges: [{ x: 22, y: 14 }],
      buttons: [{ id: "lava-bridge", x: 6, y: 27, requires: "robotOrCrate" }],
      toggleBridges: [{ x: 6, y: 14, buttonId: "lava-bridge" }],
      traps: [
        { x: 8, y: 27 }, { x: 10, y: 24 }, { x: 13, y: 18 }, { x: 20, y: 14 },
        { x: 16, y: 6 }, { x: 24, y: 6 }, { x: 25, y: 6 },
      ],
      key: null,
      door: null,
      crystal: { x: 25, y: 5 },
      solution: [
        b(COMMANDS.IF, { condition: CONDITIONS.PATH_AHEAD }, [b(COMMANDS.REPEAT, { times: 3 }, [b(COMMANDS.MOVE)])]),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(8),
        walk(5),
        walk(5),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(9),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(10),
      ],
    },
    {
      name: "Великий лабіринт",
      hint: "Повний рівень: тримай у голові довгий маршрут і не врізайся у стіни.",
      width: 30,
      height: 30,
      robot: { x: 1, y: 1, dir: "right" },
      walls: [
        ...borderWalls(30, 30),
        ...withoutPositions(line(8, 1, 8, 28), [{ x: 8, y: 5 }]),
        ...withoutPositions(line(13, 1, 13, 28), [{ x: 13, y: 10 }]),
        ...withoutPositions(line(18, 1, 18, 28), [{ x: 18, y: 15 }]),
        ...withoutPositions(line(23, 1, 23, 28), [{ x: 23, y: 20 }]),
        ...withoutPositions(line(2, 7, 10, 7), [{ x: 6, y: 7 }]),
        ...withoutPositions(line(9, 12, 17, 12), [{ x: 16, y: 12 }]),
        ...withoutPositions(line(16, 17, 24, 17), [{ x: 21, y: 17 }]),
        ...withoutPositions(line(21, 22, 28, 22), [{ x: 26, y: 22 }]),
        ...withoutPositions(line(3, 4, 6, 4), [{ x: 6, y: 4 }]),
        ...line(10, 20, 17, 20),
        ...line(24, 8, 27, 8),
      ],
      key: null,
      door: null,
      crystal: { x: 28, y: 28 },
      solution: [
        b(COMMANDS.IF, { condition: CONDITIONS.PATH_AHEAD }, [b(COMMANDS.REPEAT, { times: 5 }, [b(COMMANDS.MOVE)])]),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(5),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(8),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(2),
      ],
    },
    {
      name: "Кристали по порядку",
      hint: "Повний рівень: збери кристали 1, 2, 3, 4, 5, 6 саме в такому порядку.",
      width: 30,
      height: 30,
      robot: { x: 2, y: 2, dir: "right" },
      walls: [
        ...borderWalls(30, 30),
        ...withoutPositions(line(14, 2, 14, 25), [{ x: 14, y: 4 }, { x: 14, y: 16 }, { x: 14, y: 24 }]),
        ...withoutPositions(line(8, 10, 25, 10), [{ x: 18, y: 10 }]),
        ...withoutPositions(line(4, 20, 25, 20), [{ x: 6, y: 20 }]),
        ...line(9, 8, 13, 8),
        ...withoutPositions(line(17, 14, 21, 14), [{ x: 18, y: 14 }]),
        ...line(4, 6, 10, 6),
        ...withoutPositions(line(20, 6, 26, 6), [{ x: 22, y: 6 }]),
      ],
      key: null,
      door: null,
      crystal: null,
      numberedCrystals: [
        { number: 1, x: 7, y: 4 },
        { number: 2, x: 22, y: 4 },
        { number: 3, x: 22, y: 16 },
        { number: 4, x: 6, y: 16 },
        { number: 5, x: 6, y: 24 },
        { number: 6, x: 24, y: 24 },
      ],
      solution: [
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.IF, { condition: CONDITIONS.PATH_AHEAD }, [b(COMMANDS.REPEAT, { times: 2 }, [b(COMMANDS.MOVE)])]),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(5),
        walk(7),
        walk(8),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(8),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(8),
        walk(8),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(8),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(9),
        walk(9),
      ],
    },
  ];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function levelTrialCount(level) {
    return Array.isArray(level.trials) && level.trials.length ? level.trials.length : 1;
  }

  function levelForTrial(level, index = 0) {
    const snapshot = clone(level);
    const trial = snapshot.trials?.[index];
    if (trial) Object.assign(snapshot, clone(trial));
    return snapshot;
  }

  function countAuthoredBlocks(commands) {
    return commands.reduce((total, command) => (
      total
      + 1
      + (command.body ? countAuthoredBlocks(command.body) : 0)
      + (command.elseBody ? countAuthoredBlocks(command.elseBody) : 0)
    ), 0);
  }

  function samePos(a, b) {
    return Boolean(a && b && a.x === b.x && a.y === b.y);
  }

  function traceSolutionPath(robot, commands) {
    const cursor = { ...robot };
    const points = [{ x: cursor.x, y: cursor.y }];

    function walk(list) {
      for (const command of list) {
        if (command.type === COMMANDS.REPEAT) {
          for (let index = 0; index < command.args.times; index += 1) walk(command.body);
          continue;
        }
        if (command.type === COMMANDS.REPEAT_UNTIL || command.type === COMMANDS.IF || command.type === COMMANDS.IF_ELSE) {
          walk(command.body);
          continue;
        }
        if (command.type === COMMANDS.TURN) {
          cursor.dir = turn(cursor.dir, command.args.direction);
          continue;
        }
        if (command.type === COMMANDS.MOVE) {
        const steps = command.args.steps || 1;
          for (let step = 0; step < steps; step += 1) {
            const delta = DELTAS[cursor.dir];
            cursor.x += delta.x;
            cursor.y += delta.y;
            appendUnique(points, cursor);
          }
        }
      }
    }

    walk(commands);
    return points;
  }

  LEVELS.forEach((level, index) => {
    if (index >= 2 && !level.safePath && !level.openFloor) level.safePath = traceSolutionPath(level.robot, level.solution);
  });

  function levelWidth(level) {
    return level.width || GRID_WIDTH;
  }

  function levelHeight(level) {
    return level.height || GRID_HEIGHT;
  }

  function isOut(level, pos) {
    return pos.x < 0 || pos.y < 0 || pos.x >= levelWidth(level) || pos.y >= levelHeight(level);
  }

  function isWall(level, pos) {
    return level.walls.some((wall) => samePos(wall, pos));
  }

  function hasTile(level, name, pos) {
    return Array.isArray(level[name]) && level[name].some((tile) => samePos(tile, pos));
  }

  function isSafePath(level, pos) {
    return Array.isArray(level.safePath) && level.safePath.some((tile) => samePos(tile, pos));
  }

  function isButtonPressed(state, buttonId) {
    return Boolean(state?.pressedButtons?.has(buttonId));
  }

  function buttonAt(level, pos) {
    return (level.buttons || []).find((button) => samePos(button, pos));
  }

  function gateAt(level, pos) {
    return (level.gates || []).find((gate) => samePos(gate, pos));
  }

  function toggleBridgeAt(level, pos) {
    return (level.toggleBridges || []).find((bridge) => samePos(bridge, pos));
  }

  function crateIndexAt(state, pos) {
    return (state?.crates || []).findIndex((crate) => samePos(crate, pos));
  }

  function movingEnemyAt(state, pos) {
    return (state?.movingEnemies || []).some((enemy) => samePos(enemy.path[enemy.index], pos));
  }

  function isBridge(level, pos, state = null) {
    if (hasTile(level, "bridges", pos)) return true;
    const toggleBridge = toggleBridgeAt(level, pos);
    return Boolean(toggleBridge && isButtonPressed(state, toggleBridge.buttonId));
  }

  function isAbyss(level, pos, state = null) {
    if (hasTile(level, "abyss", pos)) return true;
    if (!Array.isArray(level.safePath)) return false;
    if (isSafePath(level, pos)) return false;
    if (isWall(level, pos) || isBridge(level, pos, state)) return false;
    if (hasTile(level, "water", pos) || hasTile(level, "lava", pos)) return false;
    if (hasTile(level, "enemies", pos) || hasTile(level, "traps", pos)) return false;
    if (samePos(level.key, pos) || samePos(level.door, pos) || samePos(level.crystal, pos)) return false;
    if ((level.crates || []).some((crate) => samePos(crate, pos))) return false;
    if ((level.buttons || []).some((button) => samePos(button, pos))) return false;
    if ((level.gates || []).some((gate) => samePos(gate, pos))) return false;
    if ((level.toggleBridges || []).some((bridge) => samePos(bridge, pos))) return false;
    if ((level.movingEnemies || []).some((enemy) => enemy.path.some((tile) => samePos(tile, pos)))) return false;
    if ((level.numberedCrystals || []).some((crystal) => samePos(crystal, pos))) return false;
    return true;
  }

  function terrainIssue(level, pos, state = null) {
    if (isAbyss(level, pos, state)) return "Тут безодня. Повернися до світлої стежки.";
    if (hasTile(level, "enemies", pos)) return "На цій клітинці ворог. Обійди його.";
    if (movingEnemyAt(state, pos)) return "Патруль перекрив шлях. Спробуй «чекати()» і рушай, коли клітинка вільна.";
    if (hasTile(level, "traps", pos)) return "Це пастка. Обери інший шлях.";
    if (hasTile(level, "water", pos) && !isBridge(level, pos, state)) {
      return toggleBridgeAt(level, pos)
        ? "Міст вимкнений. Знайди кнопку й активуй її."
        : "Тут вода. Шукай міст.";
    }
    if (hasTile(level, "lava", pos) && !isBridge(level, pos, state)) {
      return toggleBridgeAt(level, pos)
        ? "Міст над лавою вимкнений. Спочатку активуй кнопку."
        : "Тут лава. Шукай міст.";
    }
    return "";
  }

  function facingPosition(robot) {
    const delta = DELTAS[robot.dir];
    return { x: robot.x + delta.x, y: robot.y + delta.y };
  }

  function conditionTargetPosition(robot, condition) {
    if (condition === CONDITIONS.PATH_LEFT) return facingPosition({ ...robot, dir: turn(robot.dir, "left") });
    if (condition === CONDITIONS.PATH_RIGHT) return facingPosition({ ...robot, dir: turn(robot.dir, "right") });
    return facingPosition(robot);
  }

  function turn(dir, direction) {
    const step = direction === "left" ? -1 : 1;
    const index = DIRS.indexOf(dir);
    return DIRS[(index + step + DIRS.length) % DIRS.length];
  }

  function createRunState(level) {
    const snapshot = clone(level);
    const runState = {
      level: snapshot,
      robot: { ...snapshot.robot },
      hasKey: false,
      keyTaken: false,
      doorOpen: false,
      crates: clone(snapshot.crates || []),
      pressedButtons: new Set(),
      movingEnemies: (snapshot.movingEnemies || []).map((enemy) => ({
        path: clone(enemy.path),
        index: Math.max(0, Math.min(enemy.path.length - 1, enemy.startIndex || 0)),
        direction: enemy.direction === -1 ? -1 : 1,
      })),
      energyRemaining: Number.isInteger(snapshot.energy) ? snapshot.energy : null,
      collectedCrystals: [],
      nextCrystalNumber: 1,
      trail: [{ x: snapshot.robot.x, y: snapshot.robot.y }],
      status: "playing",
      message: "Готово.",
    };
    updatePressedButtons(runState);
    return runState;
  }

  function updatePressedButtons(state) {
    for (const button of state.level.buttons || []) {
      const hasCrate = crateIndexAt(state, button) >= 0;
      const hasRobot = samePos(state.robot, button);
      const occupied = button.requires === "crate" ? hasCrate : hasCrate || hasRobot;
      if (occupied) state.pressedButtons.add(button.id);
      else if (button.latching === false) state.pressedButtons.delete(button.id);
    }
  }

  function advanceMovingEnemies(state) {
    for (const enemy of state.movingEnemies) {
      if (enemy.path.length < 2) continue;
      let nextIndex = enemy.index + enemy.direction;
      if (nextIndex < 0 || nextIndex >= enemy.path.length) {
        enemy.direction *= -1;
        nextIndex = enemy.index + enemy.direction;
      }
      enemy.index = nextIndex;
      if (samePos(enemy.path[enemy.index], state.robot)) {
        return { ok: false, message: "Патруль наздогнав робота. Додай «чекати()» у безпечному місці.", target: { ...state.robot } };
      }
    }
    return { ok: true };
  }

  function closedGateAt(state, pos) {
    const gate = gateAt(state.level, pos);
    return gate && !isButtonPressed(state, gate.buttonId) ? gate : null;
  }

  function movementIssue(state, pos, direction, options = {}) {
    if (isOut(state.level, pos) || isWall(state.level, pos)) {
      return options.forCrate ? "за ним стіна або край поля." : "Ой, робот уперся. Зміни алгоритм.";
    }
    const gate = closedGateAt(state, pos);
    if (gate) {
      return options.forCrate
        ? "попереду закриті ворота."
        : "Ворота закриті. Спочатку активуй кнопку, що їх відкриває.";
    }
    if (state.level.door && samePos(pos, state.level.door) && !state.doorOpen) {
      return state.hasKey ? "Спочатку відкрий двері." : "Потрібен ключ.";
    }
    const issue = terrainIssue(state.level, pos, state);
    if (issue) return options.forCrate ? "попереду небезпечна клітинка." : issue;
    if (crateIndexAt(state, pos) >= 0) {
      if (options.forCrate) return "На цій клітинці вже стоїть ящик.";
      const delta = DELTAS[direction];
      const beyond = { x: pos.x + delta.x, y: pos.y + delta.y };
      const crateIssue = movementIssue(state, beyond, direction, { forCrate: true });
      if (crateIssue) return `Ящик не рухається: ${crateIssue.toLowerCase()}`;
    }
    return "";
  }

  function fieldValue(field, value) {
    if (field.type === "number") {
      const number = Number(value ?? field.default);
      if (!Number.isInteger(number) || number < field.min || number > field.max) {
        throw new Error(`Параметр "${field.label}" має бути від ${field.min} до ${field.max}.`);
      }
      return number;
    }
    if (!field.values.some((item) => item.value === value)) {
      throw new Error(`Невідоме значення для "${field.label}".`);
    }
    return value;
  }

  function compileNode(node) {
    const definition = COMMAND_DEFINITIONS[node.type];
    if (!definition) throw new Error("Невідомий блок.");
    const args = {};
    for (const field of definition.fields || []) {
      const rawValue = field.name === "condition" && node.args?.[field.name] === CONDITIONS.FRONT_CLEAR
        ? CONDITIONS.PATH_AHEAD
        : node.args?.[field.name] ?? field.default;
      args[field.name] = fieldValue(field, rawValue);
    }
    const compiled = { type: node.type, args };
    if (node.blockId) compiled.blockId = node.blockId;
    if (definition.acceptsBody) {
      if (!Array.isArray(node.body) || node.body.length === 0) {
        const label = [COMMANDS.REPEAT, COMMANDS.REPEAT_UNTIL].includes(node.type) ? "повторення" : "умови";
        throw new Error(`Всередині ${label} потрібна команда.`);
      }
      compiled.body = compileProgram(node.body);
      if (definition.acceptsElseBody) {
        if (!Array.isArray(node.elseBody) || node.elseBody.length === 0) {
          throw new Error("Всередині «інакше» потрібна команда.");
        }
        compiled.elseBody = compileProgram(node.elseBody);
      }
    }
    return compiled;
  }

  function compileProgram(commands) {
    return commands.map(compileNode);
  }

  function flattenCompiled(nodes, stateForConditions) {
    const flat = [];
    for (const node of nodes) {
      if (node.type === COMMANDS.REPEAT) {
        for (let i = 0; i < node.args.times; i += 1) flat.push(...flattenCompiled(node.body, stateForConditions));
      } else if (node.type === COMMANDS.REPEAT_UNTIL) {
        flat.push(...flattenCompiled(node.body, stateForConditions));
      } else if (node.type === COMMANDS.IF) {
        if (!stateForConditions || evaluateCondition(stateForConditions, node.args.condition)) {
          flat.push(...flattenCompiled(node.body, stateForConditions));
        }
      } else if (node.type === COMMANDS.IF_ELSE) {
        if (!stateForConditions) {
          flat.push(...flattenCompiled(node.body, stateForConditions));
          flat.push(...flattenCompiled(node.elseBody, stateForConditions));
        } else {
          flat.push(...flattenCompiled(
            evaluateCondition(stateForConditions, node.args.condition) ? node.body : node.elseBody,
            stateForConditions,
          ));
        }
      } else {
        flat.push(node);
      }
    }
    return flat;
  }

  function expandRepeatCommands(commands) {
    return flattenCompiled(compileProgram(commands), null);
  }

  function evaluateCondition(state, condition) {
    const target = conditionTargetPosition(state.robot, condition);
    if ([CONDITIONS.FRONT_CLEAR, CONDITIONS.PATH_AHEAD, CONDITIONS.PATH_LEFT, CONDITIONS.PATH_RIGHT].includes(condition)) {
      const direction = condition === CONDITIONS.PATH_LEFT
        ? turn(state.robot.dir, "left")
        : condition === CONDITIONS.PATH_RIGHT
          ? turn(state.robot.dir, "right")
          : state.robot.dir;
      return !movementIssue(state, target, direction);
    }
    const front = target;
    if (condition === CONDITIONS.ON_KEY) return Boolean(state.level.key && !state.keyTaken && samePos(state.robot, state.level.key));
    if (condition === CONDITIONS.DOOR_AHEAD) return Boolean(state.level.door && samePos(front, state.level.door));
    if (condition === CONDITIONS.HAS_KEY) return state.hasKey;
    if (condition === CONDITIONS.ABYSS_AHEAD) return !isOut(state.level, front) && isAbyss(state.level, front, state);
    if (condition === CONDITIONS.ENEMY_AHEAD) {
      return !isOut(state.level, front) && (hasTile(state.level, "enemies", front) || movingEnemyAt(state, front));
    }
    if (condition === CONDITIONS.TRAP_AHEAD) return !isOut(state.level, front) && hasTile(state.level, "traps", front);
    return false;
  }

  function numberedCrystalAt(state, pos) {
    return (state.level.numberedCrystals || []).find((crystal) => (
      samePos(crystal, pos) && !state.collectedCrystals.includes(crystal.number)
    ));
  }

  function collectNumberedCrystal(state) {
    const crystal = numberedCrystalAt(state, state.robot);
    if (!crystal) return { ok: true, message: "Рух." };
    if (crystal.number !== state.nextCrystalNumber) {
      return { ok: false, message: `Спочатку кристал ${state.nextCrystalNumber}.` };
    }
    state.collectedCrystals.push(crystal.number);
    state.nextCrystalNumber += 1;
    return { ok: true, message: `Кристал ${crystal.number} зібрано.` };
  }

  function checkWin(state) {
    if (Array.isArray(state.level.numberedCrystals) && state.level.numberedCrystals.length > 0) {
      if (state.collectedCrystals.length !== state.level.numberedCrystals.length) return false;
      state.status = "success";
      state.message = "Місію виконано!";
      return true;
    }
    if (!samePos(state.robot, state.level.crystal)) return false;
    if (state.level.door && !state.doorOpen) return false;
    state.status = "success";
    state.message = "Місію виконано!";
    return true;
  }

  function incompleteMessage(state) {
    if (state.level.numberedCrystals?.length) {
      return `Алгоритм закінчився. Далі шукай кристал ${state.nextCrystalNumber}.`;
    }
    if (state.level.key && !state.keyTaken) {
      return "Алгоритм закінчився. Ключ ще на полі — доведи робота до нього.";
    }
    if (state.level.door && !state.doorOpen) {
      return "Алгоритм закінчився. Двері ще зачинені — підійди й відкрий їх після ключа.";
    }
    const pendingButton = (state.level.buttons || []).find((button) => !isButtonPressed(state, button.id));
    if (pendingButton?.requires === "crate") {
      return "Алгоритм закінчився. Ящик ще не активував кнопку — підійди до нього з потрібного боку.";
    }
    if (pendingButton) {
      return "Алгоритм закінчився. Кнопка ще не активована — доведи робота до круглого маркера.";
    }
    if ((state.level.toggleBridges || []).some((bridge) => !isButtonPressed(state, bridge.buttonId))) {
      return "Алгоритм закінчився. Міст ще вимкнений — спочатку активуй його кнопку.";
    }
    if (state.level.movingEnemies?.length) {
      return "Алгоритм закінчився до кристала. Після безпечного очікування додай рух далі.";
    }
    if (state.energyRemaining !== null) {
      return `Алгоритм закінчився. До кристала ще є шлях, енергії залишилось: ${state.energyRemaining}.`;
    }
    return "Алгоритм закінчився раніше за маршрут. Подивись, де зупинився робот, і додай наступний блок.";
  }

  function finishPrimitiveAction(state, message) {
    updatePressedButtons(state);
    const patrol = advanceMovingEnemies(state);
    if (!patrol.ok) return patrol;
    if (checkWin(state)) return { ok: true, message: "Місію виконано!" };
    return { ok: true, message };
  }

  function executePrimitive(state, command) {
    if (command.type === COMMANDS.WAIT) {
      return finishPrimitiveAction(state, "Робот зачекав, патруль зробив крок.");
    }
    if (command.type === COMMANDS.TURN) {
      state.robot.dir = turn(state.robot.dir, command.args.direction);
      return finishPrimitiveAction(state, "Поворот.");
    }
    if (command.type === COMMANDS.TAKE_KEY) {
      if (!state.level.key || state.keyTaken || !samePos(state.robot, state.level.key)) {
        return { ok: false, message: "Ключ треба взяти на клітинці з ключем." };
      }
      state.hasKey = true;
      state.keyTaken = true;
      return finishPrimitiveAction(state, "Ключ у робота.");
    }
    if (command.type === COMMANDS.OPEN_DOOR) {
      if (!state.level.door) return finishPrimitiveAction(state, "Дверей немає.");
      if (!state.hasKey) return { ok: false, message: "Потрібен ключ. Спочатку знайди його й виклич «взяти ключ()»." };
      if (!samePos(state.robot, state.level.door) && !samePos(facingPosition(state.robot), state.level.door)) {
        return { ok: false, message: "Підійди до дверей, а тоді відкрий їх." };
      }
      state.doorOpen = true;
      return finishPrimitiveAction(state, "Двері відкрито.");
    }
    if (command.type === COMMANDS.MOVE) {
      const steps = command.args.steps || 1;
      for (let step = 0; step < steps; step += 1) {
        if (state.energyRemaining !== null && state.energyRemaining <= 0) {
          return {
            ok: false,
            message: "Енергія скінчилася. Шукай коротший маршрут і прибери зайві кроки.",
            target: { ...state.robot },
          };
        }
        const next = facingPosition(state.robot);
        const issue = movementIssue(state, next, state.robot.dir);
        if (issue) return { ok: false, message: issue, target: next };

        const crateIndex = crateIndexAt(state, next);
        if (crateIndex >= 0) {
          const delta = DELTAS[state.robot.dir];
          state.crates[crateIndex] = { x: next.x + delta.x, y: next.y + delta.y };
        }

        state.robot.x = next.x;
        state.robot.y = next.y;
        if (state.energyRemaining !== null) state.energyRemaining -= 1;
        state.trail.push({ x: next.x, y: next.y });
        updatePressedButtons(state);

        const collected = collectNumberedCrystal(state);
        if (!collected.ok) return collected;
        const patrol = advanceMovingEnemies(state);
        if (!patrol.ok) return patrol;
        if (checkWin(state)) return { ok: true, message: "Місію виконано!" };
      }
      return { ok: true, message: "Рух." };
    }
    return { ok: false, message: "Робот не знає цей блок. Прибери його й спробуй ще раз." };
  }

  function runNodes(state, nodes, trace = [], context = { untilIterations: 0 }) {
    for (const node of nodes) {
      trace.push(node);
      if (node.type === COMMANDS.REPEAT) {
        for (let i = 0; i < node.args.times; i += 1) {
          const result = runNodes(state, node.body, trace, context);
          if (!result.ok || state.status === "success") return result;
        }
        continue;
      }
      if (node.type === COMMANDS.REPEAT_UNTIL) {
        while (!checkWin(state)) {
          context.untilIterations += 1;
          if (context.untilIterations > 200) {
            return { ok: false, message: "Повторення не дісталося до кристала. Перевір умови." };
          }
          const result = runNodes(state, node.body, trace, context);
          if (!result.ok || state.status === "success") return result;
        }
        continue;
      }
      if (node.type === COMMANDS.IF) {
        if (evaluateCondition(state, node.args.condition)) {
          const result = runNodes(state, node.body, trace, context);
          if (!result.ok || state.status === "success") return result;
        }
        continue;
      }
      if (node.type === COMMANDS.IF_ELSE) {
        const branch = evaluateCondition(state, node.args.condition) ? node.body : node.elseBody;
        const result = runNodes(state, branch, trace, context);
        if (!result.ok || state.status === "success") return result;
        continue;
      }
      const result = executePrimitive(state, node);
      state.message = result.message;
      if (!result.ok || checkWin(state)) return result;
    }
    return { ok: true, message: state.message };
  }

  function simulateProgram(level, commands) {
    const state = createRunState(level);
    let compiled;
    try {
      compiled = compileProgram(commands);
    } catch (error) {
      return { status: "error", message: error.message, state };
    }
    const result = runNodes(state, compiled);
    if (!result.ok) return { status: "error", message: result.message, state };
    if (checkWin(state)) return { status: "success", message: "Місію виконано!", state };
    return { status: "incomplete", message: incompleteMessage(state), state };
  }

  function simulateLevelProgram(level, commands) {
    let finalResult = null;
    for (let index = 0; index < levelTrialCount(level); index += 1) {
      const result = simulateProgram(levelForTrial(level, index), commands);
      if (result.status !== "success") return { ...result, trialIndex: index };
      finalResult = result;
    }
    return { ...finalResult, trialIndex: levelTrialCount(level) - 1 };
  }

  const api = {
    GRID_WIDTH,
    GRID_HEIGHT,
    COMMANDS,
    CONDITIONS,
    COMMAND_DEFINITIONS,
    LEVELS,
    levelWidth,
    levelHeight,
    levelTrialCount,
    levelForTrial,
    countAuthoredBlocks,
    compileProgram,
    expandRepeatCommands,
    createRunState,
    simulateProgram,
    simulateLevelProgram,
    checkWin,
    assetMap,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (typeof document === "undefined") return;

  const state = {
    levelIndex: 0,
    currentLevel: clone(LEVELS[0]),
    runState: createRunState(LEVELS[0]),
    commands: [],
    compiled: [],
    runtimeStack: [],
    pointer: 0,
    attemptActive: false,
    activeBlockId: null,
    activeBlockType: null,
    executionStatus: "Готово",
    sensorPos: null,
    sensorResult: null,
    failurePos: null,
    trialIndex: 0,
    nextDelay: STEP_DELAY,
    timer: null,
    isRunning: false,
    completed: new Set(),
    insertPath: [],
    visualRobot: null,
  };

  const els = {
    levelSelect: document.getElementById("levelSelect"),
    levelHint: document.getElementById("levelHint"),
    levelTitle: document.getElementById("levelTitle"),
    grid: document.getElementById("gameGrid"),
    message: document.getElementById("messageBox"),
    workspace: document.getElementById("workspace"),
    palette: document.getElementById("blockPalette"),
    insertionLabel: document.getElementById("insertionLabel"),
    blocklyDiv: document.getElementById("blocklyDiv"),
    blockBudget: document.getElementById("blockBudget"),
    energyStatus: document.getElementById("energyStatus"),
    executionStatus: document.getElementById("executionStatus"),
    solutionBox: document.getElementById("solutionBox"),
    teacherPanel: document.getElementById("teacherPanel"),
    paletteArea: document.querySelector(".palette-area"),
  };

  let blocklyWorkspace = null;
  let suppressBlocklySync = false;
  let sessionSavePaused = false;
  let isTeacherAccess = false;

  function pathKey(path) {
    return path.join(".");
  }

  function getListAtPath(path) {
    let list = state.commands;
    for (const index of path) list = list[index].body;
    return list;
  }

  function makeBlock(type) {
    return b(type);
  }

  function stopTimer() {
    if (state.timer) window.clearTimeout(state.timer);
    state.timer = null;
  }

  function showMessage(text, type = "neutral") {
    els.message.textContent = text;
    els.message.className = `message ${type}`;
  }

  function isTeacherHost() {
    return ["localhost", "127.0.0.1", "::1"].includes(root.location?.hostname);
  }

  function readTeacherHashMode() {
    const hash = root.location?.hash?.toLowerCase() || "";
    if (hash === "#teacher" || hash === "#admin" || hash.includes("teacher=1") || hash.includes("admin=1")) return "teacher";
    if (hash === "#student" || hash.includes("student=1")) return "student";
    return null;
  }

  function isRememberedTeacherBrowser() {
    try {
      return localStorage.getItem(STORAGE_KEYS.teacherAccess) === "1";
    } catch {
      return false;
    }
  }

  async function resolveTeacherAccess() {
    const hashMode = readTeacherHashMode();
    if (hashMode === "teacher") {
      try {
        localStorage.setItem(STORAGE_KEYS.teacherAccess, "1");
      } catch {
      }
      return true;
    }
    if (hashMode === "student") {
      try {
        localStorage.removeItem(STORAGE_KEYS.teacherAccess);
      } catch {
      }
      return false;
    }
    return isTeacherHost() || isRememberedTeacherBrowser();
  }

  function applyAccessMode(teacher) {
    isTeacherAccess = teacher;
    document.body.classList.toggle("teacher-mode", teacher);
    document.body.classList.toggle("student-mode", !teacher);
    if (!teacher) {
      if (els.teacherPanel) els.teacherPanel.open = false;
      if (els.paletteArea) {
        els.paletteArea.remove();
        els.paletteArea = null;
      }
    }
  }

  function saveProgress() {
    localStorage.setItem(STORAGE_KEYS.level, String(Math.max(0, state.levelIndex)));
    localStorage.setItem(STORAGE_KEYS.done, JSON.stringify([...state.completed]));
  }

  function readStoredJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function saveCommandsForLevel(index, commands) {
    const saved = readStoredJson(STORAGE_KEYS.commands, {});
    if (commands.length) saved[String(index)] = clone(commands);
    else delete saved[String(index)];
    localStorage.setItem(STORAGE_KEYS.commands, JSON.stringify(saved));
  }

  function loadCommandsForLevel(index) {
    const saved = readStoredJson(STORAGE_KEYS.commands, {});
    return Array.isArray(saved[String(index)]) ? saved[String(index)] : [];
  }

  function recordAction(type, details = {}) {
    const log = readStoredJson(STORAGE_KEYS.actionLog, []);
    log.push({
      time: new Date().toISOString(),
      type,
      levelIndex: state.levelIndex,
      levelName: state.currentLevel?.name || "",
      details,
    });
    localStorage.setItem(STORAGE_KEYS.actionLog, JSON.stringify(log.slice(-MAX_ACTION_LOG)));
  }

  function persistSession(type = "codeChanged") {
    if (sessionSavePaused) return;
    saveProgress();
    saveCommandsForLevel(state.levelIndex, state.commands);
    recordAction(type, { commandCount: state.commands.length });
  }

  function migrateCampaignProgress() {
    if (localStorage.getItem(STORAGE_KEYS.campaign) === CAMPAIGN_VERSION) return;
    const done = readStoredJson(STORAGE_KEYS.done, []);
    const savedCommands = readStoredJson(STORAGE_KEYS.commands, {});
    const storedLevel = Number(localStorage.getItem(STORAGE_KEYS.level));
    const looksLikeNewCampaign = done.some((index) => index > 13)
      || Object.keys(savedCommands).some((index) => Number(index) > 13);

    if (!looksLikeNewCampaign) {
      const oldToNew = new Map([
        [7, 14], [8, 15], [9, 16],
        [10, 19], [11, 20], [12, 21], [13, 22],
      ]);
      const migratedDone = done.map((index) => oldToNew.get(index) ?? index);
      const migratedCommands = {};
      Object.entries(savedCommands).forEach(([index, commands]) => {
        migratedCommands[String(oldToNew.get(Number(index)) ?? Number(index))] = commands;
      });
      if (done.length) localStorage.setItem(STORAGE_KEYS.done, JSON.stringify([...new Set(migratedDone)]));
      if (Object.keys(savedCommands).length) localStorage.setItem(STORAGE_KEYS.commands, JSON.stringify(migratedCommands));
      if (Number.isInteger(storedLevel) && storedLevel >= 7) localStorage.setItem(STORAGE_KEYS.level, "7");
    }

    localStorage.setItem(STORAGE_KEYS.campaign, CAMPAIGN_VERSION);
  }

  function loadProgress() {
    migrateCampaignProgress();
    const savedLevel = Number(localStorage.getItem(STORAGE_KEYS.level));
    if (Number.isInteger(savedLevel) && LEVELS[savedLevel]) state.levelIndex = savedLevel;
    state.completed = new Set(readStoredJson(STORAGE_KEYS.done, []));
    if (!isLevelUnlocked(state.levelIndex)) state.levelIndex = highestUnlockedLevel();
  }

  function highestUnlockedLevel() {
    let index = 0;
    while (index < LEVELS.length - 1 && state.completed.has(index)) index += 1;
    return index;
  }

  function isLevelUnlocked(index) {
    return index >= 0 && index < LEVELS.length && index <= highestUnlockedLevel();
  }

  function refreshLevelLocks() {
    [...els.levelSelect.options].forEach((option) => {
      const index = Number(option.value);
      option.disabled = !isLevelUnlocked(index);
      option.textContent = `${index + 1}. ${LEVELS[index].name}${state.completed.has(index) ? " ✓" : ""}${option.disabled ? " (закрито)" : ""}`;
    });
  }

  function loadLevel(index, options = {}) {
    if (!isLevelUnlocked(index)) {
      els.levelSelect.value = String(state.levelIndex);
      showMessage("Спочатку пройди попередній рівень.", "error");
      return;
    }
    stopTimer();
    state.levelIndex = index;
    state.currentLevel = clone(LEVELS[index]);
    state.trialIndex = 0;
    state.runState = createRunState(levelForTrial(state.currentLevel, 0));
    state.commands = [];
    state.compiled = [];
    state.runtimeStack = [];
    state.pointer = 0;
    state.attemptActive = false;
    state.activeBlockId = null;
    state.activeBlockType = null;
    state.executionStatus = "Готово";
    state.sensorPos = null;
    state.sensorResult = null;
    state.failurePos = null;
    state.isRunning = false;
    state.insertPath = [];
    state.visualRobot = null;
    if (blocklyWorkspace) {
      blocklyWorkspace.updateToolbox(buildToolbox(state.currentLevel));
      setBlocklyCommands(loadCommandsForLevel(index), { persist: false });
    }
    els.levelSelect.value = String(index);
    els.levelTitle.textContent = `${index + 1}. ${state.currentLevel.name}${state.completed.has(index) ? " ✓" : ""}`;
    els.levelHint.textContent = state.currentLevel.hint;
    showMessage("Склади алгоритм.", "neutral");
    renderAll();
    if (options.persist !== false) {
      saveProgress();
      recordAction("levelLoaded");
    }
    refreshLevelLocks();
  }

  function renderAll() {
    renderGrid();
    if (isTeacherAccess) renderSolution();
    if (blocklyWorkspace) syncCommandsFromBlockly();
    renderLearningStatus();
  }

  const BLOCKLY_TYPE_BY_COMMAND = {
    [COMMANDS.MOVE]: "robot_move",
    [COMMANDS.TURN]: "robot_turn",
    [COMMANDS.WAIT]: "robot_wait",
    [COMMANDS.TAKE_KEY]: "robot_take_key",
    [COMMANDS.OPEN_DOOR]: "robot_open_door",
    [COMMANDS.REPEAT]: "robot_repeat",
    [COMMANDS.REPEAT_UNTIL]: "robot_repeat_until",
    [COMMANDS.IF]: "robot_if",
    [COMMANDS.IF_ELSE]: "robot_if_else",
  };

  function buildToolbox(level) {
    const available = new Set(level.availableBlocks || Object.values(COMMANDS));
    const movement = [COMMANDS.MOVE, COMMANDS.TURN, COMMANDS.WAIT, COMMANDS.TAKE_KEY, COMMANDS.OPEN_DOOR]
      .filter((type) => available.has(type))
      .map((type) => ({ kind: "block", type: BLOCKLY_TYPE_BY_COMMAND[type] }));
    const logic = [COMMANDS.REPEAT, COMMANDS.REPEAT_UNTIL, COMMANDS.IF, COMMANDS.IF_ELSE]
      .filter((type) => available.has(type))
      .map((type) => ({ kind: "block", type: BLOCKLY_TYPE_BY_COMMAND[type] }));
    const contents = [];
    if (movement.length) contents.push({ kind: "category", name: "Рух", colour: "#2677d9", contents: movement });
    if (logic.length) contents.push({ kind: "category", name: "Логіка", colour: "#159b64", contents: logic });
    return { kind: "categoryToolbox", contents };
  }

  function currentBlockBudget() {
    const used = countAuthoredBlocks(state.commands);
    const limit = Number.isInteger(state.currentLevel.maxBlocks) ? state.currentLevel.maxBlocks : null;
    return { used, limit, withinLimit: limit === null || used <= limit };
  }

  function renderLearningStatus() {
    const budget = currentBlockBudget();
    if (els.blockBudget) {
      els.blockBudget.textContent = budget.limit === null ? `Блоки: ${budget.used}` : `Блоки: ${budget.used} / ${budget.limit}`;
      els.blockBudget.classList.toggle("over-limit", !budget.withinLimit);
    }
    if (els.executionStatus) els.executionStatus.textContent = state.executionStatus;
    if (els.energyStatus) {
      const hasEnergy = state.runState.energyRemaining !== null;
      els.energyStatus.hidden = !hasEnergy;
      if (hasEnergy) {
        els.energyStatus.textContent = `Енергія: ${state.runState.energyRemaining}`;
        els.energyStatus.classList.toggle("energy-low", state.runState.energyRemaining <= 2);
      }
    }
    if (els.blocklyDiv) els.blocklyDiv.classList.toggle("is-running", state.isRunning);
    const runButton = document.getElementById("runBtn");
    const stepButton = document.getElementById("stepBtn");
    const pauseButton = document.getElementById("pauseBtn");
    if (runButton) {
      runButton.disabled = state.isRunning;
      runButton.textContent = state.attemptActive && !state.isRunning ? "▶ Продовжити" : "▶ Запуск";
    }
    if (stepButton) stepButton.disabled = state.isRunning;
    if (pauseButton) pauseButton.disabled = !state.isRunning;
    if (els.levelSelect) els.levelSelect.disabled = state.isRunning;
  }

  function zeroBlocklyComputeCanvas() {
    document.querySelectorAll("canvas.blocklyComputeCanvas").forEach((canvas) => {
      canvas.width = 0;
      canvas.height = 0;
    });
  }

  function setupBlockly() {
    const Blockly = root.Blockly;
    if (!Blockly || !els.blocklyDiv) {
      showMessage("Редактор блоків не завантажився.", "error");
      return;
    }

    Blockly.defineBlocksWithJsonArray([
      {
        type: "robot_start",
        message0: "коли натиснуто Запуск",
        nextStatement: null,
        colour: "#263746",
      },
      {
        type: "robot_move",
        message0: "рухатися()",
        previousStatement: null,
        nextStatement: null,
        colour: "#2677d9",
      },
      {
        type: "robot_turn",
        message0: "повернути %1",
        args0: [{ type: "field_dropdown", name: "DIRECTION", options: [["ліворуч", "left"], ["праворуч", "right"]] }],
        previousStatement: null,
        nextStatement: null,
        colour: "#d7921f",
      },
      {
        type: "robot_wait",
        message0: "чекати()",
        previousStatement: null,
        nextStatement: null,
        colour: "#2677d9",
      },
      {
        type: "robot_take_key",
        message0: "взяти ключ()",
        previousStatement: null,
        nextStatement: null,
        colour: "#d7921f",
      },
      {
        type: "robot_open_door",
        message0: "відкрити двері()",
        previousStatement: null,
        nextStatement: null,
        colour: "#a56635",
      },
      {
        type: "robot_repeat",
        message0: "повторити %1 разів",
        args0: [{ type: "field_dropdown", name: "TIMES", options: REPEAT_VALUES.map((value) => [String(value), String(value)]) }],
        message1: "виконати %1",
        args1: [{ type: "input_statement", name: "DO" }],
        previousStatement: null,
        nextStatement: null,
        colour: "#159b64",
      },
      {
        type: "robot_repeat_until",
        message0: "повторювати до кристала",
        message1: "виконати %1",
        args1: [{ type: "input_statement", name: "DO" }],
        previousStatement: null,
        nextStatement: null,
        colour: "#159b64",
      },
      {
        type: "robot_if",
        message0: "якщо %1",
        args0: [
          {
            type: "field_dropdown",
            name: "CONDITION",
            options: COMMAND_DEFINITIONS[COMMANDS.IF].fields[0].values.map((item) => [item.label, item.value]),
          },
        ],
        message1: "тоді %1",
        args1: [{ type: "input_statement", name: "DO" }],
        previousStatement: null,
        nextStatement: null,
        colour: "#7a54cf",
      },
      {
        type: "robot_if_else",
        message0: "якщо %1",
        args0: [
          {
            type: "field_dropdown",
            name: "CONDITION",
            options: COMMAND_DEFINITIONS[COMMANDS.IF].fields[0].values.map((item) => [item.label, item.value]),
          },
        ],
        message1: "тоді %1",
        args1: [{ type: "input_statement", name: "DO" }],
        message2: "інакше %1",
        args2: [{ type: "input_statement", name: "ELSE" }],
        previousStatement: null,
        nextStatement: null,
        colour: "#7a54cf",
      },
    ]);

    blocklyWorkspace = Blockly.inject(els.blocklyDiv, {
      toolbox: buildToolbox(state.currentLevel),
      media: "vendor/blockly/media/",
      renderer: "zelos",
      scrollbars: true,
      sounds: false,
      trashcan: true,
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.82,
        maxScale: 1.25,
        minScale: 0.55,
        scaleSpeed: 1.08,
      },
    });
    // Blockly's hidden measurement canvas is not game content; keep capture tools from selecting it.
    zeroBlocklyComputeCanvas();
    suppressBlocklySync = true;
    ensureStartBlock();
    suppressBlocklySync = false;
    blocklyWorkspace.addChangeListener((event) => {
      if (suppressBlocklySync || event?.isUiEvent) return;
      syncCommandsFromBlockly({ persist: true });
      invalidateRuntime();
      renderLearningStatus();
    });
    root.codeRobotBlocklyWorkspace = blocklyWorkspace;
    root.codeRobotDebug = { getCommandsFromBlockly, setBlocklyCommands, ensureStartBlock };
  }

  function ensureStartBlock() {
    if (!blocklyWorkspace) return null;
    let start = blocklyWorkspace.getBlocksByType("robot_start", false)[0];
    if (!start) {
      start = blocklyWorkspace.newBlock("robot_start");
      start.initSvg();
      start.render();
      start.moveBy(24, 24);
    }
    start.setDeletable(false);
    start.setMovable(false);
    return start;
  }

  function connectedBlockIds() {
    const ids = new Set();
    const start = ensureStartBlock();
    if (!start) return ids;
    ids.add(start.id);
    function visitChain(block) {
      let cursor = block;
      while (cursor) {
        ids.add(cursor.id);
        const body = cursor.getInputTargetBlock?.("DO");
        if (body) visitChain(body);
        const elseBody = cursor.getInputTargetBlock?.("ELSE");
        if (elseBody) visitChain(elseBody);
        cursor = cursor.getNextBlock();
      }
    }
    visitChain(start.getNextBlock());
    return ids;
  }

  function markDisconnectedBlocks() {
    if (!blocklyWorkspace) return;
    const connected = connectedBlockIds();
    for (const block of blocklyWorkspace.getAllBlocks(false)) {
      if (block.type === "robot_start") continue;
      block.getSvgRoot()?.classList.toggle("is-disconnected", !connected.has(block.id));
    }
  }

  function getCommandsFromBlockly() {
    if (!blocklyWorkspace) return clone(state.commands);
    const firstBlock = ensureStartBlock()?.getNextBlock();
    markDisconnectedBlocks();
    return firstBlock ? blockToCommandChain(firstBlock) : [];
  }

  function blockToCommandChain(block) {
    const commands = [];
    let cursor = block;
    while (cursor) {
      const command = blockToCommand(cursor);
      if (command) commands.push(command);
      cursor = cursor.getNextBlock();
    }
    return commands;
  }

  function blockToCommand(block) {
    let command = null;
    if (block.type === "robot_move") command = b(COMMANDS.MOVE);
    if (block.type === "robot_turn") command = b(COMMANDS.TURN, { direction: block.getFieldValue("DIRECTION") });
    if (block.type === "robot_wait") command = b(COMMANDS.WAIT);
    if (block.type === "robot_take_key") command = b(COMMANDS.TAKE_KEY);
    if (block.type === "robot_open_door") command = b(COMMANDS.OPEN_DOOR);
    if (block.type === "robot_repeat") {
      const firstBodyBlock = block.getInputTargetBlock("DO");
      command = b(COMMANDS.REPEAT, { times: Number(block.getFieldValue("TIMES")) }, firstBodyBlock ? blockToCommandChain(firstBodyBlock) : []);
    }
    if (block.type === "robot_repeat_until") {
      const firstBodyBlock = block.getInputTargetBlock("DO");
      command = b(COMMANDS.REPEAT_UNTIL, {}, firstBodyBlock ? blockToCommandChain(firstBodyBlock) : []);
    }
    if (block.type === "robot_if") {
      const firstBodyBlock = block.getInputTargetBlock("DO");
      command = b(COMMANDS.IF, { condition: block.getFieldValue("CONDITION") }, firstBodyBlock ? blockToCommandChain(firstBodyBlock) : []);
    }
    if (block.type === "robot_if_else") {
      const firstBodyBlock = block.getInputTargetBlock("DO");
      const firstElseBlock = block.getInputTargetBlock("ELSE");
      command = b(
        COMMANDS.IF_ELSE,
        { condition: block.getFieldValue("CONDITION") },
        firstBodyBlock ? blockToCommandChain(firstBodyBlock) : [],
        firstElseBlock ? blockToCommandChain(firstElseBlock) : [],
      );
    }
    if (!command) return null;
    Object.defineProperty(command, "blockId", { value: block.id, enumerable: false });
    return command;
  }

  function syncCommandsFromBlockly(options = {}) {
    state.commands = getCommandsFromBlockly();
    if (options.persist) persistSession("codeChanged");
    return state.commands;
  }

  function clearBlocklyWorkspace(options = {}) {
    if (!blocklyWorkspace) return;
    suppressBlocklySync = true;
    blocklyWorkspace.clear();
    ensureStartBlock();
    suppressBlocklySync = false;
    syncCommandsFromBlockly({ persist: options.persist });
  }

  function setBlocklyCommands(commands, options = {}) {
    const shouldPersist = options.persist !== false;
    if (!blocklyWorkspace) {
      state.commands = clone(commands);
      if (shouldPersist) persistSession(options.action || "codeChanged");
      return;
    }
    suppressBlocklySync = true;
    blocklyWorkspace.clear();
    let previous = ensureStartBlock();
    commands.forEach((command, index) => {
      const block = createBlocklyBlock(command);
      block.moveBy(190, 24 + index * 48);
      if (previous?.nextConnection && block.previousConnection) previous.nextConnection.connect(block.previousConnection);
      previous = block;
    });
    suppressBlocklySync = false;
    syncCommandsFromBlockly({ persist: shouldPersist });
    if (shouldPersist && options.action && options.action !== "codeChanged") recordAction(options.action, { commandCount: state.commands.length });
    root.Blockly.svgResize(blocklyWorkspace);
    window.setTimeout(zeroBlocklyComputeCanvas, 0);
  }

  function createBlocklyBlock(command) {
    const block = blocklyWorkspace.newBlock(BLOCKLY_TYPE_BY_COMMAND[command.type]);
    if (command.type === COMMANDS.TURN) block.setFieldValue(command.args.direction, "DIRECTION");
    if (command.type === COMMANDS.REPEAT) block.setFieldValue(String(command.args.times), "TIMES");
    if ([COMMANDS.IF, COMMANDS.IF_ELSE].includes(command.type)) {
      const condition = command.args.condition === CONDITIONS.FRONT_CLEAR ? CONDITIONS.PATH_AHEAD : command.args.condition;
      block.setFieldValue(condition, "CONDITION");
    }
    block.initSvg();
    block.render();
    connectBlocklyBranch(block, "DO", command.body || []);
    connectBlocklyBranch(block, "ELSE", command.elseBody || []);
    return block;
  }

  function connectBlocklyBranch(block, inputName, commands) {
    if (!commands.length || !block.getInput(inputName)) return;
    let previousChild = null;
    commands.forEach((child) => {
      const childBlock = createBlocklyBlock(child);
      if (previousChild?.nextConnection && childBlock.previousConnection) {
        previousChild.nextConnection.connect(childBlock.previousConnection);
      } else {
        block.getInput(inputName).connection.connect(childBlock.previousConnection);
      }
      previousChild = childBlock;
    });
  }

  function renderGrid() {
    els.grid.innerHTML = "";
    const level = state.runState.level;
    const width = levelWidth(level);
    const height = levelHeight(level);
    els.grid.style.setProperty("--grid-cols", width);
    els.grid.style.setProperty("--grid-rows", height);
    els.grid.style.aspectRatio = `${width} / ${height}`;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const pos = { x, y };
        const cell = document.createElement("div");
        cell.className = "cell";
        cell.classList.add((x + y) % 2 === 0 ? "shade-a" : "shade-b");
        if ((x * 3 + y * 5) % 11 === 0) cell.classList.add("small-crack");
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        if (state.runState.trail.some((point) => samePos(point, pos))) cell.classList.add("robot-trail");
        if (samePos(state.sensorPos, pos)) cell.classList.add("sensor-check", state.sensorResult ? "sensor-true" : "sensor-false");
        if (samePos(state.failurePos, pos)) cell.classList.add("failure-cell");
        if (isAbyss(level, pos, state.runState)) cell.classList.add("terrain-abyss");
        if (hasTile(level, "water", pos)) cell.classList.add("terrain-water");
        if (hasTile(level, "lava", pos)) cell.classList.add("terrain-lava");
        if ((level.movingEnemies || []).some((enemy) => enemy.path.some((tile) => samePos(tile, pos)))) {
          cell.classList.add("patrol-track");
        }
        if (isBridge(level, pos, state.runState)) addTileToken(cell, "bridge", "міст", "=");
        else if (toggleBridgeAt(level, pos)) addTileToken(cell, "bridge-off", "вимкнений міст", "×");
        if (isWall(level, pos)) cell.classList.add("wall-cell");
        const button = buttonAt(level, pos);
        if (button) {
          const pressed = isButtonPressed(state.runState, button.id);
          addTileToken(cell, `floor-button ${pressed ? "pressed" : ""}`, pressed ? "кнопка активована" : "кнопка", "●");
        }
        const gate = gateAt(level, pos);
        if (gate) {
          const open = isButtonPressed(state.runState, gate.buttonId);
          addTileToken(cell, `gate ${open ? "open" : "closed"}`, open ? "відкриті ворота" : "закриті ворота", open ? "↔" : "▥");
        }
        if (samePos(level.door, pos)) addSprite(cell, state.runState.doorOpen ? assetMap.doorOpen : assetMap.doorClosed, "двері", "door");
        if (level.key && !state.runState.keyTaken && samePos(level.key, pos)) addSprite(cell, assetMap.key, "ключ", "key");
        if (samePos(level.crystal, pos)) addSprite(cell, assetMap.crystal, "кристал", "crystal");
        const numberedCrystal = numberedCrystalAt(state.runState, pos);
        if (numberedCrystal) addNumberedCrystal(cell, numberedCrystal);
        if (hasTile(level, "traps", pos)) addTileToken(cell, "trap", "пастка", "×");
        if (hasTile(level, "enemies", pos)) addTileToken(cell, "enemy", "ворог", "!");
        if (movingEnemyAt(state.runState, pos)) addTileToken(cell, "enemy moving", "рухомий патруль", "↕");
        if (crateIndexAt(state.runState, pos) >= 0) addTileToken(cell, "crate", "ящик", "▣");
        els.grid.appendChild(cell);
      }
    }
    renderRobotMarker();
  }

  function renderRobotMarker() {
    const current = { ...state.runState.robot };
    const previous = state.visualRobot || current;
    const marker = document.createElement("div");
    marker.className = `robot-marker dir-${previous.dir}`;
    marker.setAttribute("aria-hidden", "true");

    const img = document.createElement("img");
    img.src = assetMap[`robot${cap(current.dir)}`];
    img.alt = "";
    img.className = "sprite robot";
    marker.appendChild(img);

    const arrow = document.createElement("span");
    arrow.className = "robot-direction-arrow";
    marker.appendChild(arrow);
    els.grid.appendChild(marker);

    placeRobotMarker(marker, previous, false);
    requestAnimationFrame(() => {
      marker.className = `robot-marker dir-${current.dir} is-moving`;
      img.src = assetMap[`robot${cap(current.dir)}`];
      placeRobotMarker(marker, current, true);
    });
    state.visualRobot = current;
  }

  function placeRobotMarker(marker, robot, animate) {
    const cell = els.grid.querySelector(`.cell[data-x="${robot.x}"][data-y="${robot.y}"]`);
    if (!cell) return;
    marker.style.transition = animate ? "" : "none";
    marker.style.width = `${cell.offsetWidth}px`;
    marker.style.height = `${cell.offsetHeight}px`;
    marker.style.transform = `translate(${cell.offsetLeft}px, ${cell.offsetTop}px)`;
  }

  function addSprite(cell, src, alt, className) {
    const img = document.createElement("img");
    img.src = src;
    img.alt = alt;
    img.className = `sprite ${className}`;
    cell.appendChild(img);
  }

  function addTileToken(cell, className, label, text) {
    const token = document.createElement("span");
    token.className = `tile-token ${className}`;
    token.setAttribute("aria-label", label);
    token.textContent = text;
    cell.appendChild(token);
  }

  function addNumberedCrystal(cell, crystal) {
    const wrap = document.createElement("span");
    wrap.className = "numbered-crystal";
    addSprite(wrap, assetMap.crystal, `кристал ${crystal.number}`, "crystal");
    const number = document.createElement("span");
    number.className = "crystal-number";
    number.textContent = String(crystal.number);
    wrap.appendChild(number);
    cell.appendChild(wrap);
  }

  function cap(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  function renderPalette() {
    els.palette.innerHTML = "";
    Object.values(COMMANDS).forEach((type) => {
      const definition = COMMAND_DEFINITIONS[type];
      const button = document.createElement("button");
      button.type = "button";
      button.draggable = !state.isRunning;
      button.dataset.blockType = type;
      button.className = `block-palette-item ${definition.color}`;
      button.textContent = definition.kind === "method" ? definition.label : `${definition.label} { }`;
      button.disabled = state.isRunning;
      button.addEventListener("dragstart", (event) => {
        event.dataTransfer.setData("text/plain", type);
        event.dataTransfer.effectAllowed = "copy";
      });
      button.addEventListener("click", () => addBlock(type));
      els.palette.appendChild(button);
    });
  }

  function renderWorkspace() {
    if (!els.workspace || !els.palette) return;
    renderPalette();
    els.workspace.innerHTML = "";
    const rootDrop = makeDropZone([], "алгоритм");
    els.workspace.appendChild(rootDrop);
    if (state.commands.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-code";
      empty.textContent = "Порожньо";
      els.workspace.appendChild(empty);
      return;
    }
    state.commands.forEach((node, index) => els.workspace.appendChild(renderBlock(node, [index], state.commands)));
  }

  function renderBlock(node, path, list) {
    const definition = COMMAND_DEFINITIONS[node.type];
    const block = document.createElement("div");
    block.className = `code-block ${definition.color} ${definition.kind}`;
    if (node.blockId && node.blockId === state.activeBlockId) block.classList.add("active");

    const head = document.createElement("div");
    head.className = "block-head";
    const title = document.createElement("strong");
    title.textContent = definition.label;
    head.appendChild(title);
    for (const field of definition.fields || []) head.appendChild(renderField(node, field, path));

    const controls = document.createElement("span");
    controls.className = "block-controls";
    controls.appendChild(mini("↑", () => moveBlock(path, -1), "Вгору", path[path.length - 1] === 0));
    controls.appendChild(mini("↓", () => moveBlock(path, 1), "Вниз", path[path.length - 1] === list.length - 1));
    controls.appendChild(mini("×", () => removeBlock(path), "Видалити", false));
    head.appendChild(controls);
    block.appendChild(head);

    if (definition.acceptsBody) {
      const body = document.createElement("div");
      body.className = "block-body";
      body.appendChild(makeDropZone(path, "всередину"));
      if (!node.body.length) {
        const empty = document.createElement("div");
        empty.className = "body-empty";
        empty.textContent = "порожньо";
        body.appendChild(empty);
      }
      node.body.forEach((child, index) => body.appendChild(renderBlock(child, [...path, index], node.body)));
      block.appendChild(body);
    }
    return block;
  }

  function renderField(node, field, path) {
    const label = document.createElement("label");
    label.className = "block-field";
    label.append(field.label);
    if (field.type === "number") {
      if (field.values?.length) {
        const select = document.createElement("select");
        select.dataset.fieldName = field.name;
        select.disabled = state.isRunning;
        field.values.forEach((value) => {
          const option = document.createElement("option");
          option.value = String(value);
          option.textContent = String(value);
          option.selected = Number(value) === Number(node.args[field.name]);
          select.appendChild(option);
        });
        select.addEventListener("change", () => updateArg(path, field.name, select.value));
        label.appendChild(select);
      } else {
        const input = document.createElement("input");
        input.type = "number";
        input.dataset.fieldName = field.name;
        input.min = String(field.min);
        input.max = String(field.max);
        input.value = String(node.args[field.name]);
        input.disabled = state.isRunning;
        input.addEventListener("change", () => updateArg(path, field.name, input.value));
        label.appendChild(input);
      }
    } else {
      const select = document.createElement("select");
      select.dataset.fieldName = field.name;
      select.disabled = state.isRunning;
      field.values.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        option.selected = item.value === node.args[field.name];
        select.appendChild(option);
      });
      select.addEventListener("change", () => updateArg(path, field.name, select.value));
      label.appendChild(select);
    }
    return label;
  }

  function makeDropZone(path, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.dropPath = path.length ? path.join(".") : "root";
    button.className = `drop-zone ${pathKey(path) === pathKey(state.insertPath) ? "selected" : ""}`;
    button.textContent = `+ ${label}`;
    button.disabled = state.isRunning;
    button.addEventListener("dragover", (event) => {
      if (state.isRunning) return;
      event.preventDefault();
      button.classList.add("drag-over");
      event.dataTransfer.dropEffect = "copy";
    });
    button.addEventListener("dragleave", () => button.classList.remove("drag-over"));
    button.addEventListener("drop", (event) => {
      event.preventDefault();
      button.classList.remove("drag-over");
      const type = event.dataTransfer.getData("text/plain");
      if (COMMAND_DEFINITIONS[type]) addBlock(type, path);
    });
    button.addEventListener("click", () => {
      state.insertPath = [...path];
      renderWorkspace();
      renderInsertion();
    });
    return button;
  }

  function mini(text, handler, title, disabled) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = text;
    button.title = title;
    button.disabled = state.isRunning || disabled;
    button.addEventListener("click", handler);
    return button;
  }

  function addBlock(type, explicitPath = state.insertPath) {
    const list = getListAtPath(explicitPath);
    list.push(makeBlock(type));
    state.insertPath = [...explicitPath];
    renderAll();
    showMessage("Блок додано.", "neutral");
  }

  function getNode(path) {
    let list = state.commands;
    let node = null;
    path.forEach((index, depth) => {
      node = list[index];
      if (depth < path.length - 1) list = node.body;
    });
    return node;
  }

  function getParentList(path) {
    return getListAtPath(path.slice(0, -1));
  }

  function updateArg(path, name, value) {
    const node = getNode(path);
    node.args[name] = value;
    renderAll();
  }

  function moveBlock(path, delta) {
    const list = getParentList(path);
    const index = path[path.length - 1];
    const next = index + delta;
    if (next < 0 || next >= list.length) return;
    [list[index], list[next]] = [list[next], list[index]];
    renderAll();
  }

  function removeBlock(path) {
    const list = getParentList(path);
    list.splice(path[path.length - 1], 1);
    if (pathKey(state.insertPath).startsWith(pathKey(path))) state.insertPath = [];
    renderAll();
  }

  function renderInsertion() {
    if (!els.insertionLabel) return;
    els.insertionLabel.textContent = state.insertPath.length ? "Додавання: всередину блоку" : "Додавання: в алгоритм";
  }

  function highlightActiveBlock(node = null) {
    state.activeBlockId = node?.blockId || null;
    state.activeBlockType = node?.type || null;
    if (blocklyWorkspace?.highlightBlock) blocklyWorkspace.highlightBlock(state.activeBlockId);
  }

  function invalidateRuntime() {
    stopTimer();
    state.isRunning = false;
    state.attemptActive = false;
    state.compiled = [];
    state.runtimeStack = [];
    state.pointer = 0;
    state.sensorPos = null;
    state.sensorResult = null;
    state.failurePos = null;
    state.executionStatus = "Готово";
    highlightActiveBlock();
  }

  function startTrial(index) {
    state.trialIndex = index;
    state.runState = createRunState(levelForTrial(state.currentLevel, index));
    state.runtimeStack = [{ kind: "sequence", nodes: state.compiled, index: 0 }];
    state.pointer = 0;
    state.sensorPos = null;
    state.sensorResult = null;
    state.failurePos = null;
    state.visualRobot = null;
    highlightActiveBlock();
  }

  function nextRuntimeEvent() {
    while (state.runtimeStack.length) {
      const frame = state.runtimeStack[state.runtimeStack.length - 1];
      if (frame.kind === "sequence") {
        if (frame.index >= frame.nodes.length) {
          state.runtimeStack.pop();
          continue;
        }
        const node = frame.nodes[frame.index];
        frame.index += 1;
        if (node.type === COMMANDS.REPEAT) {
          state.runtimeStack.push({ kind: "repeat", node, iteration: 0 });
          continue;
        }
        if (node.type === COMMANDS.REPEAT_UNTIL) {
          state.runtimeStack.push({ kind: "repeatUntil", node, iteration: 0 });
          continue;
        }
        if (node.type === COMMANDS.IF || node.type === COMMANDS.IF_ELSE) {
          const passed = evaluateCondition(state.runState, node.args.condition);
          const branch = passed ? node.body : node.elseBody;
          if (branch?.length) state.runtimeStack.push({ kind: "sequence", nodes: branch, index: 0 });
          return { kind: "condition", node, passed };
        }
        return { kind: "primitive", node };
      }
      if (frame.kind === "repeat") {
        if (frame.iteration >= frame.node.args.times) {
          state.runtimeStack.pop();
          continue;
        }
        frame.iteration += 1;
        state.runtimeStack.push({ kind: "sequence", nodes: frame.node.body, index: 0 });
        return { kind: "repeat", node: frame.node, iteration: frame.iteration, total: frame.node.args.times };
      }
      if (checkWin(state.runState)) {
        state.runtimeStack.pop();
        continue;
      }
      if (frame.iteration >= 200) {
        state.runtimeStack.pop();
        return { kind: "runtimeError", node: frame.node, message: "Повторення не дісталося до кристала. Перевір умови всередині." };
      }
      frame.iteration += 1;
      state.runtimeStack.push({ kind: "sequence", nodes: frame.node.body, index: 0 });
      return { kind: "repeatUntil", node: frame.node, iteration: frame.iteration };
    }
    return null;
  }

  function prepareRun() {
    try {
      syncCommandsFromBlockly();
      state.compiled = compileProgram(state.commands);
      state.attemptActive = true;
      startTrial(0);
      state.executionStatus = levelTrialCount(state.currentLevel) > 1 ? `Перевірка 1/${levelTrialCount(state.currentLevel)}` : "Запуск";
      state.nextDelay = STEP_DELAY;
      recordAction("attemptStarted", { blockCount: countAuthoredBlocks(state.commands), trialCount: levelTrialCount(state.currentLevel) });
      return true;
    } catch (error) {
      state.attemptActive = false;
      showMessage(error.message, "error");
      return false;
    }
  }

  function runProgram() {
    if (state.isRunning) return;
    if (!syncCommandsFromBlockly().length) return showMessage("Приєднай блок до «Запуск».", "error");
    if (!state.attemptActive && !prepareRun()) return;
    state.isRunning = true;
    renderAll();
    scheduleNext();
  }

  function scheduleNext() {
    stopTimer();
    state.timer = window.setTimeout(() => {
      const ok = stepProgram(true);
      if (ok && state.isRunning) scheduleNext();
    }, state.nextDelay);
  }

  function conditionUsesFront(condition) {
    return [
      CONDITIONS.PATH_AHEAD,
      CONDITIONS.ABYSS_AHEAD,
      CONDITIONS.ENEMY_AHEAD,
      CONDITIONS.TRAP_AHEAD,
      CONDITIONS.DOOR_AHEAD,
      CONDITIONS.PATH_LEFT,
      CONDITIONS.PATH_RIGHT,
      CONDITIONS.FRONT_CLEAR,
    ].includes(condition);
  }

  function stepProgram(fromAuto = false) {
    if (!state.attemptActive && !prepareRun()) return false;
    const event = nextRuntimeEvent();
    if (!event) return finishIncomplete();

    state.pointer += 1;
    state.sensorPos = null;
    state.sensorResult = null;
    state.failurePos = null;
    highlightActiveBlock(event.node);

    if (event.kind === "runtimeError") {
      state.failurePos = { ...state.runState.robot };
      state.executionStatus = "Перевір повторення";
      state.attemptActive = false;
      recordAction("attemptFinished", { status: "error", message: event.message, blockCount: countAuthoredBlocks(state.commands) });
      showMessage(event.message, "error");
      return stopRun(false);
    }

    if (event.kind === "repeat") {
      state.executionStatus = `Повторення ${event.iteration}/${event.total}`;
      state.nextDelay = CONTROL_DELAY;
      showMessage(state.executionStatus, "neutral");
      renderAll();
      return true;
    }

    if (event.kind === "repeatUntil") {
      state.executionStatus = `Пошук кристала: коло ${event.iteration}`;
      state.nextDelay = CONTROL_DELAY;
      showMessage(state.executionStatus, "neutral");
      renderAll();
      return true;
    }

    if (event.kind === "condition") {
      if (conditionUsesFront(event.node.args.condition)) {
        state.sensorPos = conditionTargetPosition(state.runState.robot, event.node.args.condition);
      }
      state.sensorResult = event.passed;
      state.executionStatus = `${conditionLabel(event.node.args.condition)}: ${event.passed ? "так" : "ні"}`;
      state.nextDelay = CONTROL_DELAY;
      showMessage(state.executionStatus, "neutral");
      renderAll();
      return true;
    }

    state.executionStatus = blockText(event.node);
    state.nextDelay = [COMMANDS.MOVE, COMMANDS.WAIT].includes(event.node.type) ? STEP_DELAY : CONTROL_DELAY;
    const result = executePrimitive(state.runState, event.node);
    if (!result.ok) state.failurePos = result.target || null;
    showMessage(result.message, result.ok ? "neutral" : "error");
    renderAll();
    if (!result.ok) {
      state.attemptActive = false;
      recordAction("attemptFinished", { status: "error", message: result.message, blockCount: countAuthoredBlocks(state.commands) });
      return stopRun(false);
    }
    if (checkWin(state.runState)) return finishSuccessfulTrial();
    if (!fromAuto) showMessage(result.message, "neutral");
    return true;
  }

  function finishSuccessfulTrial() {
    const totalTrials = levelTrialCount(state.currentLevel);
    if (state.trialIndex + 1 < totalTrials) {
      const nextTrial = state.trialIndex + 1;
      startTrial(nextTrial);
      const label = state.runState.level.trials?.[nextTrial]?.label || state.runState.level.label || "";
      state.executionStatus = `Перевірка ${nextTrial + 1}/${totalTrials}`;
      showMessage(`${state.executionStatus}${label ? `: ${label}` : ""}.`, "success");
      renderAll();
      state.nextDelay = STEP_DELAY;
      return true;
    }

    const budget = currentBlockBudget();
    state.attemptActive = false;
    if (!budget.withinLimit) {
      const message = `Маршрут працює! Скороти код до ${budget.limit} блоків. Зараз: ${budget.used}.`;
      state.executionStatus = "Скороти код";
      highlightActiveBlock();
      recordAction("attemptFinished", { status: "overBudget", message, blockCount: budget.used, limit: budget.limit });
      showMessage(message, "error");
      return stopRun(false);
    }

    state.completed.add(state.levelIndex);
    saveProgress();
    refreshLevelLocks();
    state.executionStatus = "Виконано";
    highlightActiveBlock();
    recordAction("attemptFinished", { status: "success", blockCount: budget.used, trialCount: totalTrials });
    showMessage("Місію виконано!", "success");
    return stopRun(false);
  }

  function stopRun(result) {
    state.isRunning = false;
    stopTimer();
    renderAll();
    return result;
  }

  function finishIncomplete() {
    state.isRunning = false;
    state.attemptActive = false;
    state.executionStatus = "Код закінчився";
    highlightActiveBlock();
    stopTimer();
    const message = incompleteMessage(state.runState);
    recordAction("attemptFinished", { status: "incomplete", message, blockCount: countAuthoredBlocks(state.commands) });
    renderAll();
    showMessage(message, "neutral");
    return false;
  }

  function pauseProgram() {
    if (!state.isRunning) return;
    state.isRunning = false;
    stopTimer();
    state.executionStatus = "Пауза";
    renderAll();
    showMessage("Пауза.", "neutral");
  }

  function resetLevel(clearCode = false) {
    stopTimer();
    state.trialIndex = 0;
    state.runState = createRunState(levelForTrial(state.currentLevel, 0));
    state.compiled = [];
    state.runtimeStack = [];
    state.pointer = 0;
    state.attemptActive = false;
    state.isRunning = false;
    state.executionStatus = "Готово";
    state.sensorPos = null;
    state.sensorResult = null;
    state.failurePos = null;
    state.visualRobot = null;
    highlightActiveBlock();
    if (clearCode) clearBlocklyWorkspace();
    syncCommandsFromBlockly();
    renderAll();
    showMessage(clearCode ? "Алгоритм очищено." : "Рівень скинуто.", "neutral");
    persistSession(clearCode ? "codeCleared" : "levelReset");
  }

  function renderSolution() {
    els.solutionBox.innerHTML = "";
    state.currentLevel.solution.forEach((node) => els.solutionBox.appendChild(renderSolutionNode(node)));
  }

  function renderSolutionNode(node) {
    const definition = COMMAND_DEFINITIONS[node.type];
    const chip = document.createElement("span");
    chip.className = `solution-chip ${definition.color}`;
    chip.textContent = blockText(node);
    if (node.body?.length) {
      const inner = document.createElement("span");
      inner.textContent = ` { ${node.body.map(blockText).join("; ")} }`;
      chip.appendChild(inner);
    }
    if (node.elseBody?.length) {
      const alternate = document.createElement("span");
      alternate.textContent = ` інакше { ${node.elseBody.map(blockText).join("; ")} }`;
      chip.appendChild(alternate);
    }
    return chip;
  }

  function blockText(node) {
    const definition = COMMAND_DEFINITIONS[node.type];
    if (node.type === COMMANDS.MOVE) return "рухатися()";
    if (node.type === COMMANDS.TURN) return `повернути(${node.args.direction === "left" ? "ліворуч" : "праворуч"})`;
    if (node.type === COMMANDS.WAIT) return "чекати()";
    if (node.type === COMMANDS.REPEAT) return `repeat(${node.args.times})`;
    if (node.type === COMMANDS.REPEAT_UNTIL) return "repeatUntil(кристал)";
    if (node.type === COMMANDS.IF) return `if(${conditionLabel(node.args.condition)})`;
    if (node.type === COMMANDS.IF_ELSE) return `ifElse(${conditionLabel(node.args.condition)})`;
    return definition.label;
  }

  function conditionLabel(value) {
    return COMMAND_DEFINITIONS[COMMANDS.IF].fields[0].values.find((item) => item.value === value)?.label || value;
  }

  function populateLevelSelect() {
    LEVELS.forEach((level, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${level.name}`;
      els.levelSelect.appendChild(option);
    });
  }

  function bindEvents() {
    const bind = (id, event, handler) => document.getElementById(id)?.addEventListener(event, handler);
    bind("runBtn", "click", runProgram);
    bind("stepBtn", "click", () => stepProgram(false));
    bind("pauseBtn", "click", pauseProgram);
    bind("resetLevelBtn", "click", () => resetLevel(false));
    bind("clearCodeBtn", "click", () => resetLevel(true));
    bind("loadSolutionBtn", "click", () => {
      if (window.confirm("Замінити поточний алгоритм розв'язком?")) {
        setBlocklyCommands(state.currentLevel.solution, { persist: true, action: "teacherSolutionInserted" });
        state.insertPath = [];
        resetLevel(false);
      }
    });
    bind("resetProgressBtn", "click", () => {
      if (window.confirm("Скинути позначки пройдених рівнів?")) {
        localStorage.removeItem(STORAGE_KEYS.done);
        state.completed = new Set();
        loadLevel(state.levelIndex);
        refreshLevelLocks();
      }
    });
    bind("fullClearBtn", "click", () => {
      if (window.confirm("Повністю очистити прогрес, алгоритми й журнал дій?")) {
        sessionSavePaused = true;
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
        state.completed = new Set();
        loadLevel(0, { persist: false });
        clearBlocklyWorkspace({ persist: false });
        refreshLevelLocks();
        Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
        window.setTimeout(() => {
          Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
          sessionSavePaused = false;
        }, 500);
        showMessage("Усе очищено.", "neutral");
      }
    });
    els.levelSelect.addEventListener("change", () => loadLevel(Number(els.levelSelect.value)));
  }

  function renderGameToText() {
    syncCommandsFromBlockly();
    const level = state.runState.level;
    return JSON.stringify({
      note: "Origin is top-left. x grows right, y grows down.",
      grid: { width: levelWidth(level), height: levelHeight(level) },
      level: state.currentLevel.name,
      robot: state.runState.robot,
      hasKey: state.runState.hasKey,
      keyTaken: state.runState.keyTaken,
      doorOpen: state.runState.doorOpen,
      collectedCrystals: state.runState.collectedCrystals,
      nextCrystalNumber: state.runState.nextCrystalNumber,
      energyRemaining: state.runState.energyRemaining,
      crates: state.runState.crates,
      pressedButtons: [...state.runState.pressedButtons],
      movingEnemies: state.runState.movingEnemies.map((enemy) => ({
        position: enemy.path[enemy.index],
        index: enemy.index,
        direction: enemy.direction,
      })),
      commandCount: state.commands.length,
      authoredBlockCount: countAuthoredBlocks(state.commands),
      blockBudget: currentBlockBudget(),
      compiledStepCount: state.pointer,
      pointer: state.pointer,
      trial: { current: state.trialIndex + 1, total: levelTrialCount(state.currentLevel) },
      isRunning: state.isRunning,
      attemptActive: state.attemptActive,
      activeBlockId: state.activeBlockId,
      activeBlockType: state.activeBlockType,
      executionStatus: state.executionStatus,
      sensor: state.sensorPos ? { position: state.sensorPos, result: state.sensorResult } : null,
      failure: state.failurePos,
      trail: state.runState.trail,
      message: els.message.textContent,
      insertPath: state.insertPath,
      walls: level.walls,
      key: level.key,
      door: level.door,
      crystal: level.crystal,
      water: level.water || [],
      lava: level.lava || [],
      bridges: level.bridges || [],
      toggleBridges: level.toggleBridges || [],
      buttons: level.buttons || [],
      gates: level.gates || [],
      patrolPaths: (level.movingEnemies || []).map((enemy) => enemy.path),
      enemies: level.enemies || [],
      traps: level.traps || [],
      numberedCrystals: level.numberedCrystals || [],
      safePath: level.safePath || [],
    });
  }

  async function init() {
    applyAccessMode(await resolveTeacherAccess());
    populateLevelSelect();
    loadProgress();
    bindEvents();
    setupBlockly();
    root.render_game_to_text = renderGameToText;
    root.advanceTime = function advanceTime() {
      if (state.isRunning) {
        stopTimer();
        stepProgram(true);
      }
      renderGrid();
    };
    loadLevel(state.levelIndex);
    window.setTimeout(zeroBlocklyComputeCanvas, 0);
  }

  init().catch((error) => {
    console.error(error);
    showMessage("Не вдалося запустити гру. Онови сторінку.", "error");
  });
})(typeof window !== "undefined" ? window : globalThis);
