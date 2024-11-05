import * as util from "./util.js";
import { V } from "./util.js";

import { Match, fieldSize, size, zone, clampPos } from "./data.js";

function hashStr(s) {
  s = String(s);
  let hash = 0;
  if (s.length <= 0) return hash;
  for (let i = 0; i < s.length; i++) {
    let chr = s.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash;
}
window.hashStr = hashStr;

export default class App extends util.Target {
  #id;
  #scouter;
  #flipX;
  #flipY;

  #page;

  #matches;
  #match;

  constructor() {
    super();

    window.app = this;

    this.addHandler("start", () => {
      let id = setInterval(async () => {
        if (document.readyState != "complete") return;
        this.setup();
        clearInterval(id);
        let t0 = null;
        const update = async () => {
          window.requestAnimationFrame(update);
          let t1 = util.getTime();
          if (t0 == null) return (t0 = t1);
          this.update(t1 - t0);
          t0 = t1;
        };
        update();
      }, 10);
    });

    this.addHandler("setup", () => {
      window.addEventListener("beforeunload", (e) => {
        if (window.navigator.onLine) return;
        return (e.returnValue =
          "Reloading the page when offline can crash the app! Are you sure?");
      });
      document.body.style.backgroundImage = "url(./field.png)";
      document.body.style.backgroundSize = "0% auto";

      let pwd = localStorage.getItem("pwd");
      if (pwd == null) {
        let v = prompt("Password:");
        if (v != null)
          localStorage.setItem("pwd", (pwd = v.length <= 0 ? null : v));
      }

      let apiKey = null;
      let eventKey = null;
      let scouters = [];
      let event = {};
      let matches = [];
      let teams = [];

      let lock = false;
      const pull = async () => {
        if (lock) return;
        lock = true;
        await Promise.all(
          [
            async () => {
              try {
                console.log("🛜 api-key: PYAW");
                let resp = await fetch(
                  "https://ppatrol.pythonanywhere.com/data/apiKey",
                  {
                    method: "GET",
                    mode: "cors",
                    headers: {
                      Password: pwd,
                    },
                  },
                );
                if (resp.status != 200) throw resp.status;
                resp = await resp.text();
                console.log("🛜 api-key: PYAW = " + resp);
                apiKey = JSON.parse(resp);
              } catch (e) {
                console.log("🛜 api-key: PYAW ERR", e);
                try {
                  console.log("🛜 api-key: LS");
                  apiKey = JSON.parse(localStorage.getItem("api-key"));
                } catch (e) {
                  console.log("🛜 api-key: LS ERR", e);
                  apiKey = null;
                }
              }
              apiKey = apiKey == null ? null : String(apiKey);
              localStorage.setItem("api-key", JSON.stringify(apiKey));
            },
            async () => {
              try {
                console.log("🛜 event-key: PYAW");
                let resp = await fetch(
                  "https://ppatrol.pythonanywhere.com/data/eventKey",
                  {
                    method: "GET",
                    mode: "cors",
                    headers: {
                      Password: pwd,
                    },
                  },
                );
                if (resp.status != 200) throw resp.status;
                resp = await resp.text();
                console.log("🛜 event-key: PYAW = " + resp);
                eventKey = JSON.parse(resp);
              } catch (e) {
                console.log("🛜 event-key: PYAW ERR", e);
                try {
                  console.log("🛜 event-key: LS");
                  eventKey = JSON.parse(localStorage.getItem("event-key"));
                } catch (e) {
                  console.log("🛜 event-key: LS ERR", e);
                  eventKey = null;
                }
              }
              eventKey = eventKey == null ? null : String(eventKey);
              localStorage.setItem("event-key", JSON.stringify(eventKey));
            },
          ].map((f) => f()),
        );
        await Promise.all(
          [
            async () => {
              try {
                console.log("🛜 scouters: PYAW");
                if (eventKey == null) throw "event-key";
                let resp = await fetch(
                  "https://ppatrol.pythonanywhere.com/data/" +
                    eventKey +
                    "/scouters",
                  {
                    method: "GET",
                    mode: "cors",
                    headers: {
                      Password: pwd,
                    },
                  },
                );
                if (resp.status != 200) throw resp.status;
                resp = await resp.text();
                // console.log("🛜 scouters: PYAW = "+resp);
                scouters = JSON.parse(resp);
              } catch (e) {
                console.log("🛜 scouters: PYAW ERR", e);
                try {
                  console.log("🛜 scouters: LS");
                  scouters = JSON.parse(localStorage.getItem("scouters"));
                } catch (e) {
                  console.log("🛜 scouters: LS ERR", e);
                  scouters = null;
                }
              }
              scouters = util
                .ensure(scouters, "arr")
                .map((scouter) => util.ensure(scouter, "obj"));
              localStorage.setItem("scouters", JSON.stringify(scouters));
            },
            async () => {
              try {
                console.log("🛜 event: TBA");
                if (apiKey == null) throw "api-key";
                if (eventKey == null) throw "event-key";
                let resp = await fetch(
                  "https://www.thebluealliance.com/api/v3/event/" + eventKey,
                  {
                    method: "GET",
                    headers: {
                      Accept: "application/json",
                      "X-TBA-Auth-Key": apiKey,
                    },
                  },
                );
                if (resp.status != 200) throw resp.status;
                resp = await resp.text();
                // console.log("🛜 event: TBA = "+resp);
                event = JSON.parse(resp);
              } catch (e) {
                console.log("🛜 event: TBA ERR", e);
                try {
                  console.log("🛜 event: LS");
                  event = JSON.parse(localStorage.getItem("event"));
                } catch (e) {
                  console.log("🛜 event: LS ERR", e);
                  event = null;
                }
              }
              event = util.ensure(event, "obj");
              localStorage.setItem("event", JSON.stringify(event));
            },
            async () => {
              try {
                console.log("🛜 matches: TBA");
                if (apiKey == null) throw "api-key";
                if (eventKey == null) throw "event-key";
                let resp = await fetch(
                  "https://www.thebluealliance.com/api/v3/event/" +
                    eventKey +
                    "/matches",
                  {
                    method: "GET",
                    headers: {
                      Accept: "application/json",
                      "X-TBA-Auth-Key": apiKey,
                    },
                  },
                );
                if (resp.status != 200) throw resp.status;
                resp = await resp.text();
                // console.log("🛜 matches: TBA = "+resp);
                matches = JSON.parse(resp);
              } catch (e) {
                console.log("🛜 matches: TBA ERR", e);
                try {
                  console.log("🛜 matches: LS");
                  matches = JSON.parse(localStorage.getItem("matches"));
                } catch (e) {
                  console.log("🛜 matches: LS ERR", e);
                  matches = null;
                }
              }
              matches = util.ensure(matches, "arr");
              localStorage.setItem("matches", JSON.stringify(matches));
            },
            async () => {
              try {
                console.log("🛜 teams: TBA");
                if (apiKey == null) throw "api-key";
                if (eventKey == null) throw "event-key";
                let resp = await fetch(
                  "https://www.thebluealliance.com/api/v3/event/" +
                    eventKey +
                    "/teams",
                  {
                    method: "GET",
                    headers: {
                      Accept: "application/json",
                      "X-TBA-Auth-Key": apiKey,
                    },
                  },
                );
                if (resp.status != 200) throw resp.status;
                resp = await resp.text();
                // console.log("🛜 teams: TBA = "+resp);
                teams = JSON.parse(resp);
              } catch (e) {
                console.log("🛜 teams: TBA ERR", e);
                try {
                  console.log("🛜 teams: LS");
                  teams = JSON.parse(localStorage.getItem("teams"));
                } catch (e) {
                  console.log("🛜 teams: LS ERR", e);
                  teams = null;
                }
              }
              teams = util.ensure(teams, "arr");
              localStorage.setItem("teams", JSON.stringify(teams));
            },
          ].map((f) => f()),
        );
        lock = false;
        this.post("pull");
      };

      this.eBack = document.getElementById("back");
      this.eForward = document.getElementById("forward");
      this.eMatch = document.getElementById("match");
      this.eId = document.getElementById("id");
      this.eTime = document.getElementById("time");
      this.eScreen = document.getElementById("screen");
      let fullscreenWanted = !new URLSearchParams(window.location.search).get(
        "debug",
      );
      const isFullscreen = () => document.fullscreenElement == document.body;
      const updateFullscreen = () => {
        if (fullscreenWanted) {
          if (!isFullscreen()) document.body.requestFullscreen();
        } else {
          if (isFullscreen()) document.exitFullscreen();
        }
        this.eScreen.children[0].style.display = fullscreenWanted ? "none" : "";
        this.eScreen.children[1].style.display = fullscreenWanted ? "" : "none";
        checkFullscreen();
      };
      this.eScreen.addEventListener("click", (e) => {
        fullscreenWanted = !fullscreenWanted;
        updateFullscreen();
      });
      document.body.addEventListener("click", updateFullscreen);
      this.eReload = document.getElementById("reload");
      this.eReload.addEventListener("click", (e) => {
        location.reload();
      });

      this.eOverlay = document.getElementById("overlay");
      const checkFullscreen = () => {
        if (fullscreenWanted) {
          if (isFullscreen()) this.eOverlay.classList.remove("this");
          else this.eOverlay.classList.add("this");
        } else this.eOverlay.classList.remove("this");
      };
      document.addEventListener("fullscreenchange", checkFullscreen);

      updateFullscreen();

      this.ePrompt = document.getElementById("prompt");
      this.ePromptTitle = document.getElementById("prompt-title");
      this.ePromptClose = document.getElementById("prompt-close");
      this.ePromptInput = document.getElementById("prompt-input");
      this.ePromptButtons = document.getElementById("prompt-btns");
      this.ePromptYes = document.getElementById("prompt-yes");
      this.ePromptNo = document.getElementById("prompt-no");

      this.eSettingsPage = document.getElementById("settings");

      this.eSettingEvent = document.getElementById("setting-event");
      this.eSettingEventName = document.getElementById("setting-event-name");
      this.eSettingEventId = document.getElementById("setting-event-id");
      // this.eSettingFlipX = document.getElementById("setting-flipx");
      // this.eSettingFlippedX = document.getElementById("setting-flippedx");
      // this.eSettingFlipY = document.getElementById("setting-flipy");
      // this.eSettingFlippedY = document.getElementById("setting-flippedy");
      this.eSettingLeft = document.getElementById("setting-left");
      this.eSettingLeftRed = document.getElementById("setting-left-red");
      this.eSettingIds = Array.from(document.querySelectorAll(".setting-id"));
      this.eSettingPwdEdit = document.getElementById("setting-pwd-edit");
      this.eSettingResetData = document.getElementById("setting-reset-data");

      this.eNavigatorPage = document.getElementById("navigator");

      this.eScouterName = document.getElementById("scouter-name");
      this.eScouterDropdown = document.getElementById("scouter-dropdown");
      this.ePracticeMatch = document.getElementById("practice-match");
      this.eNavigatorList = document.getElementById("navigator-list");

      this.ePreAutoPage = document.getElementById("preauto");

      this.ePreAutoField = document.getElementById("preauto-field");
      this.ePreAutoRobotPos = document.getElementById("preauto-robot-pos");
      this.ePreAutoRobot = document.getElementById("preauto-robot");
      this.ePreAutoRobotId = document.getElementById("preauto-robot-id");
      this.ePreAutoRobotDropdown = document.getElementById(
        "preauto-robot-dropdown",
      );
      this.ePreAutoPreload = document.getElementById("preauto-preload");
      this.ePreAutoPreloaded = document.getElementById("preauto-preloaded");
      this.ePreAutoTeam = document.getElementById("preauto-team");
      this.ePreAutoStart = document.getElementById("preauto-start");

      this.eAutoPage = document.getElementById("auto");

      this.eAutoField = document.getElementById("auto-field");
      this.eAutoPickups = Array.from(document.querySelectorAll(".auto-pickup"));
      this.eAutoPickup = document.getElementById("auto-pickup");
      this.eAutoPickupSuccess = document.getElementById("auto-pickup-success");
      this.eAutoPickupSuccessCount = document.getElementById(
        "auto-pickup-success-count",
      );
      this.eAutoPickupFail = document.getElementById("auto-pickup-fail");
      this.eAutoPickupFailCount = document.getElementById(
        "auto-pickup-fail-count",
      );
      this.eAutoPickupCancel = document.getElementById("auto-pickup-cancel");
      this.eAutoPickupUndo = document.getElementById("auto-pickup-undo");
      this.eAutoSpeakerSuccess = document.getElementById(
        "auto-speaker-success",
      );
      this.eAutoSpeakerSuccessCount = document.getElementById(
        "auto-speaker-success-count",
      );
      this.eAutoSpeakerFail = document.getElementById("auto-speaker-fail");
      this.eAutoSpeakerFailCount = document.getElementById(
        "auto-speaker-fail-count",
      );
      this.eAutoSpeakerUndo = document.getElementById("auto-speaker-undo");
      this.eAutoAmpSuccess = document.getElementById("auto-amp-success");
      this.eAutoAmpSuccessCount = document.getElementById(
        "auto-amp-success-count",
      );
      this.eAutoAmpFail = document.getElementById("auto-amp-fail");
      this.eAutoAmpFailCount = document.getElementById("auto-amp-fail-count");
      this.eAutoAmpUndo = document.getElementById("auto-amp-undo");
      this.eAutoDisable = document.getElementById("auto-disable");
      this.eAutoDisabled = document.getElementById("auto-disabled");
      this.eAutoNext = document.getElementById("auto-next");

      this.eTeleopPage = document.getElementById("teleop");

      this.eTeleopPickupSourceSuccess = document.getElementById(
        "teleop-pickup-source-success",
      );
      this.eTeleopPickupSourceFail = document.getElementById(
        "teleop-pickup-source-fail",
      );
      this.eTeleopPickupSourceUndo = document.getElementById(
        "teleop-pickup-source-undo",
      );
      this.eTeleopPickupGroundSuccess = document.getElementById(
        "teleop-pickup-ground-success",
      );
      this.eTeleopPickupGroundFail = document.getElementById(
        "teleop-pickup-ground-fail",
      );
      this.eTeleopPickupGroundUndo = document.getElementById(
        "teleop-pickup-ground-undo",
      );
      this.eTeleopScoreSpeakerSuccess = document.getElementById(
        "teleop-score-speaker-success",
      );
      this.eTeleopScoreSpeakerFail = document.getElementById(
        "teleop-score-speaker-fail",
      );
      this.eTeleopScoreSpeakerUndo = document.getElementById(
        "teleop-score-speaker-undo",
      );
      this.eTeleopScoreAmpSuccess = document.getElementById(
        "teleop-score-amp-success",
      );
      this.eTeleopScoreAmpFail = document.getElementById(
        "teleop-score-amp-fail",
      );
      this.eTeleopScoreAmpUndo = document.getElementById(
        "teleop-score-amp-undo",
      );
      // this.eTeleopHoardAdd = document.getElementById("teleop-hoard-add");
      // this.eTeleopHoardRem = document.getElementById("teleop-hoard-rem");
      this.eTeleopHoardSuccess = document.getElementById(
        "teleop-hoard-success",
      );
      this.eTeleopHoardFail = document.getElementById("teleop-hoard-fail");
      this.eTeleopHoardUndo = document.getElementById("teleop-hoard-undo");
      this.eTeleopPickupSourceSuccessCount = document.getElementById(
        "teleop-pickup-source-success-count",
      );
      this.eTeleopPickupSourceFailCount = document.getElementById(
        "teleop-pickup-source-fail-count",
      );
      this.eTeleopPickupGroundSuccessCount = document.getElementById(
        "teleop-pickup-ground-success-count",
      );
      this.eTeleopPickupGroundFailCount = document.getElementById(
        "teleop-pickup-ground-fail-count",
      );
      this.eTeleopScoreSpeakerSuccessCount = document.getElementById(
        "teleop-score-speaker-success-count",
      );
      this.eTeleopScoreSpeakerFailCount = document.getElementById(
        "teleop-score-speaker-fail-count",
      );
      this.eTeleopScoreAmpSuccessCount = document.getElementById(
        "teleop-score-amp-success-count",
      );
      this.eTeleopScoreAmpFailCount = document.getElementById(
        "teleop-score-amp-fail-count",
      );
      // this.eTeleopHoardCount = document.getElementById("teleop-hoard-count");
      this.eTeleopHoardSuccessCount = document.getElementById(
        "teleop-hoard-success-count",
      );
      this.eTeleopHoardFailCount = document.getElementById(
        "teleop-hoard-fail-count",
      );
      this.eTeleopScoreSpeaker = document.getElementById(
        "teleop-score-speaker",
      );
      this.eTeleopDisable = document.getElementById("teleop-disable");
      this.eTeleopDisabled = document.getElementById("teleop-disabled");
      this.eTeleopNext = document.getElementById("teleop-next");
      this.eTeleopModal = document.getElementById("teleop-modal");
      this.eTeleopField = document.getElementById("teleop-field");
      this.eTeleopRobot = document.getElementById("teleop-robot");
      this.eTeleopType = document.getElementById("teleop-type");
      this.eTeleopSuccess = document.getElementById("teleop-success");
      this.eTeleopFail = document.getElementById("teleop-fail");
      this.eTeleopCancel = document.getElementById("teleop-cancel");

      this.eEndgamePage = document.getElementById("endgame");

      this.eEndgamePos = document.getElementById("endgame-pos");
      this.eEndgamePosSelectors = Array.from(
        document.querySelectorAll(".endgame-pos-selector"),
      );
      this.eEndgameTrap = document.getElementById("endgame-trap");
      this.eEndgameTrapped = document.getElementById("endgame-trapped");
      this.eEndgameHarmony = document.getElementById("endgame-harmony");
      this.eEndgameHarmonied = document.getElementById("endgame-harmonied");
      this.eEndgameNext = document.getElementById("endgame-next");

      this.eNotesPage = document.getElementById("notes");
      this.eNotesNotes = document.getElementById("notes-notes");
      this.eNotesNext = document.getElementById("notes-next");

      this.eFinishPage = document.getElementById("finish");

      this.eFinishCodeBox = document.getElementById("finish-code-box");
      this.eFinishCode = document.getElementById("finish-code");
      this.eFinishCode.innerHTML = "<canvas></canvas>";
      this.eFinishCodeCanvas = this.eFinishCode.children[0];
      this.eFinishNext = document.getElementById("finish-next");
      this.eFinishReset = document.getElementById("finish-reset");

      this.#id = null;
      this.#scouter = "";
      this.#flipX = false;
      this.#flipY = false;

      this.pages = {
        settings: this.eSettingsPage,
        navigator: this.eNavigatorPage,
        preauto: this.ePreAutoPage,
        auto: this.eAutoPage,
        teleop: this.eTeleopPage,
        endgame: this.eEndgamePage,
        notes: this.eNotesPage,
        finish: this.eFinishPage,
      };
      this.#page = null;

      let startTime = null;

      let states = {};
      for (let id in this.pages) {
        let state = (states[id] = new util.Target());
        let idfs = {
          settings: () => {
            // this.eSettingFlippedX.addEventListener("change", e => {
            //     this.flipX = this.eSettingFlippedX.checked;
            // });
            // this.eSettingFlippedY.addEventListener("change", e => {
            //     this.flipY = this.eSettingFlippedY.checked;
            // });
            this.eSettingLeftRed.addEventListener("change", (e) => {
              this.leftRed = !this.leftRed;
            });

            this.eSettingIds.forEach((elem, id) => {
              id++;
              elem.querySelector("*").textContent = id;
              elem.addEventListener("click", (e) => {
                this.id = id;
              });
            });

            this.eSettingPwdEdit.addEventListener("click", (e) => {
              let v = prompt("Password:");
              if (v == null) return;
              if (v.length <= 0) v = null;
              localStorage.setItem("pwd", (pwd = v));
              pull();
            });

            this.eSettingResetData.addEventListener("click", async (e) => {
              this.ePrompt.classList.add("this");
              let clear = await new Promise((res, rej) => {
                this.ePromptTitle.textContent = "Are you sure?";
                this.ePromptInput.style.display = "none";
                this.ePromptButtons.style.display = "";
                const onFinish = () => {
                  this.ePrompt.classList.remove("this");
                  this.ePromptClose.removeEventListener("click", onClose);
                  this.ePromptYes.removeEventListener("click", onYes);
                  this.ePromptNo.removeEventListener("click", onNo);
                };
                const onClose = () => {
                  res(false);
                  onFinish();
                };
                const onYes = () => {
                  res(true);
                  onFinish();
                };
                const onNo = () => {
                  res(false);
                  onFinish();
                };
                this.ePromptClose.addEventListener("click", onClose);
                this.ePromptYes.addEventListener("click", onYes);
                this.ePromptNo.addEventListener("click", onNo);
              });
              if (!clear) return;
              localStorage.removeItem("_matches-scouted");
              this.updateMatches(true);
              this.page = "navigator";
            });

            this.addHandler("change-id", () => {
              this.eSettingIds.forEach((elem, id) => {
                id++;
                if (this.id == id) elem.classList.add("this");
                else elem.classList.remove("this");
              });
            });

            this.addHandler("pull", () => {
              this.eSettingEventName.textContent = util.ensure(
                event.name,
                "str",
                "None",
              );
              this.eSettingEventId.textContent = eventKey;
            });
          },
          navigator: () => {
            this.eScouterName.addEventListener("focus", (e) => {
              this.eScouterDropdown.innerHTML = "";
              scouters
                .sort((a, b) => {
                  // let roleA = ["scouter", "other", "dev"].indexOf(String(a.role).split("-")[0]);
                  let roleA = util.ensure(a.role, "int");
                  // let roleB = ["scouter", "other", "dev"].indexOf(String(b.role).split("-")[0]);
                  let roleB = util.ensure(b.role, "int");
                  if (roleA < roleB) return -1;
                  if (roleB < roleA) return +1;
                  let nameA = String(a.name);
                  let nameB = String(b.name);
                  if (nameA < nameB) return -1;
                  if (nameB < nameA) return +1;
                  return 0;
                })
                .forEach((scouter) => {
                  let elem = document.createElement("button");
                  this.eScouterDropdown.appendChild(elem);
                  // String(scouter.role).split("-").forEach(subrole => elem.classList.add(subrole));
                  elem.style.background = scouter.background;
                  elem.textContent = scouter.name;
                  elem.addEventListener("click", (e) => {
                    this.scouter = scouter.name;
                  });
                });
            });
            const updateScouter = () => {
              this.eScouterName.textContent = this.scouter || "None";
              this.eScouterName.className = "";
              let scouter = scouters.findIndex((s) => s.name == this.scouter);
              if (scouter < 0) return;
              scouter = scouters[scouter];
              this.eScouterName.style.background = scouter.background;
            };
            this.addHandler("change", updateScouter);
            updateScouter();
            this.ePracticeMatch.addEventListener("click", (e) => {
              let matches = this.matches;
              for (let match of matches) {
                if (!match.match.isPractice()) continue;
                match.post("trigger", null);
                break;
              }
            });
            this.addHandler("pull", () => {
              let newMatches = [
                new App.Match(0),
                ...matches
                  .filter((match) => match.comp_level == "qm")
                  .sort((a, b) => a.match_number - b.match_number)
                  .map((match) => {
                    return new App.Match(
                      match.match_number,
                      match.alliances.red.team_keys.map((key) =>
                        parseInt(key.substring(3)),
                      ),
                      match.alliances.blue.team_keys.map((key) =>
                        parseInt(key.substring(3)),
                      ),
                      null,
                    );
                  }),
                ...Array.from(new Array(14).keys()).map(
                  (i) => new App.Match(-i - 1),
                ),
              ];
              if (newMatches.length <= 1)
                newMatches.push(
                  new App.Match(1, [1111, 2222, 3333], [4444, 5555, 6666]),
                );
              let oldMatches = this.matches;
              let theMatches = [];
              newMatches.forEach((match) => {
                let i = oldMatches.findIndex(
                  (match2) => match2.match.id == match.match.id,
                );
                if (i < 0) theMatches.push(match);
                else theMatches.push(oldMatches[i]);
              });
              this.matches = theMatches;
            });
          },
          preauto: () => {
            this.ePreAutoField.addEventListener("touchstart", (e) => {
              const mouseup = () => {
                document.body.removeEventListener("touchmove", mousemove);
                document.body.removeEventListener("touchend", mouseup);
              };
              const mousemove = (e) => {
                const r = this.ePreAutoField.getBoundingClientRect();
                let scale = r.height / fieldSize.y;
                if (!this.hasMatch()) return;

                let x = e.changedTouches[0].pageX - r.left;
                if (this.flipX) x = r.width - x;
                if (this.match.robotTeam == "r")
                  x = fieldSize.x - (r.width - x) / scale;
                else x /= scale;
                this.match.x = x;

                let y = e.changedTouches[0].pageY - r.top;
                if (this.flipY) y = r.height - y;
                y /= scale;
                this.match.y = y;
              };
              mousemove(e);
              document.body.addEventListener("touchmove", mousemove);
              document.body.addEventListener("touchend", mouseup);
            });

            this.ePreAutoPreloaded.addEventListener("change", (e) => {
              if (!this.hasMatch()) return;
              this.match.preloaded = this.ePreAutoPreloaded.checked;
            });

            this.ePreAutoTeam.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.robotTeam = this.match.robotTeam == "b" ? "r" : "b";
            });

            this.ePreAutoStart.addEventListener("click", (e) => {
              this.page = "auto";
              if (!this.hasMatch()) return;
              if (startTime != null) return;
              startTime = util.getTime();
              this.change("match.startTime", null, startTime);
            });

            const updateField = () => {
              this.ePreAutoField.style.backgroundPosition =
                (this.hasMatch() && this.match.robotTeam == "r" ? 100 : 0) +
                "% 0%";
              this.ePreAutoField.style.transform =
                "scale(" +
                (this.flipX ? -1 : 1) +
                ", " +
                (this.flipY ? -1 : 1) +
                ")";
            };
            ["match", "match.robotTeam", "flipX", "flipY"].forEach((c) =>
              this.addHandler("change-" + c, updateField),
            );
            const updateRobot = () => {
              const r = this.ePreAutoField.getBoundingClientRect();
              let scale = r.height / fieldSize.y;

              if (this.hasMatch())
                this.match.pos = clampPos(this.match.pos, this.match.robotTeam);

              let x = this.hasMatch() ? this.match.x : 0;
              if (this.hasMatch() && this.match.robotTeam == "r")
                x = r.width - (fieldSize.x - x) * scale;
              else x *= scale;
              this.ePreAutoRobotPos.style.left = x + "px";

              let y = this.hasMatch() ? this.match.y : 0;
              y *= scale;
              this.ePreAutoRobotPos.style.top = y + "px";

              this.ePreAutoRobotPos.style.width =
                this.ePreAutoRobotPos.style.height = size * scale + "px";
              this.ePreAutoRobotPos.style.outline =
                "5px solid " +
                (this.hasMatch() && this.match.hasRobotTeam()
                  ? "var(--" + this.match.robotTeam + "4"
                  : "var(--a)");
            };
            ["match", "match.robotTeam", "match.pos.x", "match.pos.y"].forEach(
              (c) => this.addHandler("change-" + c, updateRobot),
            );
            new ResizeObserver(updateRobot).observe(this.ePreAutoField);
            const updateMenu = () => {
              this.ePreAutoRobotId.textContent =
                this.hasMatch() && this.match.hasRobot()
                  ? this.match.robot
                  : "None";
              this.ePreAutoPreloaded.checked =
                this.hasMatch() && this.match.preloaded;
              if (this.hasMatch() && this.match.robotTeam == "r")
                this.ePreAutoTeam.setAttribute("red", "");
              else this.ePreAutoTeam.removeAttribute("red");
              if (this.hasMatch() && this.match.robotTeam == "b")
                this.ePreAutoTeam.setAttribute("blue", "");
              else this.ePreAutoTeam.removeAttribute("blue");
              this.ePreAutoTeam.disabled =
                !this.hasMatch() || this.match.isNormal();
              this.ePreAutoStart.disabled =
                !this.hasMatch() ||
                !this.match.hasRobot() ||
                !this.match.hasRobotTeam();
            };
            [
              "match",
              "match.id",
              "match.robot",
              "match.robotTeam",
              "match.preloaded",
            ].forEach((c) => this.addHandler("change-" + c, updateMenu));
          },
          auto: () => {
            let pickup = -1;
            Object.defineProperty(state, "pickup", {
              get: () => pickup,
              set: (v) =>
                state.change(
                  "pickup",
                  pickup,
                  (pickup = Math.min(7, Math.max(-1, util.ensure(v, "int")))),
                ),
            });

            this.eAutoPickups.forEach((elem, i) => {
              elem.addEventListener("click", (e) => {
                state.pickup = i;
              });
            });
            const updatePickups = () => {
              this.eAutoPickups.forEach((elem, i) => {
                if (i == state.pickup) elem.classList.add("this");
                else elem.classList.remove("this");
              });
              state.updateButtons();
            };
            state.addHandler("change", updatePickups);
            const undo = (name) => {
              if (!this.hasMatch()) return;
              let last = null;
              this.match.autoFrames.frames.forEach((frame) => {
                if (frame.type != name) return;
                last = frame;
              });
              this.match.autoFrames.rem(last);
            };
            this.eAutoPickupSuccess.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              if (state.pickup < 0) return;
              this.match.autoFrames.add(
                new Match.Frame(util.getTime() - startTime, "pickup", {
                  at: state.pickup,
                  value: true,
                }),
              );
              state.pickup = -1;
            });
            this.eAutoPickupFail.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              if (state.pickup < 0) return;
              this.match.autoFrames.add(
                new Match.Frame(util.getTime() - startTime, "pickup", {
                  at: state.pickup,
                  value: false,
                }),
              );
              state.pickup = -1;
            });
            this.eAutoPickupCancel.addEventListener("click", (e) => {
              state.pickup = -1;
            });
            this.eAutoPickupUndo.addEventListener("click", (e) =>
              undo("pickup"),
            );
            this.eAutoSpeakerSuccess.addEventListener("click", (e) => {
              this.match.autoFrames.add(
                new Match.Frame(util.getTime() - startTime, "speaker", true),
              );
            });
            this.eAutoSpeakerFail.addEventListener("click", (e) => {
              this.match.autoFrames.add(
                new Match.Frame(util.getTime() - startTime, "speaker", false),
              );
            });
            this.eAutoSpeakerUndo.addEventListener("click", (e) =>
              undo("speaker"),
            );
            this.eAutoAmpSuccess.addEventListener("click", (e) => {
              this.match.autoFrames.add(
                new Match.Frame(util.getTime() - startTime, "amp", true),
              );
            });
            this.eAutoAmpFail.addEventListener("click", (e) => {
              this.match.autoFrames.add(
                new Match.Frame(util.getTime() - startTime, "amp", false),
              );
            });
            this.eAutoAmpUndo.addEventListener("click", (e) => undo("amp"));

            state.updateCount = () => {
              let pickup = [0, 0],
                speaker = [0, 0],
                amp = [0, 0];
              if (this.hasMatch())
                this.match.autoFrames.frames.forEach((frame) => {
                  if (frame.type == "pickup") pickup[+!frame.state.value]++;
                  if (frame.type == "speaker") speaker[+!frame.state]++;
                  if (frame.type == "amp") amp[+!frame.state]++;
                });
              [
                this.eAutoPickupSuccessCount.textContent,
                this.eAutoPickupFailCount.textContent,
              ] = pickup;
              [
                this.eAutoSpeakerSuccessCount.textContent,
                this.eAutoSpeakerFailCount.textContent,
              ] = speaker;
              [
                this.eAutoAmpSuccessCount.textContent,
                this.eAutoAmpFailCount.textContent,
              ] = amp;
            };
            ["match", "match.autoFrames.add", "match.autoFrames.rem"].forEach(
              (c) => this.addHandler("change-" + c, state.updateCount),
            );

            state.updateButtons = () => {
              this.eAutoSpeakerSuccess.disabled = this.eAutoDisabled.checked;
              this.eAutoSpeakerFail.disabled = this.eAutoDisabled.checked;
              this.eAutoAmpSuccess.disabled = this.eAutoDisabled.checked;
              this.eAutoAmpFail.disabled = this.eAutoDisabled.checked;
              this.eAutoPickupSuccess.disabled =
                this.eAutoDisabled.checked || state.pickup < 0;
              this.eAutoPickupFail.disabled =
                this.eAutoDisabled.checked || state.pickup < 0;
            };
            ["match.globalFrames.add", "match.globalFrames.rem"].forEach((c) =>
              this.addHandler("change-" + c, state.updateButtons),
            );

            const updateField = () => {
              if (this.hasMatch() && this.match.robotTeam == "r")
                this.eAutoPage.style.flexDirection = "row-reverse";
              else this.eAutoPage.style.flexDirection = "row-reverse";
              this.eAutoField.style.backgroundPosition =
                (this.hasMatch() && this.match.robotTeam == "r" ? 100 : 0) +
                "% 0%";
              this.eAutoField.style.transform =
                "scale(" +
                (this.flipX ? -1 : 1) +
                ", " +
                (this.flipY ? -1 : 1) +
                ")";
              this.eAutoField.style.setProperty(
                "--scale-x",
                this.flipX ? -1 : 1,
              );
              this.eAutoField.style.setProperty(
                "--scale-y",
                this.flipY ? -1 : 1,
              );
              let h = this.eAutoField.getBoundingClientRect().height;
              let scale = h / fieldSize.y;
              this.eAutoPickups.forEach((elem, i) => {
                let x = [fieldSize.x / 2 - 636.27 + 101.346, fieldSize.x / 2][
                  +(i >= 3)
                ];
                let y = [
                  (i) => fieldSize.y / 2 - (2 - i) * 144.78,
                  (i) => 75.2856 + (i - 3) * 167.64,
                ][+(i >= 3)](i);
                elem.style.top = y * scale + "px";
                elem.style.right =
                  this.hasMatch() && this.match.robotTeam == "r"
                    ? x * scale + "px"
                    : "calc(100% - " + (x * scale + "px)");
              });
              this.eAutoPickup.style.left = this.eAutoPickup.style.right = "";
              this.eAutoPickup.style[
                this.hasMatch() && this.match.robotTeam == "r"
                  ? "right"
                  : "left"
              ] = (fieldSize.x / 2 - 375) * scale + "px";
            };
            ["match", "match.robotTeam", "flipX", "flipY"].forEach((c) =>
              this.addHandler("change-" + c, updateField),
            );
            new ResizeObserver(updateField).observe(this.eAutoField);

            this.eAutoDisabled.addEventListener("change", (e) => {
              if (!this.hasMatch()) return;
              this.match.globalFrames.add(
                new Match.Frame(
                  util.getTime() - startTime,
                  "disable",
                  this.eAutoDisabled.checked,
                ),
              );
            });

            this.eAutoNext.addEventListener("click", (e) => {
              this.page = "teleop";
              if (!this.hasMatch()) return;
              if (this.match.hasTeleopTime()) return;
              this.match.teleopTime = util.getTime() - startTime;
            });

            updatePickups();
          },
          teleop: () => {
            let type = null;
            Object.defineProperty(state, "type", {
              get: () => type,
              set: (v) => state.change("type", type, (type = v)),
            });
            let pos = new V();
            Object.defineProperty(state, "pos", {
              get: () => pos,
              set: (v) => pos.set(v),
            });
            pos.addHandler("change", (c, f, t) =>
              state.change("pos." + c, f, t),
            );

            state.updateCount = () => {
              // let source = [0, 0], ground = [0, 0], speaker = [0, 0], amp = [0, 0], hoard = 0;
              let source = [0, 0],
                ground = [0, 0],
                speaker = [0, 0],
                amp = [0, 0],
                hoard = [0, 0];
              if (this.hasMatch())
                this.match.teleopFrames.frames.forEach((frame) => {
                  if (frame.type == "source") source[+!frame.state]++;
                  if (frame.type == "ground") ground[+!frame.state]++;
                  if (frame.type == "speaker") speaker[+!frame.state.value]++;
                  if (frame.type == "amp") amp[+!frame.state]++;
                  // if (frame.type == "hoard") hoard++;
                  if (frame.type == "hoard") hoard[+!frame.state]++;
                });
              [
                this.eTeleopPickupSourceSuccessCount.textContent,
                this.eTeleopPickupSourceFailCount.textContent,
              ] = source;
              [
                this.eTeleopPickupGroundSuccessCount.textContent,
                this.eTeleopPickupGroundFailCount.textContent,
              ] = ground;
              [
                this.eTeleopScoreSpeakerSuccessCount.textContent,
                this.eTeleopScoreSpeakerFailCount.textContent,
              ] = speaker;
              [
                this.eTeleopScoreAmpSuccessCount.textContent,
                this.eTeleopScoreAmpFailCount.textContent,
              ] = amp;
              // this.eTeleopHoardCount.textContent = hoard;
              [
                this.eTeleopHoardSuccessCount.textContent,
                this.eTeleopHoardFailCount.textContent,
              ] = hoard;
            };
            [
              "match",
              "match.teleopFrames.add",
              "match.teleopFrames.rem",
            ].forEach((c) => this.addHandler("change-" + c, state.updateCount));

            state.updateButtons = () => {
              this.eTeleopPickupSourceSuccess.disabled =
                this.eTeleopDisabled.checked;
              this.eTeleopPickupSourceFail.disabled =
                this.eTeleopDisabled.checked;
              this.eTeleopPickupGroundSuccess.disabled =
                this.eTeleopDisabled.checked;
              this.eTeleopPickupGroundFail.disabled =
                this.eTeleopDisabled.checked;
              this.eTeleopScoreSpeaker.disabled = this.eTeleopDisabled.checked;
              this.eTeleopScoreAmpSuccess.disabled =
                this.eTeleopDisabled.checked;
              this.eTeleopScoreAmpFail.disabled = this.eTeleopDisabled.checked;
              // this.eTeleopHoardAdd.disabled = this.eTeleopDisabled.checked;
              this.eTeleopHoardSuccess.disabled = this.eTeleopDisabled.checked;
              this.eTeleopHoardFail.disabled = this.eTeleopDisabled.checked;
            };
            ["match.globalFrames.add", "match.globalFrames.rem"].forEach((c) =>
              this.addHandler("change-" + c, state.updateButtons),
            );

            const undo = (name) => {
              if (!this.hasMatch()) return;
              let last = null;
              this.match.teleopFrames.frames.forEach((frame) => {
                if (frame.type != name) return;
                last = frame;
              });
              this.match.teleopFrames.rem(last);
            };

            this.eTeleopPickupSourceSuccess.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "source", true),
              );
            });
            this.eTeleopPickupSourceFail.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "source", false),
              );
            });
            this.eTeleopPickupSourceUndo.addEventListener("click", (e) =>
              undo("source"),
            );
            this.eTeleopPickupGroundSuccess.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "ground", true),
              );
            });
            this.eTeleopPickupGroundFail.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "ground", false),
              );
            });
            this.eTeleopPickupGroundUndo.addEventListener("click", (e) =>
              undo("ground"),
            );
            this.eTeleopScoreAmpSuccess.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "amp", true),
              );
            });
            this.eTeleopScoreAmpFail.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "amp", false),
              );
            });
            this.eTeleopScoreAmpUndo.addEventListener("click", (e) =>
              undo("amp"),
            );
            // this.eTeleopHoardAdd.addEventListener("click", e => {
            //     if (!this.hasMatch()) return;
            //     this.match.teleopFrames.add(new Match.Frame(util.getTime()-startTime, "hoard", null));
            // });
            // this.eTeleopHoardRem.addEventListener("click", e => undo("hoard"));
            this.eTeleopHoardSuccess.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "hoard", true),
              );
            });
            this.eTeleopHoardFail.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, "hoard", false),
              );
            });
            this.eTeleopHoardUndo.addEventListener("click", (e) =>
              undo("hoard"),
            );

            this.eTeleopScoreSpeaker.addEventListener("click", (e) => {
              state.type = "speaker";
            });
            this.eTeleopScoreSpeakerUndo.addEventListener("click", (e) =>
              undo("speaker"),
            );

            this.eTeleopDisabled.addEventListener("change", (e) => {
              if (!this.hasMatch()) return;
              this.match.globalFrames.add(
                new Match.Frame(
                  util.getTime() - startTime,
                  "disable",
                  this.eTeleopDisabled.checked,
                ),
              );
            });
            this.eTeleopNext.addEventListener("click", (e) => {
              this.page = "endgame";
            });

            this.eTeleopSuccess.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, state.type, {
                  at: state.pos.xy,
                  value: true,
                }),
              );
              state.type = null;
            });
            this.eTeleopFail.addEventListener("click", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(util.getTime() - startTime, state.type, {
                  at: state.pos.xy,
                  value: false,
                }),
              );
              state.type = null;
            });
            this.eTeleopCancel.addEventListener("click", (e) => {
              state.type = null;
            });

            this.eTeleopField.addEventListener("touchstart", (e) => {
              const mouseup = () => {
                document.body.removeEventListener("touchmove", mousemove);
                document.body.removeEventListener("touchend", mouseup);
              };
              const mousemove = (e) => {
                const r = this.eTeleopField.getBoundingClientRect();
                let scale = r.height / fieldSize.y;
                if (!this.hasMatch()) return;

                let x = e.changedTouches[0].pageX - r.left;
                if (this.flipX) x = r.width - x;
                if (this.match.robotTeam == "r")
                  x = fieldSize.x - (r.width - x) / scale;
                else x /= scale;
                state.pos.x = x;

                let y = e.changedTouches[0].pageY - r.top;
                if (this.flipY) y = r.height - y;
                y /= scale;
                state.pos.y = y;
              };
              mousemove(e);
              document.body.addEventListener("touchmove", mousemove);
              document.body.addEventListener("touchend", mouseup);
            });

            const updateField = () => {
              this.eTeleopField.style.backgroundPosition =
                (this.hasMatch() && this.match.robotTeam == "r" ? 100 : 0) +
                "% 0%";
              this.eTeleopField.style.transform =
                "scale(" +
                (this.flipX ? -1 : 1) +
                ", " +
                (this.flipY ? -1 : 1) +
                ")";
            };
            ["match", "match.robotTeam", "flipX", "flipY"].forEach((c) =>
              this.addHandler("change-" + c, updateField),
            );
            const updateRobot = () => {
              const r = this.eTeleopField.getBoundingClientRect();
              let scale = r.height / fieldSize.y;

              if (this.hasMatch()) {
                let x = state.pos.x;
                if (this.match.robotTeam == "r") x = fieldSize.x - x;
                x = Math.min(r.width / scale - size / 2, Math.max(size / 2, x));
                if (this.match.robotTeam == "r") x = fieldSize.x - x;
                state.pos.x = x;
                state.pos.y = Math.min(
                  fieldSize.y - size / 2,
                  Math.max(size / 2, state.pos.y),
                );
              }

              let x = state.pos.x;
              if (this.hasMatch() && this.match.robotTeam == "r")
                x = r.width - (fieldSize.x - x) * scale;
              else x *= scale;
              this.eTeleopRobot.style.left = x + "px";

              let y = state.pos.y;
              y *= scale;
              this.eTeleopRobot.style.top = y + "px";

              this.eTeleopRobot.style.width = this.eTeleopRobot.style.height =
                size * scale + "px";
              this.eTeleopRobot.style.outline =
                "5px solid " +
                (this.hasMatch() && this.match.hasRobotTeam()
                  ? "var(--" + this.match.robotTeam + "4"
                  : "var(--a)");
            };
            ["match", "match.robotTeam"].forEach((c) =>
              this.addHandler("change-" + c, updateRobot),
            );
            ["pos.x", "pos.y"].forEach((c) =>
              state.addHandler("change-" + c, updateRobot),
            );
            new ResizeObserver(updateRobot).observe(this.eTeleopField);
            state.addHandler("change-type", () => {
              let type = state.type;
              if (type) this.eTeleopModal.classList.add("this");
              else this.eTeleopModal.classList.remove("this");
              if (!type) return;
              if (type == "speaker") this.eTeleopModal.classList.add("field");
              else this.eTeleopModal.classList.remove("field");
              this.eTeleopType.textContent = {
                source: "Pickup: Source",
                ground: "Pickup: Ground",
                speaker: "Score: Speaker",
                amp: "Score: Amp",
              }[type];
            });
          },
          endgame: () => {
            this.eEndgamePos.addEventListener("input", (e) => {
              if (!this.hasMatch()) return;
              this.match.teleopFrames.add(
                new Match.Frame(
                  util.getTime() - startTime,
                  "climb",
                  parseInt(this.eEndgamePos.value),
                ),
              );
              updateMenu();
            });

            this.eEndgameTrapped.addEventListener("change", (e) => {
              if (!this.hasMatch()) return;
              this.match.endgameTrap = this.eEndgameTrapped.checked;
            });
            this.eEndgameHarmonied.addEventListener("change", (e) => {
              if (!this.hasMatch()) return;
              this.match.endgameHarmony = this.eEndgameHarmonied.checked;
            });

            this.eEndgameNext.addEventListener("click", (e) => {
              this.page = "notes";
              if (!this.hasMatch()) return;
              if (this.match.hasFinishTime()) return;
              this.match.finishTime = util.getTime() - startTime;
            });

            const updateMenu = () => {
              let pos = 0;
              if (this.hasMatch())
                this.match.teleopFrames.frames.forEach((frame) => {
                  if (frame.type != "climb") return;
                  pos = frame.state;
                });
              this.eEndgamePos.value = pos;
              this.eEndgamePosSelectors.forEach((elem, i) => {
                if (i == pos) elem.classList.add("this");
                else elem.classList.remove("this");
              });
              this.eEndgameHarmonied.disabled = pos < 2;
              this.eEndgameTrapped.checked =
                this.hasMatch() && this.match.endgameTrap;
              this.eEndgameHarmonied.checked =
                this.hasMatch() && this.match.endgameHarmony;
            };
            [
              "match",
              "match.teleopFrames.add",
              "match.teleopFrames.rem",
              "match.endgameTrap",
              "match.endgameHarmony",
            ].forEach((c) => this.addHandler("change-" + c, updateMenu));
          },
          notes: () => {
            this.eNotesNotes.addEventListener("input", (e) => {
              if (!this.hasMatch()) return;
              this.match.notes = this.eNotesNotes.value;
            });
            let n = 0;
            this.eNotesNotes.addEventListener("blur", (e) => (n = 0));
            this.eNotesNotes.addEventListener("click", (e) => {
              if (document.activeElement != this.eNotesNotes) return;
              n++;
              if (n < 2) return;
              document.activeElement.blur();
            });
            this.eNotesNext.addEventListener("click", (e) => {
              this.page = "finish";
            });
          },
          finish: () => {
            this.eFinishNext.addEventListener("click", (e) => {
              this.match = null;
              this.page = "navigator";
            });
            this.eFinishReset.addEventListener("click", async (e) => {
              this.ePrompt.classList.add("this");
              let clear = await new Promise((res, rej) => {
                this.ePromptTitle.textContent = "Are you sure?";
                this.ePromptInput.style.display = "none";
                this.ePromptButtons.style.display = "";
                const onFinish = () => {
                  this.ePrompt.classList.remove("this");
                  this.ePromptClose.removeEventListener("click", onClose);
                  this.ePromptYes.removeEventListener("click", onYes);
                  this.ePromptNo.removeEventListener("click", onNo);
                };
                const onClose = () => {
                  res(false);
                  onFinish();
                };
                const onYes = () => {
                  res(true);
                  onFinish();
                };
                const onNo = () => {
                  res(false);
                  onFinish();
                };
                this.ePromptClose.addEventListener("click", onClose);
                this.ePromptYes.addEventListener("click", onYes);
                this.ePromptNo.addEventListener("click", onNo);
              });
              if (!clear) return;
              if (this.hasMatch()) this.match.reset();
              this.match = null;
              this.page = "navigator";
            });

            new ResizeObserver(() => {
              const r = this.eFinishCodeBox.getBoundingClientRect();
              this.eFinishCode.style.width = this.eFinishCode.style.height =
                Math.min(r.width - 40, r.height - 40) + "px";
            }).observe(this.eFinishCodeBox);
          },
        };
        if (id in idfs) idfs[id]();
      }

      const updateMenu = () => {
        if (this.hasMatch() && startTime == null)
          this.eTime.classList.remove("time");
        else this.eTime.classList.add("time");
      };
      ["match", "match.startTime"].forEach((c) =>
        this.addHandler("change-" + c, updateMenu),
      );

      this.addHandler("update", (delta) => {
        pwd = localStorage.getItem("pwd");
        this.eTime.textContent = this.hasMatch()
          ? startTime != null
            ? util.formatTime(
                this.match.hasFinishTime()
                  ? this.match.finishTime
                  : util.getTime() - startTime,
              )
            : "Pre-Match"
          : "";
        let able = [true, true];
        let pagefs = {
          settings: () => [false, true],
          navigator: () => [true, this.hasMatch()],
          preauto: () => [true, !this.ePreAutoStart.disabled],
          auto: () => [true, true],
          teleop: () => [true, true],
          endgame: () => [true, true],
          notes: () => [true, true],
          finish: () => [true, false],
        };
        if (this.page in pagefs) able = pagefs[this.page]();
        if (this.eBack.disabled == able[0]) this.eBack.disabled = !able[0];
        if (this.eForward.disabled == able[1])
          this.eForward.disabled = !able[1];
      });

      this.addHandler("change-page", (f, t) => {
        pull();

        this.eScreen.style.display = this.eReload.style.display =
          this.page == "settings" ? "" : "none";

        let state = states[this.page];

        let pagefs = {
          settings: () => {
            if (util.is(state.userPwd, "str")) {
              const userPwd = hashStr(state.userPwd);
              delete state.userPwd;
              const correctPwd = 750852430;
              if (userPwd != correctPwd) return (this.page = "navigator");
            } else {
              this.ePrompt.classList.add("this");
              this.ePromptTitle.textContent = "Admin Password";
              this.ePromptInput.style.display = "";
              this.ePromptInput.value = "";
              this.ePromptInput.type = "password";
              this.ePromptInput.placeholder = "...";
              this.ePromptButtons.style.display = "none";
              const onFinish = () => {
                this.ePrompt.classList.remove("this");
                this.ePromptClose.removeEventListener("click", onClose);
                this.ePromptInput.removeEventListener("change", onSubmit);
              };
              const onClose = () => {
                onFinish();
              };
              const onSubmit = () => {
                onFinish();
                state.userPwd = this.ePromptInput.value;
                this.page = "settings";
              };
              this.ePromptClose.addEventListener("click", onClose);
              this.ePromptInput.addEventListener("change", onSubmit);
              return (this.page = "navigator");
            }

            // this.eSettingFlippedX.checked = this.flipX;
            // this.eSettingFlippedY.checked = this.flipY;
            this.eSettingLeftRed.checked = this.leftRed;
          },
          navigator: () => {
            startTime = null;
            this.match = null;
          },
          preauto: () => {
            this.ePreAutoRobot.disabled =
              this.hasMatch() && this.match.isNormal();
            this.ePreAutoRobotDropdown.innerHTML = "";
            let robots = teams
              .map((team) => team.team_number)
              .sort((a, b) => a - b);
            robots.forEach((id) => {
              let btn = document.createElement("button");
              this.ePreAutoRobotDropdown.appendChild(btn);
              let elem = document.createElement("h1");
              btn.appendChild(elem);
              elem.textContent = id;
              btn.addEventListener("click", (e) => {
                if (!this.hasMatch()) return;
                if (this.match.isNormal()) return;
                this.match.robot = id;
              });
            });
          },
          auto: () => {
            this.eAutoDisabled.checked = false;
            if (this.hasMatch())
              this.match.globalFrames.frames.forEach((frame) => {
                if (frame.type != "disable") return;
                this.eAutoDisabled.checked = frame.state;
              });
            state.updateCount();
          },
          teleop: () => {
            this.eTeleopDisabled.checked = false;
            if (this.hasMatch())
              this.match.globalFrames.frames.forEach((frame) => {
                if (frame.type != "disable") return;
                this.eTeleopDisabled.checked = frame.state;
              });
            state.updateCount();
            state.updateButtons();
          },
          endgame: () => {},
          notes: () => {
            this.eNotesNotes.value = this.hasMatch() ? this.match.notes : "";
          },
          finish: () => {
            let data = this.hasMatch()
              ? this.match.toBufferStr(this.scouter)
              : "NO_MATCH_ERR";
            // console.log(data);
            // console.log(Match.fromBufferStr(data));
            new QRious({
              element: this.eFinishCodeCanvas,
              value: data,
              size: 1000,
            });
          },
        };
        if (this.page in pagefs) pagefs[this.page]();
      });

      this.#matches = [];
      this.#match = null;

      this.eBack.addEventListener("click", (e) => {
        let pagefs = {
          navigator: () => {
            this.page = "settings";
          },
          preauto: () => {
            this.page = "navigator";
          },
          auto: () => {
            this.page = "preauto";
          },
          teleop: () => {
            this.page = "auto";
          },
          endgame: () => {
            this.page = "teleop";
          },
          notes: () => {
            this.page = "endgame";
          },
          finish: () => {
            this.page = "notes";
          },
        };
        if (this.page in pagefs) pagefs[this.page]();
      });
      this.eForward.addEventListener("click", (e) => {
        let pagefs = {
          settings: () => {
            this.page = "navigator";
          },
          navigator: () => {
            this.page = "preauto";
          },
          preauto: () => {
            this.page = "auto";
          },
          auto: () => {
            this.page = "teleop";
          },
          teleop: () => {
            this.page = "endgame";
          },
          endgame: () => {
            this.page = "notes";
          },
          notes: () => {
            this.page = "finish";
          },
        };
        if (this.page in pagefs) pagefs[this.page]();
      });

      this.loadId();
      this.loadScouter();
      this.loadFlip();

      this.page = "navigator";

      pull();
    });
  }

  start() {
    this.post("start");
  }

  setup() {
    this.post("setup");
  }

  update(delta) {
    this.post("update", delta);
  }

  get page() {
    return this.#page;
  }
  set page(v) {
    v = String(v);
    if (!(v in this.pages)) return;
    this.change("page", this.page, (this.#page = v));
    for (let id in this.pages) {
      if (id == this.page) this.pages[id].classList.add("this");
      else this.pages[id].classList.remove("this");
    }
  }

  get id() {
    return this.#id;
  }
  set id(v) {
    v = util.ensure(v, "int");
    if (this.id == v) return;
    this.change("id", this.id, (this.#id = v));
    this.eId.textContent = this.id;
    this.saveId();
    this.updateMatches();
  }
  loadId() {
    let id = null;
    try {
      id = JSON.parse(localStorage.getItem("id"));
    } catch (e) {}
    console.log("load id", id);
    this.id = id || 1;
  }
  saveId() {
    console.log("save id", this.id);
    localStorage.setItem("id", JSON.stringify(this.id));
  }

  get scouter() {
    return this.#scouter;
  }
  set scouter(v) {
    v = util.ensure(v, "str");
    if (this.scouter == v) return;
    this.change("scouter", this.scouter, (this.#scouter = v));
    this.saveScouter();
  }
  loadScouter() {
    let scouter = null;
    try {
      scouter = JSON.parse(localStorage.getItem("scouter"));
    } catch (e) {}
    console.log("load scouter", scouter);
    this.scouter = util.ensure(scouter, "str");
  }
  saveScouter() {
    console.log("save scouter", this.scouter);
    localStorage.setItem("scouter", JSON.stringify(this.scouter));
  }

  get flipX() {
    return this.#flipX;
  }
  set flipX(v) {
    v = !!v;
    if (this.flipX == v) return;
    this.change("flipX", this.flipX, (this.#flipX = v));
    this.saveFlip();
  }
  get flipY() {
    return this.#flipY;
  }
  set flipY(v) {
    v = !!v;
    if (this.flipY == v) return;
    this.change("flipY", this.flipY, (this.#flipY = v));
    this.saveFlip();
  }
  loadFlip() {
    let flipX = null;
    try {
      flipX = JSON.parse(localStorage.getItem("flipX"));
    } catch (e) {}
    let flipY = null;
    try {
      flipY = JSON.parse(localStorage.getItem("flipY"));
    } catch (e) {}
    console.log("load flip", flipX, flipY);
    this.flipX = flipX;
    this.flipY = flipY;
  }
  saveFlip() {
    console.log("save flip", this.flipX, this.flipY);
    localStorage.setItem("flipX", JSON.stringify(this.flipX));
    localStorage.setItem("flipY", JSON.stringify(this.flipY));
  }
  get leftRed() {
    return this.flipX && this.flipY;
  }
  set leftRed(v) {
    this.flipX = this.flipY = !!v;
  }
  get leftBlue() {
    return !this.flipX && !this.flipY;
  }
  set leftBlue(v) {
    this.flipX = this.flipY = !v;
  }

  get matches() {
    return this.#matches;
  }
  set matches(v) {
    v = util.ensure(v, "arr");
    this.clearMatches();
    this.addMatch(v);
  }
  clearMatches() {
    let matches = this.matches;
    this.remMatch(matches);
    return matches;
  }
  hasMatch(match) {
    if (arguments.length == 0) return !!this.match;
    if (!(match instanceof App.Match)) return false;
    return this.#matches.includes(match);
  }
  addMatch(...matches) {
    let r = util.Target.resultingForEach(matches, (match) => {
      if (!(match instanceof App.Match)) return false;
      if (this.hasMatch(match)) return false;
      this.#matches.push(match);
      // console.log(match.match.id);
      if (!match.match.isPractice())
        this.eNavigatorList.appendChild(match.eListItem);
      match.addLinkedHandler(this, "trigger", (e) => {
        this.match = match.match;
        if (this.match.hasFinishTime()) this.page = "finish";
        else this.page = "preauto";
      });
      this.change("addMatch", null, match);
      return match;
    });
    this.updateMatches();
    return r;
  }
  remMatch(...matches) {
    let r = util.Target.resultingForEach(matches, (match) => {
      if (!(match instanceof App.Match)) return false;
      if (!this.hasMatch(match)) return false;
      this.#matches.splice(this.#matches.indexOf(match), 1);
      // console.log(match.match.id);
      if (!match.match.isPractice())
        this.eNavigatorList.removeChild(match.eListItem);
      match.clearLinkedHandlers(this, "trigger");
      this.change("remMatch", match, null);
      return match;
    });
    this.updateMatches();
    return r;
  }
  updateMatches(reset = false) {
    let matchesScouted = null;
    try {
      matchesScouted = JSON.parse(localStorage.getItem("_matches-scouted"));
    } catch (e) {}
    matchesScouted = util.ensure(matchesScouted, "obj");
    this.matches.forEach((match) => {
      if (match.match.id in matchesScouted) {
        console.log(
          "*** loading " + match.match.id + " from LS",
          matchesScouted[match.match.id],
        );
        match.match.fromObj(matchesScouted[match.match.id]);
      } else if (reset) match.match.reset();
      if (!match.match.isNormal()) return;
      match.match.robot =
        this.id > 0 && this.id <= 3
          ? match.red[this.id - 1]
          : this.id > 3 && this.id <= 6
          ? match.blue[this.id - 4]
          : null;
    });
  }

  get match() {
    return this.#match;
  }
  set match(v) {
    v = v instanceof Match ? v : null;
    if (this.match == v) return;
    const update = () => {
      this.eMatch.innerHTML = "";
      if (!this.hasMatch()) return;
      this.eMatch.appendChild(
        document.createTextNode(
          this.match.isPractice()
            ? "Practice"
            : this.match.isElim()
            ? "E" + this.match.elimId
            : "Q" + this.match.id,
        ),
      );
      this.eMatch.appendChild(document.createElement("span"));
      if (this.match.hasRobot()) {
        this.eMatch.lastChild.textContent = "@";
        this.eMatch.appendChild(document.createTextNode(this.match.robot));
      }
    };
    if (this.hasMatch()) this.match.clearLinkedHandlers(this, "change");
    this.change("match", this.match, (this.#match = v));
    if (this.hasMatch()) {
      this.match.addLinkedHandler(this, "change", (c, f, t) => {
        update();
        let matchesScouted = null;
        try {
          matchesScouted = JSON.parse(localStorage.getItem("_matches-scouted"));
        } catch (e) {}
        matchesScouted = util.ensure(matchesScouted, "obj");
        matchesScouted[this.match.id] = this.match.toObj(this.scouter);
        console.log(
          "*** dumping " + this.match.id + " to LS",
          matchesScouted[this.match.id],
        );
        localStorage.setItem(
          "_matches-scouted",
          JSON.stringify(matchesScouted),
        );
        this.change("match." + c, f, t);
      });
    }
    update();
  }
}
App.Match = class AppMatch extends util.Target {
  #red;
  #blue;

  #match;

  constructor(id, red, blue, robot) {
    super();

    this.eListItem = document.createElement("button");
    this.eListItem.addEventListener("click", (e) => this.post("trigger", e));

    this.eItemId = document.createElement("h1");
    this.eListItem.appendChild(this.eItemId);
    this.eItemId.classList.add("id");

    this.eItemTeams = document.createElement("div");
    this.eListItem.appendChild(this.eItemTeams);
    this.eItemTeams.classList.add("teams");

    this.eItemRed = document.createElement("div");
    this.eItemTeams.appendChild(this.eItemRed);
    this.eItemRed.classList.add("red");

    this.eItemBlue = document.createElement("div");
    this.eItemTeams.appendChild(this.eItemBlue);
    this.eItemBlue.classList.add("blue");

    this.#red = [];
    this.#blue = [];

    this.#match = new Match(id, robot);
    this.match.addHandler("change", (c, f, t) =>
      this.change("match." + c, f, t),
    );

    this.red = red;
    this.blue = blue;

    let ignore = false;
    const apply = () => {
      if (ignore) return;

      this.eListItem.style.opacity = this.match.hasFinishTime() ? "50%" : "";

      this.eItemId.textContent = this.match.isPractice()
        ? "Practice Match"
        : this.match.isElim()
        ? "Elim Match #" + this.match.elimId
        : this.match.id;
      this.eItemId.style.textAlign = !this.match.isNormal() ? "center" : "";
      this.eItemTeams.style.display = !this.match.isNormal() ? "none" : "";

      if (this.match.isNormal()) {
        ignore = true;

        if (!this.hasRed(this.match.robot) && !this.hasBlue(this.match.robot))
          this.match.robot = null;
        this.match.robotTeam = this.hasRed(this.match.robot)
          ? "r"
          : this.hasBlue(this.match.robot)
          ? "b"
          : null;

        ignore = false;
      }

      this.formatRed();
      this.formatBlue();
    };
    this.addHandler("change", apply);
    apply();
  }

  get red() {
    return [...this.#red];
  }
  set red(v) {
    v = util.ensure(v, "arr");
    this.clearRed();
    this.addRed(v);
  }
  clearRed() {
    let red = this.red;
    this.remRed(red);
    return red;
  }
  hasRed(v) {
    v = Math.max(1, util.ensure(v, "int"));
    return this.#red.includes(v);
  }
  formatRed() {
    this.eItemRed.innerHTML = "";
    this.red.forEach((v) => {
      let elem = document.createElement("h1");
      this.eItemRed.appendChild(elem);
      elem.textContent = v;
      if (v == this.match.robot) elem.classList.add("this");
    });
  }
  addRed(...v) {
    let r = util.Target.resultingForEach(v, (v) => {
      if (!this.match.isNormal()) return false;
      v = Math.max(1, util.ensure(v, "int"));
      if (this.hasRed(v)) return false;
      this.#red.push(v);
      this.change("addRed", null, v);
      return v;
    });
    this.formatRed();
    return r;
  }
  remRed(...v) {
    let r = util.Target.resultingForEach(v, (v) => {
      v = Math.max(1, util.ensure(v, "int"));
      if (!this.hasRed(v)) return false;
      this.#red.splice(this.#red.indexOf(v), 1);
      this.change("remRed", v, null);
      return v;
    });
    this.formatRed();
    return r;
  }
  get blue() {
    return [...this.#blue];
  }
  set blue(v) {
    v = util.ensure(v, "arr");
    this.clearBlue();
    this.addBlue(v);
  }
  clearBlue() {
    let blue = this.blue;
    this.remBlue(blue);
    return blue;
  }
  hasBlue(v) {
    v = Math.max(1, util.ensure(v, "int"));
    return this.#blue.includes(v);
  }
  formatBlue() {
    this.eItemBlue.innerHTML = "";
    this.blue.forEach((v) => {
      let elem = document.createElement("h1");
      this.eItemBlue.appendChild(elem);
      elem.textContent = v;
      if (v == this.match.robot) elem.classList.add("this");
    });
  }
  addBlue(...v) {
    let r = util.Target.resultingForEach(v, (v) => {
      if (!this.match.isNormal()) return false;
      v = Math.max(1, util.ensure(v, "int"));
      if (this.hasBlue(v)) return false;
      this.#blue.push(v);
      this.change("addBlue", null, v);
      return v;
    });
    this.formatBlue();
    return r;
  }
  remBlue(...v) {
    let r = util.Target.resultingForEach(v, (v) => {
      v = Math.max(1, util.ensure(v, "int"));
      if (!this.hasBlue(v)) return false;
      this.#blue.splice(this.#blue.indexOf(v), 1);
      this.change("remBlue", v, null);
      return v;
    });
    this.formatBlue();
    return r;
  }

  get match() {
    return this.#match;
  }
};
