(function (root) {
  "use strict";

  const GRID_WIDTH = 10;
  const GRID_HEIGHT = 8;
  const STEP_DELAY = 520;

  const STORAGE_KEYS = {
    level: "codeRobot.v2.currentLevel",
    done: "codeRobot.v2.doneLevels",
    commands: "codeRobot.v2.commandsByLevel",
    actionLog: "codeRobot.v2.actionLog",
    teacherAccess: "codeRobot.v2.teacherAccess",
  };

  const MAX_ACTION_LOG = 500;

  const COMMANDS = {
    MOVE: "move",
    TURN: "turn",
    TAKE_KEY: "takeKey",
    OPEN_DOOR: "openDoor",
    REPEAT: "repeat",
    IF: "if",
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
    [COMMANDS.TAKE_KEY]: { label: "взяти ключ()", kind: "method", color: "gold", fields: [] },
    [COMMANDS.OPEN_DOOR]: { label: "відкрити двері()", kind: "method", color: "brown", fields: [] },
    [COMMANDS.REPEAT]: {
      label: "повторити",
      kind: "loop",
      color: "green",
      acceptsBody: true,
      fields: [{ name: "times", label: "разів", type: "number", min: 2, max: 15, default: 3, values: REPEAT_VALUES }],
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
          default: CONDITIONS.FRONT_CLEAR,
          values: [
            { value: CONDITIONS.FRONT_CLEAR, label: "попереду вільно" },
            { value: CONDITIONS.ON_KEY, label: "робот на ключі" },
            { value: CONDITIONS.DOOR_AHEAD, label: "попереду двері" },
            { value: CONDITIONS.HAS_KEY, label: "ключ у робота" },
            { value: CONDITIONS.ABYSS_AHEAD, label: "попереду безодня" },
            { value: CONDITIONS.ENEMY_AHEAD, label: "попереду ворог" },
            { value: CONDITIONS.TRAP_AHEAD, label: "попереду пастка" },
            { value: CONDITIONS.PATH_AHEAD, label: "попереду шлях" },
          ],
        },
      ],
    },
  };

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

  function b(type, args = {}, body = []) {
    const definition = COMMAND_DEFINITIONS[type];
    const finalArgs = {};
    for (const field of definition.fields || []) finalArgs[field.name] = args[field.name] ?? field.default;
    return definition.acceptsBody ? { type, args: finalArgs, body } : { type, args: finalArgs };
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

  const LEVELS = [
    {
      name: "Метод руху",
      hint: "Один блок руху робить один крок.",
      robot: { x: 1, y: 3, dir: "right" },
      walls: [],
      key: null,
      door: null,
      crystal: { x: 6, y: 3 },
      solution: [walk(5)],
    },
    {
      name: "Поворот",
      hint: "Метод повертає робота, але не рухає.",
      robot: { x: 1, y: 6, dir: "up" },
      walls: [],
      key: null,
      door: null,
      crystal: { x: 6, y: 3 },
      solution: [walk(3), b(COMMANDS.TURN, { direction: "right" }), walk(5)],
    },
    {
      name: "Обхід",
      hint: "Склади маршрут як послідовність методів.",
      robot: { x: 1, y: 4, dir: "right" },
      walls: [{ x: 3, y: 4 }, { x: 3, y: 5 }],
      key: null,
      door: null,
      crystal: { x: 7, y: 4 },
      solution: [
        b(COMMANDS.MOVE),
        b(COMMANDS.TURN, { direction: "left" }),
        walk(2),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(4),
        b(COMMANDS.TURN, { direction: "right" }),
        walk(2),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.MOVE),
      ],
    },
    {
      name: "Ключ і двері",
      hint: "Викликай методи в правильному порядку.",
      robot: { x: 1, y: 5, dir: "right" },
      walls: [
        { x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }, { x: 5, y: 3 },
        { x: 5, y: 4 }, { x: 5, y: 6 }, { x: 5, y: 7 },
      ],
      key: { x: 3, y: 5 },
      door: { x: 5, y: 5 },
      crystal: { x: 8, y: 5 },
      solution: [
        walk(2),
        b(COMMANDS.TAKE_KEY),
        b(COMMANDS.MOVE),
        b(COMMANDS.OPEN_DOOR),
        walk(4),
      ],
    },
    {
      name: "Цикл",
      hint: "Повторення має своє тіло.",
      robot: { x: 1, y: 1, dir: "right" },
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
      name: "Умова",
      hint: "Умова робить безпечний крок, далі обійди стіну.",
      robot: { x: 1, y: 3, dir: "right" },
      walls: [{ x: 3, y: 3 }],
      key: null,
      door: null,
      crystal: { x: 5, y: 2 },
      solution: [
        b(COMMANDS.IF, { condition: CONDITIONS.FRONT_CLEAR }, [b(COMMANDS.MOVE)]),
        b(COMMANDS.TURN, { direction: "left" }),
        b(COMMANDS.MOVE),
        b(COMMANDS.TURN, { direction: "right" }),
        b(COMMANDS.REPEAT, { times: 3 }, [b(COMMANDS.MOVE)]),
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
      hint: "Повний рівень: лава пропускає тільки по мосту, пастки треба обходити.",
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
      bridges: [{ x: 6, y: 14 }, { x: 22, y: 14 }],
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
      hint: "Повний рівень: збери кристали 1, 2, 3, 4 саме в такому порядку.",
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
        if (command.type === COMMANDS.IF) {
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
    if (index >= 2 && !level.safePath) level.safePath = traceSolutionPath(level.robot, level.solution);
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

  function isBridge(level, pos) {
    return hasTile(level, "bridges", pos);
  }

  function isAbyss(level, pos) {
    if (hasTile(level, "abyss", pos)) return true;
    if (!Array.isArray(level.safePath)) return false;
    if (isSafePath(level, pos)) return false;
    if (isWall(level, pos) || isBridge(level, pos)) return false;
    if (hasTile(level, "water", pos) || hasTile(level, "lava", pos)) return false;
    if (hasTile(level, "enemies", pos) || hasTile(level, "traps", pos)) return false;
    if (samePos(level.key, pos) || samePos(level.door, pos) || samePos(level.crystal, pos)) return false;
    if ((level.numberedCrystals || []).some((crystal) => samePos(crystal, pos))) return false;
    return true;
  }

  function terrainIssue(level, pos) {
    if (isAbyss(level, pos)) return "Тут безодня. Один крок убік — місія провалена.";
    if (hasTile(level, "enemies", pos)) return "На цій клітинці ворог. Обійди його.";
    if (hasTile(level, "traps", pos)) return "Це пастка. Обери інший шлях.";
    if (hasTile(level, "water", pos) && !isBridge(level, pos)) return "Тут вода. Шукай міст.";
    if (hasTile(level, "lava", pos) && !isBridge(level, pos)) return "Тут лава. Шукай міст.";
    return "";
  }

  function facingPosition(robot) {
    const delta = DELTAS[robot.dir];
    return { x: robot.x + delta.x, y: robot.y + delta.y };
  }

  function turn(dir, direction) {
    const step = direction === "left" ? -1 : 1;
    const index = DIRS.indexOf(dir);
    return DIRS[(index + step + DIRS.length) % DIRS.length];
  }

  function createRunState(level) {
    const snapshot = clone(level);
    return {
      level: snapshot,
      robot: { ...snapshot.robot },
      hasKey: false,
      keyTaken: false,
      doorOpen: false,
      collectedCrystals: [],
      nextCrystalNumber: 1,
      status: "playing",
      message: "Готово.",
    };
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
      args[field.name] = fieldValue(field, node.args?.[field.name] ?? field.default);
    }
    const compiled = { type: node.type, args };
    if (definition.acceptsBody) {
      if (!Array.isArray(node.body) || node.body.length === 0) {
        const label = node.type === COMMANDS.REPEAT ? "повторення" : "умови";
        throw new Error(`Всередині ${label} потрібна команда.`);
      }
      compiled.body = compileProgram(node.body);
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
      } else if (node.type === COMMANDS.IF) {
        if (!stateForConditions || evaluateCondition(stateForConditions, node.args.condition)) {
          flat.push(...flattenCompiled(node.body, stateForConditions));
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
    const front = facingPosition(state.robot);
    if (condition === CONDITIONS.FRONT_CLEAR) {
      return !isOut(state.level, front)
        && !isWall(state.level, front)
        && !terrainIssue(state.level, front)
        && !(state.level.door && samePos(front, state.level.door) && !state.doorOpen);
    }
    if (condition === CONDITIONS.ON_KEY) return Boolean(state.level.key && !state.keyTaken && samePos(state.robot, state.level.key));
    if (condition === CONDITIONS.DOOR_AHEAD) return Boolean(state.level.door && samePos(front, state.level.door));
    if (condition === CONDITIONS.HAS_KEY) return state.hasKey;
    if (condition === CONDITIONS.ABYSS_AHEAD) return !isOut(state.level, front) && isAbyss(state.level, front);
    if (condition === CONDITIONS.ENEMY_AHEAD) return !isOut(state.level, front) && hasTile(state.level, "enemies", front);
    if (condition === CONDITIONS.TRAP_AHEAD) return !isOut(state.level, front) && hasTile(state.level, "traps", front);
    if (condition === CONDITIONS.PATH_AHEAD) {
      return !isOut(state.level, front)
        && !isWall(state.level, front)
        && !terrainIssue(state.level, front)
        && !(state.level.door && samePos(front, state.level.door) && !state.doorOpen);
    }
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

  function executePrimitive(state, command) {
    if (command.type === COMMANDS.TURN) {
      state.robot.dir = turn(state.robot.dir, command.args.direction);
      return { ok: true, message: "Поворот." };
    }
    if (command.type === COMMANDS.TAKE_KEY) {
      if (!state.level.key || state.keyTaken || !samePos(state.robot, state.level.key)) {
        return { ok: false, message: "Ключ треба взяти на клітинці з ключем." };
      }
      state.hasKey = true;
      state.keyTaken = true;
      return { ok: true, message: "Ключ у робота." };
    }
    if (command.type === COMMANDS.OPEN_DOOR) {
      if (!state.level.door) return { ok: true, message: "Дверей немає." };
      if (!state.hasKey) return { ok: false, message: "Потрібен ключ." };
      if (!samePos(state.robot, state.level.door) && !samePos(facingPosition(state.robot), state.level.door)) {
        return { ok: false, message: "Підійди до дверей." };
      }
      state.doorOpen = true;
      return { ok: true, message: "Двері відкрито." };
    }
    if (command.type === COMMANDS.MOVE) {
      const steps = command.args.steps || 1;
      for (let step = 0; step < steps; step += 1) {
        const next = facingPosition(state.robot);
        if (isOut(state.level, next) || isWall(state.level, next)) return { ok: false, message: "Ой, робот уперся. Зміни алгоритм." };
        const issue = terrainIssue(state.level, next);
        if (issue) return { ok: false, message: issue };
        if (state.level.door && samePos(next, state.level.door) && !state.doorOpen) {
          return { ok: false, message: state.hasKey ? "Спочатку відкрий двері." : "Потрібен ключ." };
        }
        state.robot.x = next.x;
        state.robot.y = next.y;
        const collected = collectNumberedCrystal(state);
        if (!collected.ok) return collected;
        if (checkWin(state)) return { ok: true, message: "Місію виконано!" };
      }
      return { ok: true, message: "Рух." };
    }
    return { ok: false, message: "Робот не знає блок." };
  }

  function runNodes(state, nodes, trace = []) {
    for (const node of nodes) {
      trace.push(node);
      if (node.type === COMMANDS.REPEAT) {
        for (let i = 0; i < node.args.times; i += 1) {
          const result = runNodes(state, node.body, trace);
          if (!result.ok || state.status === "success") return result;
        }
        continue;
      }
      if (node.type === COMMANDS.IF) {
        if (evaluateCondition(state, node.args.condition)) {
          const result = runNodes(state, node.body, trace);
          if (!result.ok || state.status === "success") return result;
        }
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
    return { status: "incomplete", message: "Команди закінчилися.", state };
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
    compileProgram,
    expandRepeatCommands,
    createRunState,
    simulateProgram,
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
    flat: [],
    pointer: 0,
    activeFlatIndex: -1,
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

  function readTeacherHashMode() {
    const hash = root.location?.hash?.toLowerCase() || "";
    if (hash === "#teacher" || hash === "#admin" || hash.includes("teacher=1") || hash.includes("admin=1")) return "teacher";
    if (hash === "#student" || hash.includes("student=1")) return "student";
    return null;
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
    return true;
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

  function loadProgress() {
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
    state.runState = createRunState(state.currentLevel);
    state.commands = [];
    state.compiled = [];
    state.flat = [];
    state.pointer = 0;
    state.activeFlatIndex = -1;
    state.isRunning = false;
    state.insertPath = [];
    state.visualRobot = null;
    if (blocklyWorkspace) setBlocklyCommands(loadCommandsForLevel(index), { persist: false });
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
  }

  function setupBlockly() {
    const Blockly = root.Blockly;
    if (!Blockly || !els.blocklyDiv) {
      showMessage("Редактор блоків не завантажився.", "error");
      return;
    }

    Blockly.defineBlocksWithJsonArray([
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
        type: "robot_if",
        message0: "якщо %1",
        args0: [
          {
            type: "field_dropdown",
            name: "CONDITION",
            options: [
              ["попереду вільно", CONDITIONS.FRONT_CLEAR],
              ["робот на ключі", CONDITIONS.ON_KEY],
              ["попереду двері", CONDITIONS.DOOR_AHEAD],
              ["ключ у робота", CONDITIONS.HAS_KEY],
              ["попереду безодня", CONDITIONS.ABYSS_AHEAD],
              ["попереду ворог", CONDITIONS.ENEMY_AHEAD],
              ["попереду пастка", CONDITIONS.TRAP_AHEAD],
              ["попереду шлях", CONDITIONS.PATH_AHEAD],
            ],
          },
        ],
        message1: "тоді %1",
        args1: [{ type: "input_statement", name: "DO" }],
        previousStatement: null,
        nextStatement: null,
        colour: "#7a54cf",
      },
    ]);

    blocklyWorkspace = Blockly.inject(els.blocklyDiv, {
      toolbox: {
        kind: "categoryToolbox",
        contents: [
          {
            kind: "category",
            name: "Рух",
            colour: "#2677d9",
            contents: [
              { kind: "block", type: "robot_move" },
              { kind: "block", type: "robot_turn" },
              { kind: "block", type: "robot_take_key" },
              { kind: "block", type: "robot_open_door" },
            ],
          },
          {
            kind: "category",
            name: "Логіка",
            colour: "#159b64",
            contents: [
              { kind: "block", type: "robot_repeat" },
              { kind: "block", type: "robot_if" },
            ],
          },
        ],
      },
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
    blocklyWorkspace.addChangeListener(() => {
      if (suppressBlocklySync) return;
      syncCommandsFromBlockly({ persist: true });
      state.compiled = [];
      state.flat = [];
      state.pointer = 0;
      state.activeFlatIndex = -1;
    });
    root.codeRobotBlocklyWorkspace = blocklyWorkspace;
    root.codeRobotDebug = { getCommandsFromBlockly, setBlocklyCommands };
  }

  function getCommandsFromBlockly() {
    if (!blocklyWorkspace) return clone(state.commands);
    return blocklyWorkspace.getTopBlocks(true).flatMap(blockToCommandChain);
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
    if (block.type === "robot_move") return b(COMMANDS.MOVE);
    if (block.type === "robot_turn") return b(COMMANDS.TURN, { direction: block.getFieldValue("DIRECTION") });
    if (block.type === "robot_take_key") return b(COMMANDS.TAKE_KEY);
    if (block.type === "robot_open_door") return b(COMMANDS.OPEN_DOOR);
    if (block.type === "robot_repeat") {
      const firstBodyBlock = block.getInputTargetBlock("DO");
      return b(COMMANDS.REPEAT, { times: Number(block.getFieldValue("TIMES")) }, firstBodyBlock ? blockToCommandChain(firstBodyBlock) : []);
    }
    if (block.type === "robot_if") {
      const firstBodyBlock = block.getInputTargetBlock("DO");
      return b(COMMANDS.IF, { condition: block.getFieldValue("CONDITION") }, firstBodyBlock ? blockToCommandChain(firstBodyBlock) : []);
    }
    return null;
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
    let previous = null;
    commands.forEach((command, index) => {
      const block = createBlocklyBlock(command);
      block.moveBy(24, 24 + index * 48);
      if (previous?.nextConnection && block.previousConnection) previous.nextConnection.connect(block.previousConnection);
      previous = block;
    });
    suppressBlocklySync = false;
    syncCommandsFromBlockly({ persist: shouldPersist });
    if (shouldPersist && options.action && options.action !== "codeChanged") recordAction(options.action, { commandCount: state.commands.length });
    root.Blockly.svgResize(blocklyWorkspace);
  }

  function createBlocklyBlock(command) {
    const typeMap = {
      [COMMANDS.MOVE]: "robot_move",
      [COMMANDS.TURN]: "robot_turn",
      [COMMANDS.TAKE_KEY]: "robot_take_key",
      [COMMANDS.OPEN_DOOR]: "robot_open_door",
      [COMMANDS.REPEAT]: "robot_repeat",
      [COMMANDS.IF]: "robot_if",
    };
    const block = blocklyWorkspace.newBlock(typeMap[command.type]);
    if (command.type === COMMANDS.TURN) block.setFieldValue(command.args.direction, "DIRECTION");
    if (command.type === COMMANDS.REPEAT) block.setFieldValue(String(command.args.times), "TIMES");
    if (command.type === COMMANDS.IF) block.setFieldValue(command.args.condition, "CONDITION");
    block.initSvg();
    block.render();
    if (command.body?.length) {
      let previousChild = null;
      command.body.forEach((child) => {
        const childBlock = createBlocklyBlock(child);
        if (previousChild?.nextConnection && childBlock.previousConnection) {
          previousChild.nextConnection.connect(childBlock.previousConnection);
        } else {
          block.getInput("DO").connection.connect(childBlock.previousConnection);
        }
        previousChild = childBlock;
      });
    }
    return block;
  }

  function renderGrid() {
    els.grid.innerHTML = "";
    const width = levelWidth(state.currentLevel);
    const height = levelHeight(state.currentLevel);
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
        if (isAbyss(state.currentLevel, pos)) cell.classList.add("terrain-abyss");
        if (hasTile(state.currentLevel, "water", pos)) cell.classList.add("terrain-water");
        if (hasTile(state.currentLevel, "lava", pos)) cell.classList.add("terrain-lava");
        if (isBridge(state.currentLevel, pos)) addTileToken(cell, "bridge", "міст", "=");
        if (isWall(state.currentLevel, pos)) cell.classList.add("wall-cell");
        if (samePos(state.currentLevel.door, pos)) addSprite(cell, state.runState.doorOpen ? assetMap.doorOpen : assetMap.doorClosed, "двері", "door");
        if (state.currentLevel.key && !state.runState.keyTaken && samePos(state.currentLevel.key, pos)) addSprite(cell, assetMap.key, "ключ", "key");
        if (samePos(state.currentLevel.crystal, pos)) addSprite(cell, assetMap.crystal, "кристал", "crystal");
        const numberedCrystal = numberedCrystalAt(state.runState, pos);
        if (numberedCrystal) addNumberedCrystal(cell, numberedCrystal);
        if (hasTile(state.currentLevel, "traps", pos)) addTileToken(cell, "trap", "пастка", "×");
        if (hasTile(state.currentLevel, "enemies", pos)) addTileToken(cell, "enemy", "ворог", "!");
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
    if (state.flat[state.activeFlatIndex] === node) block.classList.add("active");

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

  function planRuntimeSteps(nodes, level) {
    const planningState = createRunState(level);
    const flat = [];

    function walk(list) {
      for (const node of list) {
        if (node.type === COMMANDS.REPEAT) {
          for (let i = 0; i < node.args.times; i += 1) {
            if (!walk(node.body)) return false;
          }
          continue;
        }
        if (node.type === COMMANDS.IF) {
          if (evaluateCondition(planningState, node.args.condition) && !walk(node.body)) return false;
          continue;
        }

        flat.push(node);
        const result = executePrimitive(planningState, node);
        if (!result.ok || planningState.status === "success") return false;
      }
      return true;
    }

    walk(nodes);
    return flat;
  }

  function prepareRun() {
    try {
      syncCommandsFromBlockly();
      state.compiled = compileProgram(state.commands);
      state.runState = createRunState(state.currentLevel);
      state.flat = planRuntimeSteps(state.compiled, state.currentLevel);
      state.pointer = 0;
      state.activeFlatIndex = -1;
      return true;
    } catch (error) {
      showMessage(error.message, "error");
      return false;
    }
  }

  function runProgram() {
    if (!syncCommandsFromBlockly().length) return showMessage("Додай блок.", "error");
    if (!state.pointer && !prepareRun()) return;
    state.isRunning = true;
    renderAll();
    scheduleNext();
  }

  function scheduleNext() {
    stopTimer();
    state.timer = window.setTimeout(() => {
      const ok = stepProgram(true);
      if (ok && state.isRunning) scheduleNext();
    }, STEP_DELAY);
  }

  function stepProgram(fromAuto = false) {
    if (!state.flat.length && !prepareRun()) return false;
    if (state.pointer >= state.flat.length) return finishIncomplete();
    const command = state.flat[state.pointer];
    state.activeFlatIndex = state.pointer;
    state.pointer += 1;
    const result = executePrimitive(state.runState, command);
    renderGrid();
    showMessage(result.message, result.ok ? "neutral" : "error");
    if (!result.ok) return stopRun(false);
    if (checkWin(state.runState)) {
      state.completed.add(state.levelIndex);
      saveProgress();
      refreshLevelLocks();
      showMessage("Місію виконано!", "success");
      return stopRun(false);
    }
    if (!fromAuto) showMessage(result.message, "neutral");
    return true;
  }

  function stopRun(result) {
    state.isRunning = false;
    stopTimer();
    renderAll();
    return result;
  }

  function finishIncomplete() {
    state.isRunning = false;
    state.activeFlatIndex = -1;
    stopTimer();
    renderAll();
    showMessage("Алгоритм закінчився.", "neutral");
    return false;
  }

  function pauseProgram() {
    state.isRunning = false;
    stopTimer();
    renderAll();
    showMessage("Пауза.", "neutral");
  }

  function resetLevel(clearCode = false) {
    stopTimer();
    state.runState = createRunState(state.currentLevel);
    state.compiled = [];
    state.flat = [];
    state.pointer = 0;
    state.activeFlatIndex = -1;
    state.isRunning = false;
    state.visualRobot = null;
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
    return chip;
  }

  function blockText(node) {
    const definition = COMMAND_DEFINITIONS[node.type];
    if (node.type === COMMANDS.MOVE) return "рухатися()";
    if (node.type === COMMANDS.TURN) return `повернути(${node.args.direction === "left" ? "ліворуч" : "праворуч"})`;
    if (node.type === COMMANDS.REPEAT) return `repeat(${node.args.times})`;
    if (node.type === COMMANDS.IF) return `if(${conditionLabel(node.args.condition)})`;
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
    return JSON.stringify({
      note: "Origin is top-left. x grows right, y grows down.",
      grid: { width: levelWidth(state.currentLevel), height: levelHeight(state.currentLevel) },
      level: state.currentLevel.name,
      robot: state.runState.robot,
      hasKey: state.runState.hasKey,
      keyTaken: state.runState.keyTaken,
      doorOpen: state.runState.doorOpen,
      collectedCrystals: state.runState.collectedCrystals,
      nextCrystalNumber: state.runState.nextCrystalNumber,
      commandCount: state.commands.length,
      compiledStepCount: state.flat.length,
      pointer: state.pointer,
      message: els.message.textContent,
      insertPath: state.insertPath,
      walls: state.currentLevel.walls,
      key: state.currentLevel.key,
      door: state.currentLevel.door,
      crystal: state.currentLevel.crystal,
      water: state.currentLevel.water || [],
      lava: state.currentLevel.lava || [],
      bridges: state.currentLevel.bridges || [],
      enemies: state.currentLevel.enemies || [],
      traps: state.currentLevel.traps || [],
      numberedCrystals: state.currentLevel.numberedCrystals || [],
      safePath: state.currentLevel.safePath || [],
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
  }

  init().catch((error) => {
    console.error(error);
    showMessage("Не вдалося запустити гру. Онови сторінку.", "error");
  });
})(typeof window !== "undefined" ? window : globalThis);
