import * as util from "./util.js";
import { V } from "./util.js";

const N = Math.log2(util.BASE64.length);

export const fieldSize = new V(1654, 821);
export const size = 304 / 4;
export const zone = 193.3575;

export function clampPos(pos, team) {
  pos = new V(pos);
  let x = pos.x;
  if (team == "r") x = fieldSize.x - x;
  x = Math.min(zone - size / 2, Math.max(size / 2, x));
  if (team == "r") x = fieldSize.x - x;
  pos.x = x;
  pos.y = Math.min(fieldSize.y - size / 2, Math.max(size / 2, pos.y));
  return pos;
}

let allowedNormal =
  " 0123456789)!@#$%^&*(abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ`~-_=+[{]}\\|;:'\",<.>/?".split(
    "",
  );
let allowedWeird = [
  "🔥",
  "💀",
  "😱",
  "🤓",
  "🥵",
  "🥶",
  "😭",
  "😢",
  "😡",
  "🤬",
  "😩",
  "😎",
  "🤡",
  "👍",
  "👎",
  "📸",
  "🐒",
  "🔫",
  "🤯",
  "🤮",
  "👌",
  "❤️",
  "📸",
  "🤌",
  "👀",
  "💙",
  "🥇",
  "🥈",
  "🥉",
  "🗿",
  "💣",
  "😑",
  "\n",
];
for (let c of allowedWeird) if (c.length > 2) console.log(c, c.length);
const allowedChars = [...allowedNormal, ...allowedWeird];

export class Buffer extends util.Target {
  #dat;

  constructor(dat) {
    super();

    this.#dat = [];

    this.dat = dat;
  }

  get dat() {
    return this.#dat.join("");
  }
  set dat(v) {
    if (typeof v == "string") v = v.split("");
    this.#dat = [...Array.from(v).map((d) => +!!parseInt(d))];
    this.#pad();
  }
  #pad() {
    while (this.#dat.length % N > 0) this.#dat.push(0);
  }

  toStr() {
    let s = "";
    for (let i = 0; i < this.#dat.length; i += N) {
      let v = 0,
        b = 1;
      for (let j = 0; j < N; j++) {
        v += b * this.#dat[i + j];
        b *= 2;
      }
      s += util.BASE64[v];
    }
    return s;
  }
  static fromStr(s) {
    s = String(s);
    let dat = [];
    for (let c of s) {
      let v = Math.max(0, util.BASE64.indexOf(c));
      for (let i = 0; i < N; i++) {
        dat.push(v % 2);
        v = Math.floor(v / 2);
      }
    }
    return new Buffer(dat);
  }
  read(x, l) {
    x = parseInt(x);
    l = parseInt(l);
    if (!Number.isFinite(x) || Number.isNaN(x)) throw `X is invalid (X=${x})`;
    if (!Number.isFinite(l) || Number.isNaN(l)) throw `L is invalid (L=${l})`;
    if (x < 0) throw `X out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
    if (x >= this.#dat.length)
      throw `X out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
    if (l < 0) throw `L out of bounds (L=${l})`;
    if (l > 0) {
      if (x + l - 1 < 0)
        throw `X+L out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
      if (x + l - 1 >= this.#dat.length)
        throw `X+L out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
    }
    let v = 0,
      b = 1;
    for (let i = 0; i < l; i++) {
      v += b * this.#dat[x + i];
      b *= 2;
    }
    return v;
  }
  write(x, l, v, push = true) {
    x = parseInt(x);
    l = parseInt(l);
    v = parseInt(v);
    if (!Number.isFinite(x) || Number.isNaN(x)) throw `X is invalid (X=${x})`;
    if (!Number.isFinite(l) || Number.isNaN(l)) throw `L is invalid (L=${l})`;
    if (!Number.isFinite(v) || Number.isNaN(v)) throw `V is invalid (V=${v})`;
    if (x < 0) throw `X out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
    if (push) {
      while (x >= this.#dat.length) this.#dat.push(0);
      this.#pad();
    } else if (x >= this.#dat.length)
      throw `X out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
    if (l < 0) throw `L out of bounds (L=${l})`;
    if (l > 0) {
      if (x + l - 1 < 0)
        throw `X+L out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
      if (push) {
        while (x + l - 1 >= this.#dat.length) this.#dat.push(0);
        this.#pad();
      } else if (x + l - 1 >= this.#dat.length)
        throw `X+L out of bounds (X=${x}, L=${l}, l=${this.#dat.length})`;
    }
    if (v < 0 || v >= 2 ** l) throw `V out of bounds (V=${v}, L=${l})`;
    for (let i = 0; i < l; i++) {
      this.#dat[x + i] = v % 2;
      v = Math.floor(v / 2);
    }
    return this;
  }
}

export class Match extends util.Target {
  #id;
  #robot;
  #robotTeam;

  #pos;
  #preloaded;

  #globalFrames;

  #autoFrames;

  #teleopTime;
  #teleopFrames;

  #endgameTrap;
  #endgameHarmony;

  #finishTime;

  #notes;

  constructor(id, robot) {
    super();

    this.#id = null;
    this.#robot = null;
    this.#robotTeam = null;

    this.#pos = new V();
    this.pos.addLinkedHandler(this, "change", (c, f, t) =>
      this.change("pos." + c, f, t),
    );
    this.#preloaded = null;

    this.#globalFrames = new Match.Frames("global");
    this.globalFrames.addLinkedHandler(this, "change", (c, f, t) =>
      this.change("globalFrames." + c, f, t),
    );

    this.#autoFrames = new Match.Frames("auto");
    this.autoFrames.addLinkedHandler(this, "change", (c, f, t) =>
      this.change("autoFrames." + c, f, t),
    );

    this.#teleopTime = null;
    this.#teleopFrames = new Match.Frames("teleop");
    this.teleopFrames.addLinkedHandler(this, "change", (c, f, t) =>
      this.change("teleopFrames." + c, f, t),
    );

    this.#endgameTrap = null;
    this.#endgameHarmony = null;

    this.#finishTime = null;

    this.#notes = "";

    this.id = id;

    this.robot = robot;

    this.reset();
  }

  reset() {
    let log = () => {};
    [log, console.log] = [console.log, log];

    this.pos = 0;
    this.preloaded = false;

    this.globalFrames = [new Match.Frame(0, "disable", false)];

    this.autoFrames = [];

    this.teleopTime = null;
    this.teleopFrames = [];

    this.endgameTrap = false;
    this.endgameHarmony = false;

    this.finishTime = null;

    this.notes = "";

    [log, console.log] = [console.log, log];

    console.log("resetting");
  }

  get id() {
    return this.#id;
  }
  set id(v) {
    v = util.ensure(v, "int");
    if (this.id == v) return;
    this.change("id", this.id, (this.#id = v));
  }
  isNormal() {
    return !this.isPractice() && !this.isElim();
  }
  isPractice() {
    return this.id == 0;
  }
  isElim() {
    return this.id < 0;
  }
  get elimId() {
    if (!this.isElim()) return null;
    return -this.id;
  }

  get robot() {
    return this.#robot;
  }
  set robot(v) {
    v = v == null ? null : Math.max(1, util.ensure(v, "int"));
    if (this.robot == v) return;
    this.change("robot", this.robot, (this.#robot = v));
    console.log("robot = " + JSON.stringify(this.robot));
    this.robotTeam = this.robotTeam;
  }
  hasRobot() {
    return !!this.robot;
  }
  get robotTeam() {
    return this.#robotTeam;
  }
  set robotTeam(v) {
    v = ["r", "b", null].includes(v) ? v : null;
    if (this.robotTeam == v) return;
    this.change("robotTeam", this.robotTeam, (this.#robotTeam = v));
    console.log("robotTeam = " + JSON.stringify(this.robotTeam));
  }
  hasRobotTeam() {
    return this.robotTeam != null;
  }
  get pos() {
    return this.#pos;
  }
  set pos(v) {
    this.#pos.set(v);
  }
  get x() {
    return this.pos.x;
  }
  set x(v) {
    this.pos.x = v;
  }
  get y() {
    return this.pos.y;
  }
  set y(v) {
    this.pos.y = v;
  }
  get preloaded() {
    return this.#preloaded;
  }
  set preloaded(v) {
    v = !!v;
    if (this.preloaded == v) return;
    this.change("preloaded", this.preloaded, (this.#preloaded = v));
    console.log("preloaded = " + JSON.stringify(this.preloaded));
  }

  get globalFrames() {
    return this.#globalFrames;
  }
  set globalFrames(v) {
    if (v instanceof Match.Frames) return (this.globalFrames.frames = v.frames);
    this.globalFrames.frames = v;
  }

  get autoFrames() {
    return this.#autoFrames;
  }
  set autoFrames(v) {
    if (v instanceof Match.Frames) return (this.autoFrames.frames = v.frames);
    this.autoFrames.frames = v;
  }

  get teleopTime() {
    return this.#teleopTime;
  }
  set teleopTime(v) {
    v = v == null ? null : util.ensure(v, "num");
    if (this.teleopTime == v) return;
    this.change("teleopTime", this.teleopTime, (this.#teleopTime = v));
    console.log("teleopTime = " + JSON.stringify(this.teleopTime));
  }
  hasTeleopTime() {
    return this.teleopTime != null;
  }
  get teleopFrames() {
    return this.#teleopFrames;
  }
  set teleopFrames(v) {
    if (v instanceof Match.Frames) return (this.teleopFrames.frames = v.frames);
    this.teleopFrames.frames = v;
  }

  get endgameTrap() {
    return this.#endgameTrap;
  }
  set endgameTrap(v) {
    v = !!v;
    if (this.endgameTrap == v) return;
    this.change("endgameTrap", this.endgameTrap, (this.#endgameTrap = v));
    console.log("endgameTrap = " + JSON.stringify(this.endgameTrap));
  }
  get endgameHarmony() {
    return this.#endgameHarmony;
  }
  set endgameHarmony(v) {
    v = !!v;
    if (this.endgameHarmony == v) return;
    this.change(
      "endgameHarmony",
      this.endgameHarmony,
      (this.#endgameHarmony = v),
    );
    console.log("endgameHarmony = " + JSON.stringify(this.endgameHarmony));
  }

  get finishTime() {
    return this.#finishTime;
  }
  set finishTime(v) {
    v = v == null ? null : util.ensure(v, "num");
    if (this.finishTime == v) return;
    this.change("finishTime", this.finishTime, (this.#finishTime = v));
    console.log("finishTime = " + JSON.stringify(this.finishTime));
  }
  hasFinishTime() {
    return this.finishTime != null;
  }

  get notes() {
    return this.#notes;
  }
  set notes(v) {
    v = util.ensure(v, "str");
    if (this.notes == v) return;
    this.change("notes", this.notes, (this.#notes = v));
    console.log("notes = " + JSON.stringify(this.notes));
  }

  toObj(scouter) {
    return {
      id: this.id,
      scouter: String(scouter),
      robot: this.robot,
      robotTeam: this.robotTeam,

      pos: this.pos.toJSON(),
      preloaded: this.preloaded,

      globalFrames: this.globalFrames.toObj(),

      autoFrames: this.autoFrames.toObj(),

      teleopTime: this.teleopTime,
      teleopFrames: this.teleopFrames.toObj(),

      endgameTrap: this.endgameTrap,
      endgameHarmony: this.endgameHarmony,

      finishTime: this.finishTime,

      notes: this.notes,
    };
  }
  toBufferStr(scouter) {
    return Match.toBufferStr(this.toObj(scouter));
  }
  fromObj(data) {
    data = util.ensure(data, "obj");

    this.id = data.id;
    this.robot = data.robot;
    this.robotTeam = data.robotTeam;

    this.pos = data.pos;
    this.preloaded = data.preloaded;

    this.globalFrames = data.globalFrames;

    this.autoFrames = data.autoFrames;

    this.teleopTime = data.teleopTime;
    this.teleopFrames = data.teleopFrames;

    this.endgameTrap = data.endgameTrap;
    this.endgameHarmony = data.endgameHarmony;

    this.finishTime = data.finishTime;

    this.notes = data.notes;

    return this;
  }
  fromBufferStr(s) {
    return this.fromObj(Match.fromBufferStr(s));
  }
  static toBufferStr(data) {
    data = util.ensure(data, "obj");
    let i = 0,
      buff = new Buffer([]);
    {
      // id: 8
      let id = util.ensure(data.id, "int") + 128;
      // no max required
      id = Math.min(2 ** 8 - 1, Math.max(0, id));
      // writing
      buff.write(i, 8, id);
      i += 8;
    }
    {
      // n_scouter: 8
      let scouter = String(data.scouter);
      let n = 0;
      for (let _ of scouter) n++;
      // no max required
      n = Math.min(2 ** 8 - 1, Math.max(0, n));
      // writing
      buff.write(i, 8, n);
      i += 8;
      for (let c of scouter) {
        // char: 8
        let char = allowedChars.indexOf(c);
        if (char < 0) char = 0;
        if (char >= 2 ** 8) char = 0;
        // writing
        buff.write(i, 8, char);
        i += 8;
      }
    }
    {
      // robot: 14
      let robot = data.robot;
      if (!util.is(robot, "int")) return "NO_ROBOT_ERR";
      robot = util.ensure(robot, "int");
      // no max required
      robot = Math.min(2 ** 14 - 1, Math.max(0, robot));
      // robotTeam: 1
      let robotTeam = data.robotTeam;
      if (!["r", "b"].includes(robotTeam)) return "NO_ROBOT_TEAM_ERR";
      robotTeam = +(robotTeam == "r");
      // writing
      buff.write(i, 14, robot).write(i + 14, 1, robotTeam);
      i += 14 + 1;
    }
    {
      // clamping
      let pos = new V(data.pos);
      let x = pos.x,
        y = pos.y;
      if (data.robotTeam == "r") x = fieldSize.x - x;
      x = Math.min(zone - size / 2, Math.max(size / 2, x));
      y = Math.min(fieldSize.y - size / 2, Math.max(size / 2, y));
      // x = [0, zone] = [0, 194]
      // y = [0, fieldSize.y] = [0, 802]
      x = Math.round(x);
      y = Math.round(y);
      // x: 8
      // no max required
      x = Math.min(2 ** 8 - 1, Math.max(0, x));
      // y: 10
      // no max required
      y = Math.min(2 ** 10 - 1, Math.max(0, y));
      // preloaded: 1
      let preloaded = +!!data.preloaded;
      // writing
      buff
        .write(i, 8, x)
        .write(i + 8, 10, y)
        .write(i + 8 + 10, 1, preloaded);
      i += 8 + 10 + 1;
    }
    {
      // n: 5
      let frames = [...util.ensure(data.globalFrames, "arr")];
      let n = frames.length;
      // no max required
      n = Math.min(2 ** 5 - 1, Math.max(0, n));
      // writing
      buff.write(i, 5, n);
      i += 5;
      // ASSUMING ALL GLOBAL FRAMES ARE DISABLE STATE FRAMES
      while (n-- > 0) {
        let frame = util.ensure(frames.shift(), "obj");
        // ts: 9
        let ts = Math.round(util.ensure(frame.ts, "num") / 100);
        // no max required
        ts = Math.min(2 ** 9 - 1, Math.max(0, ts));
        // state: 1
        let state = +!!frame.state;
        // writing
        buff.write(i, 9, ts).write(i + 9, 1, state);
        i += 9 + 1;
      }
    }
    {
      // n: 5
      let frames = [...util.ensure(data.autoFrames, "arr")];
      let n = frames.length;
      // no max required
      n = Math.min(2 ** 5 - 1, Math.max(0, n));
      // writing
      buff.write(i, 5, n);
      i += 5;
      // ASSUMING
      /*
                pickup = 0
                speaker = 1
                amp = 2
            */
      while (n-- > 0) {
        let frame = util.ensure(frames.shift(), "obj");
        // ts: 9
        let ts = Math.round(util.ensure(frame.ts, "num") / 100);
        // no max required
        ts = Math.min(2 ** 9 - 1, Math.max(0, ts));
        // type: 2
        let type = ["pickup", "speaker", "amp"].indexOf(frame.type);
        if (type < 0) return "AUTO_FRAME_TYPE_ERR";
        // writing
        buff.write(i, 9, ts).write(i + 9, 2, type);
        i += 9 + 2;
        if (type == 0) {
          // ASSUMING
          /*
                        check field.png

                        0 = zone TOP
                        1 = zone MID
                        2 = zone BOTTOM

                        3 = mid TOP
                        4 = mid
                        5 = mid MID
                        6 = mid
                        7 = mid BOTTOM
                    */
          let state = util.ensure(frame.state, "obj");
          // at: 3
          let at = state.at;
          if (!util.is(at, "int")) return "AUTO_FRAME_PICKUP_NO_LOCATION";
          at = util.ensure(at, "int");
          if (at < 0) return "AUTO_FRAME_PICKUP_LOCATION_MIN_ERR";
          if (at > 7) return "AUTO_FRAME_PICKUP_LOCATION_MAX_ERR";
          // value: 1
          let value = +!!state.value;
          // writing
          buff.write(i, 3, at).write(i + 3, 1, value);
          i += 3 + 1;
        } else {
          // value: 1
          let value = +!!frame.state;
          // writing
          buff.write(i, 1, value);
          i += 1;
        }
      }
    }
    {
      // teleopTime: 12
      let teleopTime = data.teleopTime;
      if (!util.is(teleopTime, "num")) return "NO_TELEOP_TIME";
      teleopTime = Math.round(util.ensure(teleopTime, "num") / 100);
      // no max required
      teleopTime = Math.min(2 ** 12 - 1, Math.max(0, teleopTime));
      // writing
      buff.write(i, 12, teleopTime);
      i += 12;
      // n: 8
      let frames = [...util.ensure(data.teleopFrames, "arr")];
      let n = frames.length;
      // no max required
      n = Math.min(2 ** 8 - 1, Math.max(0, n));
      // writing
      buff.write(i, 8, n);
      i += 8;
      // ASSUMING
      /*
                source = 0
                ground = 1
                speaker = 2
                amp = 3
                hoard = 4
                climb = 5
            */
      while (n-- > 0) {
        let frame = util.ensure(frames.shift(), "obj");
        // ts: 12
        let ts = Math.round(util.ensure(frame.ts, "num") / 100);
        // no max required
        ts = Math.min(2 ** 12 - 1, Math.max(0, ts));
        // type: 3
        let type = [
          "source",
          "ground",
          "speaker",
          "amp",
          "hoard",
          "climb",
        ].indexOf(frame.type);
        if (type < 0) return "TELEOP_FRAME_TYPE_ERR";
        // writing
        buff.write(i, 12, ts).write(i + 12, 3, type);
        i += 12 + 3;
        if (type == 2) {
          let state = util.ensure(frame.state, "obj");
          // clamping
          let pos = new V(state.at);
          let x = pos.x,
            y = pos.y;
          // x = [0, fieldSize.x] = [0, 1654]
          // y = [0, fieldSize.y] = [0, 802]
          x = Math.round(x);
          y = Math.round(y);
          // x: 11
          // no max required
          x = Math.min(2 ** 11 - 1, Math.max(0, x));
          // y: 10
          // no max required
          y = Math.min(2 ** 10 - 1, Math.max(0, y));
          // value: 1
          let value = +!!state.value;
          // writing
          buff
            .write(i, 11, x)
            .write(i + 11, 10, y)
            .write(i + 11 + 10, 1, value);
          i += 11 + 10 + 1;
          // } else if (type == 4) {
        } else if (type == 5) {
          // ASSUMING
          /*
                        0 = none
                        1 = parked
                        2 = onstage
                    */
          // value: 2
          let value = frame.state;
          if (!util.is(value, "int")) return "TELEOP_FRAME_CLIMB_NO_VALUE";
          value = util.ensure(value, "int");
          if (value < 0) return "TELEOP_FRAME_CLIMB_VALUE_MIN_ERR";
          if (value > 2) return "TELEOP_FRAME_CLIMB_VALUE_MAX_ERR";
          // writing
          buff.write(i, 2, value);
          i += 2;
        } else {
          // value: 1
          let value = +!!frame.state;
          // writing
          buff.write(i, 1, value);
          i += 1;
        }
      }
    }
    {
      // endgameTrap: 1
      let endgameTrap = +!!data.endgameTrap;
      // endgameHarmony: 1
      let endgameHarmony = +!!data.endgameHarmony;
      // writing
      buff.write(i, 1, endgameTrap).write(i + 1, 1, endgameHarmony);
      i += 1 + 1;
    }
    {
      // finishTime: 12
      let finishTime = data.finishTime;
      if (!util.is(finishTime, "num")) return "NO_FINISH_TIME";
      finishTime = Math.round(util.ensure(finishTime, "num") / 100);
      // no max required
      finishTime = Math.min(2 ** 12 - 1, Math.max(0, finishTime));
      // writing
      buff.write(i, 12, finishTime);
      i += 12;
    }
    {
      // n_notes: 16
      let notes = String(data.notes);
      let n = 0;
      for (let _ of notes) n++;
      // no max required
      n = Math.min(2 ** 16 - 1, Math.max(0, n));
      // writing
      buff.write(i, 16, n);
      i += 16;
      for (let c of notes) {
        // char: 8
        let char = allowedChars.indexOf(c);
        if (char < 0) char = 0;
        if (char >= 2 ** 8) char = 0;
        // writing
        buff.write(i, 8, char);
        i += 8;
      }
    }
    // console.log(Match.fromBufferStr(buff.toStr()));
    return buff.toStr();
  }
  static fromBufferStr(s) {
    let data = {};
    let i = 0,
      buff = Buffer.fromStr(s);
    {
      data.id = buff.read(i, 8) - 128;
      i += 8;
    }
    {
      let n = buff.read(i, 8),
        scouter = "";
      i += 8;
      while (n-- > 0) {
        let char = buff.read(i, 8);
        i += 8;
        scouter += allowedChars[char];
      }
      data.scouter = scouter;
    }
    {
      data.robot = buff.read(i, 14);
      data.robotTeam = buff.read(i + 14, 1) ? "r" : "b";
      i += 14 + 1;
    }
    {
      data.pos = new V(buff.read(i, 8), buff.read(i + 8, 10));
      data.preloaded = !!buff.read(i + 8 + 10, 1);
      i += 8 + 10 + 1;
    }
    {
      let n = buff.read(i, 5),
        frames = [];
      i += 5;
      while (n-- > 0) {
        let ts = buff.read(i, 9) * 100;
        let state = buff.read(i + 9, 1);
        frames.push({
          ts: ts,
          type: "disable",
          state: !!state,
        });
        i += 9 + 1;
      }
      data.globalFrames = frames;
    }
    {
      let n = buff.read(i, 5),
        frames = [];
      i += 5;
      while (n-- > 0) {
        let ts = buff.read(i, 9) * 100;
        let type = buff.read(i + 9, 2);
        let frame = {
          ts: ts,
          type: ["pickup", "speaker", "amp"][type],
        };
        i += 9 + 2;
        if (type == 0) {
          let at = buff.read(i, 3);
          let value = buff.read(i + 3, 1);
          frame.state = { at: at, value: !!value };
          i += 3 + 1;
        } else {
          frame.state = !!buff.read(i, 1);
          i += 1;
        }
        frames.push(frame);
      }
      data.autoFrames = frames;
    }
    {
      data.teleopTime = buff.read(i, 12) * 100;
      i += 12;
      let n = buff.read(i, 8),
        frames = [];
      i += 8;
      while (n-- > 0) {
        let ts = buff.read(i, 12) * 100;
        let type = buff.read(i + 12, 3);
        let frame = {
          ts: ts,
          type: ["source", "ground", "speaker", "amp", "hoard", "climb"][type],
        };
        i += 12 + 3;
        if (type == 2) {
          let x = buff.read(i, 11);
          let y = buff.read(i + 11, 10);
          let value = buff.read(i + 11 + 10, 1);
          frame.state = { at: new V(x, y), value: !!value };
          i += 11 + 10 + 1;
          // } else if (type == 4) {
          //     frame.state = null;
        } else if (type == 5) {
          frame.state = buff.read(i, 2);
          i += 2;
        } else {
          frame.state = !!buff.read(i, 1);
          i += 1;
        }
        frames.push(frame);
      }
      data.teleopFrames = frames;
    }
    {
      data.endgameTrap = !!buff.read(i, 1);
      data.endgameHarmony = !!buff.read(i + 1, 1);
      i += 1 + 1;
    }
    {
      data.finishTime = buff.read(i, 12) * 100;
      i += 12;
    }
    {
      let n = buff.read(i, 16),
        notes = "";
      i += 16;
      while (n-- > 0) {
        let char = buff.read(i, 8);
        i += 8;
        notes += allowedChars[char];
      }
      data.notes = notes;
    }
    return data;
  }
}
Match.Frames = class MatchFrames extends util.Target {
  #name;

  #frames;

  constructor(name) {
    super();

    this.#name = String(name);

    this.#frames = [];
  }

  get name() {
    return this.#name;
  }

  get frames() {
    return [...this.#frames];
  }
  set frames(v) {
    v = util.ensure(v, "arr");
    this.clear();
    this.add(v);
  }
  clear() {
    let frames = this.frames;
    this.rem(frames);
    return frames;
  }
  has(frame) {
    if (!(frame instanceof Match.Frame)) return false;
    return this.#frames.includes(frame);
  }
  add(...frames) {
    return util.Target.resultingForEach(frames, (frame) => {
      if (!(frame instanceof Match.Frame)) frame = Match.Frame.fromObj(frame);
      if (this.has(frame)) return false;
      if (this.#frames.length == 0) this.#frames.push(frame);
      else if (this.#frames.length == 1) {
        if (frame.ts < this.#frames[0].ts) this.#frames.unshift(frame);
        else this.#frames.push(frame);
      } else {
        if (frame.ts < this.#frames.at(0).ts) this.#frames.unshift(frame);
        else if (frame.ts >= this.#frames.at(-1).ts) this.#frames.push(frame);
        else {
          let l = 0,
            r = this.#frames.length - 2;
          while (l <= r) {
            let m = Math.floor((l + r) / 2);
            if (frame.ts < this.#frames[m].ts) r = l - 1;
            else if (frame.ts >= this.#frames[m + 1].ts) l = r + 1;
            else break;
          }
          let m = Math.floor((l + r) / 2);
          this.#frames.splice(m, 0, frame);
        }
      }
      this.change("add", null, frame);
      console.log(
        "add frame<" +
          this.name +
          "> (" +
          frame.type +
          " = " +
          JSON.stringify(frame.state) +
          " @ " +
          frame.ts +
          ")",
      );
      return frame;
    });
  }
  rem(...frames) {
    return util.Target.resultingForEach(frames, (frame) => {
      if (!(frame instanceof Match.Frame)) frame = Match.Frame.fromObj(frame);
      if (!this.has(frame)) return false;
      this.#frames.splice(this.#frames.indexOf(frame), 1);
      this.change("rem", frame, null);
      console.log(
        "rem frame<" +
          this.name +
          "> (" +
          frame.type +
          " = " +
          JSON.stringify(frame.state) +
          " @ " +
          frame.ts +
          ")",
      );
      return frame;
    });
  }

  toObj() {
    return this.frames.map((frame) => frame.toObj());
  }
  fromObj(data) {
    this.frames = data;
    return this;
  }
};
Match.Frame = class MatchFrame extends util.Target {
  #ts;
  #type;
  #state;

  constructor(ts, type, state) {
    super();

    this.#ts = util.ensure(ts, "num");

    this.#type = String(type);
    this.#state = state;
  }

  get ts() {
    return this.#ts;
  }
  get type() {
    return this.#type;
  }
  get state() {
    return this.#state;
  }

  toObj() {
    return {
      ts: this.ts,
      type: this.type,
      state: this.state,
    };
  }
  static fromObj(data) {
    data = util.ensure(data, "obj");
    return new Match.Frame(data.ts, data.type, data.state);
  }
};
