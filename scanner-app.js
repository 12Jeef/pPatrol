import * as util from "./util.js";
import { V } from "./util.js";

import { Match } from "./data.js";

export default class App extends util.Target {
    #scanner;

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
                    if (t0 == null) return t0 = t1;
                    this.update(t1-t0);
                    t0 = t1;
                };
                update();
            }, 10);
        });

        this.addHandler("setup", async () => {
            let pwd = localStorage.getItem("pwd");
            if (pwd == null) {
                let v = prompt("Password:");
                if (v != null) localStorage.setItem("pwd", pwd = (v.length <= 0) ? null : v);
            }

            this.addHandler("update", delta => (pwd => localStorage.getItem("pwd")));

            this.#scanner = new Html5Qrcode("feed");

            this.ePwdEdit = document.getElementById("pwd-edit");
            this.ePwdEdit.addEventListener("click", e => {
                let v = prompt("Password:");
                if (v == null) return;
                if (v.length <= 0) v = null;
                localStorage.setItem("pwd", pwd = v);
            });

            this.ePrompt = document.getElementById("prompt");
            this.eMessage = document.getElementById("message");
            this.eContent = document.getElementById("content");
            this.eFinish = document.getElementById("finish");
            this.eFinish.addEventListener("click", e => {
                this.startScanning();
                this.ePrompt.classList.remove("this");
            });

            await this.scanner.start(
                { facingMode: "environment" },
                {
                    fps: 10,
                },
                async text => {
                    this.stopScanning();
                    this.ePrompt.classList.add("this");
                    let data = Match.fromBufferStr(text);
                    this.eFinish.disabled = true;
                    try {
                        let resp;
                        resp = await fetch("https://ppatrol.pythonanywhere.com/data/eventKey", {
                            method: "GET",
                            mode: "cors",
                            headers: {
                                "Password": pwd,
                            },
                        });
                        if (resp.status != 200) throw resp.status;
                        resp = await resp.text();
                        const eventKey = JSON.parse(resp);
                        resp = await fetch("https://ppatrol.pythonanywhere.com/data/"+eventKey+"/matches/"+util.getTime(), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "Password": pwd,
                            },
                            body: JSON.stringify({
                                v: data,
                            }),
                        });
                        if (resp.status != 200) throw resp.status;
                        console.log(await resp.text());
                    } catch (e) {
                        this.eContent.textContent = util.stringifyError(e);
                        this.eFinish.disabled = false;
                        return;
                    }
                    let textData = JSON.stringify(data, null, "  ");
                    this.eContent.textContent = textData;
                    this.eFinish.disabled = false;
                },
                () => {},
            );

            this.startScanning();
            this.ePrompt.classList.remove("this");
        });
    }

    start() { this.post("start"); }

    setup() { this.post("setup"); }

    update(delta) { this.post("update", delta); }

    get scanner() { return this.#scanner; }

    async startScanning() {
        return await this.scanner.resume();
    }
    async stopScanning() {
        return await this.scanner.pause(true);
    }
}
